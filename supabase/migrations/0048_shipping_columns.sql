-- 0048_shipping_columns.sql
-- The fields postage and dispatch need. Nothing reads them yet.
--
-- Split deliberately out of a larger change. The original version altered two
-- tables, rewrote shop_order_create by string replacement AND dropped the
-- existing function, all in one step on the live money path — so a subtle
-- error in the rewrite would have taken the working function with it. This
-- half is purely additive and every default preserves today's behaviour:
-- shipping_cents 0, ship_flat_cents 0 (free postage, as now), the rest null.
alter table public.clinic
  add column if not exists ship_flat_cents      int not null default 0,
  add column if not exists ship_free_over_cents int;

comment on column public.clinic.ship_flat_cents is
  'Postage charged on a shipped order, in cents. 0 means free, which is the default and the behaviour before 0048.';
comment on column public.clinic.ship_free_over_cents is
  'Subtotal at or above which postage is free. Null disables the threshold.';

alter table public.shop_order
  add column if not exists shipping_cents int not null default 0,
  add column if not exists carrier        text,
  add column if not exists tracking_code  text,
  add column if not exists shipped_at     timestamptz;

comment on column public.shop_order.tracking_code is
  'Carrier reference, entered by staff on dispatch. Never generated or guessed.';

-- Free over $200 as the practice asked. The rate BELOW that stays 0 until
-- somebody states what postage actually costs; inventing a figure here would
-- charge real customers a number nobody chose.
update public.clinic
   set ship_free_over_cents = 20000
 where slug = 'medbar-loveland' and ship_free_over_cents is null;
