-- 0021_custom_charges.sql
--
-- Charging for something that is not on the menu, and discounting something
-- that is.
--
-- ===========================================================================
-- THE GAP THIS FILLS
-- ===========================================================================
-- Everything the system can currently take money for has to exist as a row
-- first: a product in the shop, a service on the menu. Real practice does not
-- work that way. A treatment runs long and there is an extra area. A friend
-- gets the friends-and-family price. Somebody pays a deposit toward a series
-- that has not been decided yet. A product is discounted because it is the last
-- one and the box is dented.
--
-- Without a way to express any of that, the practitioner does what everybody
-- does with software that will not bend: takes the money somewhere else — a
-- card reader, a payment app, cash — and the system's record of what the
-- business earned quietly stops being true. That is a worse outcome than any
-- amount of untidiness in the schema.
--
-- ===========================================================================
-- WHY IT REUSES shop_order
-- ===========================================================================
-- A custom charge and a shop order are the same object: contact details, a set
-- of priced lines, a total, a Stripe session, a paid-at. The differences are a
-- `kind` and where the line prices come from.
--
-- A second table would mean a second settlement path in the webhook, a second
-- place to get idempotency right, and two screens to reconcile at the end of
-- the month. One table with a discriminator is the smaller thing to hold.
--
-- ===========================================================================
-- THE PRICE RULE IS DIFFERENT HERE, DELIBERATELY
-- ===========================================================================
-- The shop refuses to let the caller supply a price, because the caller is an
-- anonymous browser. Here the caller is the practice owner, signed in, and
-- naming a price is the entire point of the feature.
--
-- So `app.custom_charge_create` is granted to `authenticated` and checks
-- app.is_staff() for the clinic — it is not, and must never be, granted to
-- anon. The guard moves from "prices are not an input" to "only staff of this
-- practice may name one".

begin;

-- ------------------------------------------------------------ shop_order ----

alter table shop_order
  add column if not exists kind text not null default 'shop'
    check (kind in ('shop', 'custom')),
  -- Who the charge is for, when it is somebody already on the books. Nullable:
  -- a walk-in buying a moisturiser is not a client record and must not become
  -- one just to take twenty dollars.
  add column if not exists patient_id uuid references patient(id) on delete set null,
  add column if not exists created_by_staff_id uuid references staff_user(id) on delete set null,
  -- Order-level discount, applied after the lines and before tax. Stored as an
  -- amount rather than a percentage because the amount is what was actually
  -- given, and a percentage of a later-corrected subtotal is a different number.
  add column if not exists discount_cents int not null default 0 check (discount_cents >= 0),
  add column if not exists discount_note text,
  -- Some custom charges are not taxable — a deposit against future work, a
  -- gratuity, a no-show fee. Left to the practitioner rather than guessed.
  add column if not exists taxable boolean not null default true;

comment on column shop_order.kind is
  'shop = a retail order placed on the public website. custom = a charge raised '
  'by staff in the console for something not on the menu, or at a price that is '
  'not the listed one.';
comment on column shop_order.discount_note is
  'Why the discount was given. Not decoration: at the end of a quarter the '
  'question is always which discounts were deliberate.';

create index if not exists shop_order_patient_idx
  on shop_order (patient_id) where patient_id is not null;

-- ------------------------------------------------------- shop_order_item ----
-- product_id is already nullable, so a custom line needs no schema change
-- beyond a flag saying it was typed rather than chosen. The flag exists so a
-- report can separate "sold a product" from "charged for something" without
-- inferring it from a null.

alter table shop_order_item
  add column if not exists is_custom boolean not null default false,
  -- What the line is for, in the practitioner's own words, when it is not a
  -- product. name_snapshot carries the title; this carries the explanation.
  add column if not exists line_note text,
  -- Per-line discount, for "this one item is half price".
  add column if not exists discount_cents int not null default 0
    check (discount_cents >= 0);

