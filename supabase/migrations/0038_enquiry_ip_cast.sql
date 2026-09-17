-- 0038_enquiry_ip_cast.sql
-- 0037 could not insert a single row.
--
-- `lead.consent_ip` is `inet`, not `text`. The function passed p_ip straight in
-- and Postgres refused the whole insert:
--
--     column "consent_ip" is of type inet but expression is of type text
--
-- So the fix for silent enquiry emails would have turned them into loud
-- failures — the visitor would have seen "Something went wrong sending that."
-- and the enquiry would not have been recorded at all. Strictly worse than the
-- bug it replaced.
--
-- Found by calling the function as `anon` against the real table immediately
-- after applying it, rather than by reading it again. A type mismatch between a
-- function and a column is invisible in the source of either one.
--
-- A NEW FILE rather than an edit, because 0037 has been applied. Migrations are
-- append-only; `create or replace` makes the correction clean.
--
-- ===========================================================================
-- WHY THE CAST IS GUARDED
-- ===========================================================================
-- p_ip comes from x-forwarded-for, which is a header and therefore attacker
-- controlled. `'not-an-ip'::inet` raises, and an exception here would lose the
-- enquiry over a field that exists only for consent evidence. A bad value is
-- recorded as null: the enquiry is the thing that matters, and a missing IP is
-- a weaker consent record, not a lost client.

begin;

create or replace function app.submit_enquiry(
  p_clinic_slug text,
  p_name        text,
  p_phone       text default null,
  p_email       text default null,
  p_interest    text default null,
  p_message     text default null,
  p_sms_consent boolean default false,
  p_consent_ver text default null,
  p_ip          text default null,
  p_user_agent  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c        record;
  v_lead   uuid;
  v_synth  boolean;
  v_body   text;
  v_ip     inet;
begin
  select id, name, listed, active, lead_email, email into c
  from public.clinic where slug = p_clinic_slug;

  if c.id is null or not (c.listed and c.active) then
    raise exception 'This practice is not taking enquiries.' using errcode = 'check_violation';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Please give a name.' using errcode = 'check_violation';
  end if;

  if (p_phone is null or btrim(p_phone) = '')
     and (p_email is null or btrim(p_email) = '') then
    raise exception 'Please give either a phone number or an email address.'
      using errcode = 'check_violation';
  end if;

  -- The pilot guard, read rather than assumed.
  select pilot_mode into v_synth from public.clinic where id = c.id;

  -- Guarded cast: a malformed header must not cost the enquiry.
  begin
    v_ip := nullif(btrim(coalesce(p_ip, '')), '')::inet;
  exception when others then
    v_ip := null;
  end;

  v_body := nullif(
    concat_ws(
      E'\n',
      nullif(case when btrim(coalesce(p_interest, '')) <> ''
                  then 'Interested in: ' || btrim(p_interest) end, ''),
      nullif(btrim(coalesce(p_message, '')), '')
    ), '');

  insert into public.lead (
    clinic_id, name, phone, email, source, message,
    consent_transactional_sms, consent_email, consent_captured_at,
    consent_ip, consent_user_agent, consent_text_version, synthetic
  ) values (
    c.id,
    btrim(p_name),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_email, '')), ''),
    'website',
    v_body,
    coalesce(p_sms_consent, false),
    nullif(btrim(coalesce(p_email, '')), '') is not null,
    case when coalesce(p_sms_consent, false)
           or nullif(btrim(coalesce(p_email, '')), '') is not null
         then now() end,
    v_ip,
    p_user_agent,
    case when coalesce(p_sms_consent, false) then p_consent_ver end,
    coalesce(v_synth, true)
  )
  returning id into v_lead;

  return jsonb_build_object(
    'lead_id', v_lead,
    'clinic_id', c.id,
    'practice_name', c.name,
    'notify_email', coalesce(c.lead_email, c.email),
    'synthetic', coalesce(v_synth, true)
  );
end;
$$;

commit;
