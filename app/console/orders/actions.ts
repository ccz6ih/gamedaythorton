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
