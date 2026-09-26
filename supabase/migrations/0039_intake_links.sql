-- 0039_intake_links.sql
-- Let a client fill in their own intake before they arrive.
--
-- ===========================================================================
-- WHAT WAS ACTUALLY MISSING
-- ===========================================================================
-- intake_template and intake_submission have existed since 0002 and nothing
-- has ever written to either. consent_record likewise. Meanwhile
-- appointment.intake_complete is READ in three places — the dashboard counts
-- it, the calendar draws a dot for it, Today lists it — and set by nothing, so
-- it is false on every appointment ever made and the dot means nothing.
--
-- The booking confirmation email, in her own words, says: "This treatment
-- needs a short assessment and a consent form before we start." The system
-- promises something it cannot do.
--
-- ===========================================================================
-- A TOKEN, NOT A LOGIN
-- ===========================================================================
-- There is no client login and building one is a bigger project. The
-- appointment confirmation already works this way: a single-purpose uuid that
-- IS the authorisation, emailed to the person concerned. Same pattern here, so
-- a client can fill the form on their phone from the email without an account.
--
-- SEPARATE FROM confirm_token on purpose. Confirming attendance and disclosing
-- your medical history are not the same act and must not share a secret: the
-- confirm link is designed to be one tap from an email, and widening it to
-- also open a medical form would mean anyone forwarded that email gets the
-- history too.
--
-- ===========================================================================
-- WHAT THE TOKEN CAN SEE
-- ===========================================================================
-- Deliberately narrow. app.intake_for_token returns the form, the client's
-- FIRST NAME, and when their appointment is. Not the chart, not the contact
-- details, not other appointments, not what they have had done before. A link
-- in an email reaches more places than the person it was sent to.
--
-- Once signed, it returns no answers at all — just "this is done". The window
-- in which a forwarded link exposes a medical history closes when the form is
-- submitted rather than staying open forever.

begin;

alter table appointment
  add column if not exists intake_token uuid default gen_random_uuid();

comment on column appointment.intake_token is
  'Single-purpose secret for the client-facing intake form. NOT confirm_token: '
  'confirming attendance and disclosing medical history are different acts and '
  'must not share a secret.';

create unique index if not exists appointment_intake_token_key
  on appointment (intake_token) where intake_token is not null;

-- Existing rows predate the column default.
update appointment set intake_token = gen_random_uuid() where intake_token is null;

/* --------------------------------------------------------------- read ---- */

create or replace function app.intake_for_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a   record;
  tpl record;
  sub record;
begin
  select ap.id, ap.clinic_id, ap.patient_id, ap.starts_at, ap.intake_complete,
         p.first_name, s.name as service_name, c.name as practice_name,
         c.pilot_mode
    into a
  from public.appointment ap
  join public.patient p on p.id = ap.patient_id
  join public.clinic  c on c.id = ap.clinic_id
  left join public.service s on s.id = ap.service_id
  where ap.intake_token = p_token;

  -- An unknown token and an expired one give the same answer, so the response
  -- cannot be used to test whether a token is real.
  if a.id is null or a.starts_at < now() - interval '30 days' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select * into tpl
  from public.intake_template
  where clinic_id = a.clinic_id and active
  order by updated_at desc
  limit 1;

  if tpl.id is null then
    return jsonb_build_object('status', 'no_form');
  end if;

  select * into sub
  from public.intake_submission
  where appointment_id = a.id
  order by created_at desc
  limit 1;

  -- Already signed: acknowledge it and return nothing further. Re-opening a
  -- forwarded link must not reprint somebody's medical history.
  if sub.signed_at is not null then
    return jsonb_build_object(
      'status', 'signed',
      'first_name', a.first_name,
      'practice_name', a.practice_name,
      'signed_at', sub.signed_at
    );
  end if;

  return jsonb_build_object(
    'status', 'open',
    'first_name', a.first_name,
    'practice_name', a.practice_name,
    'service_name', a.service_name,
    'starts_at', a.starts_at,
    'template_id', tpl.id,
    'template_version', tpl.version,
    'template_name', tpl.name,
    'sections', tpl.sections,
    'consents', tpl.consents,
    -- Their own partial answers, so a form half-filled on the bus survives.
    'answers', coalesce(sub.answers, '{}'::jsonb)
  );
end;
$$;

/* -------------------------------------------------------------- write ---- */

