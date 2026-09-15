-- 0033_appointment_confirmation.sql
-- One tap from the reminder email to "yes, I'm coming".
--
-- ===========================================================================
-- WHAT THIS REPLACES
-- ===========================================================================
-- The reminder currently ends "If anything has changed, reply to this email."
-- That makes confirmation a thing the practice READS, in an inbox, between
-- clients — and silence is ambiguous: a client who is definitely coming and a
-- client who forgot look identical right up until 2pm.
--
-- The `confirmed` status has existed in the appointment_status enum since the
-- schema was written and nothing has ever set it.
--
-- ===========================================================================
-- WHY A SEPARATE TOKEN RATHER THAN THE APPOINTMENT ID
-- ===========================================================================
-- The id is a uuid and unguessable, so it would be safe enough to put in a
-- link. It is not safe to REUSE, which is the actual objection: an id in an
-- emailed URL leaks into browser history, referrer headers and any link
-- scanner the client's mail provider runs, and it is the same identifier the
-- console uses everywhere else.
--
-- A token that can do exactly one thing — mark this one appointment confirmed —
-- can be handed out freely and revoked without touching the appointment.
--
-- ===========================================================================
-- WHAT CONFIRMING DOES NOT DO
-- ===========================================================================
-- It does not cancel, reschedule, or reveal anything about the client. The
-- endpoint takes a token and returns the time and the treatment name — enough
-- to render "you're confirmed for Wednesday at 2pm" — and nothing else. No
-- name, no contact details, no history. A link in an email ends up in more
-- places than the person it was sent to.

begin;

alter table appointment
  add column if not exists confirmed_at timestamptz,
  -- Unguessable, single-purpose, and independent of the appointment's own id.
  add column if not exists confirm_token uuid not null default gen_random_uuid();

comment on column appointment.confirmed_at is
  'When the client confirmed, via the link in their reminder. Null means not '
  'confirmed, which is different from not contacted.';
comment on column appointment.confirm_token is
  'Single-purpose secret for the confirmation link. Safe to email; cannot read '
  'or change anything but this appointment''s confirmed state.';

create unique index if not exists appointment_confirm_token_key
  on appointment (confirm_token);

-- ---------------------------------------------------------------------------
-- app.confirm_appointment — the whole of what a link can do
-- ---------------------------------------------------------------------------
create or replace function app.confirm_appointment(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  appt record;
begin
  select a.id, a.starts_at, a.status, a.confirmed_at, a.clinic_id,
         s.name as service_name, c.name as clinic_name
    into appt
    from public.appointment a
    left join public.service s on s.id = a.service_id
    join public.clinic c on c.id = a.clinic_id
   where a.confirm_token = p_token;

  if not found then
    -- Deliberately the same answer as an expired one. A distinct "no such
    -- token" reply turns this into an oracle for guessing them.
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  if appt.status in ('cancelled', 'no_show') then
    return jsonb_build_object('ok', false, 'reason', 'cancelled');
  end if;

  if appt.starts_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'past');
  end if;

  -- Idempotent: a client who taps the link twice, or whose mail provider
  -- pre-fetches it, gets the same answer rather than an error.
  if appt.confirmed_at is null then
    update public.appointment
       set confirmed_at = now(),
           -- Only from 'booked'. Someone already marked arrived or complete
           -- keeps that, because the front desk knows more than the email does.
           status = case when status = 'booked' then 'confirmed'::public.appointment_status
                         else status end,
           updated_at = now()
     where id = appt.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'startsAt', appt.starts_at,
    'service', appt.service_name,
    'clinic', appt.clinic_name
  );
end;
$$;

-- PostgREST only exposes `public`.
create or replace function public.confirm_appointment(p_token uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$ select app.confirm_appointment(p_token) $$;

revoke all on function app.confirm_appointment(uuid) from public, anon, authenticated;
revoke all on function public.confirm_appointment(uuid) from public;
-- Anonymous on purpose: the client clicking it is not logged in and never will
-- be. The token is the authorisation.
grant execute on function public.confirm_appointment(uuid) to anon, authenticated;

commit;
