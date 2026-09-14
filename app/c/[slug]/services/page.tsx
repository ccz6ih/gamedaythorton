/**
 * app/c/[slug]/services/page.tsx — the full menu.
 *
 * Set like a print menu rather than a grid of cards: a shared right edge for
 * prices across every category is what makes thirty-odd services scannable, and
 * what a card grid destroys.
 *
 * TWO DECISIONS TAKEN FROM LOOKING AT WHAT THIS REPLACES
 *
 * 1. The menu line is short and the long copy is one tap away. The incumbent
 *    prints 150 words on every row, so nobody reads any of them and comparing
 *    two treatments means scrolling past four paragraphs. `description` is the
 *    line; `details` opens underneath it. Native <details>, so it works with no
 *    JavaScript and reads correctly to a screen reader.
 *
 * 2. A service with no copy says so. The page this replaces renders an empty
 *    white box for at least one treatment, which reads as broken. `needs_copy`
 *    turns that into an honest line — and, more usefully, into something the
 *    practice can see and fix.
 *
 * Every price renders through priceLabel(), the only thing in this codebase
 * allowed to turn a price into text, so "from $800" and "$14+ / unit" survive
 * to the page instead of being flattened into a number that would not hold at
 * the counter.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront, getStorefrontServices, groupByCategory } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { ServiceIcon } from '@/components/ServiceIcon';
import { priceLabel, titleCase, money } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Services & Pricing' };

/** Category order the practice would read out, not alphabetical. */
const CATEGORY_ORDER = [
  'consult', 'injectables', 'paramedical', 'skin', 'facials', 'lashes', 'other'
];

const CATEGORY_NOTE: Record<string, string> = {
  injectables: 'Consultation and assessment before anything is administered.',
  paramedical: 'Inkless scar and stretch mark revision. Sessions are customised to the area.',
  lashes: 'Fills are priced by how long it has been since your last appointment.',
  consult: 'No commitment, and no charge.'
};

export default async function StorefrontServices({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const links = storefrontLinks(await storefrontBase(slug));

  const services = await getStorefrontServices(clinic.id);
  const groups = groupByCategory(services).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a.category);
    const ib = CATEGORY_ORDER.indexOf(b.category);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const isSpa = clinic.practice_type === 'med_spa';
  const anyQuoted = services.some(s => s.price_mode === 'quoted' || s.price_mode === 'from');
  const anyDeposit = services.some(s => s.deposit_cents);

  return (
    <>
      <header className="sf-hero">
        <div className="sf-wrap">
          <div className="sf-eyebrow">{clinic.name}</div>
          <h1>{isSpa ? 'Treatments' : 'Services'} &amp; pricing</h1>
          <p className="sf-tagline">
            Everything offered, with what it costs and how long to allow.
            {anyQuoted && ' Where the price depends on the plan it says so, rather than showing a number that would not hold.'}
          </p>

          {/* A rail, not a dropdown. Thirty services in a closed select is a
              menu you have to already know your way around. */}
          {groups.length > 1 && (
            <nav className="sf-jump" aria-label="Jump to a category">
              {groups.map(g => (
                <a key={g.category} href={`#cat-${g.category}`} className="sf-jump-link">
                  {titleCase(g.category)}
                  <span className="n">{g.items.length}</span>
                </a>
              ))}
            </nav>
          )}
        </div>
      </header>

      <section className="sf-section">
        <div className="sf-wrap">
          {groups.length === 0 && (
            <p className="sf-note">The menu is being prepared. Please call the practice.</p>
          )}

          {groups.map(group => (
            <div className="sf-menu-group" id={`cat-${group.category}`} key={group.category}>
              <div className="sf-menu-cat">
                <h2>{titleCase(group.category)}</h2>
                <span className="rule" aria-hidden="true" />
                <span className="count">{group.items.length}</span>
              </div>

              {CATEGORY_NOTE[group.category] && (
                <p className="sf-cat-note">{CATEGORY_NOTE[group.category]}</p>
              )}

              {group.items.map((s, index) => (
                <article className="sf-item" key={s.id}>
                  {s.image_path ? (
                    <img className="sf-item-photo" src={s.image_path} alt=""
                      width={72} height={72} loading="lazy" />
                  ) : (
                    <div className="sf-item-num" aria-hidden="true">
                      <span>{String(index + 1).padStart(2, '0')}</span>
                    </div>
                  )}

                  <div className="sf-item-body">
                    <h3 className="sf-item-name">
                      <Link
                        href={s.online_bookable
                          ? `${links.book}?service=${encodeURIComponent(s.id)}`
                          : `${links.enquire}?service=${encodeURIComponent(s.name)}`}
                        className="sf-item-title-link"
                      >
                        {s.name}
                      </Link>
                      {s.is_membership && <span className="sf-chip accent">membership</span>}
                      {!s.online_bookable && <span className="sf-chip">by enquiry</span>}
                      {s.requires_consent && <span className="sf-chip">consent form</span>}
                    </h3>

                    {s.description && <p className="sf-item-desc">{s.description}</p>}

                    {s.needs_copy && !s.description && (
                      <p className="sf-item-desc dim">
                        Description to be supplied by the practice.
                      </p>
                    )}

                    {s.details && (
                      <details className="sf-more">
                        <summary>What this involves</summary>
                        <p>{s.details}</p>
                      </details>
                    )}

                    {s.deposit_cents ? (
                      <p className="sf-item-desc dim">
                        {money(s.deposit_cents)} deposit holds the appointment, and comes off the total.
                      </p>
                    ) : null}
                  </div>

                  <div className="sf-item-price">
                    <span className="amount">{priceLabel(s)}</span>
                    <span className="dur">{s.duration_min} min</span>
                    <Link
                      className="sf-item-reserve"
                      href={s.online_bookable
                        ? `${links.book}?service=${encodeURIComponent(s.id)}`
                        : `${links.enquire}?service=${encodeURIComponent(s.name)}`}
                    >
                      {s.online_bookable ? 'Reserve' : 'Enquire'} <span>&rarr;</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ))}

          {(anyQuoted || anyDeposit) && (
            <p className="sf-note" style={{ marginTop: 'var(--gd-10)' }}>
              <b>About these prices.</b>{' '}
              {anyQuoted && 'Treatments priced “from” or per unit depend on how much is used, which is agreed with you before anything starts. '}
              {anyDeposit && 'Where a deposit applies it comes off the total, and it is shown above rather than at checkout.'}
            </p>
          )}

          <div className="sf-actions" style={{ marginTop: 'var(--gd-8)' }}>
            <Link href={links.book} className="sf-btn primary">Book an appointment</Link>
            <Link href={links.packages} className="sf-btn ghost">Packages &amp; series</Link>
          </div>
        </div>
      </section>
    </>
  );
}
