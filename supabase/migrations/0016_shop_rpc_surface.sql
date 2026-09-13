-- 0016_shop_rpc_surface.sql
--
-- The shop functions in 0015 live in schema `app`, which is where every helper
-- in this database lives and where they belong: `app` is implementation, and
-- nothing in it is reachable from outside Postgres.
--
-- That is exactly the problem. PostgREST — the thing the application actually
-- talks to — only exposes functions in its configured schemas, which here means
-- `public`. An RPC call to a function in `app` does not fail with a permission
-- error; it fails with "function not found", because from the API's point of
-- view it does not exist.
--
-- So: thin wrappers in `public`, one per callable operation, delegating to the
-- implementation in `app`. This is not ceremony. It makes the API surface of
-- the shop an explicit list of five functions in one file, rather than an
-- emergent property of which helpers happened to get a grant — and a helper
-- added to `app` tomorrow is private until someone deliberately writes a
-- wrapper for it here.
--
-- Each wrapper is SECURITY DEFINER because the caller (anon, or service_role)
-- has no rights on `app` at all. The wrapper crosses that line once, in a
-- controlled place, with search_path pinned.

begin;

-- ------------------------------------------------------------ place an order ----

create or replace function public.shop_order_create(
  p_clinic_slug text,
  p_items       jsonb,
  p_name        text,
  p_email       text,
  p_phone       text default null,
  p_note        text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app.shop_order_create(p_clinic_slug, p_items, p_name, p_email, p_phone, p_note);
$$;

comment on function public.shop_order_create(text, jsonb, text, text, text, text) is
  'Public entry point for the storefront basket. Prices are read from `product` '
  'inside the implementation; the caller cannot supply money.';

-- -------------------------------------------------- say which session pays ----

create or replace function public.shop_order_attach_session(
  p_order   uuid,
  p_session text
)
returns void
language sql
security definer
set search_path = ''
as $$
  select app.shop_order_attach_session(p_order, p_session);
$$;

-- ------------------------------------------------------------- settlement ----
-- Reachable by service_role only, i.e. by the Stripe webhook after signature
-- verification. anon is absent from the grants below and must stay absent.

create or replace function public.shop_order_mark_paid(
  p_session text,
  p_intent  text,
  p_amount  int,
  p_account text default null,
  p_ship    jsonb default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app.shop_order_mark_paid(p_session, p_intent, p_amount, p_account, p_ship);
$$;

create or replace function public.shop_order_mark_failed(
  p_session text,
  p_status  text,
  p_reason  text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app.shop_order_mark_failed(p_session, p_status, p_reason);
$$;

-- -------------------------------------------------------------- collection ----
-- Staff only, and the implementation checks the caller's role rather than
-- trusting that the grant was enough.

create or replace function public.shop_order_collect(p_order uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select app.shop_order_collect(p_order);
$$;

-- ------------------------------------------------------------- the grants ----
-- Revoke first, always. `create or replace function` leaves any existing grants
-- in place, so replacing a function without this can silently keep a grant a
-- previous version had.

revoke all on function public.shop_order_create(text, jsonb, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.shop_order_attach_session(uuid, text)                   from public, anon, authenticated, service_role;
revoke all on function public.shop_order_mark_paid(text, text, int, text, jsonb)      from public, anon, authenticated, service_role;
revoke all on function public.shop_order_mark_failed(text, text, text)                from public, anon, authenticated, service_role;
revoke all on function public.shop_order_collect(uuid)                                from public, anon, authenticated, service_role;

grant execute on function public.shop_order_create(text, jsonb, text, text, text, text) to anon, authenticated;
grant execute on function public.shop_order_attach_session(uuid, text)                   to anon, authenticated;

grant execute on function public.shop_order_mark_paid(text, text, int, text, jsonb)      to service_role;
grant execute on function public.shop_order_mark_failed(text, text, text)                to service_role;

grant execute on function public.shop_order_collect(uuid)                                to authenticated;

commit;
