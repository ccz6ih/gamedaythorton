/**
 * app/c/[slug]/scar-revision/page.tsx
 *
 * Dedicated Guide: Inkless Paramedical Scar & Stretch Mark Revision with NUE Conceal.
 *
 * WHY THIS PAGE EXISTS
 * "Inkless scar revision Northern Colorado", "paramedical tattoo Loveland CO",
 * "stretch mark revision before and after", and "NUE conceal scar treatment"
 * are high-ticket, high-search-intent terms with almost zero quality competition in
 * the Loveland / Fort Collins / Northern Colorado area.
 *
 * This guide explains how inkless revision works (serum infusion vs pigment tattoo),
 * the biochemistry of NUE Regen & NUE Bright, what scars are treatable (C-section,
 * tummy tuck, stretch marks, trauma), and healing phases.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront, getStorefrontServices } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { ScarRevisionExplorer } from '@/components/ScarRevisionExplorer';
import { priceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) return { title: 'Not found' };

  return {
    title: 'Inkless Scar & Stretch Mark Revision in Loveland, CO | NUE Conceal Paramedical Guide',
    description:
      'Learn about inkless paramedical scar and stretch mark revision at The Med Bar in Loveland, CO. Using NUE Conceal bio-serums to naturally remodel collagen and repigment skin.'
  };
}

const SCAR_FAQS = [
  {
    q: 'What is the difference between inkless scar revision and camouflage tattooing?',
    a: 'Traditional camouflage tattooing implants colored ink pigments into the scar to match surrounding skin tone. However, tattoo pigments can oxidize, shift in color over time (turning yellow, orange, or grey), and cannot tan when your skin is exposed to the sun. Inkless scar revision adds no pigment at all; instead it delivers the NUE Regen and NUE Bright professional serums, which are intended to support your body’s own fibroblasts and melanocytes to rebuild flexible collagen and restore natural melanin production from within.'
  },
  {
    q: 'What types of scars and stretch marks can be treated with inkless revision?',
    a: 'Inkless revision is highly effective on mature surgical scars (C-section, abdominoplasty/tummy tuck, breast reduction/augmentation, orthopedic incisions), injury/trauma scars, burn scars, and stretch marks (striae albae and striae rubrae) on the abdomen, hips, thighs, glutes, and breasts. Scars must be fully healed and mature (typically at least 9–12 months old).'
  },
  {
    q: 'How many sessions are required, and when will I see results?',
    a: 'How many sessions a scar needs depends on the scar, and the plan is set with you at consultation. Because the work relies on the skin remodelling itself rather than on pigment being deposited, changes appear gradually over the weeks after each session rather than immediately.'
  },
  {
    q: 'Is inkless scar revision painful?',
    a: 'Discomfort is typically minimal. A professional topical numbing anesthetic is applied before the procedure to ensure you are comfortable. Most clients describe the sensation as a light scratching or vibrating feeling.'
  },
  {
    q: 'What does the healing process look like after a session?',
    a: 'Immediately after the procedure, the treated scar or stretch marks will appear pink or red and slightly raised (resembling a mild scratch or cat scratch). This acute erythema and minor flaking lasts 5 to 10 days. Over the subsequent 4 to 8 weeks, the redness fades as new collagen softens the texture and natural skin pigment fills in.'
  },
  {
    q: 'How does NUE Regen compare to NUE Bright?',
    a: 'NUE Regen is a cell renewal complex packed with multi-peptides, hyaluronic acid, and botanical growth factors formulated to soften dense scar tissue, flatten raised borders, and rebuild elastin in stretch marks. NUE Bright is formulated with botanical tyrosinase inhibitors and plant brighteners specifically designed to safely lighten hyperpigmented, dark, or discolored scars.'
  }
];

export default async function ScarRevisionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const links = storefrontLinks(await storefrontBase(slug));
  const services = await getStorefrontServices(clinic.id);
  const paramedicalServices = services.filter((s) => s.category === 'paramedical');
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://www.medbarco.com';

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: SCAR_FAQS.map((f) => ({
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
      { '@type': 'ListItem', position: 3, name: 'Inkless Scar Revision Guide', item: `${base}/scar-revision` }
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
            <span>Inkless Scar Revision</span>
          </div>

          <div className="sf-hero-lead">
            <div className="sf-eyebrow">Paramedical Esthetics · Loveland, Colorado</div>
            <h1 className="sf-display">
              <span className="ln"><span>The Definitive Guide to</span></span>
              <span className="ln"><span className="sf-italic">Inkless Scar &amp; Stretch Mark Revision.</span></span>
            </h1>
            <p className="sf-lede">
              Advanced paramedical tattoo therapy using NUE Conceal botanical bio-serums. Remodeling dense scar tissue,
              restoring dermal elasticity, and awakening natural melanin without synthetic pigment tattoo inks.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="sf-matrix-stats">
            <div className="sf-matrix-stat">
              <span className="val">0%</span>
              <span className="lbl">Pigment Ink (Never Oxidizes)</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">2–4</span>
              <span className="lbl">Average Protocol Sessions</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">100%</span>
              <span className="lbl">Natural Melanin Stimulation</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">Permanent</span>
              <span className="lbl">Structural Collagen Remodeling</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Scar Explorer */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <ScarRevisionExplorer bookUrl={links.book} />
        </div>
      </section>

      {/* Inkless Revision vs. Camouflage Tattooing */}
      <section className="sf-section sf-bordered sf-invert">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Paramedical Science</div>
            <h2>Why inkless serum revision is the superior approach</h2>
            <p>
              Traditional cosmetic tattooing hides scars with colored ink; inkless paramedical revision restores
              the biological tissue so your own skin matches itself naturally.
            </p>
          </div>

          <div className="sf-editorial-cards">
            <article className="sf-editorial-card">
              <span className="sf-editorial-tag">Critical Difference 01</span>
              <h3>No Discoloration or Ink Oxidation</h3>
              <p>
                Tattoo pigments contain heavy minerals (titanium dioxide, iron oxides) that degrade under UV light,
                turning yellow, green, or chalky white after a few summers. Inkless revision uses <b>zero ink</b>,
                eliminating any risk of future color shift.
              </p>
            </article>

            <article className="sf-editorial-card">
              <span className="sf-editorial-tag">Critical Difference 02</span>
              <h3>Tans Naturally with Sun Exposure</h3>
              <p>
                Tattoo ink blocks sunlight, leaving a permanent white mask when surrounding skin tans. Because inkless
                revision activates your body’s own melanocytes, your revised scar tissue produces genuine melanin and
                tans in harmony with your natural skin.
              </p>
            </article>

            <article className="sf-editorial-card">
              <span className="sf-editorial-tag">Critical Difference 03</span>
              <h3>Softens Rigid Fibrous Texture</h3>
              <p>
                Tattooing color does not improve the stiff, bumpy, or hollow texture of a scar. NUE Regen bio-serums
                break down rigid keloid/hypertrophic collagen bundles, replacing them with smooth, pliable type I and III
                collagen fibers.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Sizing & Treatment Menu */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Paramedical Menu</div>
            <h2>Area sizing &amp; pricing structure</h2>
            <p>
              Sessions are customized based on the surface area and complexity of the scar tissue.
            </p>
          </div>

          <div className="sf-facial-full-grid">
            {paramedicalServices.map((s) => (
              <article className="sf-facial-card" key={s.id}>
                <div className="sf-facial-card-head">
                  <span className="sf-facial-badge">Paramedical Tattoo</span>
                  <h3 className="sf-facial-name">{s.name}</h3>
                  {s.description && <p className="sf-facial-summary">{s.description}</p>}
                </div>

                {s.details && (
                  <div className="sf-altitude-callout" style={{ marginTop: 'var(--gd-3)' }}>
                    <span className="sf-altitude-label">✦ Protocol Breakdown:</span>
                    <p className="sf-altitude-text">{s.details}</p>
                  </div>
                )}

                <div className="sf-facial-card-foot">
                  <div className="sf-facial-meta">
                    <span className="sf-facial-price">{priceLabel(s)}</span>
                    <span className="sf-facial-dur">{s.duration_min} min</span>
                  </div>
                  <Link href={`${links.book}?service=${encodeURIComponent(s.id)}`} className="sf-btn primary">
                    Reserve &rarr;
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 4-Phase Healing Timeline */}
      <section className="sf-section sf-bordered sf-invert">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Recovery Trajectory</div>
            <h2>The 4-phase inkless healing timeline</h2>
            <p>What to expect as your body repairs and repigments scar tissue over 60 to 90 days.</p>
          </div>

          <div className="sf-timeline">
            <div className="sf-timeline-item">
              <span className="sf-timeline-marker" />
              <div className="sf-timeline-head">
                <span className="sf-timeline-phase">Phase 1 · Acute Inflammatory Response</span>
                <span className="sf-timeline-duration">Days 1 to 4</span>
              </div>
              <h3 className="sf-timeline-title">Erythema &amp; Micro-Puncture Sealing</h3>
              <p className="sf-timeline-body">
                The treated scar appears reddish-pink and slightly swollen, resembling a minor scratch.
                The micro-channels close within 24 hours while NUE bio-serums begin cellular signaling. Keep dry for 24 hours.
              </p>
            </div>

            <div className="sf-timeline-item">
              <span className="sf-timeline-marker" />
              <div className="sf-timeline-head">
                <span className="sf-timeline-phase">Phase 2 · Epithelial Migration &amp; Flaking</span>
                <span className="sf-timeline-duration">Days 5 to 14</span>
              </div>
              <h3 className="sf-timeline-title">Micro-Crusting &amp; Cellular Turnover</h3>
              <p className="sf-timeline-body">
                A fine, thin micro-crust forms over the treated area. Apply recommended aftercare balm to maintain hydration.
                Do not pick or scratch; allow dead surface cells to shed naturally to reveal fresh pink tissue beneath.
              </p>
            </div>

            <div className="sf-timeline-item">
              <span className="sf-timeline-marker" />
              <div className="sf-timeline-head">
                <span className="sf-timeline-phase">Phase 3 · Neocollagenesis &amp; Tissue Softening</span>
                <span className="sf-timeline-duration">Weeks 3 to 6</span>
              </div>
              <h3 className="sf-timeline-title">Collagen Remodeling &amp; Flattening</h3>
              <p className="sf-timeline-body">
                Fibroblasts produce fresh, organized collagen fibers. The rigid, raised borders of surgical scars soften and
                stretch mark depressions begin to fill out from beneath.
              </p>
            </div>

            <div className="sf-timeline-item">
              <span className="sf-timeline-marker" />
              <div className="sf-timeline-head">
                <span className="sf-timeline-phase">Phase 4 · Melanin Migration &amp; Stabilization</span>
                <span className="sf-timeline-duration">Weeks 6 to 10</span>
              </div>
              <h3 className="sf-timeline-title">Tone Blending &amp; Permanent Maturation</h3>
              <p className="sf-timeline-body">
                Dormant melanocytes at the scar borders migrate into the newly vascularized tissue. Natural skin pigment
                blends seamlessly into surrounding skin tone. Ready for next session if further revision is desired.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comprehensive FAQs */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Client Inquiries</div>
            <h2>Frequently asked questions about scar revision</h2>
            <p>Clear clinical guidance on candidacy, pre-treatment preparation, and aftercare.</p>
          </div>

          <div className="sf-faq-grid">
            {SCAR_FAQS.map((faq, idx) => (
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

      {/* Booking CTA Banner */}
      <section className="sf-section sf-bordered sf-invert">
        <div className="sf-wrap">
          <div className="sf-story-outro">
            <span className="sf-story-outro-ornament">✦ ✦ ✦</span>
            <h3>Schedule your scar revision assessment</h3>
            <p>
              Every scar is unique. Start with a complimentary 15-minute consultation to evaluate your scar maturity,
              depth, and custom treatment plan.
            </p>
            <div style={{ display: 'flex', gap: 'var(--gd-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link href={`${links.book}?service=68ea65e5-3598-5f10-93f2-6b886a8f9021`} className="sf-btn ghost">
                Free 15-Min Consult &rarr;
              </Link>
              <Link href={`${links.book}?service=2909d933-4de7-560b-810b-cd22d9be475b`} className="sf-btn primary">
                Book Paramedical Session &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
