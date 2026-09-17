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
import { paymentDescriptor, checkoutLineLabel, stripeMetadata, type AllowedStripeMetadata } from '@/lib/phi';

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

/* ============================================================================
   THE RETAIL SHOP
   ============================================================================
   Everything above this line is the clinical money path: memberships, visits,
   deposits, all keyed to a patient. Everything below is a stranger buying a
   bottle of cleanser on a website.

   They are kept apart because the constraints genuinely differ. Nothing above
   may carry a service name to Stripe, because a line item reading "TRT
   consultation" next to a person's card is a disclosure. A line item reading
   "Renew Eye Complex" is a shop receipt, and hiding it would produce a bank
   statement the customer cannot recognise — which is how disputes start.
   ========================================================================= */

/**
 * May this practice take real money right now?
 *
 * REPLACES A GLOBAL SWITCH WITH A PER-PRACTICE ONE, and that is the point.
 *
 * The original rule was one env var: PILOT_MODE on meant nobody could use a
 * live key. That was right when there was one tenant. With two it became
 * unsatisfiable — Gameday must stay guarded because it holds clinical records,
 * and The Med Bar must be able to sell a moisturiser, in the same deployment,
 * on the same afternoon.
 *
 * So the question is now asked per clinic, against `clinic.pilot_mode` — the
 * same column the DATABASE independently enforces, where every PHI table
 * rejects non-synthetic rows while it is true. One flag, two enforcers, no way
 * for the app's belief and the database's to drift apart.
 *
 * PILOT_MODE the env var survives as an absolute override: while it is on, no
 * clinic may use a live key regardless of its own column. It is the switch that
 * turns the whole deployment back into a rehearsal, and it is still the one
 * deliberate act required before any real money moves.
 */
/**
 * Which Stripe mode this deployment is actually in.
 *
 * The payments screen hard-coded a "Stripe test mode" badge — a literal span
 * with no condition on it — so it announced test mode while the practice was
 * taking real money. On the one screen whose entire job is money, a badge that
 * is always wrong is worse than no badge: it teaches the reader to ignore the
 * thing that would matter on the day it is right.
 *
 * Never returns the key or any part of it.
 */
export type StripeMode = 'live' | 'test' | 'unconfigured';

export function stripeMode(): StripeMode {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return 'unconfigured';
  return key.startsWith('sk_test_') ? 'test' : 'live';
}

export type MoneyClinic = { slug: string; pilot_mode?: boolean | null };

export type MoneyVerdict =
  | { ok: true; live: boolean }
  | { ok: false; reason: string };

export function canTakeMoney(clinic: MoneyClinic): MoneyVerdict {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return { ok: false, reason: 'Payments are not configured on this deployment.' };
  }

  const live = !key.startsWith('sk_test_');

  if (live && isPilotMode()) {
    return {
      ok: false,
      reason:
        'This deployment has PILOT_MODE on and a live Stripe key. Refusing to ' +
        'charge. Either use sk_test_… or set PILOT_MODE=false deliberately.'
    };
  }

  if (live && clinic.pilot_mode) {
    return {
      ok: false,
      reason:
        `${clinic.slug} is still in pilot mode, so its records are synthetic and ` +
        'it must not take real payments. Clear clinic.pilot_mode first.'
    };
  }

  return { ok: true, live };
}

export type ShopLine = {
  name: string;
  brand: string | null;
  unitPriceCents: number;
  qty: number;
  /**
   * The stable Stripe Product this item reports against, when the catalogue
   * has been synced. Absent is fine and is the state before a first sync —
   * checkout falls back to an ad-hoc line, which charges identically and only
   * costs the grouping in Stripe's reporting.
   */
  stripeProductId?: string | null;
};

export type ShopCheckoutInput = {
  clinicSlug: string;
  practiceName: string;
  orderId: string;
  orderNo: string;
  lines: ShopLine[];
  taxCents: number;
  email: string;
  successUrl: string;
  cancelUrl: string;
  /**
   * The practice's connected account, when the platform is acting on its
   * behalf. Absent means the configured secret key IS the practice's own — the
   * single-practice case, and the simplest correct one.
   */
  stripeAccount?: string | null;
};

/**
 * A Stripe-hosted Checkout Session.
 *
 * HOSTED, NOT EMBEDDED, and the reason is the content security policy. An
 * embedded Payment Element needs script-src https://js.stripe.com plus a frame
 * ancestor, and admitting a script origin to a page is a far larger concession
 * than it looks — a script can read the whole DOM. A hosted session needs
 * nothing: the visitor is navigated away, pays on Stripe's own origin, and
 * comes back. The storefront's CSP stays exactly as strict as it is today, and
 * no card data has ever been in a page we serve.
 *
 * Tax is passed as its own zero-quantity line rather than a Stripe tax rate
 * object, because the rate lives in `clinic.sales_tax_bps` where the practice
 * can change it, and duplicating it into Stripe creates two numbers that must
 * agree forever.
 */
