-- 0012_storefront_notify_log.sql
--
-- Lets the public enquiry form record that it tried to notify the practice.
--
-- THE BUG THIS FIXES
-- The storefront runs as `anon`. automation_run carries the standard staff-only
-- policies, so every attempt to log a notification was refused by RLS — and
-- because the call site wraps notification failures in a try/catch (correctly:
-- a visitor whose enquiry saved must not see an error because a mail provider
-- was slow), nothing surfaced. The feature looked wired up and logged nothing,
-- permanently, with no error anywhere.
--
-- That is the worst shape a bug can take, so the fix comes with a test that
-- inserts as anon rather than trusting the policy reads correctly.
--
-- THE SHAPE OF THE GRANT
-- Insert only, no select — same as `lead` in 0009. A public form may record
-- that it ran; it may not read back what the practice's automations have been
-- doing. The rule_key is pinned to the single storefront rule, so this cannot
-- become a general-purpose write into the practice's automation history.

begin;

drop policy if exists automation_run_storefront_insert on automation_run;
create policy automation_run_storefront_insert on automation_run
  for insert to anon
  with check (
    rule_key = 'storefront_enquiry_email'
    and exists (
      select 1 from public.clinic c
      where c.id = automation_run.clinic_id and c.listed and c.active
    )
    -- Same pilot rule as everything else: while the clinic is in pilot mode the
    -- row must be marked synthetic.
    and (synthetic or not app.clinic_in_pilot(clinic_id))
  );

grant insert (
  clinic_id, rule_key, channel, status, payload_preview,
  consent_verified, suppressed_reason, error, sent_at, synthetic
) on automation_run to anon;

-- Deliberately not granted: patient_id and lead_id. A public form has no
-- business attaching a notification record to a patient, and payload_ref is
-- left off because anything worth referencing here is not anon's to know.

commit;
