-- 0037_enquiry_notifications.sql
-- The enquiry form never told anybody.
--
-- ===========================================================================
-- THE FIFTH TIME
-- ===========================================================================
-- 0027 fixed exactly this for BOOKINGS and wrote it down:
--
--   "This is the fourth time a missing column grant has produced a symptom
--    that pointed somewhere else... a column-level denial is
--    indistinguishable from an empty result at the call site, so the code
--    carries on as though the row simply was not there."
--
-- The enquiry page was left on the old pattern. It does:
--
--     supabase.from('clinic').select('lead_email')
--
-- as anon, which has no grant on that column, so the select returns nothing,
-- `to` is null, and sendEnquiryEmail logs `suppressed: 'No destination address
-- set for this practice.'` — while clinic.lead_email is sitting there
-- correctly filled in.
--
-- Found on live data: an enquiry arrived 15 Sept 14:14 UTC and was suppressed.
-- That one happened to be spam, so nothing was lost. The next one would not be.
--
-- ===========================================================================
-- THE FIX IS THE SAME ONE
-- ===========================================================================
-- Not a grant. The practice's inbox is not public, and granting it to anon to
-- solve a server-side problem would publish it to every visitor. Instead the
-- insert moves into a security-definer function that can read the address and
-- hand it back to the server action — our own process, which emails from there
-- and never passes it to the browser.
--
-- ===========================================================================
-- AND THE SYNTHETIC FLAG WAS STUCK ON
-- ===========================================================================
-- The page hardcoded `synthetic: true` with a comment explaining it as the
-- pilot guard — correct when it was written, because The Med Bar was in pilot
-- mode and the database refuses non-synthetic rows while it is. That clinic is
-- live now (pilot_mode = false), so every real enquiry has been landing
-- labelled as test data, in the table the practice uses to decide who to ring.
--
-- Decided from the clinic's own flag here, so it cannot go stale again: a
-- pilot tenant still marks synthetic, a live one does not.

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
begin
  select id, name, listed, active, lead_email, email into c
  from public.clinic where slug = p_clinic_slug;

  if c.id is null or not (c.listed and c.active) then
    raise exception 'This practice is not taking enquiries.' using errcode = 'check_violation';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Please give a name.' using errcode = 'check_violation';
  end if;

  -- One way to reply is the minimum. Matches what the form already enforces,
  -- restated here because a check that only exists in the browser is not one.
  if (p_phone is null or btrim(p_phone) = '')
     and (p_email is null or btrim(p_email) = '') then
    raise exception 'Please give either a phone number or an email address.'
      using errcode = 'check_violation';
  end if;

  -- The pilot guard, read rather than assumed. While a clinic is in pilot mode
  -- every PHI table rejects rows not marked synthetic; once it is live, real
  -- enquiries must be recorded as real.
  select pilot_mode into v_synth from public.clinic where id = c.id;

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
    p_ip,
    p_user_agent,
    case when coalesce(p_sms_consent, false) then p_consent_ver end,
    coalesce(v_synth, true)
  )
  returning id into v_lead;

  return jsonb_build_object(
    'lead_id', v_lead,
    'clinic_id', c.id,
    'practice_name', c.name,
    -- For the SERVER to email. Returned to a server action, which is our own
    -- process; it never reaches the browser unless the action puts it there,
    -- and it does not.
    'notify_email', coalesce(c.lead_email, c.email),
    'synthetic', coalesce(v_synth, true)
  );
end;
$$;

create or replace function public.submit_enquiry(
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
language sql
security definer
set search_path = ''
as $$
  select app.submit_enquiry(
    p_clinic_slug, p_name, p_phone, p_email, p_interest,
    p_message, p_sms_consent, p_consent_ver, p_ip, p_user_agent);
$$;

comment on function public.submit_enquiry(text, text, text, text, text, text, boolean, text, text, text) is
  'Records a storefront enquiry and returns where to notify the practice. The '
  'destination is read inside the function because lead_email is not granted to '
  'anon, and must not be.';

revoke all on function app.submit_enquiry(text, text, text, text, text, text, boolean, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.submit_enquiry(text, text, text, text, text, text, boolean, text, text, text)
  from public, anon, authenticated, service_role;

grant execute on function app.submit_enquiry(text, text, text, text, text, text, boolean, text, text, text)
  to anon, authenticated;
grant execute on function public.submit_enquiry(text, text, text, text, text, text, boolean, text, text, text)
  to anon, authenticated;

commit;
