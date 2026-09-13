-- 0022_citext_qualify.sql
--
-- Fixes a bug that would have broken the FIRST REAL ORDER, in both the shop and
-- the new custom-charge path.
--
-- ===========================================================================
-- WHAT HAPPENED
-- ===========================================================================
-- Both order functions are `security definer` with `set search_path = ''`,
-- which is correct and deliberate: an empty search path is what stops a caller
-- planting a table or an operator in a schema the function would otherwise
-- resolve first. Every table reference in them is schema-qualified for exactly
-- that reason.
--
-- The TYPE casts were not. `p_email::citext` has no schema on it, and on
-- Supabase citext lives in `extensions`, not `public`. With an empty search
-- path there is nowhere to find it, so the cast fails at runtime with
--
--     type "citext" does not exist
--
-- ===========================================================================
-- WHY NOTHING CAUGHT IT
-- ===========================================================================
-- Because it is on the success path only, and no test had ever reached the
-- success path.
--
-- The shop's tests all end in a deliberate refusal — an empty basket, a bad
-- email, a forged price — and each of those raises BEFORE the insert. The one
-- test that would have gone all the way through is blocked earlier still, by
-- the practice not having set a sales tax rate yet. So the suite was green, the
-- function was broken, and the first person to actually buy something would
-- have seen checkout fail.
--
-- That is the failure mode worth naming: a test suite made entirely of refusals
-- proves the guards and says nothing at all about whether the thing works. The
-- custom-charge tests found it within a minute of existing, because a charge
-- with no tax rate is allowed to succeed and so one of them finally ran the
-- insert.
--
-- Both functions are re-created below with the cast qualified. Nothing else
-- changes.

begin;

-- ------------------------------------------------------ shop_order_create ----
-- Identical to 0017 except `p_email::citext` -> `p_email::extensions.citext`.

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
$$;

-- --------------------------------------------------- custom_charge_create ----
-- Same one-word fix.

