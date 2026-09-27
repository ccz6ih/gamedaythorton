-- 0042_client_portal_login.sql
-- Give a client a way in.
--
-- ===========================================================================
-- WHAT EXISTED, AND WHAT DID NOT
-- ===========================================================================
-- currentViewer() has always understood a patient viewer, keyed on
-- patient.auth_user_id, and getPortalHome() has always fetched the next
-- appointment, package balance, treatment history, photos and messages. The
-- portal was built and reachable.
--
-- Nothing could ever get a client into it. No code path sets auth_user_id, no
-- client sign-in page exists, and /sign-in redirects to the STAFF login. Of 35
-- Med Bar clients exactly one had a login, seeded by hand as a demo.
--
-- So this is the front door, not the room.
--
-- ===========================================================================
-- THE EMAIL COMES FROM THE TOKEN, NEVER FROM A PARAMETER
-- ===========================================================================
-- This function takes no arguments. That is the entire security design.
--
-- The address is read from auth.email(), which is a claim in the verified JWT
-- — it is there because Supabase sent a magic link to that inbox and somebody
-- opened it. An email PARAMETER would mean "link me to whoever owns this
-- address", which is an account-takeover endpoint with a helpful name.
--
-- ===========================================================================
-- EXACTLY ONE MATCH, OR NOTHING
-- ===========================================================================
-- Two clients sharing an inbox is ordinary — a couple, a parent booking for a
-- teenager. Linking "the first one" would hand somebody another person's
-- treatment history, and the failure would be invisible to everyone involved.
--
-- So an ambiguous match refuses and says to call the practice. There are no
-- shared addresses in the data today; this exists for the day there are.
--
-- Dormant records are claimable on purpose (Craig's call): a client who has not
-- been in for a year is exactly who wants to look up what they had done before
-- rebooking.

begin;

/**
 * Link the signed-in user to their own client record.
 *
 * Idempotent and safe to call on every portal load: already-linked returns
 * 'linked' without writing.
 */
create or replace function app.claim_patient_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid   := auth.uid();
  v_email text   := lower(nullif(btrim(coalesce(auth.email(), '')), ''));
  v_id    uuid;
  v_n     int;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'anonymous');
  end if;

  -- Staff use the console and must never be linked to a client record by
  -- sharing an address with one.
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

  select count(*), min(id) into v_n, v_id
  from public.patient
  where lower(email::text) = v_email
    and auth_user_id is null
    and coalesce(status, 'active') <> 'merged';

  if v_n = 0 then
    -- Deliberately the same answer whether the address is unknown or already
    -- claimed by another user: this must not confirm who is a client here.
    return jsonb_build_object('status', 'no_match');
  end if;

  if v_n > 1 then
    return jsonb_build_object('status', 'ambiguous');
  end if;

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

create or replace function public.claim_patient_account()
returns jsonb language sql security definer set search_path = ''
as $$ select app.claim_patient_account(); $$;

comment on function public.claim_patient_account() is
  'Links the signed-in user to the one client record carrying their verified '
  'email. Takes no arguments on purpose — the address comes from the JWT, not '
  'the caller.';

revoke all on function app.claim_patient_account() from public, anon, authenticated, service_role;
revoke all on function public.claim_patient_account() from public, anon, authenticated, service_role;

-- authenticated only. anon has no verified email and nothing to claim with.
grant execute on function app.claim_patient_account()    to authenticated;
grant execute on function public.claim_patient_account() to authenticated;

-- Matching is by lower(email) on every portal sign-in.
create index if not exists patient_email_lower_idx
  on public.patient (lower(email::text)) where email is not null;

commit;
