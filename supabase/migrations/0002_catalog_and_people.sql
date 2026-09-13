-- ===========================================================================
-- 0002_catalog_and_people
-- Services, packages, plans, leads, consents, intake.
--
-- The service model has to cover two very different price shapes:
--   Gameday Thornton  flat fees, membership-inclusive visits
--   The Med Bar       per-unit neurotoxin ("$14+/unit"), from-pricing
--                     ("$800+"), free consults, prepaid 3-session series
-- A single price_cents column cannot express those, and inventing a number to
-- display is worse than honestly showing "from $800".
-- ===========================================================================

-- ------------------------------------------------------- policy helper ----
-- 30-odd tables need the same three policies. Hand-writing them is how one
-- table ends up missing the patient-read policy and nobody notices until a
-- patient sees a blank screen — or worse, until they see someone else's data.

create or replace function app.standard_policies(
  tbl           text,
  patient_col   text default null,     -- column holding patient_id, if any
  patient_write boolean default false, -- may a patient insert their own rows?
  clinic_read   boolean default false  -- may any patient of the clinic read it?
)
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', tbl);

  execute format($f$
    create policy %I on public.%I
      for all to authenticated
      using (app.is_staff(clinic_id))
      with check (app.is_staff(clinic_id))
  $f$, tbl || '_staff_all', tbl);

  if patient_col is not null then
    execute format($f$
      create policy %I on public.%I
        for select to authenticated
        using (app.is_own_patient(%I))
    $f$, tbl || '_patient_read', tbl, patient_col);

    if patient_write then
      execute format($f$
        create policy %I on public.%I
          for insert to authenticated
          with check (app.is_own_patient(%I))
      $f$, tbl || '_patient_insert', tbl, patient_col);
    end if;
  end if;

  if clinic_read then
    execute format($f$
      create policy %I on public.%I
        for select to authenticated
        using (exists (
          select 1 from public.patient p
          where p.auth_user_id = auth.uid() and p.clinic_id = %I.clinic_id
        ))
    $f$, tbl || '_clinic_patient_read', tbl, tbl);
  end if;
end;
$$;

-- Attaches the updated_at trigger. Same reasoning: 30 tables, one helper.
create or replace function app.add_touch(tbl text)
returns void
language plpgsql
as $$
begin
  execute format(
    'create trigger %I before update on public.%I for each row execute function app.touch_updated_at()',
    tbl || '_touch', tbl);
end;
$$;

-- -------------------------------------------------------------- service ----

create table service (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  clinic_id         uuid not null references clinic(id) on delete cascade,

  name              text not null,
  slug              citext,
  category          text not null default 'other',
  description       text,

  duration_min      int not null default 30 check (duration_min > 0),
  -- Aesthetic treatments need turnaround time the calendar must respect; a
  -- 120-minute lash set back-to-back with the next one is not bookable.
  buffer_after_min  int not null default 0 check (buffer_after_min >= 0),

  price_mode        price_mode not null default 'flat',
  price_cents       int check (price_cents >= 0),
  -- Used when price_mode = 'from' or 'per_unit': the number we are allowed to
  -- show, with "from" or "/unit" attached.
  price_from_cents  int check (price_from_cents >= 0),
  unit_label        text,                       -- 'unit', 'syringe', 'area'
  min_units         numeric(8,2),

  deposit_cents     int check (deposit_cents >= 0),

  requires_labs     boolean not null default false,
  requires_consent  boolean not null default false,
  is_membership     boolean not null default false,
  online_bookable   boolean not null default true,

  stripe_price_id   text,
  active            boolean not null default true,
  sort_order        int not null default 0,

  unique (clinic_id, name),

  -- A flat-priced service without a price is a bug that reaches the patient as
  -- a blank where the cost should be, on the screen where cost is the objection.
  constraint service_price_present check (
    (price_mode = 'flat'     and price_cents is not null)
    or (price_mode = 'free'  and coalesce(price_cents, 0) = 0)
    or (price_mode in ('from', 'per_unit') and price_from_cents is not null)
    or (price_mode = 'quoted')
  )
);

create index service_clinic_idx on service (clinic_id) where active;
create index service_category_idx on service (clinic_id, category);
select app.add_touch('service');
select app.standard_policies('service', null, false, true);

-- ------------------------------------------------------ service_package ----
-- Prepaid series. The Med Bar sells "PRF Microneedling | 3 treatments" at
-- $2,100 against a $2,400 list price.
--
-- These are a real liability, not a marketing device: money taken for sessions
-- not yet delivered. That is why redemptions are tracked per session in 0004
-- and why outstanding balances are a cutover blocker. docs/12 § Cutover.

create table service_package (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  clinic_id         uuid not null references clinic(id) on delete cascade,

  name              text not null,
  description       text,
  -- Null when a package spans several services; package_item covers that case.
  service_id        uuid references service(id) on delete set null,

  sessions          int not null check (sessions > 0),
  price_cents       int not null check (price_cents >= 0),
  -- What the sessions would cost bought individually, so the saving is
  -- computed rather than typed and cannot drift from the service price.
  list_price_cents  int check (list_price_cents >= price_cents),

  -- Null means no expiry. If a package does expire, that has to be disclosed at
  -- purchase and shown on the client's own screen, not buried in terms.
  expiry_days       int check (expiry_days > 0),
  interval_note     text,        -- 'treatments scheduled several weeks apart'

  stripe_price_id   text,
  active            boolean not null default true,
  sort_order        int not null default 0,

  unique (clinic_id, name)
);

