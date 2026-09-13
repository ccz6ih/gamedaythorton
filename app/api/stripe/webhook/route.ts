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
