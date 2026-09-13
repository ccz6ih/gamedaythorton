'use client';

/**
 * components/StorefrontNav.tsx
 * The storefront's navigation, which collapses to a menu on a phone.
 *
 * WHY THIS BECAME A CLIENT COMPONENT
 *
 * The nav was a flex row that wrapped. On a phone that meant the logo, five
 * links, a basket and a Book button stacked into three rows of small text
 * before any of the page appeared — so the first thing a visitor saw was a
 * table of contents, and the headline started below the fold.
 *
 * NO-JAVASCRIPT BEHAVIOUR IS THE OPEN MENU, NOT THE CLOSED ONE.
 *
 * The panel is hidden by a class this component adds on mount. If the script
 * never runs, the links are simply visible — the old wrapping row, which was
 * usable if ugly. Hiding them in CSS and revealing them with JavaScript would
 * mean a failed script leaves a site with no navigation at all, which is a far
 * worse failure than an ugly one.
 *
 * The toggle closes on navigation and on Escape, because a menu that stays open
 * over the page you just asked for is the most common way this is got wrong.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export type NavItem = { href: string; label: string };

export function StorefrontNav({
  items, homeHref, bookHref, logoUrl, name, children
}: {
  items: NavItem[];
  homeHref: string;
  bookHref: string;
  logoUrl?: string | null;
  name: string;
  /** The basket badge, rendered by the server layout. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => setReady(true), []);

  // Close on navigation. Without this the panel stays over the new page.
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <nav className={`sf-nav${ready ? ' is-enhanced' : ''}${open ? ' is-open' : ''}`} aria-label="Storefront">
      <div className="sf-nav-inner">
        <Link href={homeHref} className="sf-mark">
          {logoUrl ? <img src={logoUrl} alt={name} /> : <span>{name}</span>}
        </Link>

        <button
          type="button"
          className="sf-burger"
          aria-expanded={open}
          aria-controls="sf-menu"
          aria-label={open ? 'Close menu' : 'Menu'}
          onClick={() => setOpen(v => !v)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <div className="sf-nav-links" id="sf-menu">
          {items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="sf-link"
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
          {children}
          <Link href={bookHref} className="sf-btn primary sm">Book</Link>
        </div>
      </div>
    </nav>
  );
}
