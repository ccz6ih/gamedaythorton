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
import { verifyWebhook, isPilotMode } from '@/lib/stripe';
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

  // In pilot mode, record and acknowledge but change nothing about money. A test
  // event must not be able to mark a membership active on a build with no
  // compliance controls.
  if (isPilotMode()) {
    console.info('[stripe] pilot mode — event acknowledged, not applied', scrubForLog({
      type: event.type,
      id: event.id,
      livemode: event.livemode
    }));

    // A live event arriving at a pilot deployment means keys are crossed
    // somewhere. That is worth shouting about rather than silently ignoring.
    if (event.livemode) {
      console.error('[stripe] A LIVE event reached a PILOT deployment. Check which ' +
        'keys are configured in this environment before going any further.');
    }
    return NextResponse.json({ received: true, applied: false, reason: 'pilot_mode' });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
      case 'charge.refunded':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed':
        // Phase B: reconcile against the payment / membership rows using the
        // opaque refs in metadata. Intentionally not implemented while pilot mode
        // is the only supported configuration — a half-written money path is
        // worse than an absent one.
        console.info('[stripe] unhandled in this phase', scrubForLog({ type: event.type }));
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
