/**
 * app/c/[slug]/book/page.tsx — booking, three steps.
 *
 * The thing the storefront could not do. /enquire takes a message that a human
 * then answers; this takes an appointment. A booking site that cannot book is a
 * brochure, and the practice already had better than that.
 *
 * Availability never reaches this page as data — it is computed inside the
 * database and only free times come back. Migration 0026 explains why.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront, getStorefrontServices } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { BookingFlow, type BookService } from '@/components/BookingFlow';
import { priceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * ONE BOOKING PAGE, NOT NINE.
 *
 * `?service=<uuid>` only preselects a dropdown — the page, its copy and its
 * availability are identical whatever it says. Google had indexed eight of
 * these variants and was showing them against real queries, which costs twice:
 * eight near-identical pages split the ranking signal between them, and the
 * result a human sees in the SERP is a raw UUID.
 *
 * Canonical rather than noindex, deliberately. One of those variants already
 * sits at position 7 and has produced a click; noindex throws that away, while
 * a canonical folds it back into /book. Nothing is disallowed in robots.txt
 * either, for the same reason — a page Google cannot fetch is a page whose
 * canonical it never reads.
 *
 * Relative, resolved against the metadataBase the storefront layout sets, and
 * built from storefrontBase so it is `/book` on medbarco.com and
 * `/c/<slug>/book` on the shared deployment. Hardcoding `/book` would publish
 * a canonical that 404s for every tenant without its own domain.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const base = await storefrontBase(slug);
  return { title: 'Book', alternates: { canonical: `${base}/book` } };
}

export default async function BookPage({
  params, searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const q = await searchParams;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const links = storefrontLinks(await storefrontBase(slug));
  const services = await getStorefrontServices(clinic.id);

  const bookable: BookService[] = services
    .filter(s => s.online_bookable)
    .map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      duration_min: s.duration_min,
      // The same price renderer the menu uses, so "from $800" and "$14+/unit"
      // stay honest here too rather than being flattened into one number.
      priceLabel: priceLabel(s)
    }));

  const preselect = typeof q.service === 'string' ? q.service : undefined;

  return (
    <>
      <header className="sf-hero">
        <div className="sf-wrap">
          <div className="sf-eyebrow">{clinic.name}</div>
          <h1>Book an appointment</h1>
          {clinic.booking_note && <p className="sf-tagline">{clinic.booking_note}</p>}
        </div>
      </header>

      <section className="sf-section">
        <div className="sf-wrap">
          <BookingFlow
            slug={slug}
            services={bookable}
            hours={clinic.hours ?? []}
            servicesHref={links.services}
            preselect={preselect}
          />

          <p className="sf-note-line" style={{ marginTop: 'var(--gd-8)' }}>
            Prefer to talk it through first?{' '}
            <Link href={links.enquire}>Send us a message</Link>
            {clinic.phone_voice && <> or call {clinic.phone_voice}</>}.
          </p>
        </div>
      </section>
    </>
  );
}
