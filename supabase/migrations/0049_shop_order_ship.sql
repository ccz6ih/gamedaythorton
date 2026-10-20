-- 0049_shop_order_ship.sql
-- Record a dispatch: who carried it and under what reference.
--
-- Purely additive. Nothing existing is altered or dropped. shop_order_collect
-- keeps working exactly as it does for a collection; this is the version for a
-- parcel that has to travel, which previously had to borrow it and ended up
-- filed as 'collected' — a word nobody would use about something posted.
--
-- Carrier and tracking are whatever the person at the counter typed. Never
-- generated, never guessed, and null is allowed: a hand-delivered parcel has
-- no tracking number, and a form that insists on one teaches people to type
-- "n/a" forever.
create or replace function app.shop_order_ship(
  p_order uuid, p_carrier text default null, p_tracking text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
begin
  select id, clinic_id, status, order_no, collected_at into o
    from public.shop_order where id = p_order for update;

  if o.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Staff of THIS order's practice. A forged id from another clinic is
  -- refused here rather than by whatever page called it.
  if not app.is_staff(o.clinic_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_staff');
  end if;

  -- Nothing unpaid may be marked as sent. Posting something that was never
  -- paid for is the one mistake this screen must not make easy.
  if o.status not in ('paid', 'collected') then
    return jsonb_build_object('ok', false, 'reason', 'not_paid', 'status', o.status);
  end if;

  update public.shop_order
     set carrier       = nullif(btrim(coalesce(p_carrier, '')), ''),
         tracking_code = nullif(btrim(coalesce(p_tracking, '')), ''),
         shipped_at    = now(),
         status        = 'collected',
         collected_at  = coalesce(o.collected_at, now()),
         updated_at    = now()
   where id = o.id;

  return jsonb_build_object('ok', true, 'order_no', o.order_no);
end;
$$;

create or replace function public.shop_order_ship(
  p_order uuid, p_carrier text default null, p_tracking text default null
)
returns jsonb language sql security definer set search_path = '' as $$
  select app.shop_order_ship(p_order, p_carrier, p_tracking);
$$;

revoke all on function app.shop_order_ship(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.shop_order_ship(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function app.shop_order_ship(uuid, text, text) to authenticated;
grant execute on function public.shop_order_ship(uuid, text, text) to authenticated;
