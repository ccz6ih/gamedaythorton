-- ===========================================================================
-- 0005_guards_and_audit
--
-- THE RULE, enforced in the database:
--   "No real patient data enters this system until Phase C sign-off."
--
-- docs/09-compliance-register.md says this must be enforced technically, not by
-- memory, and that the pilot build must make real-data entry HARD rather than
-- merely discouraged. So while a clinic has pilot_mode = true, every PHI table
-- rejects any row not explicitly marked synthetic.
--
-- Honest about its limits: someone determined to enter real data can set
-- synthetic = true. This is friction plus an audit trail, not a cryptographic
-- guarantee. Its job is to stop the accident and the casual "let's just try one
-- real patient", which is the most likely way this project goes wrong.
-- ===========================================================================

-- ------------------------------------------------- synthetic-data guard ----

create or replace function app.assert_synthetic_in_pilot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.synthetic, false) is false
     and app.clinic_in_pilot(new.clinic_id) then
    raise exception
      'PILOT MODE: % rejected because it is not marked synthetic. This build has no HIPAA controls - no BAAs, no audit guarantees, no encryption at rest - so no real patient data may enter it. Set clinic.pilot_mode = false only after Phase C sign-off. See docs/09-compliance-register.md.',
      tg_table_name
      using errcode = 'check_violation',
            hint = 'If this is synthetic demo data, set synthetic = true on the row.';
  end if;
  return new;
end;
$$;

-- Every table that can hold PHI or identifying patient information.
-- Deliberately excludes clinic, staff_user, provider, service, service_package,
-- package_item, plan, analyte, intake_template, blocked_time, inventory_item and
-- inventory_lot: those are practice configuration, not patient data, and a real
-- practitioner's real service list and real name are exactly what we want in
-- here during the pilot.
do $$
declare
  t text;
  phi_tables text[] := array[
    'patient', 'lead', 'consent_record', 'intake_submission',
    'appointment', 'waitlist',
    'lab_panel', 'lab_result', 'protocol', 'protocol_item', 'protocol_change',
    'checkin', 'treatment_record', 'treatment_detail', 'body_comp',
    'photo_series', 'photo',
    'membership', 'payment', 'package_purchase', 'package_redemption',
    'message_thread', 'message', 'automation_run',
    'task', 'missed_call', 'inventory_transaction'
  ];
begin
  foreach t in array phi_tables loop
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function app.assert_synthetic_in_pilot()',
      t || '_pilot_guard', t);
  end loop;
end;
$$;

-- ---------------------------------------------------- audit triggers ----
-- Records WHO touched WHAT and WHEN, and which columns changed -- but not the
-- values. Storing full before/after row snapshots of PHI would double the PHI
-- surface area and put it in a table with different retention rules, which
-- makes the deletion story worse rather than better. Column names answer every
-- question an audit actually asks.

create or replace function app.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_cols text[] := '{}';
  k            text;
  old_j        jsonb;
  new_j        jsonb;
  target       uuid;
  pat          uuid;
  cid          uuid;
begin
  if tg_op = 'DELETE' then
    old_j := to_jsonb(old);
    target := (old_j->>'id')::uuid;
    cid := (old_j->>'clinic_id')::uuid;
    pat := case when old_j ? 'patient_id' then (old_j->>'patient_id')::uuid
                when tg_table_name = 'patient' then target end;
  else
    new_j := to_jsonb(new);
    target := (new_j->>'id')::uuid;
    cid := (new_j->>'clinic_id')::uuid;
    pat := case when new_j ? 'patient_id' then (new_j->>'patient_id')::uuid
                when tg_table_name = 'patient' then target end;
    if tg_op = 'UPDATE' then
      old_j := to_jsonb(old);
      for k in select jsonb_object_keys(new_j) loop
        if coalesce(new_j->>k, '') is distinct from coalesce(old_j->>k, '')
           and k <> 'updated_at' then
          changed_cols := array_append(changed_cols, k);
        end if;
      end loop;
      -- An update that changed nothing but updated_at is not worth a row.
      if array_length(changed_cols, 1) is null then
        return null;
      end if;
    end if;
  end if;

  insert into public.audit_log (
    clinic_id, actor_auth_id, actor_staff_id, actor_role,
    action, entity_type, entity_id, patient_id, changed
  )
  select
    cid,
    auth.uid(),
    s.id,
    s.role::text,
    lower(tg_op),
    tg_table_name,
    target,
    pat,
    case when tg_op = 'UPDATE'
      then jsonb_build_object('columns', to_jsonb(changed_cols))
      else null end
  from (
    select id, role from public.staff_user
    where auth_user_id = auth.uid() and active
    limit 1
  ) s
  right join (select 1) dummy on true;

  return null;   -- AFTER trigger
end;
$$;

-- Attached to the tables where "who looked at / changed this" is a question
-- somebody will actually have to answer. Phase C extends this to reads.
do $$
declare
  t text;
  audited text[] := array[
    'patient', 'lab_panel', 'lab_result', 'protocol', 'protocol_change',
    'checkin', 'treatment_record', 'photo', 'photo_series',
    'membership', 'payment', 'consent_record', 'message', 'intake_submission'
  ];
begin
  foreach t in array audited loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function app.audit_row()',
      t || '_audit', t);
  end loop;
end;
$$;

-- ------------------------------------------- patient self-update scope ----
-- RLS decides WHICH ROWS a patient may update; it cannot express WHICH COLUMNS.
-- Column grants cannot help either, because staff and patients are both the
-- `authenticated` role. So the column scope is a trigger.

create or replace function app.assert_patient_update_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  protected text[] := array[
    'clinic_id', 'auth_user_id', 'status', 'synthetic', 'external_emr_id',
    'therapy_start_date', 'stripe_customer_id', 'notes_internal', 'archived_at'
  ];
  k text;
begin
  -- Staff of the clinic may change anything their RLS policy allows.
  if app.is_staff(new.clinic_id) then
    return new;
  end if;

  foreach k in array protected loop
    if to_jsonb(new)->>k is distinct from to_jsonb(old)->>k then
      raise exception
        'A patient may not change %. Contact the clinic.', k
        using errcode = 'insufficient_privilege';
    end if;
  end loop;
  return new;
end;
$$;

create trigger patient_update_scope
  before update on patient
  for each row execute function app.assert_patient_update_scope();

-- ------------------------------------------------- patient-facing views ----
-- The patient app needs the clinic's name, address, hours and brand to render
-- itself. It has no business reading pilot_mode, stripe_account_id or the
-- internal NAP note. A view with security_invoker keeps RLS applied while
-- narrowing the columns.

create view clinic_public
with (security_invoker = true)
as
select
  id, slug, name, location_name, practice_type, modules,
  address_line1, address_line2, address_city, address_state, address_zip,
  phone_voice, phone_text, email, timezone, hours, brand, visit_facts
from clinic
where active;

grant select on clinic_public to authenticated, anon;

-- Provider cards for the pre-visit screen. Excludes npi and staff linkage.
create view provider_public
with (security_invoker = true)
as
select id, clinic_id, name, credentials, role_label, bio, photo_path, sort_order
from provider
where active;

grant select on provider_public to authenticated, anon;

-- ----------------------------------------------------- module helper ----
-- Screens ask "does this clinic use labs?" constantly. One function so the
-- answer cannot differ between two call sites.

create or replace function app.clinic_has_module(target_clinic uuid, module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (c.modules ->> module)::boolean from public.clinic c where c.id = target_clinic), false)
$$;

grant execute on function app.clinic_has_module(uuid, text) to authenticated, anon;
