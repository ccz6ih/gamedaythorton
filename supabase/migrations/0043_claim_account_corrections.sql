-- 0043_claim_account_corrections.sql
-- Three things 0042 got wrong, and one control it ran into.
--
-- Found by calling the function rather than re-reading it. Each failed only on
-- the path that mattered, which is why none showed up in review:
--
--   1. min(uuid) DOES NOT EXIST in Postgres. The unknown-address path returned
--      no_match happily, because it never reached the aggregate. Every address
--      that actually MATCHED a client raised "function min(uuid) does not
--      exist" — so it would have worked for nobody and looked fine in testing
--      that only tried made-up addresses.
--
--   2. `status <> 'merged'` is not a patient_status. The enum is (lead,
--      consulted, active, paused, churned); a merge DELETES the duplicate, so
--      there is no merged state to exclude. The filter guarded nothing and
--      threw on every real match.
--
--      Removed rather than corrected: every one of those statuses is a person
--      who might want to look up what they had done, and a churned client
--      checking their history before rebooking is the best possible use of
--      this portal.
--
--   3. app.assert_patient_update_scope() blocks any change to auth_user_id by
--      the patient themselves — correctly, and it has done since 0005. The
--      rule it enforces is "a patient may not reassign themselves to a
--      different chart". As a side effect it also blocked the FIRST link, so
--      no client could ever get a login.
--
--      Amended to permit exactly one transition, and the narrowness is the
--      whole point:
--          old.auth_user_id IS NULL      — a claimed record cannot be taken
--          new.auth_user_id = auth.uid() — you may only point it at yourself
--
--      The worst a caller can do is claim a chart nobody has claimed, carrying
--      an address that chart already holds. Which is the feature.
--
-- VERIFIED as the authenticated role against throwaway auth users, all four
-- cases, then removed:
--   first claim          -> claimed
--   called again         -> linked      (idempotent, no second write)
--   takeover via the RPC -> no_match    (already claimed, so no match)
--   direct table UPDATE  -> 0 rows      (RLS refused before the trigger ran)

begin;

create or replace function app.claim_patient_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(nullif(btrim(coalesce(auth.email(), '')), ''));
  v_ids   uuid[];
  v_id    uuid;
  v_n     int;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'anonymous');
  end if;

  if exists (select 1 from public.staff_user s where s.auth_user_id = v_uid) then
    return jsonb_build_object('status', 'staff');
  end if;

  select id into v_id from public.patient where auth_user_id = v_uid limit 1;
  if v_id is not null then
    return jsonb_build_object('status', 'linked', 'patient_id', v_id);
  end if;

  if v_email is null then
    return jsonb_build_object('status', 'no_email');
  end if;

  select array_agg(id) into v_ids
  from public.patient
  where lower(email::text) = v_email
    and auth_user_id is null;

  v_n := coalesce(array_length(v_ids, 1), 0);

  -- Same answer whether the address is unknown or already claimed: this must
  -- not confirm who is a client here.
  if v_n = 0 then
    return jsonb_build_object('status', 'no_match');
  end if;

  /* Two records, one inbox. Impossible within a practice — patient has a
     unique index on (clinic_id, email) — but not across two practices on this
     deployment. Refuses rather than guessing which chart is yours. */
  if v_n > 1 then
    return jsonb_build_object('status', 'ambiguous');
  end if;

  v_id := v_ids[1];

  update public.patient
     set auth_user_id = v_uid, updated_at = now()
   where id = v_id
     and auth_user_id is null;   -- loses a race rather than overwriting

  if not found then
    return jsonb_build_object('status', 'no_match');
  end if;

  return jsonb_build_object('status', 'claimed', 'patient_id', v_id);
end;
$$;

/* ------------------------------------------ the one permitted transition ---- */

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
  if auth.uid() is null then
    return new;
  end if;

  if app.is_staff(new.clinic_id) then
    return new;
  end if;

  foreach k in array protected loop
    if to_jsonb(new)->>k is distinct from to_jsonb(old)->>k then

      -- Claiming your own unclaimed record. Everything else about this trigger
      -- is unchanged, including the rule it exists for.
      if k = 'auth_user_id'
         and old.auth_user_id is null
         and new.auth_user_id = auth.uid() then
        continue;
      end if;

      raise exception
        'A patient may not change %. Contact the clinic.', k
        using errcode = 'insufficient_privilege';
    end if;
  end loop;
  return new;
end;
$$;

commit;
