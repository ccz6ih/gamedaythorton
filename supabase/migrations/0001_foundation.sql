-- ===========================================================================
-- 0001_foundation
-- Extensions, enums, tenancy, and the RLS helper functions everything else
-- depends on.
--
-- Design rules encoded here (see docs/05-data-model.md, docs/06-architecture.md):
--   1. clinic_id on every table, from commit one. Retrofitting tenancy later is
--      a rewrite, and 400+ franchisees have the same problem.
--   2. RLS enabled on every table, policies written now and tightened in
--      Phase C. The difference between a hardening pass and a rewrite is
--      decided here.
--   3. practice_type drives which clinical modules exist. Gameday Thornton runs
--      labs -> protocol -> dose -> recheck. The Med Bar runs treatment -> series
--      -> interval. Same platform, different clinical loop.
--   4. Nothing in this schema prescribes. protocol_* records what a licensed
--      provider decided elsewhere. Testosterone is Schedule III.
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create schema if not exists app;
comment on schema app is 'Helper functions for RLS. Not a data schema.';

-- ---------------------------------------------------------------- enums ----

create type practice_type as enum ('mens_health', 'med_spa', 'other');

create type staff_role as enum ('owner', 'provider', 'front_desk', 'admin');

create type patient_status as enum ('lead', 'consulted', 'active', 'paused', 'churned');

create type appointment_status as enum (
  'booked', 'confirmed', 'arrived', 'complete', 'no_show', 'cancelled'
);

create type membership_status as enum ('active', 'paused', 'cancelled');

create type payment_status as enum ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded');

create type payment_type as enum ('membership', 'visit', 'deposit', 'package', 'product', 'other');

-- Pricing has to cover Gameday's flat fees AND a med spa's per-unit neurotoxin
-- ("$14+/unit") and from-pricing ("$800+"). A single price_cents column cannot,
-- and guessing a number to display is worse than saying "from".
create type price_mode as enum ('flat', 'per_unit', 'from', 'free', 'quoted');

create type lab_flag as enum (
  'in_range', 'below_target', 'above_target', 'below_ref', 'above_ref', 'critical'
);

create type triage_tag as enum ('clinical', 'scheduling', 'billing', 'other');

create type thread_status as enum ('open', 'closed');

create type cancel_reason as enum (
  'cost', 'no_perceived_benefit', 'side_effects', 'moved', 'went_elsewhere',
  'life_event', 'schedule', 'other'
);

create type inventory_txn_type as enum ('received', 'administered', 'wasted', 'expired', 'adjusted');

create type consent_type as enum (
  'treatment', 'trt_risks', 'photo', 'transactional_sms', 'marketing_sms',
  'email', 'aesthetic_risks', 'financial_policy'
);

create type message_sender as enum ('patient', 'staff', 'system');

create type automation_status as enum ('logged_not_sent', 'queued', 'sent', 'failed', 'suppressed');

-- --------------------------------------------------- utility functions ----
-- Defined before any table, because tables below attach triggers to them.

-- Generic updated_at, applied to every mutable table.
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Default module flags per practice type. A men's-health clinic needs labs,
-- protocols and weekly check-ins; a med spa needs treatment records, areas
-- treated, and photo series. Neither should be shown the other's screens.
create or replace function app.default_modules(p practice_type)
returns jsonb
language sql
immutable
as $$
  select case p
    when 'mens_health' then jsonb_build_object(
      'labs', true, 'protocols', true, 'checkins', true, 'body_comp', true,
      'photos', true, 'memberships', true, 'packages', false,
      'treatment_records', false, 'safety_queue', true, 'units_pricing', false
    )
    when 'med_spa' then jsonb_build_object(
      'labs', false, 'protocols', false, 'checkins', false, 'body_comp', false,
      'photos', true, 'memberships', true, 'packages', true,
      'treatment_records', true, 'safety_queue', false, 'units_pricing', true
    )
    else jsonb_build_object(
      'labs', false, 'protocols', false, 'checkins', false, 'body_comp', false,
      'photos', true, 'memberships', true, 'packages', true,
      'treatment_records', true, 'safety_queue', false, 'units_pricing', false
    )
  end
$$;

-- Fill modules from practice_type on insert unless explicitly provided.
create or replace function app.clinic_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.modules is null or new.modules = '{}'::jsonb then
    new.modules := app.default_modules(new.practice_type);
  end if;
  return new;
end;
$$;

-- --------------------------------------------------------------- clinic ----

