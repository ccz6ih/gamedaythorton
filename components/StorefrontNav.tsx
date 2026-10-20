'use client';

/**
 * components/StorefrontNav.tsx
 * The storefront's navigation: a bar that stays legible, and a sheet that
 * opens over the page with more in it than the bar can hold.
 *
 * ===========================================================================
 * THE DESKTOP LINKS ARE NOT HIDDEN, AND THAT IS THE DESIGN
 * ===========================================================================
 * The fashionable version of this puts every link behind a Menu button at all
 * widths. It photographs well and it is a usability regression: a visitor who
 * can see "Services" clicks it, and a visitor who has to discover it behind a
 * button first has to guess it is there. That cost is not evenly distributed —
 * it falls hardest on people who did not grow up with the convention, which
 * for this practice is a large part of who is booking.
 *
 * So the bar keeps its links at desktop width. The sheet is an ADDITION that
 * holds what the bar cannot: where the rooms are, how to get in touch, and a
 * booking call to action that is not a 13px button in a corner.
 *
 * On a phone the bar has no room for seven links, so the sheet is the whole
 * navigation — which is the one place a full-screen menu is genuinely the
 * best answer rather than the most stylish one.
 *
 * ===========================================================================
 * NO-JAVASCRIPT BEHAVIOUR IS THE OPEN MENU, NOT THE CLOSED ONE
 * ===========================================================================
 * Unchanged from the version before this and still the most important line in
 * the file. The links are hidden by a class this component adds ON MOUNT. If
 * the script never runs, they are simply visible — the old wrapping row,
 * usable if ugly. Hiding them in CSS and revealing them with JavaScript means
 * a failed script leaves a site with no navigation at all.
 *
 * It is also why the sheet's contents are rendered into the document whether
 * or not it is open. A crawler reads real anchors; nothing here is built on
 * the client.
 *
 * ===========================================================================
 * WHAT MAKES IT USABLE RATHER THAN JUST ANIMATED
 * ===========================================================================
 *   Focus moves into the sheet on open and RETURNS TO THE BUTTON on close.
 *   Tab is trapped inside it, so the page behind cannot be tabbed into blind.
 *   Escape closes. The close control says "Close", not just a cross.
 *   The page behind cannot scroll while it is open.
 *   Every target is a full-width row, not a line of text.
 *   prefers-reduced-motion removes the movement and keeps the function.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export type NavItem = { href: string; label: string };
export type NavRoom = { slug: string; city: string; state: string };

export function StorefrontNav({
  items, homeHref, bookHref, logoUrl, name, rooms = [], email, locationsHref, children
}: {
  items: NavItem[];
  homeHref: string;
  bookHref: string;
  logoUrl?: string | null;
  name: string;
  /** Published rooms, so the sheet can say where the practice is. */
  rooms?: NavRoom[];
  email?: string | null;
  locationsHref?: string | null;
  /** The basket badge, rendered by the server layout. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setReady(true), []);

  // Close on navigation. Without this the sheet stays over the new page.
  useEffect(() => { setOpen(false); }, [pathname]);

  const close = useCallback(() => {
    setOpen(false);
    // Back to where they were, or the next Tab starts from the top of the
    // document and the sheet appears to have swallowed their place.
    triggerRef.current?.focus();
  }, []);

  /**
   * Everything that only applies while it is open: the key handling, the
   * focus trap, and the scroll lock. One effect so they cannot get out of
   * step with each other, and so the cleanup always restores the page.
   */
  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;

      const root = sheetRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    // Hold the page still. Restoring the exact previous value rather than
    // clearing it, because something else may have set it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  const current = (href: string) => (pathname === href ? 'page' : undefined);

  return (
    <>
      <nav className={`sf-nav${ready ? ' is-enhanced' : ''}`} aria-label="Storefront">
        <div className="sf-nav-inner">
          <Link href={homeHref} className="sf-mark">
            {logoUrl ? <img src={logoUrl} alt={name} /> : <span>{name}</span>}
          </Link>

          {/* The bar's own links. Visible at desktop width, hidden on a phone
              by CSS that only applies once this component has mounted. */}
          <div className="sf-nav-links" id="sf-menu">
            {items.map(item => (
              <Link key={item.href} href={item.href} className="sf-link" aria-current={current(item.href)}>
                {item.label}
              </Link>
            ))}
            {children}
            <Link href={bookHref} className="sf-btn primary sm">Book</Link>
          </div>

          {/*
            One control at every width, and it says what it does.
            The three bars alone are a convention rather than a word, and the
            word costs nothing. aria-expanded is what a screen reader
            announces; the visible text is what everyone else reads.
          */}
          <button
            ref={triggerRef}
            type="button"
            className="sf-nav-trigger"
            aria-expanded={open}
            aria-controls="sf-sheet"
            onClick={() => (open ? close() : setOpen(true))}
          >
            <span className="sf-nav-trigger-bars" aria-hidden="true">
              <span /><span /><span />
            </span>
            <span className="sf-nav-trigger-word">{open ? 'Close' : 'Menu'}</span>
          </button>
        </div>
      </nav>

      {/*
        Rendered into the document whether open or not, so its links are real
        anchors a crawler reads and a no-script visitor can still use. `hidden`
        is driven by the enhanced state for the same reason the bar's links
        are: without the script it must fail open, not shut.
      */}
      <div
        ref={sheetRef}
        id="sf-sheet"
        className={`sf-sheet${ready ? ' is-enhanced' : ''}${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal={open || undefined}
        aria-label={`${name} menu`}
      >
        <div className="sf-sheet-inner">
          <div className="sf-sheet-head">
            <span className="sf-sheet-label">{name}</span>
            <button ref={closeRef} type="button" className="sf-sheet-close" onClick={close}>
              Close
            </button>
          </div>

          <ul className="sf-sheet-nav">
            {items.map((item, i) => (
              <li key={item.href} style={{ ['--i' as string]: String(i) }}>
                <Link href={item.href} className="sf-sheet-link" aria-current={current(item.href)}>
                  <span>{item.label}</span>
                  <span className="sf-sheet-arrow" aria-hidden="true">&rarr;</span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="sf-sheet-aside">
            {rooms.length > 0 && (
              <div>
                <span className="sf-sheet-label">Where we are</span>
                <ul className="sf-sheet-rooms">
                  {rooms.map(r => (
                    <li key={r.slug}>
                      <Link
                        className="sf-sheet-room"
                        href={locationsHref ? `${locationsHref}/${r.slug}` : homeHref}
                      >
                        {r.city}, {r.state}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {email && (
              <div>
                <span className="sf-sheet-label">Get in touch</span>
                <a className="sf-sheet-room" href={`mailto:${email}`}>{email}</a>
              </div>
            )}
          </div>

          <Link href={bookHref} className="sf-btn primary sf-sheet-cta">
            Book an appointment
          </Link>
        </div>
      </div>
    </>
  );
}
