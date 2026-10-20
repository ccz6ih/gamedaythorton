/**
 * lib/order-notify.ts
 * Read a shop order back and email both sides about it.
 *
 * ===========================================================================
 * WHY THIS IS SHARED RATHER THAN LIVING IN THE WEBHOOK
 * ===========================================================================
 * Two callers need exactly this and must not drift:
 *
 *   the Stripe webhook, once, when an order first settles
 *   the console, when a customer says "I never got it"
 *
 * A second copy in the console would be a second set of column names, a
 * second idea of what the email says, and a second place to forget the
 * shipping address.
 *
 * ===========================================================================
 * IT TAKES A CLIENT RATHER THAN MAKING ONE
 * ===========================================================================
 * Deliberate. The webhook has the service role — it is one of two files
 * allowed to, and scripts/shop-test.cjs fails the build if that list grows.
 * The console has the staff session. Importing either here would either break
 * that rule or make this unusable from one of the two places it exists for.
 * So the caller brings its own authority and this module brings the content.
 */

import { sendOrderNotice, sendOrderConfirmation, sendOrderShipped, type NotifyResult } from '@/lib/notify';

/**
 * The shape both Supabase clients satisfy. Structural rather than imported,
 * for the reason above.
 */
type QueryResult = { data: unknown; error: { message: string } | null };

export type OrderDb = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        // PromiseLike, not Promise: Supabase's builder is a thenable that only
        // becomes a promise when awaited, and its error type is generated
        // rather than this shape. Callers pass their own client through a
        // cast — see the webhook and the console action — which is the price
        // of this module not importing either one of them.
        maybeSingle: () => PromiseLike<QueryResult>;
      };
    };
  };
};

type OrderRow = {
  id: string; clinic_id: string; order_no: string;
  contact_name: string; contact_email: string; contact_phone: string | null;
  note: string | null;
  subtotal_cents: number; tax_cents: number; total_cents: number;
  fulfilment: string | null; synthetic: boolean;
  ship_name: string | null; ship_line1: string | null; ship_line2: string | null;
  ship_city: string | null; ship_state: string | null; ship_postal: string | null;
  /**
   * Embedded, so the lines arrive with the order rather than in a second
   * round trip that can succeed while the first fails.
   *
   * name_snapshot, NOT name. There is no `name` column on shop_order_item —
   * the first version of this asked for one, and because PostgREST fails the
   * whole select on an unknown column, the result was not an error anybody
   * saw but an email listing nothing at all. A receipt with no items on it.
   */
  shop_order_item: {
    name_snapshot: string;
    brand_snapshot: string | null;
    qty: number;
    unit_price_cents: number;
  }[] | null;
};

const SELECT =
  'id, clinic_id, order_no, contact_name, contact_email, contact_phone, note, ' +
  'subtotal_cents, tax_cents, total_cents, fulfilment, synthetic, ' +
  'ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_postal, ' +
  'shop_order_item(name_snapshot, brand_snapshot, qty, unit_price_cents)';

export type OrderEmailResult = {
  ok: boolean;
  reason?: string;
  notice?: NotifyResult;
  confirmation?: NotifyResult;
};

/**
 * Send both emails for one order.
 *
 * `by` is which column to find it on: the webhook has a Stripe session id and
 * the console has our own order id.
 */
export async function sendOrderEmails(
  db: OrderDb,
  by: { column: 'id' | 'stripe_checkout_session_id'; value: string }
): Promise<OrderEmailResult> {
  const { data: raw, error } = await db
    .from('shop_order')
    .select(SELECT)
    .eq(by.column, by.value)
    .maybeSingle();

  if (error) return { ok: false, reason: `could not read the order: ${error.message}` };

  const order = raw as OrderRow | null;
  if (!order) return { ok: false, reason: 'order not found' };

  /**
   * The practice's inbox.
   *
   * lead_email is not granted to anon — reading it from a public path is what
   * once made the booking notice vanish in silence, because a column denial
   * takes out the whole select. Both callers here have more than anon, and
   * falling back to the general address means a practice that never set a
   * lead address still hears about a sale.
   */
  const { data: clinicRaw } = await db
    .from('clinic')
    .select('name, lead_email, email')
    .eq('id', order.clinic_id)
    .maybeSingle();

  const clinic = clinicRaw as { name?: string; lead_email?: string | null; email?: string | null } | null;
  const inbox = clinic?.lead_email ?? clinic?.email ?? null;

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
    lines: (order.shop_order_item ?? []).map(i => ({
      name: i.brand_snapshot ? `${i.brand_snapshot} ${i.name_snapshot}` : i.name_snapshot,
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
   * Neither may stop the other. A bounced practice address must not cost the
   * customer their confirmation, and a customer who mistyped their address
   * must not stop the practice learning it has something to post.
   */
  const [notice, confirmation] = await Promise.allSettled([
    sendOrderNotice(payload),
    sendOrderConfirmation(payload)
  ]);

  return {
    ok: true,
    notice: notice.status === 'fulfilled' ? notice.value : undefined,
    confirmation: confirmation.status === 'fulfilled' ? confirmation.value : undefined,
    reason: [
      notice.status === 'rejected' ? 'notice failed' : null,
      confirmation.status === 'rejected' ? 'confirmation failed' : null
    ].filter(Boolean).join(', ') || undefined
  };
}

/**
 * Tell the customer their parcel has gone.
 *
 * Reads the order back the same way sendOrderEmails does and for the same
 * reason: the caller brings its authority, this brings the content, and
 * neither the webhook nor the console keeps its own idea of which columns
 * hold a shipping address.
 *
 * Returns whether it actually went, so the screen can say something true
 * rather than claiming a send it did not make.
 */
export async function sendShippedEmail(db: OrderDb, orderId: string): Promise<boolean> {
  const { data: raw, error } = await db
    .from('shop_order')
    .select(
      'clinic_id, order_no, contact_name, contact_email, synthetic, ' +
      'carrier, tracking_code, ship_name, ship_line1, ship_line2, ' +
      'ship_city, ship_state, ship_postal'
    )
    .eq('id', orderId)
    .maybeSingle();

  if (error || !raw) return false;

  const o = raw as {
    clinic_id: string; order_no: string; contact_name: string;
    contact_email: string; synthetic: boolean;
    carrier: string | null; tracking_code: string | null;
    ship_name: string | null; ship_line1: string | null; ship_line2: string | null;
    ship_city: string | null; ship_state: string | null; ship_postal: string | null;
  };

  const { data: clinicRaw } = await db
    .from('clinic').select('name').eq('id', o.clinic_id).maybeSingle();
  const clinic = clinicRaw as { name?: string } | null;

  const shipTo = [
    o.ship_name, o.ship_line1, o.ship_line2,
    [o.ship_city, o.ship_state, o.ship_postal].filter(Boolean).join(' ')
  ].filter(v => v && String(v).trim()).join('\n') || null;

  const sent = await sendOrderShipped({
    clinicId: o.clinic_id,
    clinicName: clinic?.name ?? 'the practice',
    orderNo: o.order_no,
    customerName: o.contact_name,
    customerEmail: String(o.contact_email),
    carrier: o.carrier,
    trackingCode: o.tracking_code,
    shipTo,
    synthetic: o.synthetic === true
  });

  return sent.delivered;
}
