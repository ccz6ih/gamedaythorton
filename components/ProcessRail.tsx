'use client';

/**
 * components/ProcessRail.tsx
 * The four PRF steps, lighting up as they scroll into view.
 *
 * One IntersectionObserver, no library. The design this came from used GSAP
 * ScrollTrigger, which means two CDN scripts and a hole in the content security
 * policy for an effect that is nine lines of platform API.
 *
 * The important part is the fallback: every step renders LIT by default and the
 * observer dims the ones below the fold once it runs. So with no JavaScript, a
 * crawler, or a failed hydration, the page reads as finished prose rather than
 * as four greyed-out paragraphs — which is what happens when you build it the
 * other way round and animate from opacity zero.
 */

import { useEffect, useRef } from 'react';

type Step = { n: string; h: string; p: string };

export function ProcessRail({ steps }: { steps: Step[] }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const items = Array.from(el.querySelectorAll<HTMLElement>('.sf-step'));

    // Dim first, and only now — before this point they were lit, which is the
    // state anyone without JavaScript keeps.
    items.forEach(i => i.classList.remove('on'));

    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('on');
          io.unobserve(e.target);          // light once; do not flicker on scroll back
        }
      }),
      { rootMargin: '0px 0px -24% 0px', threshold: 0.15 }
    );

    items.forEach(i => io.observe(i));
    return () => io.disconnect();
  }, []);

  return (
    <div className="sf-steps" ref={root}>
      <div className="sf-rail" aria-hidden="true" />
      {steps.map(s => (
        <div className="sf-step on" key={s.n}>
          <span className="sf-dot" aria-hidden="true" />
          <h3><span className="num">{s.n}</span> {s.h}</h3>
          <p>{s.p}</p>
        </div>
      ))}
    </div>
  );
}
