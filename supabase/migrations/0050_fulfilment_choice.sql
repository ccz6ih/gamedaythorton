-- 0050_fulfilment_choice.sql
-- Let the customer say whether they are collecting it, and price postage.
--
-- ===========================================================================
-- WHY THIS ONE HAD TO BE ATOMIC
-- ===========================================================================
-- Adding p_fulfilment changes the signature, and the old and new functions
-- cannot coexist: PostgREST resolves a six-argument call against both
-- candidates and errors with "function is not unique". Leaving both in place
-- for even a moment takes the live shop down, so the drop and the create are
-- in one transaction and there is no incremental path.
--
-- The path BACK is supabase/snapshots/0050-revert-shop_order_create.sql,
-- captured from pg_get_functiondef before this ran — the function that was
-- actually in production, not a recollection of it.
--
-- Written out in full rather than patched by string replacement. The earlier
-- migrations in this area amended a live definition in place because they
-- changed two lines inside two hundred; this changes the signature, the
-- declarations, a query, an insert, the arithmetic and the return, and at
-- that point the replacements are harder to review than the function is.
--
-- ===========================================================================
-- THE PRICE IS STILL OURS
-- ===========================================================================
-- The rule the whole shop rests on — the basket is ids and counts, the server
-- reads the product table and computes the total — now covers postage. The
-- customer says 'pickup' or 'ship' and NOTHING else; what that costs is read
-- from the clinic row here. A cart that could name its own shipping price is
-- the same hole as one that could name its own product price.
--
-- ===========================================================================
-- SHIPPING IS NOT TAXED
-- ===========================================================================
-- Tax stays on the goods exactly as before and postage is added after it.
-- Whether Colorado wants sales tax charged on delivery depends on how it is
-- billed and is a question for the practice's accountant. Doing nothing is
-- the reversible answer; guessing is not.
--
-- With ship_flat_cents at 0 — which is where 0048 left it, pending a real
-- postage figure — every total this produces is identical to the one before
-- it. The mechanism goes live before the price does, on purpose.

drop function if exists app.shop_order_create(text, jsonb, text, text, text, text);
drop function if exists public.shop_order_create(text, jsonb, text, text, text, text);

create or replace function app.shop_order_create(
  p_clinic_slug text,
  p_items jsonb,
  p_name text,
  p_email text,
  p_phone text default null,
  p_note text default null,
  p_fulfilment text default 'ship'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  c            record;
  item         jsonb;
  prod         record;
  v_order      uuid;
  v_order_no   text;
  v_subtotal   int := 0;
  v_tax        int;
  v_ship       int := 0;
  v_total      int;
  v_count      int;
  v_recent     int;
  v_synthetic  boolean;
  v_fulfil     text;
  v_lines      jsonb := '[]'::jsonb;
begin
  select id, name, listed, active, sales_tax_bps, site_live, track_stock,
         ship_flat_cents, ship_free_over_cents
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

  -- The only thing the customer gets to say about delivery. Anything absent
  -- or unrecognised is 'ship', which is what every order meant before this
  -- parameter existed.
  v_fulfil := lower(coalesce(nullif(btrim(p_fulfilment), ''), 'ship'));
  if v_fulfil not in ('ship', 'pickup') then
    raise exception 'Choose collection or delivery.' using errcode = 'check_violation';
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
    subtotal_cents, tax_cents, total_cents, fulfilment, synthetic
  ) values (
    c.id, v_order_no, btrim(p_name), p_email::extensions.citext,
    nullif(btrim(p_phone), ''), nullif(btrim(p_note), ''), 0, 0, 0,
    v_fulfil, v_synthetic
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

  v_tax := round(v_subtotal::numeric * c.sales_tax_bps / 10000);

  -- Postage, computed here and nowhere else. Collection is always free; so is
  -- a subtotal at or above the practice's threshold. The threshold is read
  -- before the flat rate so that a practice which has set one but no rate
  -- still behaves sensibly.
  if v_fulfil = 'pickup' then
    v_ship := 0;
  elsif c.ship_free_over_cents is not null
        and v_subtotal >= c.ship_free_over_cents then
    v_ship := 0;
  else
    v_ship := coalesce(c.ship_flat_cents, 0);
  end if;

  v_total := v_subtotal + v_tax + v_ship;

  update public.shop_order
     set subtotal_cents = v_subtotal,
         tax_cents      = v_tax,
         shipping_cents = v_ship,
         total_cents    = v_total
   where id = v_order;

  return jsonb_build_object(
    'order_id', v_order, 'order_no', v_order_no, 'clinic_id', c.id,
    'practice_name', c.name, 'subtotal_cents', v_subtotal, 'tax_cents', v_tax,
    'tax_bps', c.sales_tax_bps, 'total_cents', v_total,
    -- The three the checkout needs to show a true basket: what postage came
    -- to, which way it is going, and the threshold, so the cart can say how
    -- much more would make it free.
    'shipping_cents', v_ship, 'fulfilment', v_fulfil,
    'free_over_cents', c.ship_free_over_cents,
    'synthetic', v_synthetic, 'lines', v_lines
  );
end;
$function$;

-- PostgREST reads `public`, so a thin wrapper, same as 0016 and 0026.
create or replace function public.shop_order_create(
  p_clinic_slug text, p_items jsonb, p_name text, p_email text,
  p_phone text default null, p_note text default null,
  p_fulfilment text default 'ship'
)
returns jsonb language sql security definer set search_path = '' as $$
  select app.shop_order_create(p_clinic_slug, p_items, p_name, p_email,
                               p_phone, p_note, p_fulfilment);
$$;

revoke all on function app.shop_order_create(text, jsonb, text, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.shop_order_create(text, jsonb, text, text, text, text, text)
  from public, anon, authenticated, service_role;

grant execute on function app.shop_order_create(text, jsonb, text, text, text, text, text)
  to anon, authenticated;
grant execute on function public.shop_order_create(text, jsonb, text, text, text, text, text)
  to anon, authenticated;
