-- 0045_location_pages.sql
-- Give a location enough to be a page, and a reason to deserve one.
--
-- ===========================================================================
-- WHY THE EXISTING COLUMNS ARE NOT ENOUGH
-- ===========================================================================
-- `location` carries a name and a single free-text `address`. That is right
-- for the console, where somebody reads it, and insufficient for a public
-- page, which needs three further things the free-text form cannot give:
--
--   A URL.           /locations/loveland has to come from somewhere stable.
--                    Slugifying the name would make the address of a public
--                    page change when somebody tidies a label in the console.
--
--   A STRUCTURED     schema.org PostalAddress wants streetAddress,
--   ADDRESS.         addressLocality, addressRegion and postalCode as
--                    separate fields. Splitting one string on commas is a
--                    guess, and a wrong guess publishes a wrong address in
--                    machine-readable form, which is worse than none.
--
--   SOMETHING TO     Two pages differing only in a city name are a doorway,
--   SAY.             and Google says so explicitly. `intro` is where the
--                    reason this location is actually different gets written.
--
-- ===========================================================================
-- WHY `public` DEFAULTS TO FALSE
-- ===========================================================================
-- Adding a room to the console must never silently publish a page about it,
-- with that room's address, to the open internet. Publishing is a decision
-- somebody makes, so it is a column somebody sets — not a consequence of
-- creating a record. Both of the practice's current rooms are flipped on
-- explicitly at the bottom of this file.

alter table public.location
  add column if not exists slug          text,
  add column if not exists street        text,
  add column if not exists city          text,
  add column if not exists state         text,
  add column if not exists postal_code   text,
  add column if not exists intro         text,
  -- The places this room is a sensible drive from. NOT a list of cities to
  -- rank in: writing "Denver" here because Denver is big is how a page starts
  -- claiming things it cannot support. See the Northglenn row below, where it
  -- names the suburbs that are genuinely minutes away.
  add column if not exists areas_served  text[] not null default '{}',
  add column if not exists public        boolean not null default false;

comment on column public.location.slug is
  'URL segment for the public page (/locations/<slug>). Stable and independent of name, so renaming a room in the console cannot move a published page.';
comment on column public.location.intro is
  'What is genuinely different about THIS room. Without it the page is a doorway page and should not be published.';
comment on column public.location.public is
  'Whether this location has a public page. Defaults false: creating a room must not publish its address.';

-- A slug is only meaningful inside one practice, and must be unique there, or
-- /locations/<slug> is ambiguous. Partial, because most rows have no slug.
create unique index if not exists location_slug_per_clinic
  on public.location (clinic_id, slug)
  where slug is not null;

-- Nothing may be published without the parts a page is built from. This is a
-- constraint rather than a check in the application because the application
-- is not the only thing that writes here, and a half-filled published row
-- renders a page with gaps in its schema markup.
alter table public.location
  drop constraint if exists location_public_needs_content;
alter table public.location
  add constraint location_public_needs_content check (
    public = false or (
      slug is not null and city is not null and state is not null
      and intro is not null and length(intro) >= 120
    )
  );

-- ---------------------------------------------------------------------------
-- The Med Bar's two rooms.
--
-- Both are real and both are in use: 21 appointments in Loveland since August,
-- 3 in Northglenn since 7 October and continuing. Neither intro is invented —
-- the Loveland parking sentence is the practice's own visit note, and the
-- Northglenn one says only what is true of a room inside another clinic.
--
-- NO PHONE NUMBER is set anywhere in this file. Three different numbers appear
-- across this project and the live column is null; publishing the wrong one in
-- structured data is slow to correct and actively misleading. It stays absent
-- until the practice confirms it.
-- ---------------------------------------------------------------------------
do $$
declare
  v_clinic uuid;
begin
  select id into v_clinic from public.clinic where slug = 'medbar-loveland';
  if v_clinic is null then
    raise notice 'The Med Bar not present; skipping location page backfill.';
    return;
  end if;

  update public.location set
    slug = 'loveland',
    street = '2362 West 44th Street',
    city = 'Loveland',
    state = 'CO',
    postal_code = '80538',
    areas_served = array['Loveland', 'Fort Collins', 'Windsor', 'Berthoud', 'Johnstown'],
    intro =
      'The Med Bar''s own room in north Loveland, and where most appointments happen. '
      'It is a single private treatment room rather than a row of chairs, so the '
      'practice sees one person at a time and the appointment you booked is the '
      'appointment you get. There is a dedicated on-site parking lot directly in '
      'front of the building, which matters more than it sounds for anything that '
      'leaves you pink for an hour afterwards.',
    public = true
  where clinic_id = v_clinic and is_default = true;

  update public.location set
    slug = 'northglenn',
    street = '10701 Melody Dr #315',
    city = 'Northglenn',
    state = 'CO',
    postal_code = '80234',
    -- Thornton is here because the practice's own marketing says Thornton and
    -- people in Thornton search for Thornton. The building is in Northglenn,
    -- which is what the address field says and what the page will show. The
    -- page names the area honestly rather than claiming an address it has not
    -- got; the two are different claims and only one of them is true.
    areas_served = array['Northglenn', 'Thornton', 'Westminster', 'Broomfield', 'North Denver'],
    intro =
      'A treatment room inside Gameday Men''s Health on Melody Drive, which is how '
      'the practice sees clients in the north Denver metro without asking them to '
      'drive to Loveland. It is the same practitioner and the same treatment menu, '
      'in a borrowed room on the days she is down there — so availability is '
      'narrower here than in Loveland and worth booking further ahead.',
    public = true
  where clinic_id = v_clinic and is_default = false and name like 'Gameday%';
end $$;
