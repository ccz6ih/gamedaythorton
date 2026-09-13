/**
 * lib/db/shop.ts
 * The two public facts about a practice's shop.
 *
 * Separate from lib/db/storefront.ts only because these are about the money
 * path rather than the catalogue, and it is worth being able to see the whole
 * public shop surface — a tax rate and a yes/no — in one short file.
 */

import { createServerClient } from '@supabase/ssr';
import { stripeConfigured } from '@/lib/stripe';

function anonClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

/**
 * The practice's retail sales tax, in basis points. 0 means not configured.
 *
 * Public because a shop has to show a total before checkout, and a tax rate is
 * printed on every receipt anyway. See migration 0015 for why it is not a
 * guessed default.
 */
export async function shopTaxBps(clinicId: string): Promise<number> {
  const supabase = anonClient();
  const { data } = await supabase
    .from('clinic')
    .select('sales_tax_bps')
    .eq('id', clinicId)
    .maybeSingle();

  return Number((data as { sales_tax_bps?: number } | null)?.sales_tax_bps ?? 0);
}

/** Whether the practice tracks physical stock, or its supplier ships direct. */
export async function shopTracksStock(clinicId: string): Promise<boolean> {
  const supabase = anonClient();
  const { data } = await supabase
    .from('clinic')
    .select('track_stock')
    .eq('id', clinicId)
    .maybeSingle();

  return (data as { track_stock?: boolean } | null)?.track_stock === true;
}

/**
 * Can this shop take a card right now?
 *
 * Two conditions, both necessary, and the tax one is the surprising half: a
 * practice with Stripe perfectly configured still cannot sell online until it
 * has told us what tax to collect, because selling without it means the
 * practice owes the shortfall out of its own margin. The database refuses too
 * (app.shop_order_create), so this is the polite version of the same refusal —
 * it lets the page explain instead of showing an error after a click.
 */
export function checkoutAvailable(taxBps: number): boolean {
  return stripeConfigured() && taxBps > 0;
}
