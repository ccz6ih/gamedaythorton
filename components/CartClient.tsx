'use client';

/**
 * components/CartClient.tsx — the basket page.
 *
 * THE TOTALS HERE ARE AN ESTIMATE AND THE PAGE SAYS SO.
 *
 * Everything shown is computed from the browser's own copy of the basket, which
 * may be minutes or weeks old — a price could have changed, a product could
 * have been withdrawn. The authoritative total is computed by the database at
 * checkout, and if the two disagree the customer sees the real one on Stripe's
 * page before entering a card.
 *
 * That is the honest arrangement, and it is worth stating in the interface
 * rather than quietly hoping the numbers match.
 */

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  cartKey, parseCart, cartSubtotal, taxOn, toOrderItems,
  CART_MAX_QTY, type CartLine
} from '@/lib/shop';
import { CART_EVENT } from './AddToCart';
import { startCheckout } from '@/app/c/[slug]/cart/actions';

type Props = {
  slug: string;
  taxBps: number;
  shopHref: string;
  enquireHref: string;
  /** '' on the practice's own domain, '/c/<slug>' otherwise. */
  base: string;
  /** Stripe is configured and the practice may charge. */
  checkoutReady: boolean;
  practiceName: string;
  cancelled: boolean;
};

function money(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function CartClient(props: Props) {
  const { slug, taxBps, shopHref, enquireHref, base, checkoutReady, cancelled } = props;

  const [lines, setLines] = useState<CartLine[] | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // null until read, so the empty state cannot flash before the basket loads.
  useEffect(() => {
    const read = () => {
      try {
        setLines(parseCart(window.localStorage.getItem(cartKey(slug))));
      } catch {
        setLines([]);
      }
    };
    read();
    window.addEventListener(CART_EVENT, read);
    return () => window.removeEventListener(CART_EVENT, read);
  }, [slug]);

  function write(next: CartLine[]) {
    setLines(next);
    try {
      window.localStorage.setItem(cartKey(slug), JSON.stringify(next));
    } catch { /* storage unavailable; the page still works for this visit */ }
    window.dispatchEvent(new CustomEvent(CART_EVENT));
  }

  function setQty(productId: string, qty: number) {
    if (!lines) return;
    if (qty < 1) return write(lines.filter(l => l.productId !== productId));
    write(lines.map(l => (l.productId === productId ? { ...l, qty: Math.min(CART_MAX_QTY, qty) } : l)));
  }

  if (lines === null) {
    return <p className="sf-note">Loading your basket&hellip;</p>;
  }

  if (lines.length === 0) {
    return (
      <div className="sf-empty">
        <p className="sf-lede sm">Your basket is empty.</p>
        <div className="sf-actions">
          <Link href={shopHref} className="sf-btn primary">Browse the shop</Link>
        </div>
      </div>
    );
  }

  const subtotal = cartSubtotal(lines);
  const tax = taxOn(subtotal, taxBps);
  const total = subtotal + tax;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await startCheckout(
        slug,
        toOrderItems(lines!),
        { name, email, phone: phone || undefined, note: note || undefined },
        window.location.origin,
        base
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // A full navigation rather than a router push: Stripe's checkout is a
      // different origin and is not a route in this application.
      window.location.href = result.url;
    });
  }

  return (
    <div className="sf-cart">
      {cancelled && (
        <p className="sf-note" role="status">
          Payment was cancelled and nothing was charged. Your basket is exactly
          as you left it.
        </p>
      )}

      <div className="sf-cart-grid">
        <div>
          {lines.map(l => (
            <article className="sf-cart-row" key={l.productId}>
              <div className="sf-cart-img">
                {l.imagePath
                  ? <img src={l.imagePath} alt="" loading="lazy" />
                  : <span aria-hidden="true">{l.name.slice(0, 1)}</span>}
              </div>

              <div className="sf-cart-body">
                {l.brand && <div className="sf-card-brand">{l.brand}</div>}
                <h3>{l.name}</h3>
                <div className="sf-cart-qty">
                  <button type="button" onClick={() => setQty(l.productId, l.qty - 1)}
                          aria-label={`One fewer ${l.name}`}>&minus;</button>
                  <span aria-live="polite">{l.qty}</span>
                  <button type="button" onClick={() => setQty(l.productId, l.qty + 1)}
                          disabled={l.qty >= CART_MAX_QTY}
                          aria-label={`One more ${l.name}`}>+</button>
                  <button type="button" className="sf-cart-remove"
                          onClick={() => setQty(l.productId, 0)}>Remove</button>
                </div>
              </div>

              <div className="sf-cart-price">{money(l.priceCents * l.qty)}</div>
            </article>
          ))}
        </div>

        <aside className="sf-cart-side">
          <dl className="sf-cart-totals">
            <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
            {taxBps > 0 && (
              <div><dt>Sales tax</dt><dd>{money(tax)}</dd></div>
            )}
            <div className="grand"><dt>Total</dt><dd>{money(total)}</dd></div>
          </dl>

          <p className="sf-cart-fine">
            Shipping is arranged after the order &mdash; we will confirm by email,
            or you can collect at the studio. The final total is confirmed on the
            payment page.
          </p>

          {!checkoutReady ? (
            <div className="sf-note">
              <b>Card payment is not switched on yet.</b>{' '}
              <Link href={enquireHref}>Send us this basket</Link> and we will take
              payment directly.
            </div>
          ) : (
            <form onSubmit={submit} className="sf-form sf-cart-form">
              <label>
                <span>Your name</span>
                <input name="name" value={name} required autoComplete="name"
                       onChange={e => setName(e.target.value)} />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" value={email} required autoComplete="email"
                       onChange={e => setEmail(e.target.value)} />
                <small>Your receipt and shipping confirmation go here.</small>
              </label>
              <label>
                <span>Phone <em>(optional)</em></span>
                <input name="phone" type="tel" value={phone} autoComplete="tel"
                       onChange={e => setPhone(e.target.value)} />
              </label>
              <label>
                <span>Anything we should know? <em>(optional)</em></span>
                <textarea name="note" rows={2} value={note}
                          onChange={e => setNote(e.target.value)} />
              </label>

              {error && <p className="sf-error" role="alert">{error}</p>}

              <button type="submit" className="sf-btn primary" disabled={pending}>
                {pending ? 'Taking you to payment…' : `Pay ${money(total)}`}
              </button>

              <p className="sf-cart-fine">
                Card details are entered on Stripe&rsquo;s own secure page. They
                never touch this website.
              </p>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
