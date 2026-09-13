-- ===========================================================================
-- 0004_money_comms_ops
-- Memberships, packages, payments, messaging, automations, tasks, audit log.
--
-- Two compliance rules are enforced here by TRIGGERS rather than by convention,
-- because "remember not to do that" is not a control:
--
--   1. No PHI in any payment field. Not metadata, not descriptors, not line
--      items. "Monthly membership", never a therapy name.
--   2. No clinical content in any notification preview. A lock-screen preview
--      naming a therapy discloses that the recipient is on it.
--
-- Both read one shared banned-term list, so the rules cannot drift apart.
-- ===========================================================================

-- --------------------------------------------------- PHI term guard ----
-- Platform configuration, not tenant data, so it lives in app rather than
-- carrying a clinic_id it would never use.

create table app.phi_banned_term (
  term text primary key,
  note text
);

comment on table app.phi_banned_term is
  'Terms that must never appear in a payment descriptor or a notification preview.';

insert into app.phi_banned_term (term, note) values
  ('testosterone',  'Schedule III therapy name'),
  ('trt',           'therapy abbreviation'),
  ('erectile',      'diagnosis'),
  ('ed',            'diagnosis abbreviation'),
  ('hematocrit',    'lab analyte'),
  ('psa',           'lab analyte'),
  ('estradiol',     'lab analyte'),
  ('lab',           'discloses clinical activity'),
  ('labs',          'discloses clinical activity'),
  ('lab result',    'discloses clinical activity'),
  ('results are ready', 'discloses clinical activity'),
  ('blood draw',    'discloses clinical activity'),
  ('dose',          'discloses therapy'),
  ('injection',     'discloses therapy'),
  ('prescription',  'discloses therapy'),
  ('refill',        'discloses therapy'),
  ('glp-1',         'therapy name'),
  ('semaglutide',   'therapy name'),
  ('tirzepatide',   'therapy name'),
  ('peptide',       'therapy name'),
  ('libido',        'symptom'),
  ('hormone',       'therapy category'),
  ('neurotoxin',    'aesthetic therapy name'),
  ('botox',         'aesthetic therapy brand'),
  ('jeuveau',       'aesthetic therapy brand'),
  ('filler',        'aesthetic therapy category'),
  ('prf',           'aesthetic therapy abbreviation'),
  ('microneedling', 'aesthetic therapy name');

