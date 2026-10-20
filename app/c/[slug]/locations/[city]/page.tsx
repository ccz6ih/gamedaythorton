/**
 * app/c/[slug]/locations/[city]/page.tsx
 * One page per room the practice has published.
 *
 * ===========================================================================
 * WHY THIS EXISTS
 * ===========================================================================
 * Search Console shows the practice ranking for prf boulder, prf under eye
 * treatment glenwood springs, jeuveau denver, hydrafacial parker co — and not
 * one query naming a town she actually works in. Google has worked out what
 * the site is about and has no idea where it is.
 *
 * ===========================================================================
 * WHY IT IS NOT A DOORWAY PAGE, WHICH IS THE OBVIOUS WAY TO GET THIS WRONG
 * ===========================================================================
 * Two pages differing only in a city name are a doorway, Google says so by
 * name, and the penalty is worse than the problem. So the thing that varies
 * is not a token substitution — it is `location.intro`, written per room,
 * which migration 0045 requires to exist and to be at least 120 characters
 * before `public` may be set at all. A room nobody has written about cannot
 * be published.
 *
 * The rest is genuinely different too: different street, different postcode,
 * different surrounding towns, and in Northglenn's case a borrowed room
 * inside another clinic with narrower availability. That is real content
 * about a real difference.
 *
 * ===========================================================================
 * NO TELEPHONE IN THE STRUCTURED DATA
 * ===========================================================================
 * Three different numbers appear across this project and the clinic's own
 * column is null. A wrong phone number in machine-readable form propagates
 * into knowledge panels and directories and is slow to correct, so the field
 * is omitted entirely until the practice confirms one. Absent is recoverable;
 * wrong is not.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getStorefront, getStorefrontLocation, getStorefrontLocations,
  getStorefrontServices, groupByCategory, hoursLines
} from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks, siteOrigin } from '@/lib/storefront-links';
import { ldScript } from '@/lib/structured-data';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; city: string }> }
): Promise<Metadata> {
  const { slug, city } = await params;
  const [clinic, location] = await Promise.all([
    getStorefront(slug),
    getStorefrontLocation(slug, city)
  ]);
  if (!clinic || !location) return { title: 'Not found' };

  const [origin, base] = await Promise.all([siteOrigin(), storefrontBase(slug)]);
  const where = `${location.city}, ${location.state}`;

  return {
    /**
     * No clinic name in here, and that is not an omission.
     *
     * The storefront layout sets `title.template` to "%s · <practice>", so
     * naming the practice here renders "The Med Bar in Loveland, CO |
     * Aesthetics & Skin Treatments · The Med Bar" — the brand twice in a
     * title Google truncates around sixty characters, spending a third of the
     * space somebody already knows. The template supplies it; this supplies
     * the part that distinguishes one page from another, which for a location
     * page means the treatment words and the town.
     */
    title: `Aesthetics & Skin Treatments in ${where}`,
    description:
      `${clinic.name} sees clients in ${where}` +
      `${location.street ? ` at ${location.street}` : ''}. ` +
      `PRF, injectables, facials and skin treatments, by appointment. ` +
      `Also serving ${location.areas_served.filter(a => a !== location.city).slice(0, 3).join(', ')}.`,
    alternates: { canonical: `${origin}${base}/locations/${location.slug}` },
    // A pilot tenant's storefront stays out of the index, same rule as every
    // other page here. Publishing a location is not the same as publishing a
    // site.
    robots: clinic.live ? { index: true, follow: true } : { index: false, follow: false }
  };
}

