/**
 * app/api/stripe/webhook/route.ts
 *
 * Stripe's view of a payment is authoritative; ours is a mirror. This is where
 * the two are reconciled.
 *
 * Deliberate properties:
 *   - The signature is verified before the body is parsed. An unverified webhook
 *     is an unauthenticated stranger telling you a payment succeeded.
 *   - Nothing from Stripe is trusted as a patient reference except an id we put
 *     there ourselves, looked back up in our own database.
 *   - Errors are logged through lib/phi's scrubber. An unscrubbed error report
 *     is the most-forgotten PHI egress point in any product like this.
 */

import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { verifyWebhook, isPilotMode } from '@/lib/stripe';
import { serviceClient, serviceRoleConfigured } from '@/lib/supabase/service';
import { scrubForLog } from '@/lib/phi';
import { sendOrderNotice, sendOrderConfirmation } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';        // needs the raw body; not edge-safe

export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    // Say so plainly rather than pretending to have handled it.
    return NextResponse.json(
      { error: 'Webhooks are not configured on this deployment.' },
      { status: 503 }
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  const raw = await request.text();

  let event;
  try {
    event = verifyWebhook(raw, signature);
  } catch (err) {
    console.warn('[stripe] signature verification failed', scrubForLog({
      message: err instanceof Error ? err.message : String(err)
    }));
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  // A live event arriving at a pilot deployment means keys are crossed
  // somewhere. Worth shouting about rather than silently ignoring, whether or
  // not we go on to apply it.
  if (event.livemode && isPilotMode()) {
    console.error('[stripe] A LIVE event reached a deployment with PILOT_MODE on. ' +
      'Check which keys are configured here before going any further.');
  }

  // The CLINICAL money path stays deferred while this deployment is a pilot: a
  // test event must not mark a membership active on a build with no compliance
  // controls. The RETAIL path below is not covered by that, because it is
  // guarded per practice instead — see lib/stripe.ts canTakeMoney(), and
  // app.shop_order_mark_paid(), which refuses for a clinic still in pilot.
  const clinicalDeferred = isPilotMode();

  try {
    switch (event.type) {
      /* ------------------------------------------------------------ shop -- */
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return await settleShopOrder(event, event.data.object as Stripe.Checkout.Session);

      case 'checkout.session.expired':
        return await failShopOrder(event.data.object as Stripe.Checkout.Session, 'expired');

      case 'checkout.session.async_payment_failed':
        return await failShopOrder(event.data.object as Stripe.Checkout.Session, 'failed');

      /* -------------------------------------------------------- clinical -- */
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
      case 'charge.refunded':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed':
        // Phase B: reconcile against the payment / membership rows using the
        // opaque refs in metadata. Intentionally not implemented — a
        // half-written money path is worse than an absent one.
        console.info('[stripe] clinical event not handled in this phase', scrubForLog({
          type: event.type, deferred: clinicalDeferred
        }));
        break;

      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[stripe] handler failed', scrubForLog({
      type: event.type,
      message: err instanceof Error ? err.message : String(err)
    }));
    // 500 so Stripe retries rather than dropping the event.
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 });
  }
}

/* ===========================================================================
   RETAIL ORDERS
   ===========================================================================
   The only place a shop order becomes paid. Not the return URL — a customer
   who closes the tab on Stripe's confirmation screen has still paid, and a
   return URL can be typed by hand. This handler carries a signature; that page
   carries nothing.

   Everything here is idempotent, because Stripe delivers at-least-once and
   retries anything that does not return 2xx. The idempotency lives in the
   database function rather than here: mark_paid only acts while the order is
   still `pending`, so a redelivery reports `already_paid` and moves no stock.
   =========================================================================== */

/** Stripe's shipping shape has moved between API versions; read it defensively. */
function shippingFrom(session: Stripe.Checkout.Session): Record<string, string> | null {
  const loose = session as unknown as {
    shipping_details?: { name?: string | null; address?: Record<string, string | null> | null } | null;
    collected_information?: { shipping_details?: { name?: string | null; address?: Record<string, string | null> | null } | null } | null;
  };

  const details = loose.collected_information?.shipping_details ?? loose.shipping_details;
  const address = details?.address;
  if (!details && !address) return null;

  return {
    name: details?.name ?? '',
    line1: address?.line1 ?? '',
    line2: address?.line2 ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
    postal: address?.postal_code ?? '',
    country: address?.country ?? ''
  };
}

