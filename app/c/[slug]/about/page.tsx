/**
 * app/c/[slug]/about/page.tsx — the practice and the people.
 *
 * Where credentials or a biography are missing, this says so rather than
 * filling the space. The Med Bar fixtures carry null for both on purpose: we
 * do not write a clinician's qualifications for them, and an invented
 * credential on a medical page is not a placeholder, it is a false claim.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStorefront, getStorefrontProviders, hoursLines } from '@/lib/db/storefront';
import { initials, phone } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function StorefrontAbout({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const providers = await getStorefrontProviders(clinic.id);
  const hours = hoursLines(clinic.hours);
  const facts = Object.entries(clinic.visit_facts ?? {});

  return (
    <>
      <header className="sf-hero">
        <div className="sf-wrap">
          <div className="sf-eyebrow">About</div>
          <h1>{clinic.name}</h1>
          {clinic.intro && <p className="sf-tagline">{clinic.intro}</p>}
        </div>
      </header>

      {providers.length > 0 && (
        <section className="sf-section">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <h2>The team</h2>
            </div>
            <div className="sf-people">
              {providers.map(p => (
                <article className="sf-person" key={p.id}>
                  <div className="sf-portrait">
                    <span className="initials" aria-hidden="true">{initials(p.name)}</span>
                  </div>
                  <div>
                    <h3>{p.name}{p.credentials ? `, ${p.credentials}` : ''}</h3>
                    {p.role_label && <p className="role">{p.role_label}</p>}
                    {p.bio
                      ? <p className="bio">{p.bio}</p>
                      : (
                        <p className="sf-pending">
                          Biography {p.credentials ? '' : 'and credentials '}
                          to be supplied by the practice. Nothing here is written
                          on a practitioner&rsquo;s behalf.
                        </p>
                      )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {facts.length > 0 && (
        <section className="sf-section">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <h2>Before your first visit</h2>
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

      <section className="sf-section">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>Finding us</h2>
          </div>
          <div className="sf-foot-grid">
            <div>
              <h4>Address</h4>
              <address>
                {clinic.address_line1}<br />
                {clinic.address_line2 && <>{clinic.address_line2}<br /></>}
                {clinic.address_city}, {clinic.address_state} {clinic.address_zip}
              </address>
              {clinic.address_note && <p style={{ marginTop: '.5rem' }}>{clinic.address_note}</p>}
            </div>
            <div>
              <h4>Hours</h4>
              {hours.length ? (
                <dl className="sf-hours">
                  {hours.map(h => (
                    <div key={h.window} style={{ display: 'contents' }}>
                      <dt>{h.days}</dt>
                      <dd>{h.window}</dd>
                    </div>
                  ))}
                </dl>
              ) : <p>By appointment</p>}
            </div>
            <div>
              <h4>Contact</h4>
              <p>
                {clinic.phone_voice && (
                  <><a href={`tel:${clinic.phone_voice}`}>{phone(clinic.phone_voice)}</a><br /></>
                )}
                {clinic.email && <a href={`mailto:${clinic.email}`}>{clinic.email}</a>}
              </p>
            </div>
          </div>

          <div className="sf-actions" style={{ marginTop: 'var(--gd-8)' }}>
            <Link href={`/c/${slug}/enquire`} className="sf-btn primary">Request an appointment</Link>
          </div>
        </div>
      </section>
    </>
  );
}