export default async function LocationPage(
  { params }: { params: Promise<{ slug: string; city: string }> }
) {
  const { slug, city } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const [location, all, services] = await Promise.all([
    getStorefrontLocation(slug, city),
    getStorefrontLocations(slug),
    getStorefrontServices(clinic.id)
  ]);
  if (!location) notFound();

  const links = storefrontLinks(await storefrontBase(slug));
  const origin = await siteOrigin();
  const base = await storefrontBase(slug);

  const others = all.filter(l => l.slug !== location.slug);
  const categories = Object.keys(groupByCategory(services.filter(s => s.online_bookable)));
  const nearby = location.areas_served.filter(a => a !== location.city);
  const hours = hoursLines(clinic.hours);

  /**
   * LocalBusiness, with the address split into the fields schema.org actually
   * wants rather than one string. `telephone` is absent on purpose — see the
   * file header.
   *
   * areaServed is the honest version of the thing a doorway page fakes: this
   * room IS a sensible drive from these towns, and saying so is different from
   * claiming an address in them.
   */
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'HealthAndBeautyBusiness',
    name: `${clinic.name} — ${location.city}`,
    url: `${origin}${base}/locations/${location.slug}`,
    ...(clinic.legal_name ? { legalName: clinic.legal_name } : {}),
    ...(clinic.email ? { email: clinic.email } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(location.street ? { streetAddress: location.street } : {}),
      addressLocality: location.city,
      addressRegion: location.state,
      ...(location.postal_code ? { postalCode: location.postal_code } : {}),
      addressCountry: 'US'
    },
    areaServed: location.areas_served.map(a => ({ '@type': 'Place', name: a })),
    description: location.intro
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldScript(ld)} />

      <section className="sf-hero sf-bordered">
        <div className="sf-wrap">
          <div className="sf-hero-crumbs">
            <Link href={links.home}>Home</Link>
            <span aria-hidden="true">/</span>
            <span>{location.city}</span>
          </div>

          <div className="sf-hero-lead">
            <div className="sf-eyebrow">{location.city}, Colorado</div>
            <h1 className="sf-display">
              <span className="ln"><span>{clinic.name}</span></span>
              <span className="ln"><span className="sf-italic">in {location.city}.</span></span>
            </h1>
            <p className="sf-lede">{location.intro}</p>
          </div>

          <div className="sf-matrix-stats">
            {location.street && (
              <div className="sf-matrix-stat">
                <span className="val">{location.street}</span>
                <span className="lbl">
                  {location.city}, {location.state} {location.postal_code ?? ''}
                </span>
              </div>
            )}
            <div className="sf-matrix-stat">
              <span className="val">By appointment</span>
              <span className="lbl">Every visit is booked, never walk-in</span>
            </div>
            {categories.length > 0 && (
              <div className="sf-matrix-stat">
                <span className="val">{categories.length}</span>
                <span className="lbl">
                  {categories.length === 1 ? 'Treatment category' : 'Treatment categories'} bookable here
                </span>
              </div>
            )}
          </div>

          <div className="sf-actions">
            <Link className="sf-btn primary" href={links.book}>Book an appointment</Link>
            <Link className="sf-btn ghost" href={links.services}>See the treatment menu</Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- address & hours -- */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Finding it</div>
            <h2>Where this room is, and when</h2>
          </div>

          <dl className="sf-fact">
            <dt>Address</dt>
            <dd>
              {location.name}
              {location.street && <><br />{location.street}</>}
              <br />{location.city}, {location.state} {location.postal_code ?? ''}
            </dd>

            <dt>Hours</dt>
            <dd>
              {hours.length
                ? hours.map(h => <div key={h.window}>{h.days} · {h.window}</div>)
                : 'By appointment.'}
              {/*
                Said plainly rather than left to be discovered. The practice
                keeps one set of published hours across both rooms, and which
                room she is in on a given day is what the booking calendar
                actually answers.
              */}
              <div style={{ marginTop: '.5rem' }}>
                These are the practice&rsquo;s opening hours. Which days she is in{' '}
                {location.city} specifically is what the booking calendar shows.
              </div>
            </dd>

            {clinic.email && (
              <>
                <dt>Email</dt>
                <dd><a href={`mailto:${clinic.email}`}>{clinic.email}</a></dd>
              </>
            )}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------ what's here -- */}
      {categories.length > 0 && (
        <section className="sf-section sf-bordered sf-invert">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <div className="sf-eyebrow">Bookable here</div>
              <h2>What you can have done in {location.city}</h2>
              <p>
                The same menu and the same practitioner in both rooms. Pick a
                treatment to read what it involves before you book it.
              </p>
            </div>
            <div className="sf-editorial-cards">
              {categories.map(category => (
                <article className="sf-editorial-card" key={category}>
                  <span className="sf-editorial-tag">{category}</span>
                  <p>
                    <Link className="sf-jump-link" href={`${links.services}#${
                      category.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                    }`}>
                      {category} in {location.city}
                    </Link>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* --------------------------------------------------- areas served -- */}
      {nearby.length > 0 && (
        <section className="sf-section sf-bordered">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <div className="sf-eyebrow">Getting here</div>
              <h2>Who this room is convenient for</h2>
              <p>
                {/*
                  The honest form of the thing a doorway page fakes. These are
                  towns this room is a sensible drive from — not a list of
                  places the practice claims to be in.
                */}
                The {location.city} room is a short drive for people in{' '}
                {nearby.slice(0, -1).join(', ')}
                {nearby.length > 1 ? ' and ' : ''}{nearby[nearby.length - 1]}.
              </p>
            </div>
            <div className="sf-actions">
              {nearby.map(area => (
                <span className="sf-chip" key={area}>{area}</span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------- the other room -- */}
      {others.length > 0 && (
        <section className="sf-section sf-bordered">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <div className="sf-eyebrow">The other room</div>
              <h2>
                Closer to {others.map(o => o.city).join(' or ')}?
              </h2>
            </div>
            {others.map(other => (
              <div className="sf-note" key={other.slug} style={{ marginBottom: 'var(--gd-4)' }}>
                <b>{other.city}</b> — {other.street}
                {other.postal_code ? `, ${other.postal_code}` : ''}.{' '}
                <Link className="sf-jump-link" href={`${links.base}/locations/${other.slug}`}>
                  About the {other.city} room
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="sf-section">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>Book into {location.city}</h2>
            <p>
              Pick a treatment and a time. You will get a confirmation saying
              exactly where to be.
            </p>
          </div>
          <div className="sf-actions">
            <Link className="sf-btn primary" href={links.book}>Book an appointment</Link>
            <Link className="sf-btn ghost" href={links.enquire}>Ask a question first</Link>
          </div>
        </div>
      </section>
    </>
  );
}
