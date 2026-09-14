'use client';

/**
 * components/ConsoleShell.tsx
 * The console frame, and the reason the console worked on a phone at all.
 *
 * ---------------------------------------------------------------------------
 * WHAT WAS BROKEN
 * ---------------------------------------------------------------------------
 * app.css has had a mobile layout since the beginning: under 880px the shell
 * collapses to one column, the rail becomes `position: fixed` and slides off
 * the left edge with `translateX(-100%)`, and a `.rail-toggle` is revealed with
 * `display: inline-flex !important` to bring it back.
 *
 * No `.rail-toggle` was ever built. Nothing anywhere set `data-open`.
 *
 * So on any screen narrower than 880px the entire navigation — every screen in
 * the console, and the sign-out button — sat permanently off the left edge with
 * no way to reach it. Whatever page you landed on was the only page you could
 * ever see. That is not a degraded experience; it is a locked door, and it is
 * why the console could not be used on a phone at all.
 *
 * It is the kind of fault that survives because of who tests it. The console is
 * built and reviewed on a laptop, where 880px never happens, and the front desk
 * is where a phone gets used.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SHELL IS A CLIENT COMPONENT AND THE RAIL IS NOT
 * ---------------------------------------------------------------------------
 * The rail's contents depend on the clinic's module map, the viewer's role and
 * a sign-out server action — all server concerns, none of which should move to
 * the browser to get a menu button. So the rail stays server-rendered in
 * layout.tsx and arrives here as a prop. This component owns one boolean.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

type Props = {
  rail: React.ReactNode;
  children: React.ReactNode;
  /** Just enough of the nav to name the current screen in the bar. */
  sections: { href: string; label: string }[];
  clinicName: string;
};

/** Matches the breakpoint in app.css. Changing one without the other is a bug. */
const MOBILE = '(max-width: 880px)';

export function ConsoleShell({ rail, children, sections, clinicName }: Props) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const railRef = useRef<HTMLElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  /**
   * The component has to know the breakpoint too, not just CSS.
   *
   * Two things depend on it that CSS cannot express: whether the off-canvas
   * rail should be inert (see below), and whether opening it should lock the
   * page behind it. Read from matchMedia so there is still one number, quoted
   * from app.css, rather than a second guess at the layout.
   */
  useEffect(() => {
    const mq = window.matchMedia(MOBILE);
    const sync = () => {
      setIsMobile(mq.matches);
      // Growing past the breakpoint with the drawer open would otherwise leave
      // the scrim covering a perfectly normal desktop layout.
      if (!mq.matches) setOpen(false);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /** Navigating closes it. Otherwise every tap leaves the menu over the page. */
  useEffect(() => { setOpen(false); }, [pathname]);

  /* Escape closes, and focus goes back to the button that opened it — losing
     focus to the top of the document is how a keyboard user gets stranded. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  /* The page behind a drawer must not scroll under it. */
  useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, isMobile]);

  /** Focus the first link when it opens, so the menu is usable from a keyboard. */
  useEffect(() => {
    if (open) railRef.current?.querySelector<HTMLElement>('a, button')?.focus();
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  /**
   * A closed off-canvas drawer is still in the document.
   *
   * Without `inert` a keyboard or screen-reader user tabs straight off the
   * visible page and into twenty invisible links positioned past the left edge
   * of the screen, with no indication of where they have gone. Only applied on
   * mobile: on a desktop the same element is the real, visible navigation.
   */
  const railInert = isMobile && !open;

  const current = sections
    .filter(s => pathname === s.href || pathname.startsWith(s.href + '/'))
    // The longest matching href wins, so /console/clients/123 reads "Clients"
    // rather than the "/console" dashboard that also matches.
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <div className="shell" data-app="staff">
      {/* Only rendered as a bar under the breakpoint — see .console-bar. It is
          in the markup at every width so there is no layout shift when a
          desktop window is dragged narrow. */}
      <div className="console-bar">
        <button
          ref={toggleRef}
          type="button"
          className="console-bar-toggle"
          aria-expanded={open}
          aria-controls="console-rail"
          onClick={() => setOpen(v => !v)}
        >
          <span className="bars" aria-hidden="true"><i /><i /><i /></span>
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        </button>

        {/*
          If the script does not run, the button does nothing and the console is
          back to having no navigation — the exact fault being fixed here, just
          with a button drawn over it.

          So there is a plain link as well, shown only when scripting is off. It
          targets the rail by id and `.rail:target` in app-extras.css slides it
          open with no JavaScript at all. Closing it means going somewhere,
          which is what the menu is for.
        */}
        <noscript>
          <a className="console-bar-nojs" href="#console-rail">Menu</a>
        </noscript>
        <div className="console-bar-title">
          <span className="where">{current?.label ?? 'Console'}</span>
          <span className="who">{clinicName}</span>
        </div>
      </div>

      <div
        className="rail-scrim"
        data-open={open ? '1' : '0'}
        onClick={close}
        aria-hidden="true"
      />

      <nav
        id="console-rail"
        className="rail"
        data-open={open ? '1' : '0'}
        aria-label="Console navigation"
        ref={railRef}
        // React 19 supports `inert` as a real boolean prop and omits the
        // attribute when false, which is what the spec requires — `inert="false"`
        // would still be inert.
        inert={railInert}
      >
        {rail}
      </nav>

      <div className="main">{children}</div>
    </div>
  );
}
