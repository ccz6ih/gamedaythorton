-- 0046_public_locations.sql
-- The public read path for location pages, as a function rather than a policy.
--
-- ===========================================================================
-- WHY A FUNCTION AND NOT AN RLS POLICY
-- ===========================================================================
-- `location` has exactly two policies and both require a staff_user row. That
-- is a clean posture and worth keeping: every existing reader is staff (the
-- console), the service role (the reminder cron) or a security-definer
-- function (book_appointment), so the table has never needed to be readable by
-- a stranger and does not become so here.
--
-- Widening it with a policy would make the whole row visible to anon forever
-- after, including columns added later by someone who did not know that. A
-- function names the columns that may leave, so a future `location.door_code`
-- is private by default instead of public by default.
--
-- This is the house pattern — see 0026 for public_slots, where the diary is
-- never read directly and only free times come back.
--
-- ===========================================================================
-- THE BUG IT AVOIDS
-- ===========================================================================
-- Without a read path, a storefront page selecting from `location` returns
-- zero rows and no error, because RLS filters rather than refuses. The page
-- would 404 in production and work perfectly for anyone logged into the
-- console — the exact failure CLAUDE.md records happening five times.
--
-- ===========================================================================
-- WHAT COMES BACK
-- ===========================================================================
-- Only rows a human explicitly published (`public`), in use (`active`),
-- belonging to a practice that is itself listed and active. Gameday is
-- excluded twice over: it is not listed, and neither of its rooms has `public`
-- set, which defaults to false. `note` is deliberately absent — it is an
-- internal field the console writes.

create or replace function app.public_locations(p_clinic_slug text)
returns table (
  slug text,
  name text,
  street text,
  city text,
  state text,
  postal_code text,
  intro text,
  areas_served text[],
  is_default boolean
)
language sql
security definer
stable
set search_path = ''
as $$
  select l.slug, l.name, l.street, l.city, l.state, l.postal_code,
         l.intro, l.areas_served, l.is_default
    from public.location l
    join public.clinic c on c.id = l.clinic_id
   where c.slug = p_clinic_slug
     and c.listed
     and c.active
     and l.public
     and l.active
   order by l.is_default desc, l.sort_order;
$$;

-- PostgREST reads `public`, so a thin wrapper, same as 0016 and 0026.
create or replace function public.public_locations(p_clinic_slug text)
returns table (
  slug text,
  name text,
  street text,
  city text,
  state text,
  postal_code text,
  intro text,
  areas_served text[],
  is_default boolean
)
language sql security definer stable set search_path = '' as $$
  select * from app.public_locations(p_clinic_slug);
$$;

revoke all on function app.public_locations(text) from public, anon, authenticated, service_role;
revoke all on function public.public_locations(text) from public, anon, authenticated, service_role;

grant execute on function app.public_locations(text) to anon, authenticated;
grant execute on function public.public_locations(text) to anon, authenticated;
