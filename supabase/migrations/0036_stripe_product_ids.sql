-- 0036_stripe_product_ids.sql
-- Give Stripe a stable product to report against.
--
-- ===========================================================================
-- THE PROBLEM THIS SOLVES
-- ===========================================================================
-- Both checkout paths build their line items with `price_data.product_data`,
-- which asks Stripe to invent a brand-new Product for that one line. So every
-- order of the same cleanser creates another Product, and the question "how
-- much of it did I sell in September" has no answer on Stripe's side — each
-- sale is a different product to it. The Products tab fills with duplicates.
--
-- Passing `price_data.product` instead points every sale of one item at ONE
-- Stripe Product, which is what its reporting groups by.
--
-- ===========================================================================
-- WHY A PRODUCT ID AND NOT A PRICE ID
-- ===========================================================================
-- There is already a `stripe_price_id` column, unused by anything in the app.
-- It stays unused, and this is deliberate.
--
-- A Stripe Price holds an AMOUNT. Storing one makes Stripe a second copy of
-- every price that has to agree with `product.price_cents` forever, and the
-- day they disagree the customer is charged the wrong number. lib/stripe.ts
-- already refuses that trade for sales tax, in those words: "duplicating it
-- into Stripe creates two numbers that must agree forever."
--
-- A Stripe Product holds a NAME. It carries no money, so it cannot drift into
-- charging the wrong amount. The price still travels inline on every checkout,
-- read from this database at the moment of sale.
--
-- ===========================================================================
-- RETAIL ONLY
-- ===========================================================================
-- No column is added to `service` or `service_package`, and that is not an
-- omission. Service names ARE the banned terms — `botox`, `filler`,
-- `microneedling`, `neurotoxin` are all in BANNED_TERMS in lib/phi — and rule
-- 4 says no PHI into Stripe, line items included. A clinical catalogue in
-- Stripe is the thing we are avoiding, not a feature we have not got to yet.

begin;

alter table product
  add column if not exists stripe_product_id text;

comment on column product.stripe_product_id is
  'Stable Stripe Product this retail item reports against. Holds a name, never '
  'an amount — the price travels inline on each checkout from price_cents. '
  'Populated by scripts/stripe-catalog-sync.cjs. Null is fine: checkout falls '
  'back to an ad-hoc product data line.';

-- One product per Stripe object, so a mis-run of the sync cannot quietly point
-- two catalogue rows at the same Stripe product and merge their reporting.
create unique index if not exists product_stripe_product_id_key
  on product (stripe_product_id)
  where stripe_product_id is not null;

-- ------------------------------------------------- what checkout needs to know ----

/**
 * The Stripe product for each line of an order that has just been created.
 *
 * WHY AN RPC AND NOT A COLUMN GRANT
 * `product` is readable by anon, but by an explicit list of columns, and
 * 0013 deliberately left the payment identifiers off it. Widening that grant
 * would hand every visitor the whole payment-identifier surface to get one
 * field. This returns exactly the mapping checkout needs and nothing else.
 *
 * A Stripe product id is not a secret — it identifies a moisturiser, it
 * authorises nothing, and it is already visible to anyone who completes a
 * checkout. It is kept off the public column list because nothing browsing the
 * shop needs it, which is a different and lesser reason than the service-role
 * key being off it.
 */
create or replace function app.shop_order_stripe_products(p_order uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name_snapshot',     i.name_snapshot,
        'stripe_product_id', p.stripe_product_id
      )
      order by i.created_at, i.id
    ),
    '[]'::jsonb
  )
  from public.shop_order_item i
  join public.product p on p.id = i.product_id
  where i.order_id = p_order
    and p.stripe_product_id is not null;
$$;

create or replace function public.shop_order_stripe_products(p_order uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app.shop_order_stripe_products(p_order);
$$;

comment on function public.shop_order_stripe_products(uuid) is
  'The stable Stripe Product for each line of an order, so checkout can group '
  'reporting instead of minting a throwaway product per sale. Returns names and '
  'Stripe product ids only — no amounts, no customer, no order totals.';

revoke all on function app.shop_order_stripe_products(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.shop_order_stripe_products(uuid)
  from public, anon, authenticated, service_role;

grant execute on function app.shop_order_stripe_products(uuid)    to anon, authenticated;
grant execute on function public.shop_order_stripe_products(uuid) to anon, authenticated;

commit;
