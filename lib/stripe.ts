/**
 * lib/stripe.ts
 * Payments. Test mode only until Phase C.
 *
 * THE TWO RULES THIS FILE EXISTS TO ENFORCE
 *
 * 1. No live keys while PILOT_MODE is on. Not "we won't use them" — the client
 *    refuses to initialise with one, so a live key pasted into Vercel by mistake
 *    fails loudly at the first request instead of quietly taking real money on a
 *    build with no compliance controls.
 *
 * 2. Nothing reaches Stripe that has not been through lib/phi. Stripe is not a
 *    HIPAA-covered vendor for PHI, so it gets amounts, opaque ids, and a neutral
 *    descriptor. Never a service name, never a therapy name, never a reason code.
 */

import Stripe from 'stripe';
import { paymentDescriptor, stripeMetadata, type AllowedStripeMetadata } from '@/lib/phi';

export function isPilotMode(): boolean {
  return process.env.PILOT_MODE !== 'false';
}

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let cached: Stripe | null = null;

export function stripe(): Stripe {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Payments are disabled. ' +
      'Add a TEST key (sk_test_…) — see docs/19-environment.md.'
    );
  }

  // The guard that matters.
  if (isPilotMode() && !key.startsWith('sk_test_')) {
    throw new Error(
      'Refusing to initialise Stripe with a non-test key while PILOT_MODE is on. ' +
      'This build has no HIPAA controls and must not touch real money or real ' +
      'customers. Use sk_test_… , or complete Phase C sign-off and set ' +
      'PILOT_MODE=false deliberately. See docs/09-compliance-register.md.'
    );
  }

  cached = new Stripe(key, {
    // Pinned rather than floating. The SDK's types pin this too, so bumping the
    // stripe package fails the build until someone reads the changelog — which is
    // the correct amount of friction on the money path.
    apiVersion: '2025-02-24.acacia',
    appInfo: { name: 'gamedaythorton-pilot', version: '0.1.0' },
    // Retries are safe here because every write below is idempotent by key.
    maxNetworkRetries: 2
  });
  return cached;
}

/* --------------------------------------------------------------- amounts ---- */

export type LineItem = {
  /** Internal service id. Used for our records — never sent to Stripe. */
  serviceId: string;
  /** Shown to staff in our UI only. */
  label: string;
  amountCents: number;
  quantity: number;
};

export function cartTotalCents(items: LineItem[]): number {
  return items.reduce((sum, i) => sum + i.amountCents * i.quantity, 0);
}

/* ---------------------------------------------------------------- intents ---- */

export type PaymentIntentInput = {
  clinicId: string;
  practiceName: string;
  amountCents: number;
  /** Opaque ids only. */
  patientRef?: string;
  appointmentRef?: string;
  packagePurchaseRef?: string;
  type: NonNullable<AllowedStripeMetadata['payment_type']>;
  /** Stable key so a double-click cannot charge twice. */
  idempotencyKey: string;
};

/**
 * Creates a PaymentIntent carrying nothing but money, opaque ids and a neutral
 * descriptor.
 *
 * Note what is absent: no line-item names, no service names, no receipt_email
 * (an email address is identifying and Stripe would then hold it alongside an
 * amount and a merchant category), and no description.
 */
export async function createPaymentIntent(input: PaymentIntentInput) {
  if (input.amountCents <= 0) throw new Error('Amount must be positive.');

  return stripe().paymentIntents.create(
    {
      amount: input.amountCents,
      currency: 'usd',
      statement_descriptor_suffix: paymentDescriptor(input.practiceName).slice(0, 22),
      automatic_payment_methods: { enabled: true },
      metadata: stripeMetadata({
        clinic_id: input.clinicId,
        patient_ref: input.patientRef,
        appointment_ref: input.appointmentRef,
        package_purchase_ref: input.packagePurchaseRef,
        payment_type: input.type,
        pilot: isPilotMode() ? 'true' : 'false'
      })
    },
    { idempotencyKey: input.idempotencyKey }
  );
}

/**
 * A Stripe customer for a patient, created with an opaque reference instead of a
 * name or email.
 *
 * This costs us a little convenience in the Stripe dashboard, on purpose: a
 * Stripe customer list that reads as a patient list of a men's-health clinic is
 * a disclosure sitting in a third party's system.
 */
export async function createCustomerRef(clinicId: string, patientId: string) {
  return stripe().customers.create(
    {
      metadata: stripeMetadata({
        clinic_id: clinicId,
        patient_ref: patientId,
        pilot: isPilotMode() ? 'true' : 'false'
      })
    },
    { idempotencyKey: `cust_${patientId}` }
  );
}

export function verifyWebhook(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set; refusing to trust this webhook.');
  return stripe().webhooks.constructEvent(rawBody, signature, secret);
}
