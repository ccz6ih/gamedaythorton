'use client';

/**
 * components/ClearCart.tsx
 *
 * Empties the basket once, on arrival at the thank-you page.
 *
 * Why here and not at checkout time: if the basket were cleared when the
 * customer left for Stripe, then cancelling — or simply pressing back to check
 * a price — would lose everything they had chosen. Clearing on successful
 * return is the only point at which the basket is definitely finished with.
 *
 * Renders nothing. It is a side effect with a place in the tree.
 */

import { useEffect } from 'react';
import { cartKey } from '@/lib/shop';
import { CART_EVENT } from './AddToCart';

export function ClearCart({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      window.localStorage.removeItem(cartKey(slug));
    } catch { /* storage unavailable; there was no persisted basket to clear */ }
    window.dispatchEvent(new CustomEvent(CART_EVENT));
  }, [slug]);

  return null;
}
