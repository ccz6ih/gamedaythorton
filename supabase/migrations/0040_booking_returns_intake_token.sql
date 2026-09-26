-- 0040_booking_returns_intake_token.sql
-- Hand the intake link back to the server action that sends the confirmation.
--
-- ===========================================================================
-- WHY NOT A LOOKUP FUNCTION
-- ===========================================================================
-- The obvious alternative was `intake_link_for_appointment(appointment_id)`,
-- callable by anon right after booking. That is a privilege escalation wearing
-- a helpful hat: an appointment id is not a secret, and anything holding one
-- could exchange it for the intake token — which reads a medical form and
-- submits it. The token has to come back from the act of booking, once, to the
-- process that is already trusted with the client's own details.
--
-- Same reasoning as 0027 returning notify_email: the server action runs in our
-- own process and never passes it to the browser.
--
-- ===========================================================================
-- WHY THE FUNCTION IS NOT RETYPED HERE
-- ===========================================================================
-- app.book_appointment is ~180 lines of booking rules — double-book checks,
-- timezone conversion, patient matching, consent flags. Retyping it to add one
-- key to its return is how a rule gets dropped by transcription, and it has
-- already been rewritten twice.
--
-- So this reads the live definition, replaces only the final return, and
-- re-executes it. The replacement is ASSERTED: if the anchor does not match,
-- the block raises rather than re-creating the function unchanged, because a
-- no-op that reports success is the failure mode that matters here.

begin;

do $do$
declare src text; out_src text;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'book_appointment';

  if src is null then
    raise exception 'app.book_appointment not found';
  end if;

  -- Already applied: nothing to do, and re-running must stay safe.
  if src like '%intake_token%' then
    return;
  end if;

  out_src := replace(
    src,
    E'''matched_existing'', v_matched\n  );',
    E'''matched_existing'', v_matched,\n    ''intake_token'', (select a2.intake_token from public.appointment a2 where a2.id = v_appt)\n  );'
  );

  if out_src = src then
    raise exception 'anchor not found — book_appointment was NOT modified';
  end if;

  execute out_src;
end
$do$;

commit;