create table clinic (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  slug              citext not null unique,
  name              text not null,
  location_name     text,
  legal_name        text,
  practice_type     practice_type not null default 'other',

  -- Which clinical modules this practice actually uses. Defaulted from
  -- practice_type by app.default_modules() below, but overridable per clinic
  -- because real practices do not fit categories cleanly.
  modules           jsonb not null default '{}'::jsonb,

  address_line1     text,
  address_line2     text,
  address_city      text,
  address_state     text,
  address_zip       text,
  address_note      text,

  phone_voice       text,
  phone_text        text,
  email             citext,
  timezone          text not null default 'America/Denver',

  -- [{day, open, close}] — null open means closed that day.
  hours             jsonb not null default '[]'::jsonb,

  -- Brand Kit. Mirrors prototype/assets/brand.js so a kit exported from the
  -- pilot imports here unchanged. docs/15-branding.md.
  brand             jsonb not null default '{}'::jsonb,

  -- Anxiety-reduction copy for the pre-visit card. docs/14-screen-specs.md.
  visit_facts       jsonb not null default '{}'::jsonb,

  -- THE RULE, enforced in the database. While this is true, every trigger in
  -- 0005 refuses to write a record not marked synthetic.
  -- docs/09-compliance-register.md.
  pilot_mode        boolean not null default true,

  stripe_account_id text,
  active            boolean not null default true
);

comment on column clinic.pilot_mode is
  'While true, DB triggers reject non-synthetic PHI writes. Do not set false before Phase C sign-off.';

-- ----------------------------------------------------------- staff_user ----

create table staff_user (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  clinic_id     uuid not null references clinic(id) on delete cascade,

  -- Links a console login to a clinic. Null until the person has signed in once.
  auth_user_id  uuid unique references auth.users(id) on delete set null,

  name          text not null,
  email         citext not null,
  phone         text,
  role          staff_role not null default 'front_desk',
  mfa_enabled   boolean not null default false,
  last_seen_at  timestamptz,
  active        boolean not null default true,

  unique (clinic_id, email)
);

create index staff_user_clinic_idx on staff_user (clinic_id) where active;
create index staff_user_auth_idx on staff_user (auth_user_id);

-- ------------------------------------------------------------- provider ----
-- The clinician a patient sees. Separate from staff_user because a provider may
-- be presented to patients without having a console login, and a console user
-- (front desk) is never presented as a clinician.

create table provider (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  clinic_id     uuid not null references clinic(id) on delete cascade,
  staff_user_id uuid references staff_user(id) on delete set null,

  name          text not null,
  credentials   text,
  role_label    text,
  npi           text,
  bio           text,

  -- Storage object path, never a public URL. Signed short-TTL URLs only.
  -- docs/16-media-pipeline.md.
  photo_path    text,

  -- Per-provider bookable hours; falls back to clinic.hours when empty.
  hours         jsonb not null default '[]'::jsonb,
  active        boolean not null default true,
  sort_order    int not null default 0
);

create index provider_clinic_idx on provider (clinic_id) where active;

-- -------------------------------------------------------------- patient ----
-- Foundational rather than in the "people" migration, because the RLS helper
-- functions below read it and `language sql` bodies are validated at creation.
--
-- PHI. Named identity plus the fact of being a patient of this kind of clinic is
-- itself a disclosure, independent of any clinical detail attached.
-- docs/09-compliance-register.md.

create table patient (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  clinic_id           uuid not null references clinic(id) on delete cascade,

  -- Set when the patient first uses a magic link. Null for records created by
  -- staff who have never signed in.
  auth_user_id        uuid unique references auth.users(id) on delete set null,

  first_name          text not null,
  last_name           text not null,
  preferred_name      text,
  dob                 date,
  email               citext,
  phone               text,

  address_line1       text,
  address_city        text,
  address_state       text,
  address_zip         text,

  emergency_contact_name  text,
  emergency_contact_phone text,

  status              patient_status not null default 'lead',
  acquisition_source  text,
  acquisition_campaign text,

  -- Link out to the clinical system of record. We never become the legal
  -- medical record and we never duplicate it. docs/06-architecture.md rule 4.
  external_emr_id     text,

  -- {biometric_lock, hide_sensitive}
  privacy_flags       jsonb not null default '{}'::jsonb,

  -- Stripe customer. No PHI is ever written to Stripe — not metadata, not
  -- descriptors, not line items. Enforced by lib/phi.
  stripe_customer_id  text,

  therapy_start_date  date,
  notes_internal      text,

  -- The synthetic-data guard in 0005 refuses inserts with this false while the
  -- clinic is in pilot mode.
  synthetic           boolean not null default false,

  archived_at         timestamptz
);

create index patient_clinic_idx on patient (clinic_id);
create index patient_auth_idx on patient (auth_user_id);
create index patient_status_idx on patient (clinic_id, status);
create index patient_name_idx on patient (clinic_id, last_name, first_name);
create unique index patient_clinic_email_idx on patient (clinic_id, email) where email is not null;

