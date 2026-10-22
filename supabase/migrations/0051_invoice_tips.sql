-- 0051_invoice_tips.sql
-- A tip the CLIENT chooses, on an invoice the practice sends.
--
-- ===========================================================================
-- WHY THIS NEEDS A PAGE OF OURS AND NOT JUST A LINE ITEM
-- ===========================================================================
-- A tip added to the Checkout total before the link is sent cannot be
-- declined: the client's only choices become pay-with-tip or do not pay. That
-- is a charge wearing the word "suggested", and for a practice whose whole
-- business is the relationship it is the wrong dynamic.
--
-- Stripe cannot solve it either. Its pay-what-you-want pricing forbids any
-- other line item in the session, so it cannot sit alongside the treatment
-- being invoiced, and Checkout has no tip field of its own — tipping lives in
-- Terminal, which is hardware this practice does not have.
--
-- So the invoice links to a page here. It shows the amount with the practice's
-- suggestion already selected, the client changes it or zeroes it, and only
-- then is a Stripe session created, once, for the real total.
--
-- ===========================================================================
-- WHAT IS BEING ADDED
-- ===========================================================================
--   pay_token      the public link. Opaque, like intake_token and
--                  confirm_token before it, so the page can be opened by
--                  somebody with no account and no session.
--
--   tip_cents      what they chose. Kept separate from total_cents forever,
--                  because a tip is not practice revenue in the same sense
--                  and lumping it in makes takings unanswerable later.
--
--   tip_suggested_cents
--                  what the practice proposed. Worth keeping apart from what
--                  was actually given: the difference between the two is the
--                  only honest way to find out whether the suggestion is set
--                  sensibly.

alter table public.shop_order
  add column if not exists pay_token            uuid default gen_random_uuid(),
  add column if not exists tip_cents            int not null default 0,
  add column if not exists tip_suggested_cents  int not null default 0;

-- Backfill, so links can be made for orders raised before this existed.
update public.shop_order set pay_token = gen_random_uuid() where pay_token is null;

create unique index if not exists shop_order_pay_token_key
  on public.shop_order (pay_token) where pay_token is not null;

comment on column public.shop_order.tip_cents is
  'Chosen by the customer on the payment page. Never set by staff, never included in a suggestion.';
comment on column public.shop_order.tip_suggested_cents is
  'What the practice proposed. Kept so the suggestion can be judged against what was actually given.';

-- A tip cannot be negative, and nothing may quietly turn a refund into one.
alter table public.shop_order drop constraint if exists shop_order_tip_not_negative;
alter table public.shop_order
  add constraint shop_order_tip_not_negative check (tip_cents >= 0 and tip_suggested_cents >= 0);

-- ---------------------------------------------------------------------------
-- What the payment page may see.
--
-- A function rather than a table read, for the reason migration 0046 sets out
-- at length: `shop_order` is not readable by anon and should not become so.
-- This returns the few fields a person needs to recognise their own invoice
-- and nothing else — no clinic id, no internal status beyond payable, no
-- contact details beyond the name they gave.
--
-- Returns nothing once an order is paid, so a forwarded link cannot be used to
-- read a settled invoice indefinitely.
-- ---------------------------------------------------------------------------
create or replace function app.order_for_payment(p_token uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  o record;
  v_lines jsonb;
begin
  select so.id, so.order_no, so.contact_name, so.status,
         so.subtotal_cents, so.tax_cents, so.shipping_cents,
         so.discount_cents, so.tip_cents, so.tip_suggested_cents,
         c.name as practice_name
    into o
  from public.shop_order so
  join public.clinic c on c.id = so.clinic_id
  where so.pay_token = p_token
    and c.listed and c.active;

  if o.id is null then
    return jsonb_build_object('status', 'unknown');
  end if;
  if o.status <> 'pending' then
    -- Deliberately says only that it is settled. Somebody holding a stale link
    -- gets a plain answer and no detail.
    return jsonb_build_object('status', o.status, 'order_no', o.order_no);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', i.name_snapshot, 'qty', i.qty,
           'line_total_cents', i.line_total_cents)), '[]'::jsonb)
    into v_lines
  from public.shop_order_item i where i.order_id = o.id;

  return jsonb_build_object(
    'status', 'pending',
    'order_no', o.order_no,
    'practice_name', o.practice_name,
    'name', o.contact_name,
    'subtotal_cents', o.subtotal_cents,
    'tax_cents', o.tax_cents,
    'shipping_cents', coalesce(o.shipping_cents, 0),
    'discount_cents', coalesce(o.discount_cents, 0),
    'tip_cents', o.tip_cents,
    'tip_suggested_cents', o.tip_suggested_cents,
    'lines', v_lines
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Set the tip and recompute the total.
--
-- THE TOTAL IS COMPUTED HERE, not sent. The rule the whole shop rests on — a
-- basket is ids and counts, the server does the arithmetic — applies no less
-- to a tip. What arrives is a number of cents to add; what it adds up to is
-- this function's business.
--
-- Bounded, because an unbounded amount typed into a public page is a way to
-- make somebody's card decline or to test stolen cards against a real
-- merchant. The ceiling is generous enough that no honest tip reaches it.
-- ---------------------------------------------------------------------------
create or replace function app.order_set_tip(p_token uuid, p_tip_cents int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
  v_tip int;
  v_total int;
begin
  select id, status, subtotal_cents, tax_cents, shipping_cents, discount_cents
    into o
  from public.shop_order where pay_token = p_token for update;

  if o.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  if o.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'not_pending', 'status', o.status);
  end if;

  v_tip := greatest(0, coalesce(p_tip_cents, 0));

  -- No tip larger than the work it is thanking somebody for, capped at $500.
  -- Both bounds, because a $20 order should not accept a $500 tip either.
  v_tip := least(v_tip, greatest(o.subtotal_cents, 0));
  v_tip := least(v_tip, 50000);

  v_total := greatest(0,
    coalesce(o.subtotal_cents, 0) + coalesce(o.tax_cents, 0)
    + coalesce(o.shipping_cents, 0) - coalesce(o.discount_cents, 0)) + v_tip;

  update public.shop_order
     set tip_cents = v_tip, total_cents = v_total, updated_at = now()
   where id = o.id;

  return jsonb_build_object('ok', true, 'tip_cents', v_tip, 'total_cents', v_total);
end;
$$;

create or replace function public.order_for_payment(p_token uuid)
returns jsonb language sql security definer stable set search_path = '' as $$
  select app.order_for_payment(p_token);
$$;

create or replace function public.order_set_tip(p_token uuid, p_tip_cents int)
returns jsonb language sql security definer set search_path = '' as $$
  select app.order_set_tip(p_token, p_tip_cents);
$$;

revoke all on function app.order_for_payment(uuid) from public, anon, authenticated, service_role;
revoke all on function public.order_for_payment(uuid) from public, anon, authenticated, service_role;
revoke all on function app.order_set_tip(uuid, int) from public, anon, authenticated, service_role;
revoke all on function public.order_set_tip(uuid, int) from public, anon, authenticated, service_role;

grant execute on function app.order_for_payment(uuid) to anon, authenticated;
grant execute on function public.order_for_payment(uuid) to anon, authenticated;
grant execute on function app.order_set_tip(uuid, int) to anon, authenticated;
grant execute on function public.order_set_tip(uuid, int) to anon, authenticated;
