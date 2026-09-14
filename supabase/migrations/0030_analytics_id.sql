-- 0030_analytics_id.sql
--
-- Somewhere for a practice to keep its own analytics tag.
--
-- ===========================================================================
-- PER CLINIC, NOT PER DEPLOYMENT
-- ===========================================================================
-- The obvious place for a measurement id is an environment variable. That
-- works exactly until the second practice, at which point one tenant's traffic
-- is being reported into another tenant's Google account — and the mistake is
-- invisible, because both sites keep working perfectly.
--
-- It is a property of the practice, like its logo and its tax rate, so it lives
-- on the practice.
--
-- ===========================================================================
-- PUBLIC BY NECESSITY, AND THAT IS FINE
-- ===========================================================================
-- A GA4 measurement id is not a secret: it ships in the HTML of every page it
-- measures. Anyone can read Jamie's off her own site. Granting it to anon is
-- therefore not a disclosure — it is the only way the storefront can render it.
--
-- What it does NOT do is enable anything. The tag is only ever rendered by the
-- storefront layout, never by the console, the portal or the sign-in page. That
-- is docs rule 3, and scripts/analytics-test.cjs proves it rather than trusting
-- it.

begin;

alter table clinic
  add column if not exists ga_measurement_id text
    check (ga_measurement_id is null or ga_measurement_id ~ '^G-[A-Z0-9]{6,16}$');

comment on column clinic.ga_measurement_id is
  'GA4 measurement id for this practice''s PUBLIC pages only. Never rendered on '
  'an authenticated route — no third-party tracking behind login, ever. The '
  'CHECK keeps a stray API key or a GTM container id out of a field that ends '
  'up in a script tag.';

grant select (ga_measurement_id) on clinic to anon;

commit;
