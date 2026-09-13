/**
 * app/c/[slug]/packages/page.tsx — prepaid series.
 *
 * The saving is COMPUTED from list price versus package price, never typed.
 * A hand-entered "Save $300" drifts the moment a service price changes, and
 * then the page is advertising a discount the practice is not giving.
 *
 * Expiry is stated on the card rather than in terms. A series that expires is
 * money the client has already paid, and burying that is how a prepaid balance
 * becomes an argument at the front desk.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront, getStorefrontPackages } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Treatment Packages' };

export default async function StorefrontPackages({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const links = storefrontLinks(await storefrontBase(slug));

  const packages = await getStorefrontPackages(clinic.id);

  return (
    <>
      <header className="sf-hero">
        <div className="sf-wrap">
          <div className="sf-eyebrow">{clinic.name}</div>
          <h1>Packages &amp; series</h1>
          <p className="sf-tagline">
            Several sessions bought together. Where a series saves money the
            saving is worked out from the individual prices, so it is always the
            real number.
          </p>
        </div>
      </header>

      <section className="sf-section">
        <div className="sf-wrap">
          {packages.length === 0 ? (
            <p className="sf-note">
              No packages are offered at the moment. Individual{' '}
              <Link href={links.services}>services and pricing</Link> are on the menu.
            </p>
          ) : (
            <div className="sf-packages">
              {packages.map(p => {
                const list = p.list_price_cents;
                const saving = list && list > p.price_cents ? list - p.price_cents : 0;
                const pct = list && saving ? Math.round((saving / list) * 100) : 0;
                const perSession = Math.round(p.price_cents / p.sessions);

                return (
                  <article className="sf-pack" key={p.id}>
                    <h3>{p.name}</h3>
                    <p className="sessions">
                      {p.sessions} {p.sessions === 1 ? 'session' : 'sessions'}
                      {' · '}{money(perSession)} each
                    </p>
                    {p.description && <p className="note">{p.description}</p>}
                    {p.interval_note && <p className="note">{p.interval_note}</p>}

                    <div className="price-row">
                      <span className="price">{money(p.price_cents)}</span>
                      {saving > 0 && (
                        <>
                          <span className="was">{money(list)}</span>
                          <span className="save">save {money(saving)}{pct ? ` · ${pct}%` : ''}</span>
                        </>
                      )}
                    </div>

                    {p.expiry_days ? (
                      <p className="note">
                        Sessions to be used within {p.expiry_days} days of purchase.
                      </p>
                    ) : (
                      <p className="note">No expiry — use the sessions whenever suits.</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <div className="sf-actions" style={{ marginTop: 'var(--gd-8)' }}>
            <Link href={links.enquire} className="sf-btn primary">Ask about a package</Link>
            <Link href={links.services} className="sf-btn ghost">Individual pricing</Link>
          </div>
        </div>
      </section>
    </>
  );
}
