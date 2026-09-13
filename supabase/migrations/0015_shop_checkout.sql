-- 0015_shop_checkout.sql
--
-- Taking money for retail products from an anonymous website visitor.
--
-- ===========================================================================
-- WHY NOT THE `payment` TABLE
-- ===========================================================================
-- `payment` is keyed to a patient and governed by app.standard_policies with a
-- patient column. A person buying a cleanser on the website is not a patient,
-- has no auth user, and must not be given one — creating a patient record for
-- every online order would turn a shop into a clinical roster, and that roster
-- would then be subject to every rule PHI is subject to, for no reason.
--
-- So retail orders are their own thing, with their own lifecycle: pending →
-- paid → collected. `payment` keeps meaning "money from a patient of this
-- practice", which is what the rest of the schema assumes about it.
--
-- ===========================================================================
-- WHY anon GETS NO GRANT ON THESE TABLES
-- ===========================================================================
-- Every other public write in this system is an INSERT grant with a checking
-- policy (see `lead` in 0009). That works there because a lead is whatever the
-- visitor typed — there is no value in it the visitor is not entitled to set.
--
-- An order is the opposite. It contains a price. If the visitor can write the
-- row, the visitor can choose the price, and no amount of validation in the
-- route handler fixes that, because the route handler is not the only thing
-- holding the anon key — the anon key is in the browser.
--
-- Therefore: anon has no insert, update, select or delete on either table. It
-- may call exactly two functions. Prices are read from `product` inside the
-- function, by the database, in the same transaction that writes the order.
-- A forged price is not rejected; it is impossible to express.
--
-- The two functions that settle money (mark paid, mark failed) are not granted
-- to anon at all. They are reachable only by service_role, and the only code
-- holding that key is the Stripe webhook — after signature verification.

begin;

-- ------------------------------------------------------------ sales tax ----
-- Not hardcoded, and not guessed. A wrong rate is a liability that compounds
-- quietly, and the practice already knows its own rate because it collects it
-- at the counter. Zero means "not configured yet", and the shop refuses to sell
-- rather than under-collecting.
--
-- Single-rate, which is exactly right for an order collected at the counter and
-- close enough for one shipped inside the same state. The day this practice
-- ships across a state line in volume, the correct answer is Stripe Tax and
-- this column becomes its fallback — not a second hand-maintained rate table.
alter table clinic
  add column if not exists sales_tax_bps int not null default 0
    check (sales_tax_bps >= 0 and sales_tax_bps <= 2000);

comment on column clinic.sales_tax_bps is
  'Retail sales tax in basis points (670 = 6.70%). 0 means not yet configured, '
  'and online checkout stays closed rather than under-collecting on the '
  'practice''s behalf. See 0015 for why this is not a guessed default.';

-- Public, because the shop has to be able to show a total before checkout.
-- A tax rate is not operational secrecy; it is printed on every receipt.
grant select (sales_tax_bps) on clinic to anon;

-- --------------------------------------------------------- stock tracking ----
-- OFF by default, which inverts what 0013 assumed.
--
-- 0013 treated stock_qty as the truth about availability, so a product at zero
-- was unbuyable. That is right for a practice selling what is physically on its
-- shelf, and wrong for this one: the line is ordered from the supplier, who
-- will ship to the customer directly under the practice's account. Thirteen of
-- eighteen products sat at zero and the shop read as almost empty, when in
-- reality every one of them is available.
--
-- So availability and on-hand count are separated. stock_qty stays, because a
-- practice that does hold stock still wants to know what is on the shelf; it
-- simply no longer decides who may buy.
alter table clinic
  add column if not exists track_stock boolean not null default false;

comment on column clinic.track_stock is
  'When true the shop hides sold-out products, refuses to oversell, and '
  'decrements stock_qty on payment. When false (the default) every active '
  'product is buyable and stock_qty is a note to the practice, not a gate — '
  'the supplier-ships-direct case.';

-- ----------------------------------------------------------- shop_order ----

-- Declared before the functions that draw from it so the reading order matches
-- the dependency order.
create sequence if not exists shop_order_no_seq;

