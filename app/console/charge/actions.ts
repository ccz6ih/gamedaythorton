'use server';

/**
 * Raising a charge for something that is not on the menu, or is on the menu at
 * a different price.
 *
 * Two ways it can end, and the practitioner picks before she starts:
 *
 *   A PAYMENT LINK she sends or shows. The database prices it, Stripe hosts the
 *   page, the webhook settles it — the same path the shop uses, so there is one
 *   settlement code path rather than two.
 *
 *   PAID IN THE ROOM. Cash, or a card reader the practice already owns. Nothing
 *   goes to Stripe; the charge is recorded as paid with the method noted. This
 *   exists because the alternative is she takes the money somewhere else and
 *   the system's idea of what the business earned quietly stops being true.
 */

import { revalidatePath } from 'next/cache';
import { serverClient, currentViewer } from '@/lib/supabase/server';
import { canTakeMoney, createCustomChargeSession, stripeConfigured } from '@/lib/stripe';

export type ChargeLine = {
  name: string;
  amountCents: number;
  qty: number;
  discountCents?: number;
  productId?: string | null;
  note?: string | null;
};

export type ChargeInput = {
  lines: ChargeLine[];
  name: string;
  email: string;
  phone?: string;
  patientId?: string | null;
  discountCents?: number;
  discountNote?: string;
  taxable: boolean;
  note?: string;
  /** 'link' sends them to Stripe; 'in_person' records money already taken. */
  settle: 'link' | 'in_person';
  method?: string;
  origin: string;
};

export type ChargeResult =
  | { ok: true; orderNo: string; url?: string; paid?: boolean }
  | { ok: false; error: string };

export async function raiseCharge(input: ChargeInput): Promise<ChargeResult> {
  const viewer = await currentViewer();
  if (!viewer || viewer.kind !== 'staff') return { ok: false, error: 'Not signed in as staff.' };

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return { ok: false, error: 'Add at least one line.' };
  }

  const supabase = await serverClient();

  const { data: created, error } = await supabase.rpc('custom_charge_create', {
    p_clinic: viewer.clinicId,
    p_lines: input.lines.map(l => ({
      name: l.name,
      amount_cents: Math.round(Number(l.amountCents) || 0),
      qty: Math.max(1, Math.round(Number(l.qty) || 1)),
      discount_cents: Math.max(0, Math.round(Number(l.discountCents) || 0)),
      product_id: l.productId || null,
      is_custom: !l.productId,
      note: l.note || null
    })),
    p_name: input.name,
    p_email: input.email,
    p_phone: input.phone ?? null,
    p_patient: input.patientId || null,
    p_discount: Math.max(0, Math.round(Number(input.discountCents) || 0)),
    p_discount_note: input.discountNote ?? null,
    p_taxable: input.taxable,
    p_note: input.note ?? null
  });

  if (error || !created) {
    // These messages are written for the practitioner and are safe to show:
    // "the discount is larger than the charge" is what she needs to read.
    return { ok: false, error: error?.message ?? 'Could not raise the charge.' };
  }

  const order = created as {
    order_id: string; order_no: string; practice_name: string;
    subtotal_cents: number; total_cents: number; tax_cents: number;
    lines: { name: string; unit_price_cents: number; qty: number; discount_cents: number }[];
  };

  /* ----------------------------------------------------- money in the room -- */
  if (input.settle === 'in_person') {
    const { error: paidError } = await supabase.rpc('custom_charge_mark_paid', {
      p_order: order.order_id,
      p_method: input.method || 'in_person'
    });
    if (paidError) return { ok: false, error: paidError.message };

    revalidatePath('/console/orders');
    return { ok: true, orderNo: order.order_no, paid: true };
  }

  /* ------------------------------------------------------------ a link -- */
  if (!stripeConfigured()) {
    return {
      ok: false,
      error: 'The charge was saved, but card payment is not configured on this ' +
             'deployment, so no link could be made. Mark it paid in person instead.'
    };
  }

  // The real slug and guard flag, so a refusal names the practice rather than a
  // uuid and the per-clinic pilot check has something to check.
  const { data: clinicRow } = await supabase
    .from('clinic').select('slug, pilot_mode').eq('id', viewer.clinicId).maybeSingle();

  const verdict = canTakeMoney({
    slug: clinicRow?.slug ?? viewer.clinicId,
    pilot_mode: clinicRow?.pilot_mode ?? null
  });
  if (!verdict.ok) {
    return {
      ok: false,
      error: `The charge was saved as ${order.order_no}, but no link could be made: ${verdict.reason}`
    };
  }

  try {
    const session = await createCustomChargeSession({
      clinicSlug: clinicRow?.slug ?? viewer.clinicId,
      practiceName: order.practice_name,
      orderId: order.order_id,
      orderNo: order.order_no,
      // Line totals, already net of each line's own discount. Sent whole rather
      // than as unit price x quantity because a discounted line usually has no
      // exact per-unit price — $10 x 3 less $1 is $29, and no whole number of
      // cents times three gives that. Stripe's total has to equal ours to the
      // cent or settlement refuses it, which is a guard worth keeping.
      lines: order.lines.map(l => ({
        name: l.name,
        qty: l.qty,
        lineTotalCents: l.unit_price_cents * l.qty - l.discount_cents
      })),
      discountCents: Math.max(0, Math.round(Number(input.discountCents) || 0)),
      taxCents: order.tax_cents,
      email: input.email,
      successUrl: `${input.origin}/console/orders?paid=${encodeURIComponent(order.order_no)}`,
      cancelUrl: `${input.origin}/console/charge?cancelled=${encodeURIComponent(order.order_no)}`
    });

    if (!session.url) {
      return { ok: false, error: 'Stripe did not return a payment page. Try again.' };
    }

    const { error: attachError } = await supabase.rpc('shop_order_attach_session', {
      p_order: order.order_id,
      p_session: session.id
    });
    if (attachError) {
      return { ok: false, error: 'Could not link the charge to its payment page. Try again.' };
    }

    revalidatePath('/console/orders');
    return { ok: true, orderNo: order.order_no, url: session.url };
  } catch (err) {
    return {
      ok: false,
      error: `The charge was saved as ${order.order_no}, but the payment link failed: ` +
             (err instanceof Error ? err.message : 'unknown error')
    };
  }
}
