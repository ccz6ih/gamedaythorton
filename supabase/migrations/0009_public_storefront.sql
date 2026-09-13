-- 0009_public_storefront.sql
--
-- Opens a public, unauthenticated storefront for clinics that opt in — the
-- replacement for themedbarco.glossgenius.com.
--
-- THE PROBLEM THIS SOLVES
-- clinic_public and provider_public were already granted to anon in 0005, but
-- they are security_invoker views, so RLS on the base tables still applies and
-- anon has no policy anywhere. An anonymous visitor therefore sees nothing at
-- all. That was correct until now; a public booking page changes it.
--
-- TWO INDEPENDENT LIMITS, ON PURPOSE
-- 1. ROW level — RLS policies restrict anon to clinics that have explicitly set
--    `listed`. Default false. A clinic is never publicly readable by accident.
-- 2. COLUMN level — anon is granted SELECT on named columns only. This is the
--    one that matters: provider.npi and clinic.pilot_mode sit on tables the
--    storefront must read, and a row policy alone would expose them to anyone
--    who queried the base table directly instead of the view.
--
-- Either limit alone would be a single point of failure. A storefront is the
-- one surface with no authentication in front of it, so it gets both.
--
-- What anon can NEVER reach: patient, appointment, lab_*, treatment_*, payment,
-- message, audit_log, staff_user. No policy is added for anon on any of them,
-- and RLS denies by default.

begin;

-- ------------------------------------------------------------- opt-in ----

alter table clinic
  add column if not exists listed boolean not null default false;

comment on column clinic.listed is
  'Opt-in to a public unauthenticated storefront at /c/<slug>. Default false: '
  'a clinic is never publicly readable unless someone deliberately says so.';

-- Storefront copy. Kept on the clinic rather than in the app so a practice can
-- change how it introduces itself without a deploy.
alter table clinic
  add column if not exists tagline     text,
  add column if not exists intro       text,
  add column if not exists booking_note text;

comment on column clinic.intro is
  'Storefront introduction. Marketing copy only — never clinical claims, and '
  'never anything about an identifiable person.';

-- ------------------------------------------------- anon read policies ----
-- One helper so the rule cannot differ between five call sites.

create or replace function app.storefront_policy(tbl text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  execute format($f$
    drop policy if exists %I on public.%I
  $f$, tbl || '_storefront_read', tbl);

  execute format($f$
    create policy %I on public.%I
      for select to anon
      using (exists (
        select 1 from public.clinic c
        where c.id = %I.clinic_id
          and c.listed
          and c.active
      ))
  $f$, tbl || '_storefront_read', tbl, tbl);
end;
$$;

-- The clinic itself gates on its own columns rather than a lookup.
drop policy if exists clinic_storefront_read on clinic;
create policy clinic_storefront_read on clinic
  for select to anon
  using (listed and active);

select app.storefront_policy('provider');
select app.storefront_policy('service');
select app.storefront_policy('service_package');
select app.storefront_policy('package_item');

-- ------------------------------------------------- column-level grants ----
-- The real control. Revoke everything first so a column added to one of these
-- tables later is NOT exposed by default — a new column has to be granted
-- deliberately, which is the safe direction for a table anon can read.

revoke all on clinic, provider, service, service_package, package_item from anon;

grant select (
  id, slug, name, location_name, practice_type, modules,
  address_line1, address_line2, address_city, address_state, address_zip,
  address_note, phone_voice, phone_text, email, timezone, hours, brand,
  visit_facts, tagline, intro, booking_note, listed, active
) on clinic to anon;

-- npi and staff_user_id are deliberately absent.
grant select (
  id, clinic_id, name, credentials, role_label, bio, photo_path,
  hours, active, sort_order
) on provider to anon;

-- stripe_price_id is absent: a price id is not secret, but nothing that talks
-- to the payment processor belongs on an unauthenticated surface.
grant select (
  id, clinic_id, name, slug, category, description,
  duration_min, buffer_after_min,
  price_mode, price_cents, price_from_cents, unit_label, min_units,
  deposit_cents, requires_labs, requires_consent, is_membership,
  online_bookable, active, sort_order
) on service to anon;

grant select (
  id, clinic_id, name, description, service_id, sessions,
  price_cents, list_price_cents, expiry_days, interval_note,
  active, sort_order
) on service_package to anon;

grant select (id, clinic_id, package_id, service_id, sessions)
  on package_item to anon;

-- ------------------------------------------------------- lead capture ----
-- A storefront that cannot capture an enquiry is a brochure. `lead` already
-- exists with staff-only policies; this adds insert-only access for anon.
--
-- INSERT WITHOUT SELECT is the important shape. An anonymous visitor can leave
-- their details and cannot read anybody else's — including their own. A public
-- form that can read its own table is a public database.

drop policy if exists lead_storefront_insert on lead;
create policy lead_storefront_insert on lead
  for insert to anon
  with check (
    exists (
      select 1 from public.clinic c
      where c.id = lead.clinic_id and c.listed and c.active
    )
    -- While the clinic is in pilot, a lead is synthetic like everything else.
    -- The guard trigger in 0005 enforces this too; stating it here means the
    -- policy refuses first, with a clearer failure.
    and (synthetic or not app.clinic_in_pilot(clinic_id))
  );

-- The consent columns are grantable on purpose. A storefront form that takes a
-- phone number and does not record WHICH text the person agreed to, when, and
-- from where, produces an SMS list that cannot be defended. The schema comment
-- on lead says exactly this; the grant is what lets the public form honour it.
grant insert (
  clinic_id, name, email, phone, source, campaign, message,
  consent_transactional_sms, consent_marketing_sms, consent_email,
  consent_captured_at, consent_ip, consent_user_agent, consent_text_version,
  synthetic
) on lead to anon;

-- No grant of select, update or delete on lead to anon. Stated rather than
-- implied because this is the line that matters.

-- ------------------------------------------------------------- slugs ----

update clinic set listed = true where slug in ('medbar-loveland', 'gameday-thornton');

commit;