async function settleShopOrder(event: Stripe.Event, session: Stripe.Checkout.Session) {
  // Sessions we did not create for a shop order are none of our business.
  if (session.metadata?.kind !== 'shop_order') {
    return NextResponse.json({ received: true, applied: false, reason: 'not_a_shop_order' });
  }

  // Only settle what was actually paid for. `complete` with an unpaid status is
  // a real state for delayed payment methods, and they arrive later as
  // async_payment_succeeded.
  if (session.payment_status !== 'paid') {
    console.info('[shop] session complete but not paid yet', scrubForLog({
      session: session.id, payment_status: session.payment_status
    }));
    return NextResponse.json({ received: true, applied: false, reason: 'not_paid_yet' });
  }

  if (!serviceRoleConfigured()) {
    // 500 so Stripe retries. Acknowledging here would lose a real payment
    // permanently because of a missing environment variable.
    console.error('[shop] paid order cannot be recorded: SUPABASE_SERVICE_ROLE_KEY is not set');
    return NextResponse.json({ error: 'Not configured to record payments.' }, { status: 500 });
  }

  const intent = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  const { data, error } = await serviceClient().rpc('shop_order_mark_paid', {
    p_session: session.id,
    p_intent: intent,
    // What Stripe says was charged. The function compares it against the total
    // we recorded and refuses to settle a mismatch.
    p_amount: session.amount_total ?? null,
    // Present only on a Connect direct charge; null when the configured key is
    // the practice's own.
    p_account: event.account ?? null,
    p_ship: shippingFrom(session)
  });

  if (error) {
    console.error('[shop] mark_paid failed', scrubForLog({ session: session.id, message: error.message }));
    return NextResponse.json({ error: 'Could not record the order.' }, { status: 500 });
  }

  const result = (data ?? {}) as { applied?: boolean; reason?: string; order_no?: string };

  if (!result.applied) {
    // Not an error — an already-settled order, or a clinic the database refuses
    // to take real money for. Both are correct outcomes worth seeing in a log.
    console.info('[shop] not applied', scrubForLog({
      session: session.id, reason: result.reason, order_no: result.order_no
    }));
  } else {
    console.info('[shop] order paid', scrubForLog({ order_no: result.order_no }));
    /**
     * Tell the practice. Nothing did.
     *
     * Only on `applied`, which is the point: Stripe retries this endpoint, and
     * mark_paid is idempotent — a redelivery of the same event returns
     * applied:false, so she gets one email per order rather than one per
     * attempt. An already-settled order is not news.
     *
     * Read back rather than returned by the RPC, because the function answers
     * {applied, reason, order_no} and an email needs the basket and the
     * address. This file is the only sanctioned service-role consumer, which
     * is exactly why the read belongs here and not in a page.
     *
     * Never allowed to fail the webhook. Returning non-200 to Stripe because
     * an email bounced would make it retry a payment that is already recorded.
     */
    try {
      await notifyPracticeOfOrder(session.id);
    } catch (err) {
      console.error('[shop] order notice failed', err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ received: true, applied: result.applied === true, reason: result.reason });
}

async function failShopOrder(session: Stripe.Checkout.Session, status: 'failed' | 'expired') {
  if (session.metadata?.kind !== 'shop_order') {
    return NextResponse.json({ received: true, applied: false, reason: 'not_a_shop_order' });
  }
  if (!serviceRoleConfigured()) {
    // Nothing was charged, so there is nothing to lose by acknowledging. The
    // order simply stays pending until it expires from the report.
    return NextResponse.json({ received: true, applied: false, reason: 'not_configured' });
  }

  const { error } = await serviceClient().rpc('shop_order_mark_failed', {
    p_session: session.id,
    p_status: status,
    p_reason: status === 'expired' ? 'checkout session expired unpaid' : 'payment failed at Stripe'
  });

  if (error) {
    console.warn('[shop] mark_failed failed', scrubForLog({ session: session.id, message: error.message }));
  }
  return NextResponse.json({ received: true, applied: !error });
}

/**
 * Read a settled order back and email the practice about it.
 *
 * Separated from the handler so the happy path there stays readable, and so
 * every failure in here is contained — see the call site for why this must
 * never be able to fail the webhook.
 */
async function notifyPracticeOfOrder(sessionId: string): Promise<void> {
  const db = serviceClient();

  const { data: raw, error } = await db
    .from('shop_order')
    .select(
      'id, clinic_id, order_no, contact_name, contact_email, contact_phone, note, ' +
      'subtotal_cents, tax_cents, total_cents, fulfilment, synthetic, ' +
      'ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_postal'
    )
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle();

  // Stated rather than inferred: the generated types do not cover a select
  // this wide, and the inferred union collapses to an error shape.
  const order = raw as unknown as {
    id: string; clinic_id: string; order_no: string;
    contact_name: string; contact_email: string; contact_phone: string | null;
    note: string | null;
    subtotal_cents: number; tax_cents: number; total_cents: number;
    fulfilment: string | null; synthetic: boolean;
    ship_name: string | null; ship_line1: string | null; ship_line2: string | null;
    ship_city: string | null; ship_state: string | null; ship_postal: string | null;
  } | null;

  if (error || !order) {
    console.error('[shop] could not read the order to notify', error?.message ?? 'not found');
    return;
  }

  const [{ data: items }, { data: clinic }] = await Promise.all([
    db.from('shop_order_item')
      .select('name, qty, unit_price_cents')
      .eq('order_id', order.id),
    db.from('clinic')
      .select('name, lead_email, email')
      .eq('id', order.clinic_id)
      .maybeSingle()
  ]);

  /**
   * The practice's inbox, read with the SERVICE role on purpose.
   *
   * `lead_email` is not granted to anon — reading it from a public path is
   * what once made the booking notice vanish in silence, because a
   * column-level denial takes out the whole select. Here the service role can
   * see it, and falling back to the practice's general address means a missing
   * lead_email still reaches somebody.
   */
  const inbox = (clinic?.lead_email as string | null) ?? (clinic?.email as string | null) ?? null;

  const shipTo = [
    order.ship_name,
    order.ship_line1,
    order.ship_line2,
    [order.ship_city, order.ship_state, order.ship_postal].filter(Boolean).join(' ')
  ].filter(v => v && String(v).trim()).join('\n') || null;

  const payload = {
    clinicId: order.clinic_id,
    clinicName: clinic?.name ?? 'the practice',
    practiceInbox: inbox,
    orderNo: order.order_no,
    customerName: order.contact_name,
    customerEmail: String(order.contact_email),
    customerPhone: order.contact_phone,
    note: order.note,
    lines: (items ?? []).map(i => ({
      name: i.name,
      qty: i.qty,
      unitPriceCents: i.unit_price_cents
    })),
    subtotalCents: order.subtotal_cents,
    taxCents: order.tax_cents,
    totalCents: order.total_cents,
    fulfilment: order.fulfilment ?? 'ship',
    shipTo,
    synthetic: order.synthetic === true
  };

  /**
   * Both halves, and neither may stop the other.
   *
   * The practice needs to know to post something; the customer needs to know
   * it is coming. Before this, the first real order through the shop produced
   * neither — and /shop/thanks had already promised the customer a receipt.
   *
   * Promise.allSettled rather than await-in-sequence, because a bounced
   * practice address must not cost the customer their confirmation, and vice
   * versa. Each logs its own outcome to automation_run.
   */
  const [notice, confirmation] = await Promise.allSettled([
    sendOrderNotice(payload),
    sendOrderConfirmation(payload)
  ]);

  for (const [who, r] of [['notice', notice], ['confirmation', confirmation]] as const) {
    if (r.status === 'rejected') {
      console.error(`[shop] order ${who} threw`, r.reason instanceof Error ? r.reason.message : r.reason);
    }
  }
}
