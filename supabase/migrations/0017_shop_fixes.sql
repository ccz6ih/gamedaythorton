-- 0017_shop_fixes.sql
--
-- Two defects in 0015, both found by scripts/shop-test.cjs on its first run.
--
-- ===========================================================================
-- 1. track_stock WAS NEVER GRANTED TO anon
-- ===========================================================================
-- 0015 added clinic.track_stock and granted anon nothing on it. The shop page
-- reads it to decide whether to show stock counts.
--
-- The damage was hidden by a helpful accident: lib/db/shop.ts returns false
-- when the read fails, and false is also the correct value for this practice,
-- so the page looked right. It would have stayed looking right until the first
-- practice that DOES hold stock turned tracking on and found the setting had no
-- effect — with nothing in any log to explain it, because a column-level
-- permission failure comes back as an ordinary empty result.
--
-- This is the argument for the storefront tests reading columns individually
-- rather than in one convenient select: a single missing grant makes the whole
-- row unreadable, so a broad query masks exactly which column is at fault.
--
-- ===========================================================================
-- 2. THE TAX CHECK RAN BEFORE THE REQUEST WAS VALIDATED
-- ===========================================================================
-- app.shop_order_create refused with "checkout is not finished being set up"
-- for an empty basket and for a malformed email, because the practice-level
-- configuration check came first and short-circuited everything after it.
--
-- Both refusals are correct in the sense that nothing was ordered. Both are
-- wrong in the sense that matters: the message sent a customer to ring the
-- practice about a setup problem when in fact they had mistyped their own email
-- address. A stranger cannot act on "we are not set up"; they can act on "that
-- email address does not look right".
--
-- So the order is now: is this request coherent, then is this practice able to
-- sell. Validate the input you were given before reporting on your own state.

begin;

grant select (track_stock) on clinic to anon;

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
  -- ------------------------------------------------- does this exist at all --
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

  -- ------------------------------------- is the REQUEST coherent (first) --
  -- Before anything about how this practice is configured, because a customer
  -- can fix their own typo and cannot fix our setup.
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
    raise exception 'That email address does not look right — we need a working one to send the receipt.'
      using errcode = 'check_violation';
  end if;

  -- ------------------------------- can this practice sell online (second) --
  if c.sales_tax_bps = 0 then
    raise exception 'Online checkout is not finished being set up. Please ask us directly.'
      using errcode = 'check_violation';
  end if;

  v_synthetic := app.clinic_in_pilot(c.id);

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

-- `create or replace` keeps existing grants, but state them again rather than
-- relying on that — a future replacement that changes the signature would
-- silently create an ungranted function instead.
revoke all on function app.shop_order_create(text, jsonb, text, text, text, text) from public, anon, authenticated;
grant execute on function app.shop_order_create(text, jsonb, text, text, text, text) to anon, authenticated;

commit;
