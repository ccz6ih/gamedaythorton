-- 0024_provider_story.sql
--
-- Somewhere for a practitioner's actual biography to live.
--
-- ===========================================================================
-- WHY A SECOND FIELD RATHER THAN A LONGER FIRST ONE
-- ===========================================================================
-- `provider.bio` is rendered in a card next to a portrait, on the home page and
-- again in the team list. It wants two or three sentences. A seven-hundred-word
-- life story in that slot pushes everything else off the screen and nobody
-- reads it there anyway.
--
-- But the long version is the one that actually sells this practice — it is why
-- somebody picks her over the med spa down the road — and it belongs on the
-- about page, in full, where a reader has chosen to be.
--
-- Two fields, two jobs. `bio` stays the card copy; `story` is the about page.
--
-- ===========================================================================
-- WHAT PROMPTED THIS
-- ===========================================================================
-- The biography was pasted into `clinic.intro`, which is the hero lede on the
-- home page. It arrived truncated — the live site opened with "icensed
-- Esthetician • Certified Phlebotomy Technician…", missing its first letter and
-- cut off mid-sentence — because that field is a short intro and the paste was
-- clipped somewhere on the way in.
--
-- That is a design failure rather than a user error. There was no field for a
-- biography, so it went in the only box that looked big enough. The fix is a
-- field that fits, and restoring the intro to what it is for.

begin;

alter table provider
  add column if not exists story text;

comment on column provider.story is
  'Full biography for the about page. `bio` is the two-or-three sentence version '
  'shown beside a portrait; this is the long one a reader has chosen to open.';

-- Public, like the rest of a practitioner's marketing copy. The provider_public
-- view is what anon actually reads, so it has to carry the new column too.
drop view if exists provider_public;
create view provider_public
with (security_invoker = true)
as
  select id, clinic_id, name, credentials, role_label, bio, story,
         photo_path, hours, active, sort_order
  from provider
  where active;

grant select on provider_public to authenticated, anon;

comment on view provider_public is
  'A practitioner as the public may see them. npi and staff_user_id are absent '
  'by omission — a licence number is not marketing copy, and the link to a '
  'staff account exposes the tenant structure.';

commit;