create table if not exists shop_order (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  clinic_id      uuid not null references clinic(id) on delete cascade,

  -- What the customer is told to quote at the counter. Date-prefixed so the
  -- front desk can find today's orders without a search.
  order_no       text not null unique,

  contact_name   text not null,
  contact_email  citext not null,
  contact_phone  text,
  note           text,

  -- All three stored, not two stored and one derived. A total recomputed from a
  -- tax rate that has since changed produces a different number than the one
  -- the customer agreed to pay, and the one they agreed to is the true one.
  subtotal_cents int not null check (subtotal_cents >= 0),
  tax_cents      int not null default 0 check (tax_cents >= 0),
  total_cents    int not null check (total_cents >= 0),
  currency       text not null default 'usd',

  fulfilment     text not null default 'ship'
                   check (fulfilment in ('pickup', 'ship')),

  -- Captured by Stripe Checkout, written back by the webhook, and stored flat
  -- rather than as jsonb because the front desk reads it off a screen and a
  -- packing label is not a document model.
  --
  -- Nullable throughout: the address arrives one step after the order does, and
  -- an order collected at the counter never has one at all.
  ship_name      text,
  ship_line1     text,
  ship_line2     text,
  ship_city      text,
  ship_state     text,
  ship_postal    text,
  ship_country   text,

  status         text not null default 'pending'
                   check (status in ('pending', 'paid', 'failed', 'expired', 'collected')),

  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text,
  -- Which connected account the charge landed on, recorded at the time. If the
  -- practice later changes accounts, old orders still say where the money went.
  stripe_account_id          text,

  paid_at        timestamptz,
  collected_at   timestamptz,
  collected_by   uuid references staff_user(id) on delete set null,
  failure_reason text,

  synthetic      boolean not null default false
);

create index if not exists shop_order_clinic_idx on shop_order (clinic_id, created_at desc);
create index if not exists shop_order_open_idx on shop_order (clinic_id, status)
  where status in ('paid', 'pending');

select app.add_touch('shop_order');
select app.standard_policies('shop_order');

comment on table shop_order is
  'A retail order placed on the public website. Not a patient record and not a '
  'clinical payment: see the header of 0015 for why it is not in `payment`.';

-- ------------------------------------------------------- shop_order_item ----
-- Names and prices are SNAPSHOTTED rather than joined. A product renamed or
-- repriced next month must not change what last month's receipt says, and
-- product_id is nullable on delete so discontinuing a line does not delete the
-- record that it was once sold.

create table if not exists shop_order_item (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  clinic_id         uuid not null references clinic(id) on delete cascade,
  order_id          uuid not null references shop_order(id) on delete cascade,
  product_id        uuid references product(id) on delete set null,

  name_snapshot     text not null,
  brand_snapshot    text,
  unit_price_cents  int not null check (unit_price_cents >= 0),
  qty               int not null check (qty > 0 and qty <= 10),
  line_total_cents  int not null check (line_total_cents >= 0),

  synthetic         boolean not null default false
);

create index if not exists shop_order_item_order_idx on shop_order_item (order_id);
select app.standard_policies('shop_order_item');

comment on column shop_order_item.name_snapshot is
  'The name as sold. Deliberately not a join: a later rename must not rewrite '
  'an old receipt.';

-- ===========================================================================
-- app.shop_order_create — the only way an order comes into existence
-- ===========================================================================
-- Takes a cart of {product_id, qty} and contact details. Returns the order and
-- the totals the database computed. The caller's opinion about price is not a
-- parameter.
--
-- Refuses, with a message meant to be shown to a customer, when:
--   the clinic is not listed, not active, or has no tax rate configured
--   the cart is empty, too long, or has a bad quantity
--   a product is not that clinic's, not online, not active
--   stock is insufficient
--   the same email has flooded the endpoint