create trigger patient_touch before update on patient
  for each row execute function app.touch_updated_at();

-- -------------------------------------------------------------- triggers ----

create trigger clinic_defaults_trg
  before insert on clinic
  for each row execute function app.clinic_defaults();

create trigger clinic_touch before update on clinic
  for each row execute function app.touch_updated_at();
create trigger staff_user_touch before update on staff_user
  for each row execute function app.touch_updated_at();
create trigger provider_touch before update on provider
  for each row execute function app.touch_updated_at();

-- --------------------------------------------------------- RLS helpers ----
-- All security definer so they can read staff_user/patient without tripping
-- those tables' own RLS, which would recurse. search_path is pinned empty:
-- a mutable search_path on a security definer function is a privilege
-- escalation waiting to happen.

create or replace function app.staff_clinic_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.clinic_id
  from public.staff_user s
  where s.auth_user_id = auth.uid()
    and s.active
$$;

create or replace function app.is_staff(target_clinic uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_user s
    where s.auth_user_id = auth.uid()
      and s.active
      and s.clinic_id = target_clinic
  )
$$;

create or replace function app.has_role(target_clinic uuid, roles staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_user s
    where s.auth_user_id = auth.uid()
      and s.active
      and s.clinic_id = target_clinic
      and s.role = any(roles)
  )
$$;

-- The patient rows belonging to the signed-in user. A patient sees exactly his
-- own record and nothing else, ever.
create or replace function app.own_patient_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.patient p
  where p.auth_user_id = auth.uid()
$$;

create or replace function app.is_own_patient(target_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.patient p
    where p.auth_user_id = auth.uid()
      and p.id = target_patient
  )
$$;

-- Is this clinic still in pilot mode? Used by the synthetic-data guard.
create or replace function app.clinic_in_pilot(target_clinic uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.pilot_mode from public.clinic c where c.id = target_clinic), true)
$$;

grant usage on schema app to authenticated, anon, service_role;

-- ------------------------------------------------------- clinic RLS ----

alter table clinic enable row level security;
alter table staff_user enable row level security;
alter table provider enable row level security;

-- Staff read their own clinic. Owners and admins may update it.
create policy clinic_staff_read on clinic
  for select to authenticated
  using (app.is_staff(id));

create policy clinic_owner_update on clinic
  for update to authenticated
  using (app.has_role(id, array['owner','admin']::staff_role[]))
  with check (app.has_role(id, array['owner','admin']::staff_role[]));

-- A patient needs clinic name, address, hours and brand to render his own app.
-- No compliance or billing columns are exposed by this: the app selects an
-- explicit column list, and a view in 0005 is what the patient client actually
-- reads.
create policy clinic_patient_read on clinic
  for select to authenticated
  using (exists (
    select 1 from patient p
    where p.auth_user_id = auth.uid() and p.clinic_id = clinic.id
  ));

create policy staff_read_colleagues on staff_user
  for select to authenticated
  using (app.is_staff(clinic_id));

create policy staff_self_update on staff_user
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy staff_admin_write on staff_user
  for all to authenticated
  using (app.has_role(clinic_id, array['owner','admin']::staff_role[]))
  with check (app.has_role(clinic_id, array['owner','admin']::staff_role[]));

-- Providers are patient-visible by design: a real face on the pre-visit card is
-- the most effective anxiety reducer we have. docs/02-patient-journey.md.
create policy provider_read on provider
  for select to authenticated
  using (
    app.is_staff(clinic_id)
    or exists (select 1 from patient p where p.auth_user_id = auth.uid() and p.clinic_id = provider.clinic_id)
  );

create policy provider_staff_write on provider
  for all to authenticated
  using (app.has_role(clinic_id, array['owner','admin','provider']::staff_role[]))
  with check (app.has_role(clinic_id, array['owner','admin','provider']::staff_role[]));

-- ------------------------------------------------------- patient RLS ----
-- The single most important policy pair in the system. A cross-tenant or
-- cross-patient read here is a reportable breach, so Phase C tests it with a
-- deliberate attempt rather than assuming it holds.

alter table patient enable row level security;

create policy patient_staff_all on patient
  for all to authenticated
  using (app.is_staff(clinic_id))
  with check (app.is_staff(clinic_id));

create policy patient_self_read on patient
  for select to authenticated
  using (auth_user_id = auth.uid());

-- A patient may maintain his own contact details and privacy flags. He may not
-- change his clinic, his status, or his clinical linkage — those are guarded by
-- the column grants in 0005, because a WITH CHECK cannot express "only these
-- columns".
create policy patient_self_update on patient
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
