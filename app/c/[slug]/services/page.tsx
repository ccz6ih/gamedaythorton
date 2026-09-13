/**
 * app/c/[slug]/services/page.tsx — the full menu.
 *
 * Set like a print menu rather than a grid of cards: a shared right edge for
 * prices across every category is what makes fifty-odd services scannable.
 *
 * Every price renders through priceLabel(), which is the only thing in this
 * codebase allowed to turn a price into text. A practice that quotes "from
 * $800" has that on its page, not $800 — the difference is a complaint at the
 * counter.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStorefront, getStorefrontServices, groupByCategory } from '@/lib/db/storefront';
import { priceLabel, titleCase, money } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function StorefrontServices({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const services = await getStorefrontServices(clinic.id);
  const groups = groupByCategory(services);
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
            {anyQuoted && ' Where a price depends on the plan, it says so rather than showing a number that would not hold.'}
          </p>
        </div>
      </header>

      <section className="sf-section">
        <div className="sf-wrap">
          {groups.length === 0 && (
            <p className="sf-note">The menu is being prepared. Please call the practice.</p>
          )}

          {groups.map(group => (
            <div className="sf-menu-group" key={group.category}>
              <div className="sf-menu-cat">
                <h3>{titleCase(group.category)}</h3>
                <span className="rule" aria-hidden="true" />
                <span className="count">{group.items.length}</span>
              </div>

              {group.items.map(s => (
                <article className="sf-item" key={s.id}>
                  <div>
                    <h4 className="sf-item-name">
                      {s.name}
                      {s.is_membership && <span className="sf-chip accent">membership</span>}
                      {!s.online_bookable && <span className="sf-chip">by enquiry</span>}
                      {s.requires_consent && <span className="sf-chip">consent form</span>}
                    </h4>
                    {s.description && <p className="sf-item-desc">{s.description}</p>}
                    {s.deposit_cents ? (
                      <p className="sf-item-desc" style={{ marginTop: '.35rem' }}>
                        {money(s.deposit_cents)} deposit to hold the appointment.
                      </p>
                    ) : null}
                  </div>
                  <div className="sf-item-price">
                    <span className="amount">{priceLabel(s)}</span>
                    <span className="dur">{s.duration_min} min</span>
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
            <Link href={`/c/${slug}/enquire`} className="sf-btn primary">Request an appointment</Link>
            <Link href={`/c/${slug}/packages`} className="sf-btn ghost">Packages &amp; series</Link>
          </div>
        </div>
      </section>
    </>
  );
}