create or replace function app.shop_order_create(
  p_clinic_slug text,
  p_items       jsonb,
  p_name        text,
  p_email       text,
  p_phone       text default null,
  p_note        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c            record;
  item         jsonb;
  prod         record;
  v_order      uuid;
  v_order_no   text;
  v_subtotal   int := 0;
  v_tax        int;
  v_total      int;
  v_count      int;
  v_recent     int;
  v_synthetic  boolean;
  v_lines      jsonb := '[]'::jsonb;
begin
  -- ---------------------------------------------------------- the clinic --
  select id, name, listed, active, sales_tax_bps, site_live, track_stock
    into c
  from public.clinic
  where slug = p_clinic_slug;

  if c.id is null then
    raise exception 'No such practice.' using errcode = 'no_data_found';
  end if;
  if not (c.listed and c.active) then
    raise exception 'This practice is not accepting online orders.'
      using errcode = 'check_violation';
  end if;
  if c.sales_tax_bps = 0 then
    -- Deliberately a refusal rather than a zero-tax sale. Selling without the
    -- tax the practice owes puts the shortfall on the practice.
    raise exception 'Online checkout is not finished being set up. Please ask us directly.'
      using errcode = 'check_violation';
  end if;

  v_synthetic := app.clinic_in_pilot(c.id);

  -- ------------------------------------------------------------ the cart --
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'No items in the basket.' using errcode = 'check_violation';
  end if;

  v_count := jsonb_array_length(p_items);
  if v_count = 0 then
    raise exception 'No items in the basket.' using errcode = 'check_violation';
  end if;
  if v_count > 20 then
    raise exception 'That is more separate items than we can take in one order.'
      using errcode = 'check_violation';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'A name is needed so we know whose order it is.'
      using errcode = 'check_violation';
  end if;
  if p_email is null or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A working email address is needed to send the receipt.'
      using errcode = 'check_violation';
  end if;

  -- ------------------------------------------------------ flood control --
  -- Not a real rate limiter; a brake. Enough to stop a loop filling the table
  -- without stopping a family ordering from one address.
  select count(*) into v_recent
  from public.shop_order o
  where o.clinic_id = c.id
    and o.contact_email = p_email::citext
    and o.status = 'pending'
    and o.created_at > now() - interval '5 minutes';

  if v_recent >= 5 then
    raise exception 'Several orders are already waiting on payment for this email. '
      'Finish or abandon one of those first.'
      using errcode = 'check_violation';
  end if;

  -- ------------------------------------------------------- the order row --
  v_order_no := to_char(now() at time zone 'America/Denver', 'YYMMDD')
                || '-' || lpad(nextval('public.shop_order_no_seq')::text, 4, '0');

  insert into public.shop_order (
    clinic_id, order_no, contact_name, contact_email, contact_phone, note,
    subtotal_cents, tax_cents, total_cents, synthetic
  ) values (
    c.id, v_order_no, btrim(p_name), p_email::citext, nullif(btrim(p_phone), ''),
    nullif(btrim(p_note), ''), 0, 0, 0, v_synthetic
  )
  returning id into v_order;

  -- ----------------------------------------------------------- the lines --
  for item in select * from jsonb_array_elements(p_items)
  loop
    if (item->>'product_id') is null or (item->>'qty') is null then
      raise exception 'The basket could not be read. Please try again.'
        using errcode = 'check_violation';
    end if;

    -- FOR UPDATE so that when the practice DOES track stock, two simultaneous
    -- checkouts cannot both pass the check on the last unit. The row stays
    -- locked until this transaction commits, microseconds later.
    select id, name, brand, price_cents, stock_qty, online, active
      into prod
    from public.product
    where id = (item->>'product_id')::uuid
      and clinic_id = c.id
    for update;

    if prod.id is null then
      raise exception 'One of the items is no longer in the shop. Please review your basket.'
        using errcode = 'no_data_found';
    end if;
    if not (prod.online and prod.active) then
      raise exception '% is not available to buy online.', prod.name
        using errcode = 'check_violation';
    end if;

    if (item->>'qty')::int < 1 or (item->>'qty')::int > 10 then
      raise exception 'Quantity for % must be between 1 and 10.', prod.name
        using errcode = 'check_violation';
    end if;

    -- Only a practice that actually holds the stock can run out of it.
    if c.track_stock and prod.stock_qty < (item->>'qty')::int then
      raise exception '% — only % left in stock.', prod.name, prod.stock_qty
        using errcode = 'check_violation';
    end if;

    insert into public.shop_order_item (
      clinic_id, order_id, product_id, name_snapshot, brand_snapshot,
      unit_price_cents, qty, line_total_cents, synthetic
    ) values (
      c.id, v_order, prod.id, prod.name, prod.brand,
      prod.price_cents, (item->>'qty')::int,
      prod.price_cents * (item->>'qty')::int, v_synthetic
    );

    v_subtotal := v_subtotal + prod.price_cents * (item->>'qty')::int;

    -- Returned so the caller can build Stripe line items from the database's
    -- numbers instead of echoing back the browser's.
    v_lines := v_lines || jsonb_build_object(
      'name', prod.name,
      'brand', prod.brand,
      'unit_price_cents', prod.price_cents,
      'qty', (item->>'qty')::int
    );
  end loop;

  -- Tax on the subtotal, once, rounded half-up to the cent. Per-line rounding
  -- drifts from the figure on the invoice.
  v_tax   := round(v_subtotal::numeric * c.sales_tax_bps / 10000);
  v_total := v_subtotal + v_tax;

  update public.shop_order
     set subtotal_cents = v_subtotal,
         tax_cents      = v_tax,
         total_cents    = v_total
   where id = v_order;

  return jsonb_build_object(
    'order_id',       v_order,
    'order_no',       v_order_no,
    'clinic_id',      c.id,
    'practice_name',  c.name,
    'subtotal_cents', v_subtotal,
    'tax_cents',      v_tax,
    'tax_bps',        c.sales_tax_bps,
    'total_cents',    v_total,
    'synthetic',      v_synthetic,
    'lines',          v_lines
  );
end;
$$;

-- ===========================================================================
-- app.shop_order_attach_session — record which Stripe session is paying
-- ===========================================================================
-- Split from create() because the Stripe call happens between them: we need an
-- order id to put in the session's metadata, and a session id to put on the
-- order. Narrow on purpose — it can only ever fill in a blank on a pending
-- order, so a replay cannot repoint a paid order at a different session.

create or replace function app.shop_order_attach_session(
  p_order   uuid,
  p_session text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.shop_order
     set stripe_checkout_session_id = p_session
   where id = p_order
     and status = 'pending'
     and stripe_checkout_session_id is null;

  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'That order is not waiting for payment.'
      using errcode = 'check_violation';
  end if;
end;
$$;

-- ===========================================================================
-- app.shop_order_mark_paid — settlement. NOT granted to anon.
-- ===========================================================================
-- Called only by the Stripe webhook, only after signature verification.
--
-- Idempotent: Stripe retries, and delivers at-least-once. Calling this twice
-- for the same session must not decrement stock twice, so the status change is
-- the lock — the update only fires while the order is still pending, and the
-- stock decrement is inside the same `if`.
--
-- Refuses for a clinic still in pilot mode. That guard lives in the database
-- as well as the application because an env var is one edit away from being
-- wrong, and this is the function that moves inventory.

create or replace function app.shop_order_mark_paid(
  p_session  text,
  p_intent   text,
  p_amount   int,
  p_account  text default null,
  p_ship     jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
  n int;
  v_track boolean;
begin
  select id, clinic_id, status, total_cents, order_no
    into o
  from public.shop_order
  where stripe_checkout_session_id = p_session
  for update;

  if o.id is null then
    return jsonb_build_object('applied', false, 'reason', 'unknown_session');
  end if;

  if app.clinic_in_pilot(o.clinic_id) then
    return jsonb_build_object('applied', false, 'reason', 'clinic_in_pilot',
                              'order_no', o.order_no);
  end if;

  if o.status <> 'pending' then
    -- Already settled. Stripe retried; say so and change nothing.
    return jsonb_build_object('applied', false, 'reason', 'already_' || o.status,
                              'order_no', o.order_no);
  end if;

  -- What Stripe says was charged must match what we recorded, or something is
  -- wrong enough to stop for rather than reconcile silently.
  if p_amount is not null and p_amount <> o.total_cents then
    update public.shop_order
       set status = 'failed',
           failure_reason = format('amount mismatch: stripe %s, order %s',
                                   p_amount, o.total_cents)
     where id = o.id;
    return jsonb_build_object('applied', false, 'reason', 'amount_mismatch',
                              'order_no', o.order_no);
  end if;

  update public.shop_order
     set status = 'paid',
         paid_at = now(),
         stripe_payment_intent_id = p_intent,
         stripe_account_id = p_account,
         -- Shipping arrives with the payment, not with the order: Stripe
         -- collects it on its own page. Absent fields stay null rather than
         -- overwriting with empty strings.
         ship_name    = coalesce(nullif(p_ship->>'name',    ''), ship_name),
         ship_line1   = coalesce(nullif(p_ship->>'line1',   ''), ship_line1),
         ship_line2   = coalesce(nullif(p_ship->>'line2',   ''), ship_line2),
         ship_city    = coalesce(nullif(p_ship->>'city',    ''), ship_city),
         ship_state   = coalesce(nullif(p_ship->>'state',   ''), ship_state),
         ship_postal  = coalesce(nullif(p_ship->>'postal',  ''), ship_postal),
         ship_country = coalesce(nullif(p_ship->>'country', ''), ship_country)
   where id = o.id
     and status = 'pending';

  get diagnostics n = row_count;
  if n = 0 then
    return jsonb_build_object('applied', false, 'reason', 'race_lost');
  end if;

  -- Stock comes off on payment, not on checkout creation. An abandoned basket
  -- is the common case and must not hold inventory hostage; the cost is that
  -- two people can buy the last unit within the same few seconds, which
  -- greatest() turns into a visible zero rather than a negative count the
  -- practice never notices.
  --
  -- Skipped entirely when the practice does not track stock, because then
  -- stock_qty is a note about the shelf and this order did not come off it.
  select track_stock into v_track from public.clinic where id = o.clinic_id;

  if v_track then
    update public.product p
       set stock_qty = greatest(0, p.stock_qty - i.qty)
      from public.shop_order_item i
     where i.order_id = o.id
       and p.id = i.product_id;
  end if;

  return jsonb_build_object('applied', true, 'order_no', o.order_no,
                            'order_id', o.id);
end;
$$;

-- ===========================================================================
-- app.shop_order_mark_failed — the other end. NOT granted to anon.
-- ===========================================================================

create or replace function app.shop_order_mark_failed(
  p_session text,
  p_status  text,
  p_reason  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  if p_status not in ('failed', 'expired') then
    raise exception 'shop_order_mark_failed takes failed or expired, not %', p_status;
  end if;

  update public.shop_order
     set status = p_status,
         failure_reason = p_reason
   where stripe_checkout_session_id = p_session
     and status = 'pending';

  get diagnostics n = row_count;
  return jsonb_build_object('applied', n > 0);
end;
$$;

-- ===========================================================================
-- app.shop_order_collect — the front desk handing the bag over
-- ===========================================================================
-- Staff-facing, so it runs as the signed-in user and checks their role rather
-- than bypassing RLS. Here because "collected" is a state change with a
-- who-and-when, not a checkbox.

create or replace function app.shop_order_collect(p_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
  s uuid;
begin
  select id, clinic_id, status into o
  from public.shop_order where id = p_order;

  if o.id is null then
    raise exception 'No such order.' using errcode = 'no_data_found';
  end if;
  if not app.is_staff(o.clinic_id) then
    raise exception 'Not your practice.' using errcode = 'insufficient_privilege';
  end if;
  if o.status <> 'paid' then
    raise exception 'Only a paid order can be marked collected (this one is %).', o.status
      using errcode = 'check_violation';
  end if;

  select id into s from public.staff_user
   where auth_user_id = auth.uid() and active limit 1;

  update public.shop_order
     set status = 'collected', collected_at = now(), collected_by = s
   where id = p_order;
end;
$$;

-- ------------------------------------------------------------ the grants ----
-- The whole security posture of this migration is these dozen lines. Read them
-- as the answer to "what can a stranger with the anon key do?"

revoke all on shop_order      from anon;
revoke all on shop_order_item from anon;

revoke all on function app.shop_order_create(text, jsonb, text, text, text, text)  from public, anon, authenticated;
revoke all on function app.shop_order_attach_session(uuid, text)                   from public, anon, authenticated;
revoke all on function app.shop_order_mark_paid(text, text, int, text, jsonb)      from public, anon, authenticated;
revoke all on function app.shop_order_mark_failed(text, text, text)                from public, anon, authenticated;
revoke all on function app.shop_order_collect(uuid)                                from public, anon, authenticated;

-- A visitor may place an order and say which Stripe session is paying for it.
-- That is the entire public write surface of the shop.
grant execute on function app.shop_order_create(text, jsonb, text, text, text, text) to anon, authenticated;
grant execute on function app.shop_order_attach_session(uuid, text)                  to anon, authenticated;

-- Settlement is the webhook's alone. anon is deliberately absent, and stays so.
grant execute on function app.shop_order_mark_paid(text, text, int, text, jsonb) to service_role;
grant execute on function app.shop_order_mark_failed(text, text, text)           to service_role;

-- Collection is the front desk's, as themselves, with their role checked.
grant execute on function app.shop_order_collect(uuid) to authenticated;

-- The sequence is touched only inside a security-definer function, so no role
-- the application runs as needs rights on it directly.
revoke all on sequence shop_order_no_seq from anon, authenticated;

-- ----------------------------------------------------------- this practice ----
-- The Med Bar sells a supplier-shipped line, so stock is a note rather than a
-- gate. The tax rate is deliberately NOT set here: nobody in this repository
-- knows it, and a plausible-looking guess would be collected from real
-- customers. Until the practice supplies it, app.shop_order_create refuses and
-- the shop says products are bought in person.

update clinic set track_stock = false where slug = 'medbar-loveland';

commit;
