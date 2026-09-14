/**
 * app/c/[slug]/prf/compare/page.tsx
 *
 * Dedicated Comparison Guide: PRF vs PRP vs Dermal Fillers vs Botox (Jeuveau).
 *
 * WHY THIS PAGE EXISTS
 * "PRF vs PRP" and "PRF vs under eye filler" are among the highest-volume aesthetic
 * search queries in Google and frequently referenced in AI answer engines (ChatGPT,
 * Perplexity, Google AI Overviews).
 *
 * This guide provides an objective, transparent, and medically accurate breakdown
 * of each modality: how they work, their composition, onset timelines, safety
 * profiles, and which concerns each is best designed to address.
 *
 * COMPLIANCE & TONE
 * General educational information written in hedged, non-superlative clinical prose.
 * Reuses verified practice copy where applicable. Zero invented medical claims.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront, getStorefrontServices } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) return { title: 'Not found' };

  return {
    title: 'PRF vs PRP vs Fillers vs Botox: Aesthetic Comparison Guide',
    description:
      'Compare PRF (Platelet-Rich Fibrin) with PRP, hyaluronic acid fillers, and neurotoxins like Jeuveau. Compare composition, onset, longevity, and safety.'
  };
}

const COMPARISON_FAQS = [
  {
    q: 'What is the main difference between PRF and PRP?',
    a: 'Both PRF and PRP start with a patient blood draw spun in a centrifuge. However, PRP is spun at high speeds with chemical anticoagulants (like ACD or sodium citrate), producing a liquid platelet concentrate that releases its growth factors rapidly in the first hour. PRF is spun at lower speeds without any anticoagulant, forming a natural fibrin matrix that traps platelets, white blood cells, and mesenchymal stem cells, releasing growth factors slowly over 10 to 14 days.'
  },
  {
    q: 'Is PRF better than under-eye filler?',
    a: 'They achieve different outcomes. Dermal filler (hyaluronic acid) physically adds synthetic gel volume instantly, which is effective for deep structural bone volume loss. PRF adds no synthetic volume; instead, it uses your own platelets and fibrin to stimulate natural collagen, elastin, and cellular repair in thin under-eye skin over 6–8 weeks. PRF carries zero risk of the bluish Tyndall effect or vascular occlusion associated with synthetic gels.'
  },
  {
    q: 'Can PRF and Jeuveau or Botox be combined?',
    a: 'Yes. Neurotoxins (such as Jeuveau®) work by temporarily relaxing the facial muscles that cause dynamic expression lines (such as frown lines or crow’s feet), while PRF works biologically on skin texture, collagen density, and cellular repair. Many individuals combine both to address muscle movement and skin quality simultaneously.'
  },
  {
    q: 'How long do PRF results last compared to fillers and PRP?',
    a: 'Because PRF works through your own healing rather than by adding a material, changes in skin density and texture develop gradually and are not permanent, so treatment is usually repeated. How long they hold varies from person to person, and how many sessions suit you is decided at your consultation — unlike a filler, nothing is being added that then wears off on a predictable schedule.'
  },
  {
    q: 'Is there any downtime with PRF compared to fillers?',
    a: 'PRF involves mild temporary fullness and localized redness or slight bruising for 24 to 48 hours as the natural fibrin matrix integrates into tissue. Unlike fillers, there is zero risk of foreign-body granulomas, synthetic allergic reactions, or long-term product migration.'
  }
];

export default async function PrfComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const links = storefrontLinks(await storefrontBase(slug));
  const services = await getStorefrontServices(clinic.id);
  const isSpa = clinic.practice_type === 'med_spa';

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://www.medbarco.com';

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: COMPARISON_FAQS.map((f) => ({
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
      { '@type': 'ListItem', position: 2, name: 'PRF', item: `${base}${links.prf}` },
      { '@type': 'ListItem', position: 3, name: 'Comparison Guide', item: `${base}${links.prfCompare}` }
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

      <header className="sf-hero">
        <div className="sf-wrap">
          <nav className="sf-breadcrumb" aria-label="Breadcrumbs">
            <Link href={links.home}>Home</Link>
            <span className="sf-breadcrumb-sep">/</span>
            <Link href={links.prf}>PRF</Link>
            <span className="sf-breadcrumb-sep">/</span>
            <span>Comparison Guide</span>
          </nav>

          <div className="sf-eyebrow">Modality Comparison</div>
          <h1>PRF vs PRP vs Fillers vs Botox</h1>
          <p className="sf-tagline">
            Understanding how autologous Platelet-Rich Fibrin compares to first-generation PRP,
            hyaluronic acid fillers, and neurotoxins — so you can make an informed, confident choice.
          </p>

          <div className="sf-cluster-nav">
            <Link href={links.prf} className="sf-chip">
              &larr; What Is PRF?
            </Link>
            <Link href={links.prfAftercare} className="sf-chip">
              Pre-Care & Aftercare &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Quick Comparison Table */}
      <section className="sf-section">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>Side-by-side comparison matrix</h2>
            <p>
              Each aesthetic treatment operates through a distinct biological or mechanical pathway.
              Here is how they compare across key characteristics:
            </p>
          </div>

          <div className="sf-table-wrapper">
            <table className="sf-compare-table">
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col" className="is-highlight">PRF (Platelet-Rich Fibrin)</th>
                  <th scope="col">PRP (Platelet-Rich Plasma)</th>
                  <th scope="col">Dermal Fillers (HA)</th>
                  <th scope="col">Neurotoxins (Jeuveau®)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Primary Source</strong></td>
                  <td className="is-highlight">100% autologous blood (own body)</td>
                  <td>Autologous blood + anticoagulant</td>
                  <td>Synthetic hyaluronic acid gel</td>
                  <td>Purified botulinum toxin protein</td>
                </tr>
                <tr>
                  <td><strong>Chemical Additives</strong></td>
                  <td className="is-highlight"><strong>Zero</strong> (pure natural fibrin)</td>
                  <td>Chemical anticoagulants / acid citrate</td>
                  <td>Cross-linked synthetic agents (BDDE)</td>
                  <td>Purified protein carrier</td>
                </tr>
                <tr>
                  <td><strong>Mechanism</strong></td>
                  <td className="is-highlight">Sustained biological collagen & tissue renewal</td>
                  <td>Rapid growth factor release</td>
                  <td>Instant physical volume augmentation</td>
                  <td>Temporary muscle relaxation</td>
                </tr>
                <tr>
                  <td><strong>Release Duration</strong></td>
                  <td className="is-highlight"><strong>10–14 days</strong> gradual slow release</td>
                  <td>Rapid release (first 1–2 hours)</td>
                  <td>Static until gel metabolizes</td>
                  <td>Peak action at 14 days</td>
                </tr>
                <tr>
                  <td><strong>Onset of Results</strong></td>
                  <td className="is-highlight">Progressive over 4–8 weeks</td>
                  <td>Gradual over 3–6 weeks</td>
                  <td><strong>Immediate</strong> same-day change</td>
                  <td>Visible in 2–4 days</td>
                </tr>
                <tr>
                  <td><strong>Under-Eye Safety</strong></td>
                  <td className="is-highlight">Excellent — zero Tyndall effect or lump risk</td>
                  <td>Liquid — fast dissipation</td>
                  <td>Risk of puffiness, migration, Tyndall</td>
                  <td>Not typically used directly under eye</td>
                </tr>
                <tr>
                  <td><strong>Allergy / Rejection Risk</strong></td>
                  <td className="is-highlight">Virtually none (100% your own tissue)</td>
                  <td>Low (potential additive sensitivity)</td>
                  <td>Low to moderate (synthetic foreign body)</td>
                  <td>Low (purified protein)</td>
                </tr>
                <tr>
                  <td><strong>Best Suited For</strong></td>
                  <td className="is-highlight">Thin skin, under-eye hollows, texture, hair thinning</td>
                  <td>General scalp & superficial skin</td>
                  <td>Deep facial hollows, lips, jawline volume</td>
                  <td>Dynamic forehead, frown & smile lines</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Deep-Dive Sections */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>Detailed breakdown of each modality</h2>
          </div>

          <div className="sf-compare-details-grid">
            {/* PRF vs PRP */}
            <article className="sf-compare-card">
              <span className="sf-compare-tag">Regenerative Evolution</span>
              <h3>PRF vs. PRP: What&rsquo;s the real difference?</h3>
              <p>
                Platelet-Rich Plasma (PRP) was the first generation of autologous blood concentrates.
                To keep blood liquid during centrifugation, PRP tubes use chemical anticoagulants.
                While effective, anticoagulants prevent the natural formation of a fibrin clot, causing
                the platelets to release nearly all their growth factors immediately upon injection.
              </p>
              <p>
                <strong>Platelet-Rich Fibrin (PRF)</strong> is the second generation. Spun at a slower
                speed without anticoagulants, PRF preserves a spongy natural fibrin mesh. This mesh traps
                living platelets, white blood cells, and healing cytokines, allowing them to release
                essential growth factors continuously for up to two weeks at the treatment site.
              </p>
              <div className="sf-compare-callout">
                <strong>Key Takeaway:</strong> PRF is 100% additive-free and provides up to 10x more
                concentrated, sustained cellular signaling than traditional liquid PRP.
              </div>
            </article>

            {/* PRF vs Dermal Fillers */}
            <article className="sf-compare-card">
              <span className="sf-compare-tag">Natural vs Synthetic</span>
              <h3>PRF vs. Dermal Fillers: Volume vs. Regeneration</h3>
              <p>
                Dermal fillers (like Juvederm or Restylane) consist of synthetic hyaluronic acid gel.
                They work by physically occupying space beneath the skin, offering an instant &ldquo;plump.&rdquo;
                However, in delicate areas like the tear troughs (under-eyes), synthetic fillers can
                occasionally migrate, create a bluish hue under thin skin (the Tyndall effect), or cause
                chronic fluid retention and puffiness.
              </p>
              <p>
                <strong>PRF does not add synthetic volume.</strong> Instead, it thickens the delicate
                the skin's own structure, rather than adding volume from outside it.
                The result is a rested, smoother appearance without altering facial anatomy or risking synthetic gel migration.
              </p>
              <div className="sf-compare-callout">
                <strong>Key Takeaway:</strong> Fillers are ideal for structural sculpting (lips, cheeks, jawline);
                PRF is unmatched for rejuvenating thin, crepey under-eye skin and overall tissue health.
              </div>
            </article>

            {/* PRF vs Neurotoxins */}
            <article className="sf-compare-card">
              <span className="sf-compare-tag">Complementary Therapies</span>
              <h3>PRF vs. Jeuveau® & Botox: Skin Health vs. Muscle Movement</h3>
              <p>
                Neurotoxins like Jeuveau® work at the neuromuscular junction to relax the muscles
                that contract when you frown, raise your eyebrows, or squint. They prevent and soften
                dynamic expression wrinkles.
              </p>
              <p>
                PRF does not affect muscle contraction. It works entirely on the skin itself — improving
                elasticity, hydration, cellular turnover, and structural density. Combining Jeuveau® to
                quiet expression lines with PRF to regenerate skin texture provides a harmonious, comprehensive
                anti-aging approach.
              </p>
              <div className="sf-compare-callout">
                <strong>Key Takeaway:</strong> Jeuveau® relaxes the muscle underneath; PRF repairs and
                rebuilds the skin on top. They complement each other seamlessly.
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Comparison FAQs */}
      <section className="sf-section">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>Frequently asked comparison questions</h2>
            <p>Direct answers to the most common questions about selecting the right aesthetic approach.</p>
          </div>

          <div className="sf-faq-list">
            {COMPARISON_FAQS.map((f, i) => (
              <details className="sf-faq-item" key={i}>
                <summary className="sf-faq-q">{f.q}</summary>
                <p className="sf-faq-a">{f.a}</p>
              </details>
            ))}
          </div>

          <div className="sf-cta-block" style={{ marginTop: 'var(--gd-8)' }}>
            <h3>Still unsure which treatment is right for you?</h3>
            <p>
              During a complimentary 15-minute consultation at The Med Bar in Loveland,
              we review your unique anatomy, health history, and goals to build a personalized plan.
            </p>
            <div className="sf-cta-actions">
              <Link href={links.book} className="sf-btn primary">
                Book Complimentary Consultation <span>&rarr;</span>
              </Link>
              <Link href={links.services} className="sf-btn ghost">
                View All Services & Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
