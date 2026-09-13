-- ===========================================================================
-- 0008_patient_scope_admin_path
--
-- The patient self-update scope trigger from 0005 blocked administrative writes
-- as well as patient writes. It allowed the update only when app.is_staff() was
-- true, and is_staff() reads auth.uid() — which is null for the service_role key
-- and for direct superuser connections. So legitimate admin work (linking a
-- seeded patient to a login, a support fix, a migration backfill) failed with
-- "A patient may not change auth_user_id".
--
-- The fix is to skip the check when there is no authenticated user at all, and
-- let RLS be the gate for those callers — which it already is:
--
--   anon          has no UPDATE policy on patient that can ever pass, so RLS
--                 rejects it before this trigger is reached.
--   service_role  bypasses RLS by design; it is the admin key and is expected
--                 to be able to do administrative things.
--   postgres      superuser, direct connection, migrations and seed scripts.
--
-- So this widens nothing that RLS was closing. The trigger keeps doing the one
-- job RLS cannot do: stopping a signed-in PATIENT from editing columns that are
-- not his to edit.
-- ===========================================================================

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
  -- No signed-in user: service_role, postgres, or a migration. RLS has already
  -- decided whether this caller may write at all.
  if auth.uid() is null then
    return new;
  end if;

  -- Staff of this clinic may change anything their RLS policy allows.
  if app.is_staff(new.clinic_id) then
    return new;
  end if;

  -- Everyone else reaching this point is the patient themselves.
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
