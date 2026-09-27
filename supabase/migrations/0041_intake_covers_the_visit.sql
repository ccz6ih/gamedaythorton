-- 0041_intake_covers_the_visit.sql
-- One form per visit, not one per appointment.
--
-- ===========================================================================
-- CRAIG'S POINT
-- ===========================================================================
-- Amanda booked waxing at 1pm and lashes at 3pm on the same afternoon. As
-- built, that is two confirmation emails each carrying a different form link,
-- and a client who fills one in is still marked incomplete for the other. The
-- obvious question — "which form do I fill in?" — has no good answer, and the
-- honest one is "both, and they are identical".
--
-- Nobody gives their medical history twice in one afternoon. The form covers
-- the person and the day; it is not a per-procedure artefact.
--
-- ===========================================================================
-- WHAT THIS CHANGES, PRECISELY
-- ===========================================================================
-- intake_for_token now looks for a signed submission from the SAME PATIENT on
-- the SAME LOCAL DAY, rather than only against the one appointment the token
-- belongs to. Two consequences, both wanted:
--
--   - the second confirmation email carries no form link, because
--     intakeLinkFor() asks this function and it no longer answers "open"
--   - opening the second link after filling the first says "All done" rather
--     than presenting the same questions again
--
-- intake_submit marks every appointment that patient has that day complete, so
-- Today stops flagging the 3pm for a form that was filled at 1pm.
--
-- ===========================================================================
-- THE JUDGEMENT IN THIS, STATED PLAINLY
-- ===========================================================================
-- A per-procedure contraindication check is a defensible thing to want: what
-- matters before neurotoxin is not what matters before waxing. This treats the
-- form as covering the VISIT, which is the common practice and what the
-- questions as written actually ask — history, medications, allergies, recent
-- treatments. None of them are procedure-specific.
--
-- The day boundary is deliberate and narrow. It does NOT carry a submission
-- forward to next month, because how long a health history stays current is a
-- clinical threshold and Jamie's to set, not one to infer from a schema.

begin;

create or replace function app.intake_for_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a    record;
  tpl  record;
  sub  record;
  v_tz text;
begin
  select ap.id, ap.clinic_id, ap.patient_id, ap.starts_at, ap.intake_complete,
         p.first_name, s.name as service_name, c.name as practice_name,
         c.pilot_mode, coalesce(c.timezone, 'America/Denver') as tz
    into a
  from public.appointment ap
  join public.patient p on p.id = ap.patient_id
  join public.clinic  c on c.id = ap.clinic_id
  left join public.service s on s.id = ap.service_id
  where ap.intake_token = p_token;

  if a.id is null or a.starts_at < now() - interval '30 days' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  v_tz := a.tz;

  select * into tpl
  from public.intake_template
  where clinic_id = a.clinic_id and active
  order by updated_at desc limit 1;

  if tpl.id is null then
    return jsonb_build_object('status', 'no_form');
  end if;

  /* Anything this person signed for this DAY, whichever appointment it was
     attached to. This is the whole change. */
  select s2.* into sub
  from public.intake_submission s2
  join public.appointment a2 on a2.id = s2.appointment_id
  where s2.patient_id = a.patient_id
    and s2.signed_at is not null
    and (a2.starts_at at time zone v_tz)::date = (a.starts_at at time zone v_tz)::date
  order by s2.signed_at desc
  limit 1;

  if sub.id is not null then
    return jsonb_build_object(
      'status', 'signed',
      'first_name', a.first_name,
      'practice_name', a.practice_name,
      'signed_at', sub.signed_at
    );
  end if;

  -- Nothing signed yet: their own partial answers for THIS appointment, so a
  -- form half-filled on the bus survives.
  select * into sub
  from public.intake_submission
  where appointment_id = a.id
  order by created_at desc limit 1;

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
    'answers', coalesce(sub.answers, '{}'::jsonb)
  );
end;
$$;

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
  a       record;
  tpl     record;
  v_sub   uuid;
  v_ip    inet;
  item    jsonb;
  v_given boolean;
  v_label text;
  v_synth boolean;
  v_tz    text;
  v_also  int;
begin
  select ap.id, ap.clinic_id, ap.patient_id, ap.starts_at, c.pilot_mode,
         coalesce(c.timezone, 'America/Denver') as tz
    into a
  from public.appointment ap
  join public.clinic c on c.id = ap.clinic_id
  where ap.intake_token = p_token;

  if a.id is null or a.starts_at < now() - interval '30 days' then
    raise exception 'That form is no longer available.' using errcode = 'no_data_found';
  end if;

  v_tz := a.tz;

  select * into tpl
  from public.intake_template
  where clinic_id = a.clinic_id and active
  order by updated_at desc limit 1;

  if tpl.id is null then
    raise exception 'No form is set up for this practice.' using errcode = 'no_data_found';
  end if;

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
    'typed_affirmation', v_synth
  )
  returning id into v_sub;

  for item in select * from jsonb_array_elements(coalesce(p_consents, '[]'::jsonb))
  loop
    v_given := coalesce((item->>'granted')::boolean, false);
    v_label := item->>'label';
    insert into public.consent_record (
      clinic_id, patient_id, type, granted, text_version, text_snapshot,
      captured_at, ip, user_agent, synthetic
    ) values (
      a.clinic_id, a.patient_id, (item->>'key')::public.consent_type,
      v_given, tpl.version, v_label, now(), v_ip, p_agent, v_synth
    );
  end loop;

  /* Every appointment this person has that day, not just the one the link came
     from — otherwise Today keeps flagging the 3pm for a form filled at 1pm. */
  update public.appointment
     set intake_complete = true
   where patient_id = a.patient_id
     and clinic_id = a.clinic_id
     and (starts_at at time zone v_tz)::date = (a.starts_at at time zone v_tz)::date;

  get diagnostics v_also = row_count;

  return jsonb_build_object(
    'status', 'signed',
    'submission_id', v_sub,
    'appointments_covered', v_also
  );
end;
$$;

commit;
