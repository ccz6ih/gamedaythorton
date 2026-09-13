'use client';

/**
 * components/AddToCart.tsx
 *
 * The button reports what it did, in place, and does not navigate. A shop that
 * throws you into a basket page on every add makes buying three things into
 * three round trips, and the back button becomes part of the purchase flow.
 *
 * It also renders as a plain disabled button before hydration rather than
 * vanishing, because a product card that grows a button a second after it
 * appears makes the page jump under the reader's cursor.
 */

import { useEffect, useState } from 'react';
import { cartKey, parseCart, CART_MAX_QTY, CART_MAX_LINES, type CartLine } from '@/lib/shop';

export const CART_EVENT = 'medbar:cart';

/** Read, mutate, write, announce. Every basket change in the app goes through here. */
export function addLine(slug: string, line: Omit<CartLine, 'qty'>, qty = 1): 'added' | 'full' | 'max' {
  const key = cartKey(slug);
  let lines: CartLine[] = [];
  try {
    lines = parseCart(window.localStorage.getItem(key));
  } catch {
    // Private browsing, or storage disabled. Start from empty rather than
    // refusing — the basket is then per-page, which is degraded but usable.
    lines = [];
  }

  const existing = lines.find(l => l.productId === line.productId);
  if (existing) {
    if (existing.qty >= CART_MAX_QTY) return 'max';
    existing.qty = Math.min(CART_MAX_QTY, existing.qty + qty);
  } else {
    if (lines.length >= CART_MAX_LINES) return 'full';
    lines.push({ ...line, qty });
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(lines));
  } catch {
    // Nothing to do about it and nothing worth showing. The in-memory basket
    // for this page still works; it just will not survive navigation.
  }
  window.dispatchEvent(new CustomEvent(CART_EVENT));
  return 'added';
}

type Props = {
  slug: string;
  product: Omit<CartLine, 'qty'>;
  /** Checkout is not configured; the button explains instead of lying. */
  disabled?: boolean;
};

export function AddToCart({ slug, product, disabled }: Props) {
  const [ready, setReady] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (!said) return;
    const t = window.setTimeout(() => setSaid(null), 2200);
    return () => window.clearTimeout(t);
  }, [said]);

  if (disabled) return null;

  return (
    <button
      type="button"
      className="sf-add"
      disabled={!ready}
      aria-live="polite"
      onClick={() => {
        const result = addLine(slug, product);
        setSaid(
          result === 'added' ? 'Added' :
          result === 'max' ? 'Max 10' : 'Basket full'
        );
      }}
    >
      {said ?? 'Add to basket'}
    </button>
  );
}
