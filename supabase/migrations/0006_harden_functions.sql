-- ===========================================================================
-- 0006_harden_functions
-- Closes both findings from Supabase's security linter.
--
-- 1. FUNCTION SEARCH PATH
--    A function without a pinned search_path resolves unqualified names against
--    whatever the caller's search_path happens to be. If an attacker can create
--    an object in a schema that sorts earlier, they can substitute their own
--    function for one of ours. It matters most on SECURITY DEFINER functions
--    (already pinned in 0001-0004) but trigger functions are worth pinning too:
--    they run on every write, with the writer's privileges, and the cost of
--    pinning is nil.
--
--    Every function below only calls pg_catalog builtins or app.* functions it
--    already schema-qualifies, so pinning to '' changes no behaviour.
--
-- 2. EXTENSIONS IN PUBLIC
--    citext and btree_gist land in public by default. Moved to a dedicated
--    extensions schema, with the role search_paths widened so unqualified
--    references keep resolving. Types and operator classes are referenced by
--    OID once a column or constraint exists, so the move does not disturb
--    anything already created -- scripts/db-test.cjs re-runs in full to prove it.
-- ===========================================================================

-- ------------------------------------------------- pin the search paths ----

alter function app.touch_updated_at()          set search_path = '';
alter function app.default_modules(practice_type) set search_path = '';
alter function app.clinic_defaults()           set search_path = '';
alter function app.add_touch(text)             set search_path = '';
alter function app.appointment_times()         set search_path = '';
alter function app.assert_no_phi_text()        set search_path = '';
alter function app.standard_policies(text, text, boolean, boolean) set search_path = '';

-- ------------------------------------------------ move the extensions ----

create schema if not exists extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;

alter extension citext set schema extensions;
alter extension btree_gist set schema extensions;

-- Keep unqualified citext / gist references resolving for every role the
-- application and future migrations run as.
alter role postgres      set search_path to "$user", public, extensions;
alter role authenticated set search_path to "$user", public, extensions;
alter role anon          set search_path to "$user", public, extensions;
alter role service_role  set search_path to "$user", public, extensions;
