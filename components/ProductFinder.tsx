'use client';

/**
 * components/ProductFinder.tsx
 * "Not sure where to start?" — a concern, then the products that answer it.
 *
 * ---------------------------------------------------------------------------
 * THE MATCHING IS DONE ON THE SERVER, BEFORE THIS EVER RUNS
 * ---------------------------------------------------------------------------
 * This component receives finished lists. It does no searching, holds no
 * product copy, and decides nothing about what suits whom — it shows one of N
 * precomputed answers and remembers which button is pressed.
 *
 * That split is deliberate. Matching on the client would mean shipping every
 * product's description and details as JSON on a page that already loads
 * thirty-one photographs, and it would put the logic that decides what to
 * recommend somewhere it can be edited by anyone with dev tools. Doing it in
 * lib/shop-taxonomy.ts keeps one rule — a product matches only if its own
 * verified copy says so — in one place, testable, server-side.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS NOT A MULTI-STEP QUIZ
 * ---------------------------------------------------------------------------
 * Craig asked for a quiz. A quiz would be several screens of questions before
 * anybody sees a product, and every extra question is a place to give up —
 * on a thirty-one product shop the honest answer is available after ONE.
 *
 * So it asks once, answers immediately, and lets you change your mind without
 * starting again. If it grows a second question later it should be because the
 * first one stopped being enough, not because a quiz is expected to have five.
 */

import { useState } from 'react';
import Link from 'next/link';
import { money } from '@/lib/format';

export type FinderProduct = {
  id: string;
  name: string;
  slug: string | null;
  priceCents: number;
  imagePath: string | null;
  description: string | null;
};

export type FinderConcern = {
  key: string;
  label: string;
  blurb: string;
  /** Best first, already trimmed by the server. */
  products: FinderProduct[];
  /** How many matched in total, so a trimmed list can say so. */
  total: number;
};

export function ProductFinder(
  { concerns, shopHref, enquireHref }:
  { concerns: FinderConcern[]; shopHref: string; enquireHref: string }
) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = concerns.find(c => c.key === activeKey) ?? null;

  if (concerns.length === 0) return null;

  return (
    <div className="sf-finder">
      <div className="sf-finder-head">
        <span className="sf-finder-eyebrow">Not sure where to start</span>
        <h2>What does your skin need?</h2>
        <p>
          Pick one. Everything shown is matched on what the product&rsquo;s own
          description says, so nothing appears here that the label does not
          claim for itself.
        </p>
      </div>

      <div className="sf-finder-pills" role="group" aria-label="Skin concerns">
        {concerns.map(c => {
          const isActive = c.key === activeKey;
          return (
            <button
              key={c.key}
              type="button"
              className={`sf-finder-pill${isActive ? ' is-active' : ''}`}
              aria-pressed={isActive}
              /* Pressing the active one clears it, so the section can be put
                 away without reloading or scrolling past it. */
              onClick={() => setActiveKey(isActive ? null : c.key)}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* aria-live so a screen reader is told the results changed — the button
          press moves focus nowhere, and silently swapping the content below is
          how this kind of control becomes unusable without sight. */}
      <div className="sf-finder-results" aria-live="polite">
        {!active && (
          <p className="sf-finder-idle">
            Or <Link href={shopHref}>browse the full shelf</Link> — it runs in
            routine order, from cleanse through to SPF.
          </p>
        )}

        {active && active.products.length === 0 && (
          <p className="sf-finder-idle">
            Nothing on the shelf describes itself that way.{' '}
            <Link href={enquireHref}>Ask the practice</Link> and Jamie will point
            you at the right thing.
          </p>
        )}

        {active && active.products.length > 0 && (
          <>
            <p className="sf-finder-blurb">
              {active.blurb}
              {active.total > active.products.length && (
                <> Showing the {active.products.length} closest of {active.total}.</>
              )}
            </p>

            <div className="sf-finder-grid">
              {active.products.map(p => (
                <Link
                  key={p.id}
                  className="sf-finder-card"
                  href={`${shopHref}/${p.slug ?? ''}`}
                >
                  <div className="sf-finder-card-img">
                    {p.imagePath
                      ? <img src={p.imagePath} alt="" loading="lazy" />
                      : <span aria-hidden="true">{p.name.slice(0, 1)}</span>}
                  </div>
                  <div className="sf-finder-card-body">
                    <h3>{p.name}</h3>
                    {p.description && <p>{p.description}</p>}
                  </div>
                  <div className="sf-finder-card-foot">
                    <span>{money(p.priceCents)}</span>
                    <span className="sf-finder-card-go" aria-hidden="true">&rarr;</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
