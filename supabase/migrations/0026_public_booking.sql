-- 0026_public_booking.sql
--
-- Booking an appointment from the website, without letting the website read the
-- calendar.
--
-- ===========================================================================
-- THE PROBLEM THIS SOLVES
-- ===========================================================================
-- The storefront could take an enquiry — a name and a message that a human then
-- answers. That is a step backwards from what the practice already has, where a
-- client picks a treatment, picks a time, and is booked without anyone being
-- involved. A booking site that cannot book is a brochure.
--
-- ===========================================================================
-- AVAILABILITY IS COMPUTED, NEVER READ
-- ===========================================================================
-- The obvious implementation is to let the page read `appointment` and work out
-- the gaps. That would mean granting anon select on the appointment table, and
-- an appointment row says that a named person is at a med spa at 2pm on
-- Thursday. Publishing the practice's diary is not an acceptable price for a
-- booking form.
--
-- So `app.public_slots` reads the calendar INSIDE the database, as a security
-- definer, and returns only a list of free start times. A stranger learns that
-- 10:15 is available. They cannot learn that 11:00 is taken, by whom, or for
-- what — an unavailable slot is simply absent, which is indistinguishable from
-- the practice being closed, on lunch, or fully booked.
--
-- ===========================================================================
-- WHAT IS DELIBERATELY NOT HERE
-- ===========================================================================
-- No deposit, no card on file, no cancellation window. Those are real features
-- and each is a decision the practice has to make rather than inherit. A first
-- booking flow that works is worth more than a complete one that is waiting on
-- three answers.

begin;

-- ===========================================================================
-- app.public_slots — free start times for one service on one day
-- ===========================================================================

create or replace function app.public_slots(
  p_clinic_slug text,
  p_service_id  uuid,
  p_date        date
)
returns text[]
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  c        record;
  svc      record;
  v_hours  jsonb;
  v_day    text;
  v_open   int;
  v_close  int;
  v_need   int;
  t        int;
  v_out    text[] := '{}';
  v_now    timestamptz := now();
  v_lead   int := 120;   -- minutes of notice before the earliest bookable slot
begin
  select id, hours, listed, active into c
  from public.clinic where slug = p_clinic_slug;

  if c.id is null or not (c.listed and c.active) then
    return '{}';
  end if;

  select id, duration_min, buffer_after_min, online_bookable, active
    into svc
  from public.service
  where id = p_service_id and clinic_id = c.id;

  if svc.id is null or not (svc.active and svc.online_bookable) then
    return '{}';
  end if;

  -- No booking in the past, and none more than sixty days out — a calendar that
  -- runs forever invites somebody to book a treatment in March.
  if p_date < (v_now at time zone 'America/Denver')::date
     or p_date > (v_now at time zone 'America/Denver')::date + 60 then
    return '{}';
  end if;

  v_day := to_char(p_date, 'Dy');
  v_hours := (
    select h from jsonb_array_elements(c.hours) h
    where h->>'day' = v_day
    limit 1
  );

  if v_hours is null or v_hours->>'open' is null or v_hours->>'close' is null then
    return '{}';   -- closed that day
  end if;

  v_open  := split_part(v_hours->>'open', ':', 1)::int * 60
           + split_part(v_hours->>'open', ':', 2)::int;
  v_close := split_part(v_hours->>'close', ':', 1)::int * 60
           + split_part(v_hours->>'close', ':', 2)::int;

  v_need := svc.duration_min + coalesce(svc.buffer_after_min, 0);

  t := v_open;
  while t + svc.duration_min <= v_close loop
    declare
      v_start timestamptz;
      v_clash boolean;
    begin
      -- Denver wall-clock to a real instant, so daylight saving is handled by
      -- the database rather than by arithmetic somebody has to remember.
      v_start := (p_date::text || ' ' || lpad((t / 60)::text, 2, '0') || ':'
                  || lpad((t % 60)::text, 2, '0'))::timestamp
                 at time zone 'America/Denver';

      -- Enough notice. A slot forty minutes from now is not really bookable.
      if v_start < v_now + make_interval(mins => v_lead) then
        t := t + 15;
        continue;
      end if;

      -- Anything already on the calendar, including its buffer.
      select exists (
        select 1 from public.appointment a
        where a.clinic_id = c.id
          and a.status in ('booked', 'confirmed', 'arrived')
          and a.starts_at < v_start + make_interval(mins => v_need)
          and (a.starts_at + make_interval(mins => a.duration_min + coalesce(a.buffer_min, 0)))
              > v_start
      ) into v_clash;

      if not v_clash then
        -- Time the practice has blocked out for itself.
        select exists (
          select 1 from public.blocked_time b
          where b.clinic_id = c.id
            and b.starts_at < v_start + make_interval(mins => v_need)
            and b.ends_at > v_start
        ) into v_clash;
      end if;

      if not v_clash then
        v_out := v_out || (lpad((t / 60)::text, 2, '0') || ':' || lpad((t % 60)::text, 2, '0'));
      end if;
    end;

    t := t + 15;
  end loop;

  return v_out;
