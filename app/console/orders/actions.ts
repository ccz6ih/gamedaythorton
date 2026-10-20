'use server';

/**
 * Marking a shop order sent.
 *
 * Runs as the signed-in staff member, through the session-scoped client, so the
 * database checks their role rather than this file trusting that the page was
 * only rendered for staff. app.shop_order_collect verifies is_staff() for the
 * order's own clinic and refuses anything that is not already paid — so a
 * forged order id from another practice fails at the database, not here.
 */

import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { sendOrderEmails, type OrderDb } from '@/lib/order-notify';

export type CollectResult = { ok: true } | { ok: false; error: string };

export async function markCollected(orderId: string): Promise<CollectResult> {
  const supabase = await serverClient();

  const { error } = await supabase.rpc('shop_order_collect', { p_order: orderId });

  if (error) {
    // These messages are written for staff and are safe to show: they say what
    // the state actually is, which is what an unexpected refusal needs to say.
    return { ok: false, error: error.message || 'Could not update that order.' };
  }

  revalidatePath('/console/orders');
  return { ok: true };
}

export type ResendResult = { ok: true; detail: string } | { ok: false; error: string };

/**
 * Send the order emails again.
 *
 * TWO REASONS THIS EXISTS, and the mundane one is the important one.
 *
 * A customer rings saying they never got a confirmation — which happens with
 * every shop, because of typos, spam folders and people looking in the wrong
 * inbox. Without this the only answer is "I can see it, I promise", and
 * somebody ends up forwarding a screenshot.
 *
 * It is also the only way to send for an order that settled BEFORE the emails
 * existed. The webhook is deliberately idempotent — a Stripe redelivery of an
 * already-settled order returns applied:false and sends nothing — so asking
 * Stripe to replay the event cannot produce one.
 *
 * Runs as the signed-in staff member through the session client, so RLS
 * decides which orders are visible. An order id from another practice reads
 * as "not found" rather than being refused informatively.
 */
export async function resendOrderEmails(orderId: string): Promise<ResendResult> {
  const supabase = await serverClient();

  const result = await sendOrderEmails(supabase as unknown as OrderDb, {
    column: 'id',
    value: orderId
  });

  if (!result.ok) return { ok: false, error: result.reason ?? 'Could not read that order.' };

  // Say which of the two actually went, rather than a blanket "sent". A
  // confirmation that reached the customer while the practice notice bounced
  // is a different situation from both working, and the person clicking this
  // is usually mid-phone-call with somebody who wants to know.
  const bits: string[] = [];
  bits.push(result.confirmation?.delivered ? 'customer: sent' : `customer: not sent${result.confirmation?.reason ? ` (${result.confirmation.reason})` : ''}`);
  bits.push(result.notice?.delivered ? 'practice: sent' : `practice: not sent${result.notice?.reason ? ` (${result.notice.reason})` : ''}`);

  revalidatePath('/console/orders');
  return { ok: true, detail: bits.join(' · ') };
}