export async function createShopCheckoutSession(input: ShopCheckoutInput) {
  /**
   * The amount is ALWAYS inline, read from our own database a moment ago.
   * Only the product identity comes from Stripe, and only so its reporting can
   * group repeat sales of the same item instead of seeing a new product every
   * time. `product_data` mints a throwaway Product per line; `product` points
   * at the one stable object the sync created.
   *
   * The fallback is not a degraded path — it is exactly what shipped before,
   * and it charges the same number. An unsynced catalogue costs the grouping,
   * nothing else.
   */
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.lines.map(l => ({
    quantity: l.qty,
    price_data: {
      currency: 'usd',
      unit_amount: l.unitPriceCents,
      ...(l.stripeProductId
        ? { product: l.stripeProductId }
        : {
            product_data: {
              name: checkoutLineLabel(l.brand ? `${l.brand} — ${l.name}` : l.name)
            }
          })
    }
  }));

  if (input.taxCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: input.taxCents,
        product_data: { name: 'Sales tax' }
      }
    });
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: lineItems,
    customer_email: input.email,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    shipping_address_collection: { allowed_countries: ['US'] },
    // Ours, not Stripe's. The webhook looks the order up by session id and by
    // this, and trusts neither as a price — only as a pointer into our own
    // database, which is where the price lives.
    metadata: {
      order_id: input.orderId,
      order_no: input.orderNo,
      clinic_slug: input.clinicSlug,
      kind: 'shop_order'
    },
    payment_intent_data: {
      // The practice's name on the statement. A customer who cannot recognise
      // a charge disputes it, and a dispute costs more than the order.
      statement_descriptor_suffix: input.practiceName
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .slice(0, 22)
        .trim() || undefined,
      metadata: { order_id: input.orderId, kind: 'shop_order' }
    },
    // Abandoned baskets should not sit as pending orders indefinitely.
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24
  };

  // A retry of the same order must never produce a second session that could
  // be paid separately.
  const options: Stripe.RequestOptions = { idempotencyKey: `shop_${input.orderId}` };
  if (input.stripeAccount) options.stripeAccount = input.stripeAccount;

  return stripe().checkout.sessions.create(params, options);
}

export type CustomChargeLine = {
  /** Already net of this line's own discount. */
  name: string;
  qty: number;
  lineTotalCents: number;
};

export type CustomChargeInput = {
  clinicSlug: string;
  practiceName: string;
  orderId: string;
  orderNo: string;
  lines: CustomChargeLine[];
  /** Order-level discount, shown to the customer as a discount. */
  discountCents: number;
  taxCents: number;
  email: string;
  successUrl: string;
  cancelUrl: string;
};

/**
 * A payment page for a charge the practitioner priced herself.
 *
 * TWO THINGS HERE EXIST TO KEEP STRIPE'S TOTAL EXACTLY EQUAL TO OURS, because
 * app.shop_order_mark_paid refuses to settle a charge whose amount does not
 * match what we recorded. That guard is worth keeping, so the arithmetic has to
 * be right rather than close.
 *
 * 1. EVERY LINE IS QUANTITY ONE, priced at its own line total. The obvious
 *    alternative — a per-unit price times a quantity — cannot represent a
 *    discounted line without rounding: $10.00 x 3 less $1.00 is $29.00, and
 *    there is no whole number of cents that multiplied by three gives it. The
 *    quantity moves into the description, where it still reads correctly.
 *
 * 2. THE ORDER DISCOUNT IS A REAL STRIPE COUPON, not a negative line, because
 *    Stripe has no negative line items. It also means the customer sees the
 *    word "Discount" and the amount, which is what they are owed by anyone
 *    giving them one.
 */
export async function createCustomChargeSession(input: CustomChargeInput) {
  const client = stripe();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.lines.map(l => ({
    quantity: 1,
    price_data: {
      currency: 'usd',
      unit_amount: l.lineTotalCents,
      // Through the PHI filter: this name is free text the practitioner typed,
      // it is printed on a Stripe receipt, and Stripe keeps it. A clinical term
      // here is the disclosure paymentDescriptor prevents on the statement.
      product_data: {
        name: checkoutLineLabel(l.qty > 1 ? `${l.name} (${l.qty})` : l.name)
      }
    }
  }));

  if (input.taxCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: { currency: 'usd', unit_amount: input.taxCents, product_data: { name: 'Sales tax' } }
    });
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: lineItems,
    customer_email: input.email,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: {
      order_id: input.orderId,
      order_no: input.orderNo,
      clinic_slug: input.clinicSlug,
      // The webhook keys on this, so a custom charge settles down the same path
      // as a shop order. One settlement path, not two.
      kind: 'shop_order'
    },
    payment_intent_data: {
      statement_descriptor_suffix:
        input.practiceName.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 22).trim() || undefined,
      metadata: { order_id: input.orderId, kind: 'shop_order' }
    },
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
  };

  if (input.discountCents > 0) {
    // Idempotent on the order, so a retry reuses the coupon rather than
    // littering the account with one per attempt.
    const coupon = await client.coupons.create(
      { amount_off: input.discountCents, currency: 'usd', duration: 'once', name: 'Discount' },
      { idempotencyKey: `coupon_${input.orderId}` }
    );
    params.discounts = [{ coupon: coupon.id }];
  }

  return client.checkout.sessions.create(params, { idempotencyKey: `charge_${input.orderId}` });
}