/**
 * Submit the form.
 *
 * Writes three things in one transaction, because a consent record without the
 * answers it was given alongside, or answers with no record of what was
 * agreed, is worse than neither:
 *
 *   1. intake_submission  — the answers, the template version they saw
 *   2. consent_record     — one row per consent, WITH the exact wording
 *   3. appointment        — intake_complete, so the dot on the calendar
 *                           finally means something
 *
 * text_snapshot is the point of the consent table. A consent that records only
 * "they ticked photo" is not evidence of anything; what makes it evidence is
 * the sentence they were shown at the time, stored next to the tick.
 */
create or replace function app.intake_submit(
  p_token    uuid,
  p_answers  jsonb,
  p_consents jsonb,
  p_ip       text default null,
  p_agent    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a        record;
  tpl      record;
  v_sub    uuid;
  v_ip     inet;
  item     jsonb;
  v_given  boolean;
  v_label  text;
  v_synth  boolean;
begin
  select ap.id, ap.clinic_id, ap.patient_id, ap.starts_at, c.pilot_mode
    into a
  from public.appointment ap
  join public.clinic c on c.id = ap.clinic_id
  where ap.intake_token = p_token;

  if a.id is null or a.starts_at < now() - interval '30 days' then
    raise exception 'That form is no longer available.' using errcode = 'no_data_found';
  end if;

  select * into tpl
  from public.intake_template
  where clinic_id = a.clinic_id and active
  order by updated_at desc limit 1;

  if tpl.id is null then
    raise exception 'No form is set up for this practice.' using errcode = 'no_data_found';
  end if;

  -- Guarded, same as the enquiry form: x-forwarded-for is attacker controlled
  -- and a malformed value must cost the IP, not the submission.
  begin
    v_ip := nullif(btrim(coalesce(p_ip, '')), '')::inet;
  exception when others then
    v_ip := null;
  end;

  v_synth := coalesce(a.pilot_mode, true);

  insert into public.intake_submission (
    clinic_id, patient_id, appointment_id, template_id, template_version,
    answers, percent_complete, submitted_at, signed_at, signature_ref, synthetic
  ) values (
    a.clinic_id, a.patient_id, a.id, tpl.id, tpl.version,
    coalesce(p_answers, '{}'::jsonb), 100, now(), now(),
    -- Not a drawn signature. See the note in the route: this records a typed
    -- affirmation with a timestamp and an address, and says so plainly rather
    -- than implying something it is not.
    'typed_affirmation', v_synth
  )
  returning id into v_sub;

  /* One consent_record per item, carrying the words they were shown. */
  for item in select * from jsonb_array_elements(coalesce(p_consents, '[]'::jsonb))
  loop
    v_given := coalesce((item->>'granted')::boolean, false);
    v_label := item->>'label';

    insert into public.consent_record (
      clinic_id, patient_id, type, granted, text_version, text_snapshot,
      captured_at, ip, user_agent, synthetic
    ) values (
      a.clinic_id, a.patient_id,
      (item->>'key')::public.consent_type,
      v_given, tpl.version, v_label,
      now(), v_ip, p_agent, v_synth
    );
  end loop;

  update public.appointment
     set intake_complete = true
   where id = a.id;

  return jsonb_build_object('status', 'signed', 'submission_id', v_sub);
end;
$$;

/* ------------------------------------------------------------- surface ---- */

create or replace function public.intake_for_token(p_token uuid)
returns jsonb language sql security definer set search_path = ''
as $$ select app.intake_for_token(p_token); $$;

create or replace function public.intake_submit(
  p_token uuid, p_answers jsonb, p_consents jsonb,
  p_ip text default null, p_agent text default null
)
returns jsonb language sql security definer set search_path = ''
as $$ select app.intake_submit(p_token, p_answers, p_consents, p_ip, p_agent); $$;

revoke all on function app.intake_for_token(uuid) from public, anon, authenticated, service_role;
revoke all on function public.intake_for_token(uuid) from public, anon, authenticated, service_role;
revoke all on function app.intake_submit(uuid, jsonb, jsonb, text, text) from public, anon, authenticated, service_role;
revoke all on function public.intake_submit(uuid, jsonb, jsonb, text, text) from public, anon, authenticated, service_role;

grant execute on function app.intake_for_token(uuid)    to anon, authenticated;
grant execute on function public.intake_for_token(uuid) to anon, authenticated;
grant execute on function app.intake_submit(uuid, jsonb, jsonb, text, text)    to anon, authenticated;
grant execute on function public.intake_submit(uuid, jsonb, jsonb, text, text) to anon, authenticated;

commit;
