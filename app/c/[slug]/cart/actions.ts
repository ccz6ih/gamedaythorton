'use server';

/**
 * Checkout. The only place the storefront starts a payment.
 *
 * The sequence, and why it is three steps rather than one:
 *
 *   1. app.shop_order_create   — the DATABASE prices the basket. It reads
 *                                `product` itself, computes tax from the
 *                                practice's own rate, and writes a pending
 *                                order. Nothing the browser sent about money is
 *                                consulted, so a forged price is not rejected —
 *                                it is unrepresentable.
 *
 *   2. Stripe                  — a hosted Checkout Session built from the
 *                                numbers step 1 returned. We need an order id
 *                                to put in its metadata, which is why this
 *                                cannot be folded into step 1.
 *
 *   3. attach_session          — record which session is paying for which
 *                                order, so the webhook can find its way back.
 *
 * If step 2 or 3 fails the order stays `pending` and is never paid. A pending
 * order nobody paid is litter; a paid order nobody recorded is a customer
 * charged for nothing. The ordering makes only the harmless one possible.
 */

import { createServerClient } from '@supabase/ssr';
import { canTakeMoney, createShopCheckoutSession, stripeConfigured } from '@/lib/stripe';
import { CART_MAX_LINES, CART_MAX_QTY } from '@/lib/shop';

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

type Incoming = { productId: string; qty: number };

function anonClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

/**
 * Postgres raises with a message written to be read by the customer. Supabase
 * wraps it, so this unwraps it again — but only for the errors we raised on
 * purpose. Anything else gets a generic line, because a raw database error
 * shown on a public page tells a stranger about the schema.
 */
function customerFacing(message: string | undefined): string {
  if (!message) return 'Something went wrong starting checkout. Please try again.';

  // Our own raises come through recognisably; internal failures do not.
  const ours = [
    'No such practice', 'not accepting online orders', 'not finished being set up',
    'No items in the basket', 'separate items', 'A name is needed',
    'working email address', 'Several orders are already waiting',
    'no longer in the shop', 'not available to buy online', 'Quantity for',
    'left in stock', 'basket could not be read'
  ];
  if (ours.some(fragment => message.includes(fragment))) return message;

  return 'Something went wrong starting checkout. Please try again.';
}

export async function startCheckout(
  slug: string,
  items: Incoming[],
  contact: { name: string; email: string; phone?: string; note?: string },
  origin: string,
  base: string
): Promise<CheckoutResult> {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'Your basket is empty.' };
  }
  if (items.length > CART_MAX_LINES) {
    return { ok: false, error: 'That is more separate items than we can take in one order.' };
  }

  if (!stripeConfigured()) {
    return {
      ok: false,
      error: 'Online payment is not switched on yet. Please get in touch and we will sort it out directly.'
    };
  }

  const supabase = anonClient();

  // The practice, for the money guard and the connected account. Read before
  // the order is created so a refusal costs nothing.
  const { data: clinicRow } = await supabase
    .from('clinic')
    .select('name, stripe_account_id')
    .eq('slug', slug)
    .maybeSingle();

  if (!clinicRow) return { ok: false, error: 'No such practice.' };

  // pilot_mode is deliberately not readable by anon (migration 0014), so the
  // per-clinic guard here can only check what the deployment knows. The
  // database enforces the rest: app.shop_order_mark_paid refuses to settle an
  // order for a clinic in pilot, whatever this process believes.
  const verdict = canTakeMoney({ slug });
  if (!verdict.ok) {
    console.warn('[shop] refusing checkout:', verdict.reason);
    return {
      ok: false,
      error: 'Online payment is not switched on yet. Please get in touch and we will sort it out directly.'
    };
  }

  // ------------------------------------------------------ 1. price it, ours --
  const { data: created, error: createError } = await supabase.rpc('shop_order_create', {
    p_clinic_slug: slug,
    p_items: items.map(i => ({
      product_id: String(i.productId),
      qty: Math.max(1, Math.min(CART_MAX_QTY, Math.floor(Number(i.qty) || 1)))
    })),
    p_name: contact.name,
    p_email: contact.email,
    p_phone: contact.phone ?? null,
    p_note: contact.note ?? null
  });

  if (createError || !created) {
    return { ok: false, error: customerFacing(createError?.message) };
  }

  const order = created as {
    order_id: string; order_no: string; practice_name: string;
    total_cents: number; tax_cents: number; subtotal_cents: number;
    lines: { name: string; brand: string | null; unit_price_cents: number; qty: number }[];
  };

  // ------------------------------------------------------------- 2. Stripe --
  let session;
  try {
    session = await createShopCheckoutSession({
      clinicSlug: slug,
      practiceName: order.practice_name,
      orderId: order.order_id,
      orderNo: order.order_no,
      lines: order.lines.map(l => ({
        name: l.name,
        brand: l.brand,
        unitPriceCents: l.unit_price_cents,
        qty: l.qty
      })),
      taxCents: order.tax_cents,
      email: contact.email,
      successUrl: `${origin}${base}/shop/thanks?order=${encodeURIComponent(order.order_no)}`,
      cancelUrl: `${origin}${base}/cart?cancelled=1`,
      // Connect is opt-in. With the practice's OWN secret key configured — the
      // single-practice case and the one running today — passing its account id
      // here would be wrong: you cannot act on behalf of yourself.
      stripeAccount:
        process.env.STRIPE_CONNECT === 'true' ? clinicRow.stripe_account_id : null
    });
  } catch (err) {
    console.error('[shop] Stripe session failed', err instanceof Error ? err.message : err);
    return {
      ok: false,
      error: 'We could not reach the payment provider. Your basket is safe — please try again in a moment.'
    };
  }

  if (!session.url) {
    return { ok: false, error: 'The payment provider did not return a checkout page. Please try again.' };
  }

  // ------------------------------------------------------- 3. tie them up --
  const { error: attachError } = await supabase.rpc('shop_order_attach_session', {
    p_order: order.order_id,
    p_session: session.id
  });

  if (attachError) {
    // The session exists and could be paid, but we would not recognise the
    // payment when it arrived. Better to stop here than to take money we
    // cannot match to an order.
    console.error('[shop] could not attach session to order', attachError.message);
    return { ok: false, error: 'Something went wrong starting checkout. Please try again.' };
  }

  return { ok: true, url: session.url };
}