create or replace function app.custom_charge_create(
  p_clinic       uuid,
  p_lines        jsonb,
  p_name         text,
  p_email        text,
  p_phone        text default null,
  p_patient      uuid default null,
  p_discount     int default 0,
  p_discount_note text default null,
  p_taxable      boolean default true,
  p_note         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c            record;
  line         jsonb;
  v_order      uuid;
  v_order_no   text;
  v_subtotal   int := 0;
  v_tax        int;
  v_total      int;
  v_count      int;
  v_staff      uuid;
  v_amount     int;
  v_qty        int;
  v_linedisc   int;
  v_linetotal  int;
  v_lines      jsonb := '[]'::jsonb;
begin
  if not app.is_staff(p_clinic) then
    raise exception 'Only staff of this practice can raise a charge.'
      using errcode = 'insufficient_privilege';
  end if;

  select id, name, sales_tax_bps into c from public.clinic where id = p_clinic;

  select id into v_staff
  from public.staff_user where auth_user_id = auth.uid() and active limit 1;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Add at least one line to the charge.' using errcode = 'check_violation';
  end if;

  v_count := jsonb_array_length(p_lines);
  if v_count = 0 then
    raise exception 'Add at least one line to the charge.' using errcode = 'check_violation';
  end if;
  if v_count > 30 then
    raise exception 'That is more lines than one charge can carry.' using errcode = 'check_violation';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Who is this charge for?' using errcode = 'check_violation';
  end if;
  if p_email is null or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A working email address is needed to send the receipt and the payment link.'
      using errcode = 'check_violation';
  end if;

  v_order_no := to_char(now() at time zone 'America/Denver', 'YYMMDD')
                || '-' || lpad(nextval('public.shop_order_no_seq')::text, 4, '0');

  insert into public.shop_order (
    clinic_id, order_no, kind, patient_id, created_by_staff_id,
    contact_name, contact_email, contact_phone, note,
    subtotal_cents, tax_cents, total_cents,
    discount_cents, discount_note, taxable, fulfilment, synthetic
  ) values (
    c.id, v_order_no, 'custom', p_patient, v_staff,
    btrim(p_name), p_email::extensions.citext, nullif(btrim(p_phone), ''),
    nullif(btrim(p_note), ''), 0, 0, 0,
    greatest(0, coalesce(p_discount, 0)), nullif(btrim(p_discount_note), ''),
    coalesce(p_taxable, true), 'pickup', app.clinic_in_pilot(c.id)
  )
  returning id into v_order;

  for line in select * from jsonb_array_elements(p_lines)
  loop
    if nullif(btrim(coalesce(line->>'name', '')), '') is null then
      raise exception 'Every line needs a description.' using errcode = 'check_violation';
    end if;

    v_amount := coalesce((line->>'amount_cents')::int, 0);
    v_qty    := greatest(1, coalesce((line->>'qty')::int, 1));
    v_linedisc := greatest(0, coalesce((line->>'discount_cents')::int, 0));

    if v_amount < 0 then
      raise exception 'A line cannot be a negative amount. Use the discount instead.'
        using errcode = 'check_violation';
    end if;
    if v_linedisc > v_amount * v_qty then
      raise exception 'The discount on "%" is larger than the line itself.', line->>'name'
        using errcode = 'check_violation';
    end if;

    v_linetotal := (v_amount * v_qty) - v_linedisc;

    insert into public.shop_order_item (
      clinic_id, order_id, product_id, name_snapshot, brand_snapshot,
      unit_price_cents, qty, line_total_cents,
      is_custom, line_note, discount_cents, synthetic
    ) values (
      c.id, v_order, nullif(line->>'product_id', '')::uuid,
      btrim(line->>'name'), null,
      v_amount, v_qty, v_linetotal,
      coalesce((line->>'is_custom')::boolean, true),
      nullif(btrim(line->>'note'), ''), v_linedisc,
      app.clinic_in_pilot(c.id)
    );

    v_subtotal := v_subtotal + v_linetotal;

    v_lines := v_lines || jsonb_build_object(
      'name', btrim(line->>'name'), 'unit_price_cents', v_amount,
      'qty', v_qty, 'discount_cents', v_linedisc
    );
  end loop;

  if greatest(0, coalesce(p_discount, 0)) > v_subtotal then
    raise exception 'The discount is larger than the charge.' using errcode = 'check_violation';
  end if;
  v_subtotal := v_subtotal - greatest(0, coalesce(p_discount, 0));

  v_tax := case when coalesce(p_taxable, true)
                then round(v_subtotal::numeric * c.sales_tax_bps / 10000) else 0 end;
  v_total := v_subtotal + v_tax;

  if v_total <= 0 then
    raise exception 'The charge comes to nothing once discounts are applied.'
      using errcode = 'check_violation';
  end if;

  update public.shop_order
     set subtotal_cents = v_subtotal, tax_cents = v_tax, total_cents = v_total
   where id = v_order;

  return jsonb_build_object(
    'order_id', v_order, 'order_no', v_order_no, 'clinic_id', c.id,
    'practice_name', c.name, 'subtotal_cents', v_subtotal,
    'tax_cents', v_tax, 'total_cents', v_total, 'lines', v_lines
  );
end;
$$;

-- Restate the grants; `create or replace` keeps them, but relying on that is
-- how a function ends up ungranted after a signature change.
revoke all on function app.shop_order_create(text, jsonb, text, text, text, text)
  from public, anon, authenticated;
grant execute on function app.shop_order_create(text, jsonb, text, text, text, text)
  to anon, authenticated;

revoke all on function app.custom_charge_create(uuid, jsonb, text, text, text, uuid, int, text, boolean, text)
  from public, anon, authenticated;
grant execute on function app.custom_charge_create(uuid, jsonb, text, text, text, uuid, int, text, boolean, text)
  to authenticated;

commit;
