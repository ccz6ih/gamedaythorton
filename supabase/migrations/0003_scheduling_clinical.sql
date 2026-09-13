-- ===========================================================================
-- 0003_scheduling_clinical
-- Appointments, inventory, and both clinical models:
--   labs + protocols + check-ins   (men's health)
--   treatment records + areas      (med spa)
--
-- A clinic sees only the modules its practice_type turns on, but both models
-- live in one schema so a practice that does both is not a special case.
-- ===========================================================================

create extension if not exists "btree_gist";

-- -------------------------------------------------------- appointment ----

create table appointment (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  clinic_id        uuid not null references clinic(id) on delete cascade,

  patient_id       uuid not null references patient(id) on delete cascade,
  provider_id      uuid references provider(id) on delete set null,
  service_id       uuid references service(id) on delete set null,

  starts_at        timestamptz not null,
  duration_min     int not null check (duration_min > 0),
  buffer_min       int not null default 0 check (buffer_min >= 0),

  -- Maintained by a trigger, not a generated column: adding an interval to a
  -- timestamptz is STABLE rather than IMMUTABLE (the result depends on the
  -- session timezone across DST boundaries), and Postgres will not accept a
  -- stable expression in a stored generated column.
  ends_at          timestamptz not null default now(),
  -- Appointment end plus turnaround. A 120-minute lash set cannot be followed
  -- immediately by the next one, and the calendar has to know that.
  blocks_until     timestamptz not null default now(),

  status           appointment_status not null default 'booked',
  room             text,
  booking_channel  text,

  -- PHI. "ED consult" attached to a named person is a diagnosis disclosure,
  -- which is why this never appears in a notification, a calendar invite, or a
  -- payment descriptor. docs/05-data-model.md.
  reason_code      text,
  notes            text,

  intake_complete  boolean not null default false,
  deposit_payment_id uuid,        -- FK added in 0004, after payment exists
  created_by       uuid references staff_user(id) on delete set null,
  cancelled_at     timestamptz,
  cancel_reason    text,
  synthetic        boolean not null default false,

  -- No appointment in the past century or the next one. Catches a date-parsing
  -- bug at write time instead of as an empty calendar nobody can explain.
  constraint appointment_sane_date check (starts_at > '2020-01-01'::timestamptz
                                      and starts_at < '2100-01-01'::timestamptz)
);

-- Keeps ends_at / blocks_until in step with starts_at, duration and buffer so
-- the calendar and the double-booking constraint always agree with each other.
create or replace function app.appointment_times()
returns trigger
language plpgsql
as $$
begin
  new.ends_at := new.starts_at + make_interval(mins => new.duration_min);
  new.blocks_until := new.starts_at + make_interval(mins => new.duration_min + coalesce(new.buffer_min, 0));
  return new;
end;
$$;

create trigger appointment_times_trg
  before insert or update of starts_at, duration_min, buffer_min on appointment
  for each row execute function app.appointment_times();

create index appointment_clinic_start_idx on appointment (clinic_id, starts_at);
create index appointment_patient_idx on appointment (patient_id, starts_at desc);
create index appointment_provider_idx on appointment (provider_id, starts_at);
create index appointment_status_idx on appointment (clinic_id, status, starts_at);

-- Double-booking prevented in the database, not in application code. An app
-- level check races with itself the moment two people book at once, and the
-- failure is a real person standing in a waiting room.
alter table appointment
  add constraint appointment_no_double_book
  exclude using gist (
    provider_id with =,
    tstzrange(starts_at, blocks_until) with &&
  )
  where (status in ('booked', 'confirmed', 'arrived') and provider_id is not null);

select app.add_touch('appointment');
select app.standard_policies('appointment', 'patient_id', true);

create policy appointment_patient_update on appointment
  for update to authenticated
  using (app.is_own_patient(patient_id))
  with check (app.is_own_patient(patient_id));

-- Deferred FK from 0002.
alter table intake_submission
  add constraint intake_submission_appointment_fkey
  foreign key (appointment_id) references appointment(id) on delete set null;

-- ------------------------------------------------------------ waitlist ----

create table waitlist (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  clinic_id        uuid not null references clinic(id) on delete cascade,
  patient_id       uuid not null references patient(id) on delete cascade,
  service_id       uuid references service(id) on delete set null,

  preferred_window text,
  earliest         date,
  latest           date,
  status           text not null default 'waiting',
  offered_at       timestamptz,
  offered_appointment_id uuid references appointment(id) on delete set null,
  synthetic        boolean not null default false
);

create index waitlist_clinic_idx on waitlist (clinic_id, status);
select app.add_touch('waitlist');
select app.standard_policies('waitlist', 'patient_id', true);

-- -------------------------------------------------------- blocked_time ----
-- Holidays, lunch, a provider's afternoon off. Anything that removes
-- availability without being an appointment.

create table blocked_time (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  clinic_id    uuid not null references clinic(id) on delete cascade,
  provider_id  uuid references provider(id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  reason       text,
  check (ends_at > starts_at)
);

create index blocked_time_clinic_idx on blocked_time (clinic_id, starts_at);
select app.standard_policies('blocked_time');

-- ------------------------------------------------------------ inventory ----
-- Before the clinical tables, because a treatment record consumes a lot and the
-- FK has to exist. Testosterone is Schedule III and injectable neurotoxin is
-- lot-tracked by the manufacturer; both have real record-keeping obligations.

create table inventory_item (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  clinic_id          uuid not null references clinic(id) on delete cascade,

  name               text not null,
  category           text,
  is_controlled      boolean not null default false,
  schedule           text,
  unit               text not null default 'vial',
  unit_label         text,          -- 'unit' for neurotoxin, so units reconcile
  units_per_container numeric(10,2),
  reorder_threshold  numeric(10,2) not null default 0,
  active             boolean not null default true,

  unique (clinic_id, name)
);

select app.add_touch('inventory_item');
select app.standard_policies('inventory_item');

create table inventory_lot (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  clinic_id      uuid not null references clinic(id) on delete cascade,
  item_id        uuid not null references inventory_item(id) on delete cascade,

  lot_number     text not null,
  expiry_date    date,
  qty_received   numeric(10,2) not null default 0,
  qty_remaining  numeric(10,2) not null default 0,
  received_at    date,
  unique (item_id, lot_number)
);

create index inventory_lot_item_idx on inventory_lot (item_id) where qty_remaining > 0;
create index inventory_lot_expiry_idx on inventory_lot (clinic_id, expiry_date);
select app.add_touch('inventory_lot');
select app.standard_policies('inventory_lot');

create table inventory_transaction (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  clinic_id     uuid not null references clinic(id) on delete cascade,
  lot_id        uuid not null references inventory_lot(id) on delete cascade,

  type          inventory_txn_type not null,
  qty           numeric(10,2) not null,
  patient_id    uuid references patient(id) on delete set null,
  performed_by  uuid references staff_user(id) on delete set null,
  witness_id    uuid references staff_user(id) on delete set null,
  occurred_at   timestamptz not null default now(),
  note          text,
  synthetic     boolean not null default false
);

create index inventory_txn_lot_idx on inventory_transaction (lot_id, occurred_at desc);
select app.standard_policies('inventory_transaction');

-- ============================ men's health clinical =======================

-- --------------------------------------------------------------- analyte ----
-- Clinic-scoped: every practice optimises toward different targets, and using
-- one global range is how a patient panics over a value his provider is happy
-- with. Reference range and target range are different things.

create table analyte (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  clinic_id     uuid not null references clinic(id) on delete cascade,

  key           text not null,
  label         text not null,
  unit          text not null,
  ref_low       numeric(10,3),
  ref_high      numeric(10,3),
  target_low    numeric(10,3),
  target_high   numeric(10,3),
  ceiling       numeric(10,3),        -- hard safety ceiling, e.g. hematocrit 52
  higher_better boolean,
  is_safety     boolean not null default false,

  -- Every range in the pilot is invented. A provider who spots an assumed
  -- threshold presented as fact loses confidence in the whole system, so this
  -- flag drives a visible marker in the UI. docs/11-discovery-questions.md §3.
  provisional   boolean not null default true,
  sort_order    int not null default 0,
  active        boolean not null default true,

  unique (clinic_id, key)
);

select app.add_touch('analyte');
select app.standard_policies('analyte', null, false, true);

-- ------------------------------------------------------------- lab_panel ----

create table lab_panel (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  clinic_id     uuid not null references clinic(id) on delete cascade,
  patient_id    uuid not null references patient(id) on delete cascade,

  drawn_at      date not null,
  source        text not null default 'in_clinic',
  entered_by    uuid references staff_user(id) on delete set null,
  document_path text,                -- private storage object, signed URLs only
  note          text,
  synthetic     boolean not null default false
);

create index lab_panel_patient_idx on lab_panel (patient_id, drawn_at);
select app.add_touch('lab_panel');
select app.standard_policies('lab_panel', 'patient_id');

-- ------------------------------------------------------------ lab_result ----

create table lab_result (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  clinic_id     uuid not null references clinic(id) on delete cascade,
  panel_id      uuid not null references lab_panel(id) on delete cascade,
  patient_id    uuid not null references patient(id) on delete cascade,

  analyte_key   text not null,
  value_numeric numeric(12,3),
  value_text    text,
  unit          text,

  -- Ranges are SNAPSHOT onto the result, not read live from analyte. If the
  -- clinic revises a target range next year, last year's flags must not
  -- silently change underneath a chart the patient has already been shown.
  ref_low       numeric(10,3),
  ref_high      numeric(10,3),
  target_low    numeric(10,3),
  target_high   numeric(10,3),
  flag          lab_flag,
  provisional_ranges boolean not null default true,
  synthetic     boolean not null default false,

  unique (panel_id, analyte_key)
);

create index lab_result_patient_analyte_idx on lab_result (patient_id, analyte_key);
select app.standard_policies('lab_result', 'patient_id');

-- -------------------------------------------------------------- protocol ----
-- HARD RULE: this records what a licensed provider decided elsewhere. It is not
-- a prescribing system. No pharmacy transmission, ever. Testosterone is
-- Schedule III. docs/06-architecture.md rule 3.

create table protocol (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  clinic_id   uuid not null references clinic(id) on delete cascade,
  patient_id  uuid not null references patient(id) on delete cascade,

  status      text not null default 'active',
  started_at  date,
  ended_at    date,
  synthetic   boolean not null default false
);

create index protocol_patient_idx on protocol (patient_id);
select app.add_touch('protocol');
select app.standard_policies('protocol', 'patient_id');

create table protocol_item (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  clinic_id       uuid not null references clinic(id) on delete cascade,
  protocol_id     uuid not null references protocol(id) on delete cascade,
  patient_id      uuid not null references patient(id) on delete cascade,

  medication_name text not null,
  dose_amount     numeric(10,3),
  dose_unit       text,
  route           text,
  frequency       text,
  notes           text,
  sort_order      int not null default 0
);

create index protocol_item_protocol_idx on protocol_item (protocol_id);
select app.standard_policies('protocol_item', 'patient_id');

create table protocol_change (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  clinic_id             uuid not null references clinic(id) on delete cascade,
  protocol_id           uuid references protocol(id) on delete cascade,
  patient_id            uuid not null references patient(id) on delete cascade,

  changed_at            date not null,
  changed_by            uuid references staff_user(id) on delete set null,
  field                 text,
  old_value             text,
  new_value             text,

  -- Two reasons on purpose. The clinical note stays internal; the plain-language
  -- one publishes to the patient's app. Never show a patient a raw clinical note.
  reason_clinical       text,
  reason_patient_facing text,
  synthetic             boolean not null default false
);

create index protocol_change_patient_idx on protocol_change (patient_id, changed_at);
select app.standard_policies('protocol_change', 'patient_id');

-- --------------------------------------------------------------- checkin ----
-- The highest-value data the product collects, and the only thing the patient
-- must do weekly. Fixed 1-10 scales across every dimension so they chart on one
-- axis.

create table checkin (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  clinic_id          uuid not null references clinic(id) on delete cascade,
  patient_id         uuid not null references patient(id) on delete cascade,

  week_of            date not null,
  submitted_at       timestamptz not null default now(),

  energy             int check (energy between 1 and 10),
  libido             int check (libido between 1 and 10),
  sleep_quality      int check (sleep_quality between 1 and 10),
  mood               int check (mood between 1 and 10),
  gym_performance    int check (gym_performance between 1 and 10),
  mental_clarity     int check (mental_clarity between 1 and 10),

  weight_lbs         numeric(6,2),
  -- PHI, and a Phase C column-encryption target. Patients write clinically
  -- significant things here and somebody has to read it.
  notes_free_text    text,
  missed_doses_count int not null default 0 check (missed_doses_count >= 0),
  reviewed_by        uuid references staff_user(id) on delete set null,
  reviewed_at        timestamptz,
  synthetic          boolean not null default false,

  -- One check-in per week. A man who fixes a slider should not put two points on
  -- his own chart; the app upserts on this constraint.
  unique (patient_id, week_of)
);

create index checkin_patient_idx on checkin (patient_id, week_of);
create index checkin_unread_idx on checkin (clinic_id, submitted_at desc)
  where notes_free_text is not null and reviewed_at is null;
select app.add_touch('checkin');
select app.standard_policies('checkin', 'patient_id', true);

create policy checkin_patient_update on checkin
  for update to authenticated
  using (app.is_own_patient(patient_id))
  with check (app.is_own_patient(patient_id));

-- ============================== med spa clinical ==========================

-- ------------------------------------------------------ treatment_record ----
-- The med spa equivalent of a protocol: what was actually done, to which areas,
-- with how much product, from which lot. For injectables that lot linkage is a
-- genuine record-keeping requirement, not a nice-to-have.

create table treatment_record (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  clinic_id             uuid not null references clinic(id) on delete cascade,
  patient_id            uuid not null references patient(id) on delete cascade,
  appointment_id        uuid references appointment(id) on delete set null,
  service_id            uuid references service(id) on delete set null,
  provider_id           uuid references provider(id) on delete set null,

  performed_at          timestamptz not null default now(),
  total_units           numeric(10,2),

  notes_clinical        text,
  notes_patient_facing  text,

  aftercare_given       boolean not null default false,
  aftercare_version     text,
  consent_record_id     uuid references consent_record(id) on delete set null,

  -- Aesthetic practice's equivalent of the safety queue: an adverse event has to
  -- be recordable and findable, not buried in a note.
  adverse_event         boolean not null default false,
  adverse_event_note    text,
  follow_up_due         date,
  synthetic             boolean not null default false
);

create index treatment_patient_idx on treatment_record (patient_id, performed_at desc);
create index treatment_adverse_idx on treatment_record (clinic_id, performed_at desc)
  where adverse_event;
select app.add_touch('treatment_record');
select app.standard_policies('treatment_record', 'patient_id');

create table treatment_detail (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  clinic_id           uuid not null references clinic(id) on delete cascade,
  treatment_record_id uuid not null references treatment_record(id) on delete cascade,
  patient_id          uuid not null references patient(id) on delete cascade,

  area                text not null,        -- 'glabella', 'crown', 'under-eye'
  units               numeric(10,2),
  product_name        text,
  lot_id              uuid references inventory_lot(id) on delete set null,
  depth               text,
  technique           text,
  sort_order          int not null default 0
);

create index treatment_detail_record_idx on treatment_detail (treatment_record_id);
select app.standard_policies('treatment_detail', 'patient_id');

-- ============================== shared clinical ===========================

-- ------------------------------------------------------------- body_comp ----

create table body_comp (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  clinic_id           uuid not null references clinic(id) on delete cascade,
  patient_id          uuid not null references patient(id) on delete cascade,

  measured_at         date not null,
  weight_lbs          numeric(6,2),
  body_fat_pct        numeric(5,2),
  lean_mass_lbs       numeric(6,2),
  visceral_fat_level  numeric(5,2),
  device              text,
  synthetic           boolean not null default false,

  unique (patient_id, measured_at)
);

select app.standard_policies('body_comp', 'patient_id');

-- ---------------------------------------------------------- photo_series ----
-- The highest-sensitivity asset in the system. A lab number attached to a name
-- is a disclosure; a photograph attached to a name is a disclosure that cannot
-- be de-identified after the fact. docs/16-media-pipeline.md.

create table photo_series (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  clinic_id         uuid not null references clinic(id) on delete cascade,
  patient_id        uuid not null references patient(id) on delete cascade,

  series_type       text not null,          -- hair | body | face | treatment_area
  label             text,
  -- Guide geometry version. If the capture guide changes, older frames were shot
  -- against different geometry and are not strictly comparable. Never silently
  -- compare across versions.
  guide_version     text not null default 'v1',
  capture_guide_ref text,
  consent_record_id uuid references consent_record(id) on delete set null,
  archived_at       timestamptz,
  synthetic         boolean not null default false
);

create index photo_series_patient_idx on photo_series (patient_id);
select app.add_touch('photo_series');
select app.standard_policies('photo_series', 'patient_id');

create table photo (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  clinic_id     uuid not null references clinic(id) on delete cascade,
  series_id     uuid not null references photo_series(id) on delete cascade,
  patient_id    uuid not null references patient(id) on delete cascade,

  captured_at   date not null,
  week_index    int,
  pose_key      text not null,
  guide_version text not null default 'v1',

  -- Private bucket object path. Never a public URL, never CDN-cached: a cached
  -- progress photo is a copy of PHI outside the BAA, and cache invalidation is
  -- not deletion.
  storage_path  text,
  placeholder   boolean not null default true,
  reviewed_by   uuid references staff_user(id) on delete set null,
  synthetic     boolean not null default false
);

create index photo_series_idx on photo (series_id, captured_at);
select app.standard_policies('photo', 'patient_id', true);
