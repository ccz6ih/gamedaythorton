/**
 * lib/shop.ts
 * The basket, and the one rule that governs it.
 *
 * THE RULE: a basket is a list of ids and counts. It is never a list of prices.
 *
 * The basket lives in the visitor's own browser, which means the visitor can
 * edit it. Any money in it is therefore a suggestion, and the moment the server
 * treats a suggestion as a fact you have a shop that sells at whatever price
 * the customer typed into devtools.
 *
 * So the shape below has `qty` and `productId` and nothing else that matters.
 * Names and prices ARE cached alongside, purely so the basket page can render
 * without a round trip — but they are marked as display-only and the server
 * re-reads every one of them from `product` inside app.shop_order_create. If
 * the cached copy is stale or forged, the totals simply come back different
 * and the basket page shows the real ones.
 */

export type CartLine = {
  productId: string;
  qty: number;
  /** DISPLAY ONLY. Re-read server-side; never trusted for money. */
  name: string;
  /** DISPLAY ONLY. */
  brand: string | null;
  /** DISPLAY ONLY. */
  priceCents: number;
  /** DISPLAY ONLY. */
  imagePath: string | null;
};

export const CART_MAX_LINES = 20;
export const CART_MAX_QTY = 10;

/** Per-practice, so two storefronts in one browser do not share a basket. */
export function cartKey(slug: string): string {
  return `medbar.cart.${slug}`;
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.priceCents * l.qty, 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

/** Basis points to cents, rounded half-up — the same arithmetic as the database. */
export function taxOn(subtotalCents: number, bps: number): number {
  return Math.round((subtotalCents * bps) / 10000);
}

/**
 * Read a basket back from storage.
 *
 * Every field is re-validated because this string came from a place the user
 * controls and may also have been written by an older version of this code. A
 * basket that fails to parse becomes an empty basket, never an exception — a
 * shop that throws on load is a shop nobody can use, and the cost of being
 * wrong is that somebody re-adds a moisturiser.
 */
export function parseCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const lines: CartLine[] = [];
    for (const item of parsed.slice(0, CART_MAX_LINES)) {
      if (typeof item !== 'object' || item === null) continue;
      const l = item as Record<string, unknown>;
      if (typeof l.productId !== 'string' || !l.productId) continue;

      const qty = Number(l.qty);
      if (!Number.isFinite(qty) || qty < 1) continue;

      lines.push({
        productId: l.productId,
        qty: Math.min(Math.floor(qty), CART_MAX_QTY),
        name: typeof l.name === 'string' ? l.name : 'Item',
        brand: typeof l.brand === 'string' ? l.brand : null,
        priceCents: Number.isFinite(Number(l.priceCents)) ? Number(l.priceCents) : 0,
        imagePath: typeof l.imagePath === 'string' ? l.imagePath : null
      });
    }
    return lines;
  } catch {
    return [];
  }
}

/**
 * What actually crosses the wire to the server action: ids and counts, and
 * nothing else. The display fields are dropped here rather than ignored later,
 * so there is no version of the request that even contains a price.
 */
export function toOrderItems(lines: CartLine[]): { productId: string; qty: number }[] {
  return lines.map(l => ({ productId: l.productId, qty: l.qty }));
}
