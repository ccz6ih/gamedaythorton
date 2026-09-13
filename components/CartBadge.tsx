'use client';

/**
 * components/CartBadge.tsx
 * The basket count in the nav.
 *
 * Renders NOTHING until it has both hydrated and found something in the basket.
 * Two reasons, and the second is the one that matters:
 *
 *   - The server has no idea what is in this visitor's basket, so any count
 *     rendered server-side would be wrong and would flash.
 *   - An empty basket link is clutter on every page of a site most visitors
 *     are reading rather than shopping. It appears when it means something.
 *
 * It listens for the storage event as well as its own, so adding something in
 * one tab updates the nav in another.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cartKey, parseCart, cartCount } from '@/lib/shop';
import { CART_EVENT } from './AddToCart';

export function CartBadge({ slug, href }: { slug: string; href: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const read = () => {
      try {
        setCount(cartCount(parseCart(window.localStorage.getItem(cartKey(slug)))));
      } catch {
        setCount(0);
      }
    };

    read();
    window.addEventListener(CART_EVENT, read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(CART_EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, [slug]);

  if (count === 0) return null;

  return (
    <Link href={href} className="sf-cart-badge" aria-label={`Basket, ${count} item${count === 1 ? '' : 's'}`}>
      <span aria-hidden="true">Basket</span>
      <span className="n">{count}</span>
    </Link>
  );
}