create index service_package_clinic_idx on service_package (clinic_id) where active;
select app.add_touch('service_package');
select app.standard_policies('service_package', null, false, true);

-- For packages covering more than one service.
create table package_item (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinic(id) on delete cascade,
  package_id  uuid not null references service_package(id) on delete cascade,
  service_id  uuid not null references service(id) on delete cascade,
  sessions    int not null default 1 check (sessions > 0),
  unique (package_id, service_id)
);

create index package_item_package_idx on package_item (package_id);
select app.standard_policies('package_item', null, false, true);

-- ----------------------------------------------------------------- plan ----
-- Recurring membership. Gameday's core revenue; optional for a med spa.

create table plan (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  clinic_id       uuid not null references clinic(id) on delete cascade,

  name            text not null,
  description     text,
  price_cents     int not null check (price_cents >= 0),
  interval        text not null default 'month' check (interval in ('month', 'quarter', 'year')),
  includes        jsonb not null default '[]'::jsonb,

  -- Prices in the pilot are invented. Anything true here must be marked so it
  -- cannot be quoted to a patient by accident. docs/17-agent-playbook.md.
  provisional_price boolean not null default true,

  stripe_price_id text,
  active          boolean not null default true,
  sort_order      int not null default 0,

  unique (clinic_id, name)
);

select app.add_touch('plan');
select app.standard_policies('plan', null, false, true);

-- ----------------------------------------------------------------- lead ----
-- Separate from patient on purpose: a lead is not yet a patient, and treating
-- it as one pollutes clinical counts and complicates deletion.

create table lead (
  id                        uuid primary key default gen_random_uuid(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  clinic_id                 uuid not null references clinic(id) on delete cascade,

  name                      text,
  email                     citext,
  phone                     text,
  source                    text,
  campaign                  text,
  message                   text,

  -- TCPA evidence. Non-negotiable: without the text version, timestamp and IP,
  -- an SMS programme is a liability rather than a growth channel. Transactional
  -- and marketing consent are separate because they legally are.
  consent_transactional_sms boolean not null default false,
  consent_marketing_sms     boolean not null default false,
  consent_email             boolean not null default false,
  consent_captured_at       timestamptz,
  consent_ip                inet,
  consent_user_agent        text,
  consent_text_version      text,

  -- Speed-to-lead measurement. While the corporate form is a callback queue,
  -- response time is the conversion rate. docs/01-audit-findings.md.
  first_response_at         timestamptz,

  status                    text not null default 'new',
  converted_patient_id      uuid references patient(id) on delete set null,
  synthetic                 boolean not null default false
);

create index lead_clinic_idx on lead (clinic_id, created_at desc);
create index lead_source_idx on lead (clinic_id, source);
select app.add_touch('lead');
select app.standard_policies('lead');

-- ------------------------------------------------------- consent_record ----

create table consent_record (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  clinic_id     uuid not null references clinic(id) on delete cascade,
  patient_id    uuid not null references patient(id) on delete cascade,

  type          consent_type not null,
  granted       boolean not null,
  -- A consent signed against v3 must be reproducible as v3 forever.
  text_version  text not null,
  text_snapshot text,
  captured_at   timestamptz not null default now(),
  ip            inet,
  user_agent    text,

  -- Photo consent is revocable, and revoking it must actually make the series
  -- inaccessible. That path needs a test in Phase C.
  revoked_at    timestamptz,
  synthetic     boolean not null default false
);

create index consent_patient_idx on consent_record (patient_id, type);
select app.standard_policies('consent_record', 'patient_id', true);

-- ------------------------------------------------------ intake_template ----

create table intake_template (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  clinic_id   uuid not null references clinic(id) on delete cascade,

  version     text not null,
  name        text not null default 'New patient intake',
  sections    jsonb not null default '[]'::jsonb,
  consents    jsonb not null default '[]'::jsonb,
  active      boolean not null default true,

  unique (clinic_id, version)
);

select app.add_touch('intake_template');
select app.standard_policies('intake_template', null, false, true);

-- ---------------------------------------------------- intake_submission ----

create table intake_submission (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  clinic_id        uuid not null references clinic(id) on delete cascade,
  patient_id       uuid not null references patient(id) on delete cascade,
  appointment_id   uuid,          -- FK added in 0003, after appointment exists

  template_id      uuid references intake_template(id) on delete set null,
  template_version text not null,

  -- PHI, and a Phase C column-encryption target.
  answers          jsonb not null default '{}'::jsonb,

  percent_complete int not null default 0 check (percent_complete between 0 and 100),
  submitted_at     timestamptz,
  signed_at        timestamptz,
  signature_ref    text,
  synthetic        boolean not null default false
);

create index intake_patient_idx on intake_submission (patient_id);
select app.add_touch('intake_submission');
-- A patient fills in and updates his own intake, so this one needs write access
-- beyond insert; the update policy is explicit rather than from the helper.
select app.standard_policies('intake_submission', 'patient_id', true);

create policy intake_submission_patient_update on intake_submission
  for update to authenticated
  using (app.is_own_patient(patient_id))
  with check (app.is_own_patient(patient_id));