-- ===========================================================================
-- app.custom_charge_create
-- ===========================================================================
-- Raises a charge from lines the practitioner typed or picked.
--
-- Each line is {name, amount_cents, qty, product_id?, service_id?, note?,
-- discount_cents?}. A line naming a product or service still carries its own
-- amount, because overriding the listed price is the reason to be here — but
-- the reference is kept so the sale still counts toward that item in a report.

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
  -- ------------------------------------------------------- who is asking --
  -- The price is an input here, so the caller's right to name one is the
  -- control. Checked first, before anything is read or written.
  if not app.is_staff(p_clinic) then
    raise exception 'Only staff of this practice can raise a charge.'
      using errcode = 'insufficient_privilege';
  end if;

  select id, name, sales_tax_bps into c
  from public.clinic where id = p_clinic;

  select id into v_staff
  from public.staff_user where auth_user_id = auth.uid() and active limit 1;

  -- ------------------------------------------------------------- checks --
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
    btrim(p_name), p_email::citext, nullif(btrim(p_phone), ''), nullif(btrim(p_note), ''),
    0, 0, 0,
    greatest(0, coalesce(p_discount, 0)), nullif(btrim(p_discount_note), ''),
    coalesce(p_taxable, true), 'pickup', app.clinic_in_pilot(c.id)
  )
  returning id into v_order;

  -- -------------------------------------------------------------- lines --
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

    -- A discount larger than the line is almost always a typo, and silently
    -- flooring it to zero hides the mistake until somebody reconciles.
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
      'name', btrim(line->>'name'),
      'unit_price_cents', v_amount,
      'qty', v_qty,
      'discount_cents', v_linedisc
    );
  end loop;

  -- Order-level discount after the lines.
  if greatest(0, coalesce(p_discount, 0)) > v_subtotal then
    raise exception 'The discount is larger than the charge.' using errcode = 'check_violation';
  end if;
  v_subtotal := v_subtotal - greatest(0, coalesce(p_discount, 0));

  -- Tax only if the practice has a rate AND this charge is taxable. A custom
  -- charge is allowed through with no tax rate configured, unlike a shop order:
  -- the practitioner is standing there and has decided the number herself.
  v_tax := case when coalesce(p_taxable, true) then round(v_subtotal::numeric * c.sales_tax_bps / 10000) else 0 end;
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

-- ===========================================================================
-- app.custom_charge_mark_paid — money taken in the room
-- ===========================================================================
-- Not every charge goes through a link. Somebody pays cash, or taps a card on
-- a reader the practice already owns. The record still has to be able to say
-- so, or the totals in this system are only half the business.
--
-- Deliberately separate from the Stripe path: this one records that money
-- arrived by some other means, and says which, rather than pretending a
-- payment intent exists.

create or replace function app.custom_charge_mark_paid(
  p_order  uuid,
  p_method text default 'in_person'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
begin
  select id, clinic_id, status, kind into o
  from public.shop_order where id = p_order;

  if o.id is null then
    raise exception 'No such charge.' using errcode = 'no_data_found';
  end if;
  if not app.is_staff(o.clinic_id) then
    raise exception 'Not your practice.' using errcode = 'insufficient_privilege';
  end if;
  if o.kind <> 'custom' then
    -- A shop order is settled by the webhook against what Stripe says was
    -- charged. Letting it be marked paid by hand would let the two disagree.
    raise exception 'A website order is marked paid by the payment provider, not by hand.'
      using errcode = 'check_violation';
  end if;
  if o.status <> 'pending' then
    raise exception 'That charge is already %.', o.status using errcode = 'check_violation';
  end if;

  update public.shop_order
     set status = 'paid',
         paid_at = now(),
         processor_note = p_method
   where id = p_order;
end;
$$;

alter table shop_order add column if not exists processor_note text;
comment on column shop_order.processor_note is
  'How the money arrived when it did not come through Stripe — cash, a card '
  'reader, a transfer. Null for anything settled by the webhook.';

-- ------------------------------------------------------------- the grants ----
-- Staff only. `anon` is absent from both, and that is the whole difference
-- between this file and the shop: here, naming a price is the feature.

revoke all on function app.custom_charge_create(uuid, jsonb, text, text, text, uuid, int, text, boolean, text)
  from public, anon, authenticated;
revoke all on function app.custom_charge_mark_paid(uuid, text) from public, anon, authenticated;

grant execute on function app.custom_charge_create(uuid, jsonb, text, text, text, uuid, int, text, boolean, text)
  to authenticated;
grant execute on function app.custom_charge_mark_paid(uuid, text) to authenticated;

-- Public wrappers, because PostgREST only exposes `public`. Same reasoning as
-- migration 0016.
create or replace function public.custom_charge_create(
  p_clinic uuid, p_lines jsonb, p_name text, p_email text,
  p_phone text default null, p_patient uuid default null,
  p_discount int default 0, p_discount_note text default null,
  p_taxable boolean default true, p_note text default null
)
returns jsonb language sql security definer set search_path = '' as $$
  select app.custom_charge_create(p_clinic, p_lines, p_name, p_email, p_phone,
                                  p_patient, p_discount, p_discount_note, p_taxable, p_note);
$$;

create or replace function public.custom_charge_mark_paid(p_order uuid, p_method text default 'in_person')
returns void language sql security definer set search_path = '' as $$
  select app.custom_charge_mark_paid(p_order, p_method);
$$;

revoke all on function public.custom_charge_create(uuid, jsonb, text, text, text, uuid, int, text, boolean, text)
  from public, anon, authenticated, service_role;
revoke all on function public.custom_charge_mark_paid(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.custom_charge_create(uuid, jsonb, text, text, text, uuid, int, text, boolean, text)
  to authenticated;
grant execute on function public.custom_charge_mark_paid(uuid, text) to authenticated;

commit;
