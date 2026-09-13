-- 0013_retail_products.sql
--
-- Retail products — the shop.
--
-- WHY NOT inventory_item
-- inventory_item exists for clinical consumables: vials, lot numbers, expiry
-- dates, controlled-substance flags, units reconciled against treatment
-- records. A bottle of cleanser sold over the counter shares almost none of
-- that and needs things it does not have — a retail price, a description, an
-- image, a place in a shop.
--
-- Forcing both through one table would mean a controlled-substance schedule
-- column on a face mist and a retail price on a vial of neurotoxin, and the
-- first person to write a stock report would have to remember which rows are
-- which. Two tables, each meaning one thing.

begin;

create table if not exists product (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  clinic_id     uuid not null references clinic(id) on delete cascade,

  name          text not null,
  slug          citext,
  brand         text,
  category      text not null default 'skincare',
  description   text,
  details       text,

  price_cents   int not null check (price_cents >= 0),
  -- What it cost the practice. Never exposed publicly; it is here so a margin
  -- report is possible without a second system.
  cost_cents    int check (cost_cents >= 0),

  -- Simple on-hand count. A practice selling eighteen SKUs does not need lot
  -- tracking, and pretending otherwise would make restocking a chore.
  stock_qty     int not null default 0,
  low_stock_at  int not null default 1,

  image_path    text,
  stripe_price_id text,

  -- Sellable online, as distinct from active. A product can be on the shelf
  -- and deliberately not in the shop.
  online        boolean not null default true,
  active        boolean not null default true,
  sort_order    int not null default 0,

  synthetic     boolean not null default false,

  unique (clinic_id, name)
);

select app.add_touch('product');
select app.standard_policies('product');

create index if not exists product_clinic_idx on product (clinic_id, active, sort_order);

comment on table product is
  'Retail products sold over the counter or in the shop. Clinical consumables '
  'are inventory_item — different lifecycle, different columns.';
comment on column product.cost_cents is
  'Practice cost. Never granted to anon; margin is not shop content.';

-- ------------------------------------------------------------ storefront ----
-- Same two limits as everything else public: rows restricted to clinics that
-- opted in, columns granted by name. cost_cents and stripe_price_id are
-- deliberately absent.

select app.storefront_policy('product');

revoke all on product from anon;
grant select (
  id, clinic_id, name, slug, brand, category, description, details,
  price_cents, stock_qty, image_path, online, active, sort_order
) on product to anon;

commit;
