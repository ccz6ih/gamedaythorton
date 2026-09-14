-- 0028_booking_identity.sql
--
-- A booking must not land on somebody else's chart.
--
-- ===========================================================================
-- WHAT HAPPENED
-- ===========================================================================
-- Craig booked as "Craig Carda" with craigcarda2@gmail.com. That address was
-- already on Sarah Carda's record, so the booking matched her, used HER name,
-- and the practice's day sheet showed Sarah Carda arriving twice.
--
-- The matching rule was "email is identity". That rule came from the client
-- import, which had used phone alone and merged two different people — and the
-- correction then was that email is the stronger signal. It is. But stronger is
-- not sufficient, and applying it here reproduced the same class of error one
-- level up.
--
-- ===========================================================================
-- WHY THIS MATTERS MORE THAN A DUPLICATE ROW
-- ===========================================================================
-- Households share an email constantly, and a med spa is exactly where that
-- happens: one partner books for the other, a mother books for a daughter, a
-- couple has used the same address for fifteen years. Filing the wrong person's
-- appointment on a chart means the practitioner preps for the wrong face, and —
-- once treatment notes exist — clinical history accumulates on the wrong
-- record. Notes are append-only by design, so that is expensive to unpick.
--
-- A duplicate chart is a nuisance somebody can merge in a minute. A visit on
-- the wrong chart is a records error. Given the choice, create the duplicate.
--
-- ===========================================================================
-- THE RULE NOW
-- ===========================================================================
-- Match on email AND name. Names are compared loosely — case, punctuation and
-- extra spaces ignored — so "craig carda" and "Craig  Carda" are the same
-- person, but "Craig" and "Sarah" are not.
--
-- A nickname ("Mike" for "Michael") will create a second record. That is the
-- failure this deliberately accepts, because it fails toward the recoverable
-- side.

begin;

/**
 * Loose name comparison. Lower case, letters and digits only.
 */
create or replace function app.name_key(p_first text, p_last text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(lower(coalesce(p_first, '') || ' ' || coalesce(p_last, '')),
                        '[^a-z0-9]+', '', 'g');
$$;

create or replace function app.book_appointment(
  p_clinic_slug text,
  p_service_id  uuid,
  p_date        date,
  p_time        text,
  p_first       text,
  p_last        text,
  p_email       text,
  p_phone       text default null,
  p_note        text default null,
  p_sms_consent boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c          record;
  svc        record;
  v_start    timestamptz;
  v_patient  uuid;
  v_provider uuid;
  v_appt     uuid;
  v_recent   int;
  v_free     text[];
  v_synth    boolean;
  v_matched  boolean := false;
begin
  select id, name, listed, active, lead_email, email, phone_voice into c
  from public.clinic where slug = p_clinic_slug;

  if c.id is null or not (c.listed and c.active) then
    raise exception 'This practice is not taking online bookings.' using errcode = 'check_violation';
  end if;

  select id, name, duration_min, buffer_after_min, online_bookable, active, requires_consent
    into svc
  from public.service where id = p_service_id and clinic_id = c.id;

  if svc.id is null or not (svc.active and svc.online_bookable) then
    raise exception 'That treatment is not available to book online.' using errcode = 'check_violation';
  end if;

  if p_first is null or btrim(p_first) = '' or p_last is null or btrim(p_last) = '' then
    raise exception 'A first and last name are needed for the appointment.'
      using errcode = 'check_violation';
  end if;
  if p_email is null or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'That email address does not look right — we need a working one to confirm.'
      using errcode = 'check_violation';
  end if;
  if p_time !~ '^\d{2}:\d{2}$' then
    raise exception 'Pick a time.' using errcode = 'check_violation';
  end if;

  v_start := (p_date::text || ' ' || p_time)::timestamp at time zone 'America/Denver';

  v_free := app.public_slots(p_clinic_slug, p_service_id, p_date);
  if not (p_time = any(v_free)) then
    raise exception 'That time has just been taken. Please pick another.'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_recent
  from public.appointment a
  join public.patient pt on pt.id = a.patient_id
  where a.clinic_id = c.id
    and pt.email = p_email::extensions.citext
    and a.created_at > now() - interval '1 hour';

  if v_recent >= 3 then
    raise exception 'There are already several bookings for this email in the last hour. '
      'Please call us if you need another.'
      using errcode = 'check_violation';
  end if;

  v_synth := app.clinic_in_pilot(c.id);

  -- ------------------------------------------------------------ identity --
  -- EMAIL AND NAME, not email alone. See the header.
  select id into v_patient
  from public.patient
  where clinic_id = c.id
    and email = p_email::extensions.citext
    and app.name_key(first_name, last_name) = app.name_key(p_first, p_last)
  limit 1;

  if v_patient is not null then
    v_matched := true;
    -- Fill a gap, never overwrite. What the practice entered is likelier right
    -- than what somebody typed on a phone.
    update public.patient
       set phone = coalesce(phone, nullif(btrim(p_phone), ''))
     where id = v_patient;
  else
    -- No match on both. If the address belongs to somebody else at this
    -- practice, this is a second person on a shared household address, and
    -- they get their own record.
    insert into public.patient (
      clinic_id, first_name, last_name, email, phone,
      status, acquisition_source, synthetic
    ) values (
      c.id, btrim(p_first), btrim(p_last), p_email::extensions.citext,
      nullif(btrim(p_phone), ''), 'active', 'website', v_synth
    )
    returning id into v_patient;
  end if;

  select id into v_provider
  from public.provider where clinic_id = c.id and active
  order by sort_order limit 1;

  insert into public.appointment (
    clinic_id, patient_id, provider_id, service_id,
    starts_at, duration_min, buffer_min,
    status, booking_channel, synthetic
  ) values (
    c.id, v_patient, v_provider, svc.id,
    v_start, svc.duration_min, coalesce(svc.buffer_after_min, 0),
    'booked', 'online', v_synth
  )
  returning id into v_appt;

  if nullif(btrim(p_note), '') is not null then
    insert into public.lead (
      clinic_id, name, email, phone, source, message,
      consent_transactional_sms, consent_captured_at, synthetic
    ) values (
      c.id, btrim(p_first) || ' ' || btrim(p_last), p_email::extensions.citext,
      nullif(btrim(p_phone), ''), 'booking', btrim(p_note),
      coalesce(p_sms_consent, false), now(), v_synth
    );
  end if;

  return jsonb_build_object(
    'appointment_id', v_appt,
    'patient_id', v_patient,
    'clinic_id', c.id,
    'service_name', svc.name,
    'practice_name', c.name,
    'practice_phone', c.phone_voice,
    'notify_email', coalesce(c.lead_email, c.email),
    'starts_at', v_start,
    'duration_min', svc.duration_min,
    'requires_consent', coalesce(svc.requires_consent, false),
    'synthetic', v_synth,
    -- Whether this went on an existing chart. Not shown to the person booking —
    -- "welcome back" tells whoever typed an address that it belongs to a client
    -- here — but useful to the practice and to tests.
    'matched_existing', v_matched
  );
end;
$$;

-- `create or replace` keeps grants, but state them rather than rely on it.
revoke all on function app.book_appointment(text, uuid, date, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function app.book_appointment(text, uuid, date, text, text, text, text, text, text, boolean)
  to anon, authenticated;

commit;