end;
$$;

-- ===========================================================================
-- app.book_appointment — the booking itself
-- ===========================================================================
-- Matches an existing client by email, or creates one. Deliberately SILENT
-- about which: a form that says "welcome back" tells whoever typed the address
-- that it belongs to a client of this practice, and that is a disclosure the
-- practice did not agree to make.

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
  select id, name, listed, active into c
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

  -- The slot must still be free NOW, not when the page was loaded. Two people
  -- on the same time is the failure this prevents, and it is common enough on a
  -- small practice's diary to be worth the extra call.
  v_free := app.public_slots(p_clinic_slug, p_service_id, p_date);
  if not (p_time = any(v_free)) then
    raise exception 'That time has just been taken. Please pick another.'
      using errcode = 'check_violation';
  end if;

  -- A brake on automated booking. Not a rate limiter; enough that a loop
  -- cannot fill a week.
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

  -- Existing client, or a new one. Matched on email, which is the only thing
  -- here that is actually an identity — two people share a phone far more often
  -- than an inbox, and the client import learned that the hard way.
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
    -- Fill in a phone number we did not have. Never overwrite one we did: the
    -- record on file was entered by the practice and is likelier to be right.
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

  -- The note the client typed, kept where the practice will actually see it.
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
    'service_name', svc.name,
    'practice_name', c.name,
    'starts_at', v_start,
    'duration_min', svc.duration_min,
    'requires_consent', coalesce(svc.requires_consent, false)
  );
end;
$$;

-- --------------------------------------------------------------- surface ----
-- PostgREST reads `public`, so wrappers, same as 0016.

create or replace function public.public_slots(
  p_clinic_slug text, p_service_id uuid, p_date date
)
returns text[] language sql security definer stable set search_path = '' as $$
  select app.public_slots(p_clinic_slug, p_service_id, p_date);
$$;

create or replace function public.book_appointment(
  p_clinic_slug text, p_service_id uuid, p_date date, p_time text,
  p_first text, p_last text, p_email text,
  p_phone text default null, p_note text default null, p_sms_consent boolean default false
)
returns jsonb language sql security definer set search_path = '' as $$
  select app.book_appointment(p_clinic_slug, p_service_id, p_date, p_time,
                              p_first, p_last, p_email, p_phone, p_note, p_sms_consent);
$$;

-- ---------------------------------------------------------------- grants ----
-- Both are anon-callable, which is the point. Note what that does NOT include:
-- no select on `appointment`, `patient` or `blocked_time` anywhere. A stranger
-- can find a free time and take it, and can learn nothing else about the diary.

revoke all on function app.public_slots(text, uuid, date) from public, anon, authenticated;
revoke all on function app.book_appointment(text, uuid, date, text, text, text, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.public_slots(text, uuid, date) from public, anon, authenticated, service_role;
revoke all on function public.book_appointment(text, uuid, date, text, text, text, text, text, text, boolean)
  from public, anon, authenticated, service_role;

grant execute on function app.public_slots(text, uuid, date) to anon, authenticated;
grant execute on function app.book_appointment(text, uuid, date, text, text, text, text, text, text, boolean)
  to anon, authenticated;
grant execute on function public.public_slots(text, uuid, date) to anon, authenticated;
grant execute on function public.book_appointment(text, uuid, date, text, text, text, text, text, text, boolean)
  to anon, authenticated;

commit;
