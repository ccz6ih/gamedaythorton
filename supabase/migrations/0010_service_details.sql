-- 0010_service_details.sql
--
-- Splits a service's public copy in two, because one field was making the
-- storefront worse.
--
-- THE PROBLEM
-- A single `description` column forces a choice between a scannable menu and a
-- page that answers questions. The incumbent booking page chose the second and
-- got 150-word paragraphs on every row, which nobody reads and which makes
-- thirty services impossible to compare. Choosing the first loses the detail a
-- nervous first-timer actually needs.
--
-- So: `description` is the one or two lines that belong in a menu, and
-- `details` is everything else, shown on request. The menu stays scannable and
-- the detail is one tap away instead of gone.
--
-- `needs_copy` marks a service whose public copy has not been written or
-- approved by the practice yet. The storefront can then be honest about a gap
-- rather than printing an empty white box where a description should be —
-- which is what the page this replaces does today on at least one service.

begin;

alter table service
  add column if not exists details    text,
  add column if not exists needs_copy boolean not null default false;

comment on column service.description is
  'One or two lines. What it is and who it is for — the menu line. Long copy '
  'belongs in details.';

comment on column service.details is
  'Expanded public copy: what is included, what to expect, whether a series is '
  'recommended. Shown on request, never in the menu row.';

comment on column service.needs_copy is
  'True when the practice has not yet written or approved this service''s '
  'public copy. The storefront says so rather than showing a blank.';

-- The storefront reads these, so anon needs them. 0009 revoked everything
-- first precisely so a new column is NOT exposed until someone says to.
grant select (details, needs_copy) on service to anon;

commit;
