-- 0025_grant_provider_story.sql
--
-- 0024 added provider.story and put it in provider_public, and broke the about
-- page for anonymous visitors.
--
-- provider_public is declared `with (security_invoker = true)`, which means it
-- runs as whoever queries it rather than as its owner. That is the right
-- setting — it keeps RLS and column grants in force through the view instead of
-- letting a view become a way around them — but it has a consequence that is
-- easy to miss: adding a column to the view is not enough. `anon` needs a grant
-- on that column of the UNDERLYING TABLE, or the whole select fails with
-- permission denied and the practitioner cards disappear.
--
-- This is the third time a missing column grant has produced a symptom that
-- looked like something else. track_stock read as "the setting has no effect";
-- this read as "the team section is empty". The failure mode is always the
-- same: a column-level permission error takes out the entire row, so the
-- symptom points at the query rather than at the one column that caused it.
--
-- Worth remembering when adding any column to a public view: grant it, and
-- check the storefront suite, which is what caught this one.

begin;

grant select (story) on provider to anon;

commit;
