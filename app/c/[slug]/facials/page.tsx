/**
 * app/c/[slug]/facials/page.tsx
 *
 * Dedicated Guide: Clinical Facials & The Colorado Altitude Skin Directory.
 *
 * WHY THIS PAGE EXISTS
 * "Facials Loveland CO", "hydrodermabrasion Loveland", "dermaplaning facial Northern Colorado",
 * and "Colorado high altitude skincare" are high-intent search queries.
 *
 * Northern Colorado sits at 5,000+ feet altitude with low humidity (15–25%) and intense UV.
 * This guide connects skin physiology at altitude (TEWL, lipid depletion, barrier breakdown)
 * with The Med Bar's full directory of 9 clinical facial protocols and provides an interactive
 * skin concern finder.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront, getStorefrontServices } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { FacialDiagnosticFinder } from '@/components/FacialDiagnosticFinder';
import { ServiceIcon } from '@/components/ServiceIcon';
import { priceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) return { title: 'Not found' };

  return {
    title: 'Clinical Facials in Loveland, CO | Colorado Altitude Skincare Directory',
    description:
      'Explore customized clinical facials at The Med Bar in Loveland, CO. Hydroboration, Dermaplaning, Nano Infusion, Lactic Peels, and Acne Protocols designed for Colorado skin.'
  };
}

const FACIAL_FAQS = [
  {
    q: 'Why does living in Colorado (5,000+ ft altitude) require specialized clinical facials?',
    a: 'Northern Colorado’s high-desert environment combines low atmospheric humidity (often 15–25%), rapid barometric pressure shifts, and 25% higher UV radiation than sea level. This accelerates Transepidermal Water Loss (TEWL), depletes natural lipid ceramides, and thickens the outer stratum corneum with dead, dehydrated cells. Regular clinical facials like Hydroboration and Dermaplaning clear this build-up and infuse deep hydration directly into living cells.'
  },
  {
    q: 'What is the difference between Hydroboration and traditional microdermabrasion?',
    a: 'Traditional microdermabrasion uses dry abrasive crystals or diamond tips that can pull and irritate dry or sensitive skin. Hydroboration (fluid vortex hydradermabrasion) uses simultaneous liquid suction: it vacuums blackheads and dead cells while simultaneously drenching the pore with pressurized hyaluronic acid, peptides, and botanical antioxidants. You get deeper cleansing with zero irritation, zero scratching, and zero redness.'
  },
  {
    q: 'Will dermaplaning cause my facial hair (peach fuzz) to grow back thicker or darker?',
    a: 'No. This is a common myth. Dermaplaning removes vellus hair (fine peach fuzz) from the skin surface without affecting the hair follicle or bulb located beneath the dermis. Vellus hair regrows at the exact same rate, texture, color, and thickness as before.'
  },
  {
    q: 'How does Nano Infusion differ from Microneedling with PRF?',
    a: 'PRF Microneedling uses surgical-grade micro-needles that penetrate into the living dermis to trigger genuine collagen induction and platelet growth factor absorption (with 24–48 hours of mild pinkness). Nano Infusion uses microscopic silicone pyramids that only create pathways in the dead stratum corneum. It boosts topical serum absorption by up to 97% with zero needles, zero pain, and zero downtime.'
  },
  {
    q: 'How often should I receive a clinical facial at The Med Bar?',
    a: 'Because cellular turnover at adult age takes approximately 28 to 40 days, a monthly facial (every 4 to 6 weeks) is ideal to clear dead cell accumulation, decongest pores, and reinforce the lipid moisture barrier. For active acne clearing, an initial series spaced 2 to 3 weeks apart may be recommended.'
  },
  {
    q: 'Are your facials customized with clean, botanical ingredients?',
    a: 'Yes. All facials at The Med Bar utilize professional-grade, non-toxic Green Envee botanical formulations. They are crafted without artificial dyes, synthetic fragrances, parabens, or harsh sulfates, and are certified cruelty-free by Leaping Bunny.'
  }
];

export default async function FacialsDirectoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const links = storefrontLinks(await storefrontBase(slug));
  const services = await getStorefrontServices(clinic.id);
  const facialServices = services.filter((s) => s.category === 'facials');
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://www.medbarco.com';

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FACIAL_FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };

  const breadcrumbsSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}${links.home}` },
      { '@type': 'ListItem', position: 2, name: 'Services', item: `${base}${links.services}` },
      { '@type': 'ListItem', position: 3, name: 'Clinical Facials Guide', item: `${base}/facials` }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsSchema) }}
      />

      {/* Hero */}
      <section className="sf-hero sf-bordered">
        <div className="sf-wrap">
          <div className="sf-hero-crumbs">
            <Link href={links.home}>Home</Link>
            <span aria-hidden="true">/</span>
            <Link href={links.services}>Services</Link>
            <span aria-hidden="true">/</span>
            <span>Clinical Facials</span>
          </div>

          <div className="sf-hero-lead">
            <div className="sf-eyebrow">Clinical Esthetics · Loveland, Colorado</div>
            <h1 className="sf-display">
              <span className="ln"><span>Clinical Facials &amp;</span></span>
              <span className="ln"><span className="sf-italic">Colorado Altitude Skincare.</span></span>
            </h1>
            <p className="sf-lede">
              Customized botanical treatments engineered for high-altitude skin. Restoring cellular hydration,
              decongesting stubborn pores, and rebuilding the lipid barrier against dry Rocky Mountain climate.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="sf-matrix-stats">
            <div className="sf-matrix-stat">
              <span className="val">9</span>
              <span className="lbl">Clinical Protocols</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">5,000+ ft</span>
              <span className="lbl">Altitude Engineered</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">+60–97%</span>
              <span className="lbl">Active Nutrient Uptake</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">100%</span>
              <span className="lbl">Clean Botanical Actives</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Facial Diagnostic Finder */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <FacialDiagnosticFinder bookUrl={links.book} />
        </div>
      </section>

      {/* The 5,000-Foot Colorado Altitude Factor */}
      <section className="sf-section sf-bordered sf-invert">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Regional Dermatology</div>
            <h2>Why Colorado skin behaves differently</h2>
            <p>
              Living in Loveland, Fort Collins, and Northern Colorado exposes your skin to physiological
              stress factors rarely encountered at lower elevations.
            </p>
          </div>

          <div className="sf-editorial-cards">
            <article className="sf-editorial-card">
              <span className="sf-editorial-tag">Factor 01 · 15–25% Humidity</span>
              <h3>Accelerated TEWL (Water Loss)</h3>
              <p>
                In dry mountain air, moisture is constantly drawn out of the skin via <b>Transepidermal Water Loss (TEWL)</b>.
                Without professional fluid-infusion and barrier sealing, cells shrink and dehydrate, causing fine lines and tightness.
              </p>
            </article>

            <article className="sf-editorial-card">
              <span className="sf-editorial-tag">Factor 02 · Thickened Dead Layer</span>
              <h3>Cellular Hyperkeratinization</h3>
              <p>
                In response to dry wind and high-altitude UV, the skin overproduces dead stratum corneum cells. This creates a dull,
                rough texture that traps sebum beneath, causing rebound blackheads and preventing home skincare from absorbing.
              </p>
            </article>

            <article className="sf-editorial-card">
              <span className="sf-editorial-tag">Factor 03 · 25% Higher UV Index</span>
              <h3>Photo-Oxidation &amp; Lipid Depletion</h3>
              <p>
                UV radiation increases roughly 4–5% per 1,000 feet of elevation. Colorado skin experiences continuous free-radical
                stress, requiring high-potency topical antioxidants (polyphenols, vitamins C &amp; E) and barrier-repair ceramides.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Complete 9-Facial Clinical Directory */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Treatment Directory</div>
            <h2>The Med Bar facial menu</h2>
            <p>Every clinical facial offered at our Loveland studio, with pricing, timing, and clinical focus.</p>
          </div>

          <div className="sf-facial-full-grid">
            {facialServices.map((s) => (
              <article className="sf-facial-card" key={s.id}>
                <div className="sf-facial-card-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div className="sf-item-icon-box" aria-hidden="true" style={{ width: '2.5rem', height: '2.5rem' }}>
                      <ServiceIcon name={s.name} category={s.category} />
                    </div>
                    <div>
                      <h3 className="sf-facial-name" style={{ margin: 0 }}>{s.name}</h3>
                      <span className="sf-paired-card-meta">{s.duration_min} min · Clinical Protocol</span>
                    </div>
                  </div>
                  {s.description && <p className="sf-facial-summary">{s.description}</p>}
                </div>

                {s.details && (
                  <div className="sf-altitude-callout" style={{ marginTop: 'var(--gd-3)' }}>
                    <span className="sf-altitude-label">✦ Clinical Protocol Breakdown:</span>
                    <p className="sf-altitude-text">{s.details}</p>
                  </div>
                )}

                <div className="sf-facial-card-foot">
                  <div className="sf-facial-meta">
                    <span className="sf-facial-price">{priceLabel(s)}</span>
                    <span className="sf-facial-dur">{s.duration_min} min</span>
                  </div>
                  <Link href={`${links.book}?service=${encodeURIComponent(s.id)}`} className="sf-btn sf-btn-primary">
                    Reserve &rarr;
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Modality Comparison Table */}
      <section className="sf-section sf-bordered sf-invert">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Modality Comparison</div>
            <h2>Comparing facial exfoliation &amp; infusion methods</h2>
            <p>Understand how each advanced clinical technology targets different layers of the skin.</p>
          </div>

          <div className="sf-matrix-wrapper" role="region" aria-label="Facial Modalities Comparison" tabIndex={0}>
            <table className="sf-matrix-table">
              <thead>
                <tr>
                  <th scope="col">Modality</th>
                  <th scope="col">Mechanism</th>
                  <th scope="col">Primary Target</th>
                  <th scope="col">Absorption Boost</th>
                  <th scope="col">Downtime</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row"><b>Hydroboration</b></th>
                  <td>Fluid vortex vacuum suction + fluid pressure</td>
                  <td>Clogged pores, blackheads, cellular dehydration</td>
                  <td>High (direct fluid drenching)</td>
                  <td>Zero downtime</td>
                </tr>
                <tr>
                  <th scope="row"><b>Dermaplaning</b></th>
                  <td>Sterile surgical blade physical exfoliation</td>
                  <td>Dead stratum corneum &amp; vellus peach fuzz</td>
                  <td>+60% active absorption</td>
                  <td>Zero downtime</td>
                </tr>
                <tr>
                  <th scope="row"><b>Nano Infusion</b></th>
                  <td>Microscopic transdermal silicone channels</td>
                  <td>Deep serum delivery without piercing dermis</td>
                  <td>+97% active absorption</td>
                  <td>Zero downtime</td>
                </tr>
                <tr>
                  <th scope="row"><b>Lactic Acid 20% Peel</b></th>
                  <td>AHA humectant chemical exfoliation</td>
                  <td>Uneven tone, sun spots, dry flaking</td>
                  <td>Moderate</td>
                  <td>Zero to mild flaking</td>
                </tr>
                <tr>
                  <th scope="row"><b>RF Skin Tightening</b></th>
                  <td>Controlled deep dermal radiofrequency heat</td>
                  <td>Collagen fiber contraction &amp; jawline contouring</td>
                  <td>N/A (Thermal remodeling)</td>
                  <td>Zero downtime</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Comprehensive FAQs */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Client Inquiries</div>
            <h2>Frequently asked questions about clinical facials</h2>
            <p>Expert guidance on preparation, facial selection, frequency, and aftercare.</p>
          </div>

          <div className="sf-faq-grid">
            {FACIAL_FAQS.map((faq, idx) => (
              <details className="sf-faq-item" key={idx}>
                <summary className="sf-faq-question">
                  <span>{faq.q}</span>
                  <span className="sf-faq-arrow" aria-hidden="true" />
                </summary>
                <div className="sf-faq-answer">
                  <p>{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Outro CTA */}
      <section className="sf-section sf-bordered sf-invert">
        <div className="sf-wrap">
          <div className="sf-story-outro">
            <span className="sf-story-outro-ornament">✦ ✦ ✦</span>
            <h3>Recharge your skin at The Med Bar in Loveland</h3>
            <p>
              Book your customized clinical facial today, or start with a complimentary 15-minute consultation
              to design your personalized Colorado skincare roadmap.
            </p>
            <div style={{ display: 'flex', gap: 'var(--gd-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link href={`${links.book}?service=68ea65e5-3598-5f10-93f2-6b886a8f9021`} className="sf-btn sf-btn-ghost">
                Free 15-Min Consult &rarr;
              </Link>
              <Link href={links.services} className="sf-btn sf-btn-primary">
                Explore Treatment Menu &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
