/**
 * app/c/[slug]/mens-skin-care/page.tsx
 * Local men's skincare and skin-health guide.
 *
 * This is an audience page, not a men's-health module. It connects everyday
 * skincare questions with the practice's real facial, PRF, LED, neurotoxin,
 * and retail services without inventing a diagnosis or promising an outcome.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront, getStorefrontProducts, getStorefrontServices } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { ServiceIcon } from '@/components/ServiceIcon';
import { priceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

const FAQS = [
  {
    q: 'Do men need a different skincare routine?',
    a: 'The useful difference is not a separate men’s formula. It is choosing a routine for the person’s oil production, shaving habits, sensitivity, sun exposure, and goals. A simple routine usually starts with a gentle cleanser, targeted treatment, moisturizer, and daily SPF.'
  },
  {
    q: 'Is microneedling good for men’s skin?',
    a: 'Microneedling may be considered for concerns such as uneven texture, enlarged pores, acne scarring, and fine lines. At The Med Bar, PRF microneedling combines the procedure with the client’s own platelet-rich fibrin after a consultation and candidacy assessment.'
  },
  {
    q: 'Can men combine microneedling with PRF?',
    a: 'The Med Bar offers PRF microneedling as a treatment that incorporates the client’s own platelet-rich fibrin into a customized microneedling session. A provider determines whether it is appropriate for the skin and concern being treated.'
  },
  {
    q: 'What is the difference between Jeuveau and microneedling?',
    a: 'Jeuveau is a neurotoxin treatment that relaxes selected facial muscles associated with dynamic expression lines. Microneedling works on skin texture and the skin’s repair response. They address different concerns and may be discussed separately or as part of a broader plan.'
  },
  {
    q: 'What should men use after a professional skin treatment?',
    a: 'Post-treatment care depends on the procedure. The practice should provide specific instructions after your appointment. In general, use the recommended gentle cleanser and barrier-support products, avoid adding unapproved exfoliants too quickly, and follow the provider’s guidance on sun protection and activity.'
  },
  {
    q: 'Where can men get a facial or microneedling in Loveland?',
    a: 'The Med Bar provides customized facials, PRF microneedling, LED light therapy, and related aesthetic services in Loveland, Colorado. Booking is available through the treatment menu, where each service includes its duration and current pricing.'
  }
];

function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(faq => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a }
    }))
  };
}

function RoutineDiagram() {
  return (
    <div className="sf-men-routine-graphic">
      <svg viewBox="0 0 900 250" role="img" aria-labelledby="routine-diagram-title routine-diagram-desc">
        <title id="routine-diagram-title">A four-step men&apos;s skincare routine</title>
        <desc id="routine-diagram-desc">Cleanse, treat, seal, and protect in that order.</desc>
        <defs>
          <linearGradient id="routine-line" x1="0" x2="1">
            <stop offset="0" stopColor="var(--gd-accent)" stopOpacity=".25" />
            <stop offset=".5" stopColor="var(--gd-accent)" />
            <stop offset="1" stopColor="var(--gd-accent)" stopOpacity=".25" />
          </linearGradient>
        </defs>
        <path d="M118 112 H782" stroke="url(#routine-line)" strokeWidth="2" strokeDasharray="5 8" />
        {[
          { x: 115, n: '01', title: 'Cleanse', sub: 'Remove the day' },
          { x: 338, n: '02', title: 'Treat', sub: 'Target the concern' },
          { x: 562, n: '03', title: 'Seal', sub: 'Support the barrier' },
          { x: 785, n: '04', title: 'Protect', sub: 'Keep the progress' }
        ].map(step => (
          <g key={step.n} className="sf-men-routine-node">
            <circle cx={step.x} cy="112" r="39" fill="var(--gd-surface)" stroke="var(--gd-accent)" strokeWidth="1.5" />
            <circle cx={step.x} cy="112" r="28" fill="none" stroke="var(--gd-accent)" strokeOpacity=".25" />
            <text x={step.x} y="108" textAnchor="middle" className="sf-men-routine-num">{step.n}</text>
            <text x={step.x} y="119" textAnchor="middle" className="sf-men-routine-dot">•</text>
            <text x={step.x} y="180" textAnchor="middle" className="sf-men-routine-title">{step.title}</text>
            <text x={step.x} y="201" textAnchor="middle" className="sf-men-routine-sub">{step.sub}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function ConcernMap() {
  return (
    <div className="sf-men-concern-map">
      <svg viewBox="0 0 800 340" role="img" aria-labelledby="concern-map-title concern-map-desc">
        <title id="concern-map-title">Men&apos;s skin health concern map</title>
        <desc id="concern-map-desc">Different concerns connect to different home-care and professional treatment paths.</desc>
        <path d="M400 170 L155 75 M400 170 L645 75 M400 170 L155 265 M400 170 L645 265" stroke="var(--gd-border-strong)" strokeWidth="1.5" />
        <circle cx="400" cy="170" r="72" fill="var(--gd-surface)" stroke="var(--gd-accent)" strokeWidth="2" />
        <text x="400" y="164" textAnchor="middle" className="sf-men-map-main">SKIN</text>
        <text x="400" y="187" textAnchor="middle" className="sf-men-map-main">HEALTH</text>
        <g className="sf-men-map-card">
          <rect x="42" y="35" width="225" height="80" rx="10" />
          <text x="60" y="65" className="sf-men-map-title">Barrier &amp; dryness</text>
          <text x="60" y="90" className="sf-men-map-copy">Cleanse · hydrate · protect</text>
        </g>
        <g className="sf-men-map-card">
          <rect x="533" y="35" width="225" height="80" rx="10" />
          <text x="551" y="65" className="sf-men-map-title">Texture &amp; scars</text>
          <text x="551" y="90" className="sf-men-map-copy">Facials · microneedling · PRF</text>
        </g>
        <g className="sf-men-map-card">
          <rect x="42" y="225" width="225" height="80" rx="10" />
          <text x="60" y="255" className="sf-men-map-title">Oil &amp; congestion</text>
          <text x="60" y="280" className="sf-men-map-copy">Clarify · exfoliate · LED</text>
        </g>
        <g className="sf-men-map-card">
          <rect x="533" y="225" width="225" height="80" rx="10" />
          <text x="551" y="255" className="sf-men-map-title">Expression lines</text>
          <text x="551" y="280" className="sf-men-map-copy">Consultation · Jeuveau</text>
        </g>
      </svg>
    </div>
  );
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) return { title: 'Not found' };

  return {
    title: 'Men’s Skincare & Skin Health in Loveland, CO',
    description: 'Men’s skincare, microneedling, PRF, facials, LED light therapy, and Jeuveau in Loveland, CO. Build a practical skin-health routine at The Med Bar.',
    alternates: { canonical: '/mens-skin-care' },
    robots: clinic.live ? { index: true, follow: true } : { index: false, follow: false }
  };
}

export default async function MensSkinCarePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const links = storefrontLinks(await storefrontBase(slug));
  const [services, products] = await Promise.all([
    getStorefrontServices(clinic.id),
    getStorefrontProducts(clinic.id)
  ]);

  const featuredServices = services.filter(service =>
    /microneedl|facial|led|jeuveau|neurotoxin/i.test(service.name)
  ).slice(0, 6);
  const routineProducts = products.filter(product =>
    /clean|serum|moistur|spf|retinal|eye|facial oil/i.test(`${product.name} ${product.category}`)
  ).slice(0, 6);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }} />

      <header className="sf-hero sf-bordered">
        <div className="sf-wrap">
          <div className="sf-hero-crumbs">
            <Link href={links.home}>Home</Link>
            <span aria-hidden="true">/</span>
            <span>Men’s Skin Health</span>
          </div>
          <div className="sf-hero-lead">
            <div className="sf-eyebrow">The Med Bar · Loveland, Colorado</div>
            <h1 className="sf-display">
              <span className="ln"><span>Men’s skin health,</span></span>
              <span className="ln"><span className="sf-italic">without the guesswork.</span></span>
            </h1>
            <p className="sf-lede">
              A practical skincare approach for men dealing with dryness, oil, shaving irritation,
              acne scars, uneven texture, fine lines, or skin that simply looks tired.
            </p>
            <div className="sf-actions">
              <Link href={links.book} className="sf-btn primary">Book a skin consultation</Link>
              <Link href={links.services} className="sf-btn ghost">Explore treatments</Link>
            </div>
          </div>
        </div>
      </header>

      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">A simple starting point</div>
            <h2>A men’s skincare routine should be useful before it is complicated.</h2>
            <p>
              Good skin health is not about owning the most products. It is about using the right
              steps consistently, then adding professional treatment when home care alone cannot
              address the concern.
            </p>
          </div>

          <div className="sf-pillars-grid">
            <article className="sf-pillar-card">
              <span className="sf-pillar-num">01</span>
              <h3>Clean without stripping</h3>
              <p>Choose a cleanser that removes sweat, sunscreen, oil, and daily buildup without leaving the skin tight or irritated after washing.</p>
            </article>
            <article className="sf-pillar-card">
              <span className="sf-pillar-num">02</span>
              <h3>Treat the actual concern</h3>
              <p>Texture, acne scars, dullness, puffiness, and expression lines are different concerns. The treatment should match the reason you came in.</p>
            </article>
            <article className="sf-pillar-card">
              <span className="sf-pillar-num">03</span>
              <h3>Protect the result</h3>
              <p>Moisturizer and daily broad-spectrum SPF help support the skin barrier and protect the progress made through professional care.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="sf-section sf-bordered sf-invert">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">The order matters</div>
            <h2>Four steps. One routine you can actually keep.</h2>
            <p>
              The goal is not a crowded bathroom shelf. It is a sequence that makes sense,
              protects the barrier, and leaves room for professional care when the concern calls for it.
            </p>
          </div>
          <RoutineDiagram />
        </div>
      </section>

      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Start with the concern</div>
            <h2>Skin health is not one-size-fits-all.</h2>
            <p>
              The same routine does not solve every problem. Use the map as a starting point,
              then let a consultation decide what belongs in your plan.
            </p>
          </div>
          <ConcernMap />
        </div>
      </section>

      <section className="sf-section sf-bordered sf-invert">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Professional skin treatments</div>
            <h2>When skincare needs more than another product.</h2>
            <p>
              A consultation helps separate a home-routine question from a treatment question.
              The Med Bar’s menu includes options for skin quality, texture, expression lines,
              and recovery support.
            </p>
          </div>

          <div className="sf-paired-services-grid">
            {featuredServices.map(service => (
              <article className="sf-paired-service-card" key={service.id}>
                <div className="sf-paired-head">
                  <div className="sf-item-icon-box" aria-hidden="true">
                    <ServiceIcon name={service.name} category={service.category} />
                  </div>
                  <div>
                    <h3 className="sf-paired-card-title">{service.name}</h3>
                    <span className="sf-paired-card-meta">{service.duration_min} min</span>
                  </div>
                </div>
                {service.description && <p className="sf-paired-desc">{service.description}</p>}
                <div className="sf-paired-foot">
                  <span className="sf-paired-price">{priceLabel(service)}</span>
                  <Link href={`${links.book}?service=${encodeURIComponent(service.id)}`} className="sf-item-reserve">Book &rarr;</Link>
                </div>
              </article>
            ))}
          </div>

          <div className="sf-actions" style={{ marginTop: 'var(--gd-8)' }}>
            <Link href={links.services} className="sf-btn ghost">See the full treatment menu</Link>
          </div>
        </div>
      </section>

      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">The home-care layer</div>
            <h2>Build the routine around the treatment.</h2>
            <p>
              Professional care works best when the daily routine is simple enough to follow.
              These products are selected from the retail line used in the studio; your provider
              can help decide what belongs in your routine and when to use it.
            </p>
          </div>

          <div className="sf-grid">
            {routineProducts.map(product => (
              <Link className="sf-card" key={product.id} href={`${links.shop}/${product.slug}`}>
                <div className="sf-card-img">
                  {product.image_path
                    ? <img src={product.image_path} alt={product.name} loading="lazy" />
                    : <span aria-hidden="true">{product.name.slice(0, 1)}</span>}
                </div>
                <div className="sf-card-body">
                  {product.brand && <div className="sf-card-brand">{product.brand}</div>}
                  <h3>{product.name}</h3>
                  {product.description && <p className="sf-card-desc">{product.description}</p>}
                </div>
                <div className="sf-card-foot">
                  <span className="sf-card-price">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.price_cents / 100)}</span>
                  <span className="sf-chip">View &rarr;</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="sf-actions" style={{ marginTop: 'var(--gd-8)' }}>
            <Link href={links.shop} className="sf-btn primary">Shop the full skincare line</Link>
          </div>
        </div>
      </section>

      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Men’s skincare in Loveland</div>
            <h2>Common questions about men’s skin health</h2>
          </div>
          <div className="sf-product-accordions">
            {FAQS.map(faq => (
              <details className="sf-accordion" key={faq.q}>
                <summary>
                  <span>{faq.q}</span>
                  <span className="sf-accordion-arrow" aria-hidden="true" />
                </summary>
                <div className="sf-accordion-body"><p>{faq.a}</p></div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="sf-section sf-centre">
        <div className="sf-wrap">
          <h2 className="sf-display-sm">Start with a skin-health conversation.</h2>
          <p className="sf-lede centre">
            Bring the products you already use, the concerns you want to change, and the questions
            you have been putting off. We will talk through what is realistic and what belongs in a plan.
          </p>
          <div className="sf-actions centre">
            <Link href={links.book} className="sf-btn primary">Book a consultation</Link>
            <Link href={links.services} className="sf-btn ghost">View services and pricing</Link>
          </div>
        </div>
      </section>
    </>
  );
}
