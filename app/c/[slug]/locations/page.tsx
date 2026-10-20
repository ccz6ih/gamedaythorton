/**
 * app/c/[slug]/locations/page.tsx
 * The hub: every room the practice has published, on one page.
 *
 * Exists for two reasons beyond tidiness. `/locations` is registered in
 * STOREFRONT_PATHS so the middleware treats the prefix as public — without a
 * page at the bare path, that registration resolves to a 404 for anybody who
 * trims a URL, which people do. And it is the page that can answer "where is
 * The Med Bar" as a question in its own right, rather than making a visitor
 * pick a city before they have been told which cities there are.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront, getStorefrontLocations } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks, siteOrigin } from '@/lib/storefront-links';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const [clinic, rooms] = await Promise.all([
    getStorefront(slug),
    getStorefrontLocations(slug)
  ]);
  if (!clinic) return { title: 'Not found' };

  const [origin, base] = await Promise.all([siteOrigin(), storefrontBase(slug)]);
  const cities = rooms.map(r => r.city).join(' and ');

  return {
    // The practice's name comes from the layout's title template; repeating
    // it here spends a third of a truncated SERP title on the brand twice.
    title: cities ? `Where to Find Us — ${cities}` : 'Where to Find Us',
    description: cities
      ? `${clinic.name} sees clients in ${cities}. Addresses, what each room is like, and how to book into either.`
      : `Where to find ${clinic.name}.`,
    alternates: { canonical: `${origin}${base}/locations` },
    robots: clinic.live ? { index: true, follow: true } : { index: false, follow: false }
  };
}

export default async function LocationsPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const rooms = await getStorefrontLocations(slug);
  const links = storefrontLinks(await storefrontBase(slug));
  const base = await storefrontBase(slug);

  // A practice that has published no rooms has no hub to show. 404 rather
  // than an empty page with a heading over nothing.
  if (rooms.length === 0) notFound();

  return (
    <>
      <section className="sf-hero sf-bordered">
        <div className="sf-wrap">
          <div className="sf-hero-crumbs">
            <Link href={links.home}>Home</Link>
            <span aria-hidden="true">/</span>
            <span>Locations</span>
          </div>
          <div className="sf-hero-lead">
            <div className="sf-eyebrow">Colorado</div>
            <h1 className="sf-display">
              <span className="ln"><span>Where to find</span></span>
              <span className="ln"><span className="sf-italic">{clinic.name}.</span></span>
            </h1>
            <p className="sf-lede">
              {rooms.length === 1
                ? 'One room, by appointment.'
                : `${rooms.length} rooms, the same practitioner and the same treatment menu in both.`}
            </p>
          </div>
        </div>
      </section>

      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-editorial-cards">
            {rooms.map(room => (
              <article className="sf-editorial-card" key={room.slug}>
                <span className="sf-editorial-tag">
                  {room.city}, {room.state}{room.is_default ? ' · Main room' : ''}
                </span>
                <p>{room.intro}</p>
                <p>
                  {room.street && <>{room.street}<br /></>}
                  {room.city}, {room.state} {room.postal_code ?? ''}
                </p>
                <p>
                  <Link className="sf-jump-link" href={`${base}/locations/${room.slug}`}>
                    About the {room.city} room
                  </Link>
                </p>
              </article>
            ))}
          </div>

          <div className="sf-actions" style={{ marginTop: 'var(--gd-8)' }}>
            <Link className="sf-btn primary" href={links.book}>Book an appointment</Link>
            <Link className="sf-btn ghost" href={links.services}>See the treatment menu</Link>
          </div>
        </div>
      </section>
    </>
  );
}
