'use client';

/**
 * components/FaqConversation.tsx
 * The FAQ as a conversation: each question arrives as a chat bubble that
 * types, then opens into its answer as you scroll.
 *
 * ===========================================================================
 * WHY THIS AND NOT THE ACCORDION
 * ===========================================================================
 * A <details> list is the right shape for reference — somebody who knows what
 * they want to look up, scanning for one line. It is the wrong shape for the
 * PRF page, where the honest summary of the visitor is "nervous, curious, has
 * never had a needle near their face and is not sure what to ask".
 *
 * A conversation answers that person, because it shows them somebody else
 * asking the awkward question first.
 *
 * ===========================================================================
 * NO GSAP, NO LENIS, AND THE REASONS ARE NOT DOGMA
 * ===========================================================================
 * The reference this is built from uses GSAP ScrollTrigger plus Lenis smooth
 * scrolling. Both were considered and both were declined:
 *
 *   - GSAP + ScrollTrigger is roughly 50KB on a page whose job is to load fast
 *     and rank. The sequence here is four transitions with delays, which is
 *     what CSS transitions are for. GSAP earns its place when a timeline needs
 *     scrubbing, reversing and interruption; this one plays once.
 *
 *   - Lenis replaces native scrolling for the WHOLE document. It fights the
 *     installed PWA, it costs momentum scrolling on iOS, it breaks
 *     scroll-to-anchor, and it takes the scrollbar away from people who use it
 *     to judge how long a page is. On a marketing site that is a trade; on a
 *     clinic's booking funnel it is a tax on everybody to make one section
 *     feel nicer.
 *
 * ===========================================================================
 * IT WORKS WITH NO JAVASCRIPT AT ALL
 * ===========================================================================
 * The markup renders as a plain, fully readable question-and-answer list. The
 * animation is added afterwards by setting a flag on the container, so:
 *
 *   - the text is in the DOM for crawlers and answer engines, which is the
 *     entire point of the FAQPage schema this page also emits
 *   - a failed bundle leaves a readable page rather than a column of dots
 *   - prefers-reduced-motion gets the readable version deliberately, not as a
 *     degraded fallback
 */

import { useEffect, useRef } from 'react';

export type FaqItem = { q: string; a: string };

export function FaqConversation({ items }: { items: FaqItem[] }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    // Somebody who asked not to be moved gets the plain version. Checked
    // before anything is measured so nothing is set up and then undone.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const bubbles = Array.from(el.querySelectorAll<HTMLElement>('.faqx-msg'));

    /**
     * Measure BEFORE collapsing, and reserve the space.
     *
     * The bubble animates from a 64px circle to its natural size, which CSS
     * cannot interpolate to `auto` — so the target is measured once and
     * written as a custom property. The row keeps that height from the start,
     * otherwise every bubble that opens shoves the rest of the page down and
     * the scroll position the observer just fired on is no longer where the
     * reader is looking.
     */
    for (const msg of bubbles) {
      const row = msg.parentElement;
      const rect = msg.getBoundingClientRect();
      msg.style.setProperty('--faqx-w', `${Math.round(rect.width)}px`);
      msg.style.setProperty('--faqx-h', `${Math.round(rect.height)}px`);
      if (row) row.style.minHeight = `${Math.round(rect.height)}px`;
    }

    el.dataset.anim = 'on';

    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const msg = entry.target as HTMLElement;

          msg.classList.add('is-in');
          // The pause is the whole trick: the bubble lands, the dots run, and
          // only then does it open. Without it there is nothing to read as
          // "somebody is typing".
          window.setTimeout(() => msg.classList.add('is-open'), 620);

          io.unobserve(msg);
        }
      },
      // Fires a little before the bubble reaches the middle of the screen, so
      // it has finished opening by the time it is being read.
      { rootMargin: '0px 0px -25% 0px', threshold: 0.1 }
    );

    for (const msg of bubbles) io.observe(msg);

    /* Re-measure on resize: the target width was taken at one viewport and a
       rotated phone makes it wrong, leaving bubbles clipped or over-wide. */
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        for (const msg of bubbles) {
          if (!msg.classList.contains('is-open')) continue;
          msg.style.removeProperty('--faqx-w');
          msg.style.removeProperty('--faqx-h');
          const row = msg.parentElement;
          if (row) row.style.minHeight = '';
          const rect = msg.getBoundingClientRect();
          msg.style.setProperty('--faqx-w', `${Math.round(rect.width)}px`);
          msg.style.setProperty('--faqx-h', `${Math.round(rect.height)}px`);
          if (row) row.style.minHeight = `${Math.round(rect.height)}px`;
        }
      }, 150);
    };
    window.addEventListener('resize', onResize);

    return () => {
      io.disconnect();
      window.removeEventListener('resize', onResize);
      window.clearTimeout(resizeTimer);
    };
  }, [items.length]);

  return (
    <div className="faqx" ref={root}>
      {items.map((item, i) => (
        <div className="faqx-pair" key={i}>
          <div className="faqx-row faqx-row-q">
            <div className="faqx-msg faqx-q">
              <span className="faqx-dots" aria-hidden="true">
                <i /><i /><i />
              </span>
              <div className="faqx-body">
                <p>{item.q}</p>
              </div>
            </div>
          </div>

          <div className="faqx-row faqx-row-a">
            <div className="faqx-msg faqx-a">
              <span className="faqx-dots" aria-hidden="true">
                <i /><i /><i />
              </span>
              <div className="faqx-body">
                {/* Split on blank lines so a long answer breathes as separate
                    messages would, without needing the copy rewritten. */}
                {item.a.split(/\n\s*\n/).map((para, j) => (
                  <p key={j}>{para}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
