/**
 * app/c/[slug]/prf/[treatment]/page.tsx — one PRF treatment, one URL.
 *
 * WHY THIS EXISTS ON TOP OF THE PILLAR PAGE
 * /prf is the best answer to "what is PRF." It is not, and should not try to
 * be, the best answer to "PRF under-eye treatment Loveland" or "PRF hair
 * restoration Loveland" — those are three different searches with three
 * different intents, and a search engine and an AI answer engine both reward
 * a page whose whole job is the specific query over a section of a longer
 * page. This route gives each of the three PRF services its own indexable
 * URL, its own <title>/meta description, and its own Service + FAQPage
 * structured data, while staying a child of /prf in the URL, the breadcrumb
 * and the nav — a cluster page under the pillar, not a competing one. See
 * docs/23-content-seo-strategy.md Tier 2.1.
 *
 * WHERE THE COPY COMES FROM
 * The service's own `description`/`details` come from the database — the
 * practice's own words, unchanged. The `intro` and FAQ answers come from
 * lib/prf-content.ts and are the same kind of general, hedged, non-outcome
 * information as the pillar page's FAQ (see that file's own comment, and
 * scripts/medbar-copy.cjs). Nothing here claims a result specific to this
 * practice.
 *
 * WHY A NAME-PATTERN MATCH INSTEAD OF A SLUG COLUMN
 * See lib/prf-content.ts's comment on PRF_TREATMENTS. Three known rows, no
 * schema change.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront, getStorefrontServices } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { ServiceIcon } from '@/components/ServiceIcon';
import { priceLabel } from '@/lib/format';
import { PRF_TREATMENTS } from '@/lib/prf-content';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string; treatment: string }> };

function findTreatment(treatmentParam: string) {
  return PRF_TREATMENTS.find(t => t.slug === treatmentParam);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { treatment: treatmentParam } = await params;
  const treatment = findTreatment(treatmentParam);
  if (!treatment) return { title: 'Not found' };

  return {
    title: treatment.metaTitle,
    description: treatment.metaDescription
  };
}

export default async function PrfTreatmentPage({ params }: Props) {
  const { slug, treatment: treatmentParam } = await params;
  const treatment = findTreatment(treatmentParam);
  if (!treatment) notFound();

  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const links = storefrontLinks(await storefrontBase(slug));
  const services = await getStorefrontServices(clinic.id);
  const service = services.find(s => treatment.match.test(s.name));
  const consult = services.find(s => s.category === 'consult');

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://www.medbarco.com';
  const pageUrl = `${base}${links.prf}/${treatment.slug}`;

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: treatment.faq.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: clinic.name, item: `${base}${links.home}` },
      { '@type': 'ListItem', position: 2, name: 'What is PRF?', item: `${base}${links.prf}` },
      { '@type': 'ListItem', position: 3, name: service?.name ?? treatment.eyebrow, item: pageUrl }
    ]
  };

  const serviceJsonLd = service ? {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: service.name,
    name: service.name,
    description: service.description ?? treatment.metaDescription,
    url: pageUrl,
    provider: { '@type': 'MedicalBusiness', name: clinic.name },
    ...(clinic.address_city ? {
      areaServed: { '@type': 'City', name: clinic.address_city }
    } : {}),
    ...(service.price_cents || service.price_from_cents ? {
      offers: {
        '@type': 'Offer',
        priceCurrency: 'USD',
        price: ((service.price_from_cents ?? service.price_cents)! / 100).toFixed(2),
        url: pageUrl
      }
    } : {})
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {serviceJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      )}

      <div className="sf-wrap" style={{ paddingTop: 'var(--gd-6)' }}>
        <Link href={links.prf} className="sf-back">&larr; What is PRF?</Link>
      </div>

      <header className="sf-hero" style={{ paddingTop: 'var(--gd-4)' }}>
        <div className="sf-wrap">
          <div className="sf-eyebrow">{treatment.eyebrow}</div>
          <h1>{service?.name ?? treatment.eyebrow}</h1>
          <p className="sf-tagline">{treatment.intro}</p>

          {service && (
            <div className="sf-actions">
              <Link
                href={service.online_bookable
                  ? `${links.book}?service=${encodeURIComponent(service.id)}`
                  : `${links.enquire}?service=${encodeURIComponent(service.name)}`}
                className="sf-btn primary"
              >
                {service.online_bookable ? 'Reserve' : 'Enquire'}
              </Link>
              {consult && (
                <Link
                  href={`${links.book}?service=${encodeURIComponent(consult.id)}`}
                  className="sf-btn ghost"
                >
                  Free 15-minute consult
                </Link>
              )}
            </div>
          )}
        </div>
      </header>

      {service ? (
        <section className="sf-section">
          <div className="sf-wrap">
            <div className="sf-menu-group">
              <article className="sf-item">
                <div className="sf-item-icon-box" aria-hidden="true">
                  <ServiceIcon name={service.name} category={service.category} />
                </div>
                <div className="sf-item-body">
                  <h2 className="sf-item-name">{service.name}</h2>
                  {service.description && <p className="sf-item-desc">{service.description}</p>}
                  {service.details && (
                    <details className="sf-more" open>
                      <summary>What this involves</summary>
                      <p>{service.details}</p>
                    </details>
                  )}
                </div>
                <div className="sf-item-price">
                  <span className="amount">{priceLabel(service)}</span>
                  <span className="dur">{service.duration_min} min</span>
                </div>
              </article>
            </div>
          </div>
        </section>
      ) : (
        <section className="sf-section">
          <div className="sf-wrap">
            <p className="sf-note">
              This treatment is not currently listed at {clinic.name}. See{' '}
              <Link href={links.services}>every treatment &amp; price</Link>, or{' '}
              <Link href={links.enquire}>ask the practice</Link>.
            </p>
          </div>
        </section>
      )}

      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head"><h2>Common questions</h2></div>

          <div className="sf-menu-group">
            {treatment.faq.map(f => (
              <details className="sf-more" key={f.q} style={{ marginBottom: 'var(--gd-4)' }}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>

          <p className="sf-note" style={{ marginTop: 'var(--gd-8)' }}>
            This page is general information about this treatment, not medical
            advice, and it is not a substitute for an in-person consultation.
            Candidacy, dosing and a realistic plan are set with your provider.
            Read more about{' '}
            <Link href={links.prf}>what PRF is and how it&rsquo;s made</Link>.
          </p>

          <div className="sf-actions" style={{ marginTop: 'var(--gd-6)' }}>
            <Link href={links.prf} className="sf-btn ghost">All PRF treatments</Link>
            <Link href={links.services} className="sf-btn ghost">Full menu &amp; pricing</Link>
            <Link href={links.book} className="sf-btn primary">Book an appointment</Link>
          </div>
        </div>
      </section>
    </>
  );
}
