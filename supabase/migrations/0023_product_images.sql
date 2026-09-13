-- 0023_product_images.sql
--
-- More than one photograph per product, and somewhere for the practice to write
-- what the thing actually is.
--
-- ===========================================================================
-- WHY A TABLE AND NOT A SECOND COLUMN
-- ===========================================================================
-- product.image_path holds one path and the shop grid shows it. That is right
-- for a grid and wrong for a product page, where a second angle — the texture,
-- the back of the bottle with the ingredients on it — is often what actually
-- sells the thing.
--
-- image_path_2 would work until somebody has three. A table costs one join and
-- ends the question.
--
-- product.image_path STAYS as the primary, rather than being migrated away.
-- The grid reads one image and should not join to find it, and having a column
-- that means "the one to lead with" is clearer than a boolean on a row called
-- is_primary that two rows could both claim.
--
-- ===========================================================================
-- ON DESCRIPTIONS
-- ===========================================================================
-- The column already exists and every one of the eighteen is null. It is empty
-- because nobody here has read the label.
--
-- Writing skincare copy for a line we have not handled would put claims on a
-- real practice's shop that neither the developer nor the owner could stand
-- behind — and cosmetic claims are the specific thing that attracts regulatory
-- attention. "Reduces the appearance of fine lines" is marketing; "repairs the
-- skin barrier" is a drug claim in the United States, and the line between them
-- is not obvious to somebody writing quickly.
--
-- So: a place to put them, a screen to write them on, and a source worth using
-- — the supplier publishes its own copy for stockists and it is already
-- compliant. What this migration does NOT do is invent any.

begin;

create table if not exists product_image (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  clinic_id   uuid not null references clinic(id) on delete cascade,
  product_id  uuid not null references product(id) on delete cascade,

  -- Public path under /products, same as product.image_path. These are supplier
  -- marketing photographs, not client media: public by design, and deliberately
  -- nowhere near the private bucket.
  path        text not null,
  alt         text,
  sort_order  int not null default 0,

  unique (product_id, path)
);

create index if not exists product_image_product_idx
  on product_image (product_id, sort_order);

select app.standard_policies('product_image');

comment on table product_image is
  'Additional photographs for a product page. product.image_path remains the '
  'one the grid leads with. Public marketing assets — client media lives in the '
  'private client-media bucket and never here.';

-- The shop is public, so these are readable by anyone, under the same
-- opted-in-clinics rule as everything else on the storefront.
select app.storefront_policy('product_image');

revoke all on product_image from anon;
grant select (id, clinic_id, product_id, path, alt, sort_order) on product_image to anon;

-- --------------------------------------------------------------- slugs ----
-- A product page needs an address. `slug` already exists on product and is
-- null for all eighteen; fill it from the name so /shop/renew-eye-complex
-- works, and keep it unique per practice.

update product
   set slug = regexp_replace(
                regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'),
                '^-|-$', '', 'g')
 where slug is null;

create unique index if not exists product_slug_unique
  on product (clinic_id, slug) where slug is not null;

comment on column product.slug is
  'Address of the product page: /shop/<slug>. Derived from the name once, then '
  'stable — a slug that follows a rename breaks every link anybody saved.';

commit;