-- Word-boundary matching, not substring. A naive LIKE '%ed%' fires on
-- "scheduled", "needs" and "linked", which flags everything and so gets ignored.
create or replace function app.phi_terms_in(txt text)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(t.term order by t.term), '{}')
  from app.phi_banned_term t
  where txt is not null
    and txt ~* ('(^|[^a-z0-9])' || regexp_replace(t.term, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '([^a-z0-9]|$)')
$$;

create or replace function app.assert_no_phi_text()
returns trigger
language plpgsql
as $$
declare
  col   text;
  val   text;
  hits  text[];
begin
  foreach col in array tg_argv loop
    execute format('select ($1).%I::text', col) into val using new;
    hits := app.phi_terms_in(val);
    if array_length(hits, 1) > 0 then
      raise exception
        'PHI leak blocked in %.%: contains %. This field is visible outside our systems (payment processor or lock-screen preview) and must carry no clinical content. See docs/09-compliance-register.md.',
        tg_table_name, col, array_to_string(hits, ', ')
        using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;

-- ------------------------------------------------------------- membership ----

create table membership (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  clinic_id           uuid not null references clinic(id) on delete cascade,
  patient_id          uuid not null references patient(id) on delete cascade,
  plan_id             uuid references plan(id) on delete set null,

  status              membership_status not null default 'active',
  started_at          date not null default current_date,
  paused_at           date,
  resumes_at          date,
  cancelled_at        date,

  -- Enumerated on purpose. Free-text cancel reasons make churn cohorts
  -- decorative; codes make them actionable.
  cancel_reason_code  cancel_reason,
  cancel_reason_text  text,

  mrr_cents           int not null default 0 check (mrr_cents >= 0),
  stripe_subscription_id text,
  synthetic           boolean not null default false,

  constraint membership_paused_has_date check (status <> 'paused' or paused_at is not null),
  constraint membership_cancelled_has_date check (status <> 'cancelled' or cancelled_at is not null)
);

create index membership_clinic_status_idx on membership (clinic_id, status);
create unique index membership_one_active_idx on membership (patient_id)
  where status in ('active', 'paused');
select app.add_touch('membership');
select app.standard_policies('membership', 'patient_id');

create policy membership_patient_update on membership
  for update to authenticated
  using (app.is_own_patient(patient_id))
  with check (app.is_own_patient(patient_id));

-- --------------------------------------------------------------- payment ----

create table payment (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  clinic_id           uuid not null references clinic(id) on delete cascade,
  patient_id          uuid references patient(id) on delete set null,

  amount_cents        int not null check (amount_cents >= 0),
  currency            text not null default 'usd',
  type                payment_type not null default 'visit',
  status              payment_status not null default 'pending',

  -- What the cardholder sees on a statement. Trigger-checked for clinical terms.
  descriptor          text,

  processor           text not null default 'stripe',
  processor_ref       text,
  stripe_payment_intent_id text,
  stripe_charge_id    text,

  -- Trigger-checked. Stripe metadata is the most common place PHI leaks,
  -- because it feels internal and is not.
  metadata            jsonb not null default '{}'::jsonb,

  refunded_cents      int not null default 0 check (refunded_cents >= 0),
  failure_code        text,
  failure_message     text,
  paid_at             timestamptz,
  synthetic           boolean not null default false,

  constraint payment_refund_bound check (refunded_cents <= amount_cents)
);

create index payment_clinic_idx on payment (clinic_id, created_at desc);
create index payment_patient_idx on payment (patient_id, created_at desc);
create index payment_failed_idx on payment (clinic_id) where status = 'failed';
select app.add_touch('payment');
select app.standard_policies('payment', 'patient_id');

create trigger payment_no_phi
  before insert or update on payment
  for each row execute function app.assert_no_phi_text('descriptor', 'metadata');

-- Deferred FK from 0003.
alter table appointment
  add constraint appointment_deposit_payment_fkey
  foreign key (deposit_payment_id) references payment(id) on delete set null;

-- ------------------------------------------------------ package_purchase ----
-- Money taken for sessions not yet delivered. That is a liability on the
-- practice's books and it must survive a platform migration, which is why
-- outstanding balances are a cutover blocker. docs/12 § Cutover.

create table package_purchase (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  clinic_id         uuid not null references clinic(id) on delete cascade,
  patient_id        uuid not null references patient(id) on delete cascade,
  package_id        uuid references service_package(id) on delete set null,

  package_name      text not null,          -- snapshot: packages get renamed
  sessions_total    int not null check (sessions_total > 0),
  price_paid_cents  int not null check (price_paid_cents >= 0),

  purchased_at      timestamptz not null default now(),
  expires_on        date,
  payment_id        uuid references payment(id) on delete set null,
  status            text not null default 'active',
  synthetic         boolean not null default false
);

create index package_purchase_patient_idx on package_purchase (patient_id);
select app.add_touch('package_purchase');
select app.standard_policies('package_purchase', 'patient_id');

create table package_redemption (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  clinic_id           uuid not null references clinic(id) on delete cascade,
  purchase_id         uuid not null references package_purchase(id) on delete cascade,
  patient_id          uuid not null references patient(id) on delete cascade,
  appointment_id      uuid references appointment(id) on delete set null,
  treatment_record_id uuid references treatment_record(id) on delete set null,

  sessions            int not null default 1 check (sessions > 0),
  redeemed_at         timestamptz not null default now(),
  redeemed_by         uuid references staff_user(id) on delete set null,
  note                text,
  synthetic           boolean not null default false
);

create index package_redemption_purchase_idx on package_redemption (purchase_id);
select app.standard_policies('package_redemption', 'patient_id');

-- Sessions remaining, computed rather than stored, so it cannot drift.
create or replace function app.package_sessions_used(p_purchase uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(r.sessions), 0)::int
  from public.package_redemption r
  where r.purchase_id = p_purchase
$$;

-- Refuses to redeem more sessions than were bought. Without this, a busy front
-- desk gives away treatments and nobody notices until the numbers are audited.
create or replace function app.assert_package_not_overdrawn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  total int;
  used  int;
begin
  select p.sessions_total into total
  from public.package_purchase p where p.id = new.purchase_id;

  select coalesce(sum(r.sessions), 0)::int into used
  from public.package_redemption r
  where r.purchase_id = new.purchase_id and r.id <> new.id;

  if used + new.sessions > total then
    raise exception
      'Package has % of % sessions already redeemed; cannot redeem % more.',
      used, total, new.sessions
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger package_redemption_bound
  before insert or update on package_redemption
  for each row execute function app.assert_package_not_overdrawn();

-- -------------------------------------------------------- message_thread ----

create table message_thread (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  clinic_id     uuid not null references clinic(id) on delete cascade,
  patient_id    uuid not null references patient(id) on delete cascade,

  -- Chosen by the patient at send time, so nothing lands in a shared inbox
  -- nobody owns.
  triage_tag    triage_tag not null default 'other',
  status        thread_status not null default 'open',
  assigned_to   uuid references staff_user(id) on delete set null,
  subject       text,
  last_at       timestamptz not null default now(),
  unread_staff  int not null default 0 check (unread_staff >= 0),
  unread_patient int not null default 0 check (unread_patient >= 0),
  synthetic     boolean not null default false
);

create index message_thread_clinic_idx on message_thread (clinic_id, last_at desc);
select app.add_touch('message_thread');
select app.standard_policies('message_thread', 'patient_id', true);

create policy message_thread_patient_update on message_thread
  for update to authenticated
  using (app.is_own_patient(patient_id))
  with check (app.is_own_patient(patient_id));

create table message (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  clinic_id     uuid not null references clinic(id) on delete cascade,
  thread_id     uuid not null references message_thread(id) on delete cascade,
  patient_id    uuid not null references patient(id) on delete cascade,

  sender_type   message_sender not null,
  sender_staff_id uuid references staff_user(id) on delete set null,
  -- Message bodies may contain clinical content: this is a secure channel inside
  -- systems we control, unlike a notification preview.
  body          text not null,
  sent_at       timestamptz not null default now(),
  read_at       timestamptz,
  synthetic     boolean not null default false
);

create index message_thread_idx on message (thread_id, sent_at);
select app.standard_policies('message', 'patient_id', true);

-- --------------------------------------------------------- automation_run ----

create table automation_run (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  clinic_id         uuid not null references clinic(id) on delete cascade,
  patient_id        uuid references patient(id) on delete set null,
  lead_id           uuid references lead(id) on delete set null,

  rule_key          text not null,
  channel           text not null,
  status            automation_status not null default 'logged_not_sent',

  -- What the recipient would see on a lock screen. Trigger-checked: this is the
  -- single biggest privacy risk in a product like this.
  payload_preview   text,
  payload_ref       text,

  triggered_at      timestamptz not null default now(),
  sent_at           timestamptz,
  latency_seconds   int,

  -- Consent has to be verified at send time, not assumed from signup.
  consent_verified  boolean not null default false,
  consent_record_id uuid references consent_record(id) on delete set null,
  suppressed_reason text,
  error             text,
  synthetic         boolean not null default false
);

create index automation_run_clinic_idx on automation_run (clinic_id, triggered_at desc);
create index automation_run_rule_idx on automation_run (clinic_id, rule_key, triggered_at desc);
select app.standard_policies('automation_run');

create trigger automation_run_no_phi
  before insert or update on automation_run
  for each row execute function app.assert_no_phi_text('payload_preview');

-- ------------------------------------------------------------------ task ----

create table task (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  clinic_id     uuid not null references clinic(id) on delete cascade,
  patient_id    uuid references patient(id) on delete set null,

  title         text not null,
  detail        text,
  assigned_to   uuid references staff_user(id) on delete set null,
  due_on        date,
  priority      text not null default 'med' check (priority in ('high', 'med', 'low')),
  source        text,
  done          boolean not null default false,
  done_at       timestamptz,
  done_by       uuid references staff_user(id) on delete set null,
  synthetic     boolean not null default false
);

create index task_open_idx on task (clinic_id, priority, due_on) where not done;
select app.add_touch('task');
select app.standard_policies('task');

-- ----------------------------------------------------------- missed_call ----

create table missed_call (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  clinic_id       uuid not null references clinic(id) on delete cascade,
  from_number     text not null,
  received_at     timestamptz not null default now(),
  duration_seconds int not null default 0,
  textback_sent   boolean not null default false,
  textback_at     timestamptz,
  status          text not null default 'needs_callback',
  patient_id      uuid references patient(id) on delete set null,
  note            text,
  synthetic       boolean not null default false
);

create index missed_call_clinic_idx on missed_call (clinic_id, received_at desc);
select app.standard_policies('missed_call');

-- ------------------------------------------------------------- audit_log ----
-- Append-only. Required by the HIPAA Security Rule and useless if it can be
-- edited after the fact, so UPDATE and DELETE are revoked from every role that
-- the application ever runs as.

create table audit_log (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  clinic_id      uuid,
  actor_auth_id  uuid,
  actor_staff_id uuid,
  actor_role     text,
  action         text not null,
  entity_type    text not null,
  entity_id      uuid,
  patient_id     uuid,
  ip             inet,
  user_agent     text,
  changed        jsonb
);

create index audit_log_clinic_idx on audit_log (clinic_id, occurred_at desc);
create index audit_log_patient_idx on audit_log (patient_id, occurred_at desc);
create index audit_log_entity_idx on audit_log (entity_type, entity_id);

alter table audit_log enable row level security;

-- Only owners and admins can read it, and nobody can change it.
create policy audit_log_owner_read on audit_log
  for select to authenticated
  using (clinic_id is not null and app.has_role(clinic_id, array['owner','admin']::staff_role[]));

revoke update, delete on audit_log from authenticated, anon;

-- Writes go through this function, which is the only path that can insert.
create or replace function app.write_audit(
  p_clinic uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_patient uuid default null, p_changed jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
begin
  select id, role into s
  from public.staff_user
  where auth_user_id = auth.uid() and active
  limit 1;

  insert into public.audit_log (
    clinic_id, actor_auth_id, actor_staff_id, actor_role,
    action, entity_type, entity_id, patient_id, changed
  ) values (
    p_clinic, auth.uid(), s.id, s.role::text,
    p_action, p_entity_type, p_entity_id, p_patient, p_changed
  );
end;
$$;

grant execute on function app.write_audit(uuid, text, text, uuid, uuid, jsonb) to authenticated;
