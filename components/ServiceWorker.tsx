'use client';

/**
 * components/ServiceWorker.tsx
 * Registers the worker, and only in the places it belongs.
 *
 * WHY A COMPONENT AND NOT A SCRIPT TAG
 * Registration has to happen after hydration and only in a browser that
 * supports it, and it must not throw into the page when it fails — a practice
 * losing the console because a worker registration rejected would be a
 * self-inflicted outage for a feature nobody asked for.
 *
 * WHY NOT ON EVERY PAGE
 * A worker registered from the storefront takes the root scope and stays
 * installed on the machine of every visitor who ever loaded the shop, updating
 * in the background forever. It is mounted deliberately, in the two layouts
 * that want it, rather than globally.
 *
 * NOTHING IS TRACKED HERE. No analytics, no beacon, no reporting — CLAUDE.md
 * rule 3 applies to authenticated routes and this mounts on one.
 */

import { useEffect } from 'react';

export default function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Registration is not urgent and competes with the first paint for
    // bandwidth on the connection that matters most — a phone in a treatment
    // room. It waits for the page to settle.
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // An install prompt that does not appear is a missing nicety. It is
          // never worth surfacing an error to somebody mid-appointment.
        });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
