'use client';

/**
 * components/TrackOnce.tsx
 * Reports a conversion that happened on the SERVER, exactly once.
 *
 * ===========================================================================
 * WHY THIS IS NEEDED AT ALL
 * ===========================================================================
 * The booking flow is a client component, so it can report its own success
 * from the callback that received it — once per booking, by construction.
 *
 * The enquiry form is not. It is a server action that redirects to `?sent=1`,
 * and a server action cannot reach gtag. The only evidence in the browser that
 * anything happened is that query parameter, so something client-side has to
 * notice it.
 *
 * ===========================================================================
 * WHY "ONCE" TAKES ANY WORK
 * ===========================================================================
 * A query parameter is not an event, it is a STATE — and the page carrying it
 * can be rendered repeatedly without anything new having happened. Refresh it
 * and the flag is still there. Navigate away and come back and it is still
 * there. Bookmark it, and it is there forever. Firing on render would count
 * every one of those as another enquiry, which inflates the only number on
 * this dashboard that is supposed to mean something.
 *
 * sessionStorage keyed on the event name holds the line for the session, which
 * is the window in which a refresh is plausible. Deliberately sessionStorage
 * and not localStorage: somebody who genuinely enquires twice in a fortnight
 * has converted twice and should be counted twice.
 *
 * Renders nothing.
 */

import { useEffect } from 'react';
import { track, type PublicEvent } from '@/lib/track';

export function TrackOnce({ event }: { event: PublicEvent }) {
  useEffect(() => {
    const key = `tracked:${event}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /**
       * Private mode, blocked storage, or an embedded webview. Fall through
       * and report anyway: a conversion counted twice is a smaller problem
       * than a conversion never counted, and this is the rarer path.
       */
    }
    track(event);
  }, [event]);

  return null;
}
