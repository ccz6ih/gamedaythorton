/**
 * app/c/[slug]/page.tsx — the storefront home.
 *
 * Three jobs, in the order a visitor actually has them: what is this and where,
 * what does it cost, and what is it going to be like. The third is the one
 * every booking-page template skips, and it is the one a nervous first-timer is
 * really asking. docs/14-screen-specs.md P13.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getStorefront, getStorefrontServices, getStorefrontProviders, hoursLines
} from '@/lib/db/storefront';
import { ServiceIcon } from '@/components/ServiceIcon';
import { priceLabel, initials } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function StorefrontHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const [services, providers] = await Promise.all([
    getStorefrontServices(clinic.id),
    getStorefrontProviders(clinic.id)
  ]);

  const isSpa = clinic.practice_type === 'med_spa';
  const hours = hoursLines(clinic.hours);
  const facts = Object.entries(clinic.visit_facts ?? {});

  // Lead with what people book most, not with whatever sorts first.
  const featured = services.filter(s => s.online_bookable).slice(0, 6);

  return (
    <>
      <header className="sf-hero">
        <div className="sf-wrap">
          <div className="sf-eyebrow">
            {clinic.location_name ?? `${clinic.address_city}, ${clinic.address_state}`}
          </div>
          <h1>{clinic.tagline ?? clinic.name}</h1>

          {clinic.intro && <p className="sf-tagline">{clinic.intro}</p>}

          <div className="sf-hero-meta">
            {hours[0] && (
              <span><b>{hours[0].days}</b> {hours[0].window}</span>
            )}
            {services.length > 0 && (
              <span><b>{services.length}</b> {isSpa ? 'treatments' : 'services'}</span>
            )}
            {providers[0] && <span>with <b>{providers[0].name}</b></span>}
          </div>

          <div className="sf-actions">
            <Link href={`/c/${slug}/enquire`} className="sf-btn primary">
              Request an appointment
            </Link>
            <Link href={`/c/${slug}/services`} className="sf-btn ghost">
              See {isSpa ? 'treatments' : 'services'} &amp; pricing
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------ what to expect -- */}
      {facts.length > 0 && (
        <section className="sf-section">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <h2>What actually happens</h2>
              <p>
                The things worth knowing before a first visit, in plain language.
                No surprises at the door.
              </p>
            </div>
            <dl className="sf-facts">
              {facts.map(([label, value]) => (
                <div className="sf-fact" key={label}>
                  <dt>{label.replace(/_/g, ' ')}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ featured -- */}
      {featured.length > 0 && (
        <section className="sf-section">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <h2>{isSpa ? 'Most booked' : 'Where people start'}</h2>
              <p>
                Prices shown the way they actually work — a range stays a range,
                and per-unit pricing says so rather than pretending to be a
                single number.
              </p>
            </div>

            <div className="sf-menu-group">
              {featured.map(s => (
                <article className="sf-item" key={s.id}>
                  {s.image_path ? (
                    <img className="sf-item-photo" src={s.image_path} alt=""
                      width={72} height={72} loading="lazy" />
                  ) : (
                    <span className="sf-item-mark" aria-hidden="true">
                      <ServiceIcon name={s.name} category={s.category} />
                    </span>
                  )}
                  <div className="sf-item-body">
                    <h3 className="sf-item-name">
                      {s.name}
                      {s.is_membership && <span className="sf-chip accent">membership</span>}
                      {s.requires_consent && <span className="sf-chip">consent form</span>}
                    </h3>
                    {s.description && <p className="sf-item-desc">{s.description}</p>}
                  </div>
                  <div className="sf-item-price">
                    <span className="amount">{priceLabel(s)}</span>
                    <span className="dur">{s.duration_min} min</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="sf-actions" style={{ marginTop: 'var(--gd-8)' }}>
              <Link href={`/c/${slug}/services`} className="sf-btn ghost">
                Full menu — {services.length} {isSpa ? 'treatments' : 'services'}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------------- who -- */}
      {providers.length > 0 && (
        <section className="sf-section">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <h2>Who you&rsquo;ll see</h2>
            </div>
            <div className="sf-people">
              {providers.slice(0, 2).map(p => (
                <article className="sf-person" key={p.id}>
                  <div className="sf-portrait">
                    {p.photo_path?.startsWith('/')
                      ? <img src={p.photo_path} alt={p.name} width={480} height={600} />
                      : <span className="initials" aria-hidden="true">{initials(p.name)}</span>}
                  </div>
                  <div>
                    <h3>{p.name}{p.credentials ? `, ${p.credentials}` : ''}</h3>
                    {p.role_label && <p className="role">{p.role_label}</p>}
                    {p.bio
                      ? <p className="bio">{p.bio}</p>
                      : (
                        // We do not write a practitioner's biography for them,
                        // and we never invent credentials. The gap is visible
                        // so it gets filled by the person it belongs to.
                        <p className="sf-pending">
                          Biography and credentials to be supplied by the practice.
                        </p>
                      )}
                  </div>
                </article>
              ))}
            </div>
            {providers.length > 2 && (
              <div className="sf-actions" style={{ marginTop: 'var(--gd-6)' }}>
                <Link href={`/c/${slug}/about`} className="sf-btn ghost">Meet the team</Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- close -- */}
      <section className="sf-section">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>Ready when you are</h2>
            <p>
              {clinic.booking_note ??
                'Send a request and the practice will confirm a time that works. No card required to ask.'}
            </p>
          </div>
          <div className="sf-actions">
            <Link href={`/c/${slug}/enquire`} className="sf-btn primary">
              Request an appointment
            </Link>
            {clinic.phone_voice && (
              <a href={`tel:${clinic.phone_voice}`} className="sf-btn ghost">Call the practice</a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
