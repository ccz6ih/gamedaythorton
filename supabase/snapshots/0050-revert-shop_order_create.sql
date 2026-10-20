-- 0050-revert-shop_order_create.sql
-- THE WORKING SIX-ARGUMENT FUNCTION, EXACTLY AS IT WAS BEFORE 0050.
--
-- ===========================================================================
-- WHAT THIS IS FOR
-- ===========================================================================
-- 0050 changes shop_order_create's signature, and old and new cannot coexist:
-- PostgREST resolves a six-argument call against both candidates and errors
-- with "function is not unique", which would take the live shop down. So the
-- drop and the create happen in one transaction, and there is no incremental
-- path back.
--
-- This file is the path back. Running it restores the shop to exactly the
-- behaviour it had before the fulfilment choice existed: no pickup option, no
-- postage, orders default to 'ship' as they always did.
--
--   psql "$DATABASE_URL" -f supabase/snapshots/0050-revert-shop_order_create.sql
--
-- It is captured from pg_get_functiondef rather than retyped, so it is the
-- function that was actually running and not somebody's recollection of it.
--
-- ===========================================================================
-- WHAT IT DOES NOT UNDO
-- ===========================================================================
-- The columns from 0048 (shipping_cents, carrier, tracking_code, shipped_at)
-- stay. They are additive, default to today's behaviour, and nothing breaks by
-- their being present — removing them would be a second risky change to undo a
-- first one.
--
-- Orders created WHILE 0050 was live keep whatever fulfilment and shipping
-- they were given. That is correct: they are a record of what was actually
-- sold, and rewriting them to match a reverted code path would be falsifying
-- the books.

drop function if exists app.shop_order_create(text, jsonb, text, text, text, text, text);
drop function if exists public.shop_order_create(text, jsonb, text, text, text, text, text);

CREATE OR REPLACE FUNCTION app.shop_order_create(p_clinic_slug text, p_items jsonb, p_name text, p_email text, p_phone text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if c.sales_tax_bps = 0 then
    raise exception 'Online checkout is not finished being set up. Please ask us directly.'
      using errcode = 'check_violation';
  end if;

  v_synthetic := app.clinic_in_pilot(c.id);

  select count(*) into v_recent
  from public.shop_order o
  where o.clinic_id = c.id
    and o.contact_email = p_email::extensions.citext
    and o.status = 'pending'
    and o.created_at > now() - interval '5 minutes';

  if v_recent >= 5 then
    raise exception 'Several orders are already waiting on payment for this email. '
      'Finish or abandon one of those first.'
      using errcode = 'check_violation';
  end if;

  v_order_no := to_char(now() at time zone 'America/Denver', 'YYMMDD')
                || '-' || lpad(nextval('public.shop_order_no_seq')::text, 4, '0');

  insert into public.shop_order (
    clinic_id, order_no, contact_name, contact_email, contact_phone, note,
    subtotal_cents, tax_cents, total_cents, synthetic
  ) values (
    c.id, v_order_no, btrim(p_name), p_email::extensions.citext,
    nullif(btrim(p_phone), ''), nullif(btrim(p_note), ''), 0, 0, 0, v_synthetic
  )
  returning id into v_order;

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
      'name', prod.name, 'brand', prod.brand,
      'unit_price_cents', prod.price_cents, 'qty', (item->>'qty')::int
    );
  end loop;

  v_tax   := round(v_subtotal::numeric * c.sales_tax_bps / 10000);
  v_total := v_subtotal + v_tax;

  update public.shop_order
     set subtotal_cents = v_subtotal, tax_cents = v_tax, total_cents = v_total
   where id = v_order;

  return jsonb_build_object(
    'order_id', v_order, 'order_no', v_order_no, 'clinic_id', c.id,
    'practice_name', c.name, 'subtotal_cents', v_subtotal, 'tax_cents', v_tax,
    'tax_bps', c.sales_tax_bps, 'total_cents', v_total,
    'synthetic', v_synthetic, 'lines', v_lines
  );
end;
$function$;

create or replace function public.shop_order_create(
  p_clinic_slug text, p_items jsonb, p_name text, p_email text,
  p_phone text default null, p_note text default null
)
returns jsonb language sql security definer set search_path = '' as $$
  select app.shop_order_create(p_clinic_slug, p_items, p_name, p_email, p_phone, p_note);
$$;

revoke all on function app.shop_order_create(text, jsonb, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.shop_order_create(text, jsonb, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function app.shop_order_create(text, jsonb, text, text, text, text)
  to anon, authenticated;
grant execute on function public.shop_order_create(text, jsonb, text, text, text, text)
  to anon, authenticated;
