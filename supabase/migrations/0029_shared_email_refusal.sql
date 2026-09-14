-- 0029_shared_email_refusal.sql
--
-- When an email is already on file under a different name, say so. Do not guess.
--
-- ===========================================================================
-- WHY 0028 COULD NOT WORK
-- ===========================================================================
-- 0028 changed matching from "email is identity" to "email AND name", and
-- created a second record when only the email matched — on the reasoning that a
-- duplicate chart is recoverable and a visit on the wrong chart is not.
--
-- `patient` has a unique index on (clinic_id, email). The second record cannot
-- exist. The insert fails with a constraint violation and the person booking
-- sees a database error.
--
-- So there are three possible behaviours and only one of them is acceptable:
--
--   book on the existing chart   what it did before, and the actual bug —
--                                Craig booked and the day sheet said Sarah
--   create a second chart        blocked by the schema
--   refuse, and explain          this
--
-- ===========================================================================
-- REFUSING COSTS SOMETHING, AND IT IS THE RIGHT COST
-- ===========================================================================
-- A household sharing one address — a partner booking for a partner, a parent
-- for a daughter — now has to use a second email or ring up. That is real
-- friction on a real case, and it is still better than the alternative: a visit
-- filed against somebody else, a practitioner preparing for the wrong face, and
-- append-only treatment notes accumulating on a chart they do not belong to.
--
-- The message says what to do rather than just refusing, because a stranger who
-- hits this has done nothing wrong and needs a way forward.
--
-- If the practice would rather allow shared addresses, that is a deliberate
-- decision to drop the unique index — not something to work around here.

begin;

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
  existing   record;
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
  select id, first_name, last_name into existing
  from public.patient
  where clinic_id = c.id and email = p_email::extensions.citext
  limit 1;

  if existing.id is not null then
    if app.name_key(existing.first_name, existing.last_name) = app.name_key(p_first, p_last) then
      v_patient := existing.id;
      v_matched := true;
      -- Fill a gap, never overwrite. What the practice entered is likelier
      -- right than what somebody typed on a phone.
      update public.patient
         set phone = coalesce(phone, nullif(btrim(p_phone), ''))
       where id = v_patient;
    else
      -- A different person on an address already on file. Refuse rather than
      -- put this visit on somebody else's chart. The first name of the record
      -- holder is deliberately NOT quoted back — that would confirm who else
      -- uses this address at this practice, to anyone who guessed it.
      raise exception
        'That email address is already on file for someone else here. Please '
        'book with your own email address, or call us and we will sort it out.'
        using errcode = 'check_violation';
    end if;
  else
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
    'matched_existing', v_matched
  );
end;
$$;

revoke all on function app.book_appointment(text, uuid, date, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function app.book_appointment(text, uuid, date, text, text, text, text, text, text, boolean)
  to anon, authenticated;

commit;
