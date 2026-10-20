-- 0047_settlement_survives_a_discount.sql
-- Let Stripe charge LESS than we priced, and record why.
--
-- ===========================================================================
-- WHY THIS HAS TO COME FIRST
-- ===========================================================================
-- allow_promotion_codes was switched on in lib/stripe.ts and switched straight
-- back off, because of this function.
--
-- shop_order_mark_paid compares what Stripe charged against the total we
-- recorded and marks the order FAILED on ANY difference:
--
--     if p_amount is not null and p_amount <> o.total_cents then
--
-- That is exactly right while every price is ours. It is the guard that stops
-- a tampered basket settling, and it is the reason app.shop_order_create reads
-- the product table itself rather than trusting a cart.
--
-- It is exactly wrong the moment a promotion code subtracts from the total.
-- The first customer to use one would have been charged, and then had their
-- order filed as failed: stock never released, the practice told nothing true,
-- and a real payment sitting against a dead record.
--
-- ===========================================================================
-- THE DIRECTION OF THE MISMATCH IS THE WHOLE POINT
-- ===========================================================================
-- Under-charging is explainable: Stripe applied a discount the practice
-- created, in a dashboard only the practice can reach. Over-charging is not
-- explainable by anything legitimate, so it still fails, and the reason code
-- now says which of the two happened instead of a single 'amount_mismatch'
-- covering a discount and an attack.
--
-- ===========================================================================
-- WHAT total_cents MEANS AFTERWARDS
-- ===========================================================================
-- Money actually received. Deliberately, because every existing consumer
-- already reads it that way — the dashboard sums it as takings, and leaving it
-- at the pre-discount figure would quietly overstate revenue on every
-- discounted order.
--
-- The original price is not lost: discount_cents holds the difference, so the
-- pre-discount total is total_cents + discount_cents whenever anybody needs it.

do $mig$
declare
  v_src text;
  v_old text;
begin
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'shop_order_mark_paid';

  ---------------------------------------------------------------- declare --
  v_old := 'declare' || E'\n' ||
           '  o record;' || E'\n' ||
           '  n int;' || E'\n' ||
           '  v_track boolean;';

  if position(v_old in v_src) = 0 then
    raise exception 'mark_paid declare block not found; refusing to guess.';
  end if;

  v_src := replace(v_src, v_old,
           'declare' || E'\n' ||
           '  o record;' || E'\n' ||
           '  n int;' || E'\n' ||
           '  v_track boolean;' || E'\n' ||
           '  v_discount int := 0;');

  ------------------------------------------------------- the amount check --
  v_old :=
    '  if p_amount is not null and p_amount <> o.total_cents then' || E'\n' ||
    '    update public.shop_order' || E'\n' ||
    '       set status = ''failed'',' || E'\n' ||
    '           failure_reason = format(''amount mismatch: stripe %s, order %s'',' || E'\n' ||
    '                                   p_amount, o.total_cents)' || E'\n' ||
    '     where id = o.id;' || E'\n' ||
    '    return jsonb_build_object(''applied'', false, ''reason'', ''amount_mismatch'',' || E'\n' ||
    '                              ''order_no'', o.order_no);' || E'\n' ||
    '  end if;';

  if position(v_old in v_src) = 0 then
    raise exception 'mark_paid amount check not found; refusing to guess.';
  end if;

  v_src := replace(v_src, v_old,
    '  -- MORE than we priced is not explainable by anything legitimate.' || E'\n' ||
    '  if p_amount is not null and p_amount > o.total_cents then' || E'\n' ||
    '    update public.shop_order' || E'\n' ||
    '       set status = ''failed'',' || E'\n' ||
    '           failure_reason = format(''overcharge: stripe %s, order %s'',' || E'\n' ||
    '                                   p_amount, o.total_cents)' || E'\n' ||
    '     where id = o.id;' || E'\n' ||
    '    return jsonb_build_object(''applied'', false, ''reason'', ''amount_overcharge'',' || E'\n' ||
    '                              ''order_no'', o.order_no);' || E'\n' ||
    '  end if;' || E'\n' ||
    E'\n' ||
    '  -- LESS is a promotion code the practice created in its own dashboard.' || E'\n' ||
    '  -- Recorded rather than refused, and never negative.' || E'\n' ||
    '  if p_amount is not null and p_amount < o.total_cents then' || E'\n' ||
    '    v_discount := o.total_cents - p_amount;' || E'\n' ||
    '  end if;');

  ----------------------------------------------------------- the update ----
  v_old :=
    '     set status = ''paid'',' || E'\n' ||
    '         paid_at = now(),';

  if position(v_old in v_src) = 0 then
    raise exception 'mark_paid update block not found; refusing to guess.';
  end if;

  v_src := replace(v_src, v_old,
    '     set status = ''paid'',' || E'\n' ||
    '         paid_at = now(),' || E'\n' ||
    '         -- What was actually received. See the migration header for why' || E'\n' ||
    '         -- this moves rather than staying at the priced figure.' || E'\n' ||
    '         total_cents = coalesce(p_amount, total_cents),' || E'\n' ||
    '         discount_cents = coalesce(discount_cents, 0) + v_discount,' || E'\n' ||
    '         discount_note = case when v_discount > 0' || E'\n' ||
    '                           then ''Stripe promotion code''' || E'\n' ||
    '                           else discount_note end,');

  execute v_src;

  ------------------------------------------------------------- prove it ----
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'shop_order_mark_paid';

  if position('p_amount <> o.total_cents' in v_src) > 0 then
    raise exception 'the equality check is still there.';
  end if;
  if position('v_discount := o.total_cents - p_amount' in v_src) = 0 then
    raise exception 'the discount branch did not land.';
  end if;
  if position('amount_overcharge' in v_src) = 0 then
    raise exception 'the overcharge refusal did not land.';
  end if;
end
$mig$;
