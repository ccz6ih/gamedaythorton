-- 0027_booking_notifications.sql
--
-- Makes the booking confirmation possible to send, and the attempt possible to
-- log.
--
-- ===========================================================================
-- WHY NOTHING WAS SENT
-- ===========================================================================
-- The booking action tried to read the practice's notification address before
-- emailing it:
--
--     supabase.from('clinic').select('id, name, lead_email')
--
-- `lead_email` is not granted to anon, and a column-level permission failure
-- takes out the WHOLE select — so `clinic` came back null, the `if (clinic)`
-- guard skipped the notification, and nothing was sent or even logged. The
-- booking itself worked perfectly.
--
-- This is the fourth time a missing column grant has produced a symptom that
-- pointed somewhere else: track_stock read as "the setting does nothing",
-- provider.story read as "the team section is empty", and this read as "email
-- is broken". The shape is always the same, and it is worth naming — a
-- column-level denial is indistinguishable from an empty result at the call
-- site, so the code carries on as though the row simply was not there.
--
-- The fix is NOT to grant lead_email to anon. The practice's inbox is not
-- public. app.book_appointment is security definer, so it can read it and hand
-- it back to the server action — which runs on our own server and never passes
-- it to the browser.
--
-- ===========================================================================
-- AND THE CLIENT WAS NEVER GOING TO GET ONE
-- ===========================================================================
-- Even with the address working, the only email was to the PRACTICE. The
-- success page said "a confirmation is on its way", which was untrue for the
-- person who had just booked. Two notifications now exist, and the automation
-- log has to accept both, so the anon insert policy is widened from a single
-- pinned rule_key to a short allowlist.

begin;

-- --------------------------------------------- return the notify address ----

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

  select id into v_patient
  from public.patient
  where clinic_id = c.id and email = p_email::extensions.citext
  limit 1;

  if v_patient is null then
    insert into public.patient (
      clinic_id, first_name, last_name, email, phone,
      status, acquisition_source, synthetic
    ) values (
      c.id, btrim(p_first), btrim(p_last), p_email::extensions.citext,
      nullif(btrim(p_phone), ''), 'active', 'website', v_synth
    )
    returning id into v_patient;
  else
    update public.patient
       set phone = coalesce(phone, nullif(btrim(p_phone), ''))
     where id = v_patient;
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
    'clinic_id', c.id,
    'service_name', svc.name,
    'practice_name', c.name,
    'practice_phone', c.phone_voice,
    -- For the SERVER to email. It is returned to a server action, which is our
    -- own process; nothing here reaches the browser unless the action puts it
    -- there, and it does not.
    'notify_email', coalesce(c.lead_email, c.email),
    'starts_at', v_start,
    'duration_min', svc.duration_min,
    'requires_consent', coalesce(svc.requires_consent, false),
    'synthetic', v_synth
  );
end;
$$;

-- ------------------------------------------------- log both notifications ----
-- 0012 pinned the anon insert to one rule_key. There are two now: one to the
-- practice, one to the person who booked. A short allowlist rather than an open
-- insert — anon may record that these specific things were attempted and
-- nothing else.

drop policy if exists automation_run_storefront_insert on automation_run;
create policy automation_run_storefront_insert on automation_run
  for insert to anon
  with check (
    rule_key in ('storefront_enquiry_email', 'booking_confirmation', 'booking_notice')
    and exists (
      select 1 from public.clinic c
      where c.id = automation_run.clinic_id and c.listed and c.active
    )
  );

commit;
