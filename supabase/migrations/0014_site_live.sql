-- 0014_site_live.sql
--
-- Separates "this database accepts real records" from "this website presents
-- itself as a real business".
--
-- I briefly conflated them, granted anon read on `pilot_mode` to drive the
-- footer, and in doing so exposed an operational flag to the public and broke
-- a test that correctly asserted it was private. Reverted here, properly.
--
-- They are genuinely different decisions:
--
--   pilot_mode   a database guard. While true, every PHI-bearing table refuses
--                rows not marked synthetic. Private, and it stays private —
--                nobody outside the practice needs to know.
--
--   site_live    a presentation choice. While false the public page says it is
--                a preview and asks search engines to stay away. Public by
--                definition, because the page it controls is public.
--
-- A practice can reasonably be one without the other: real records in the
-- database while the website is still being reviewed is exactly where The Med
-- Bar sat this afternoon.

begin;

alter table clinic
  add column if not exists site_live boolean not null default false;

comment on column clinic.site_live is
  'Public website presents as a live business: no preview notice, indexable. '
  'Distinct from pilot_mode, which is the database guard and stays private.';

grant select (site_live, legal_name) on clinic to anon;

-- Undo the over-grant. pilot_mode is operational state and not shop content.
revoke select (pilot_mode) on clinic from anon;

update clinic set site_live = true where slug = 'medbar-loveland';

commit;
