/**
 * app/c/[slug]/injectables/page.tsx
 *
 * Dedicated Guide: Precision Facial Musculature Architecture & Jeuveau® Neurotoxin.
 *
 * WHY THIS PAGE EXISTS
 * "Jeuveau vs Botox Loveland CO", "natural wrinkle relaxers Northern Colorado",
 * "neurotoxin facial anatomy", and "preventing frozen forehead botox" are high-intent
 * search queries with substantial AI citation value (ChatGPT, Perplexity, Google AI Overviews).
 *
 * This guide provides a clinical, transparent explanation of facial musculature mechanics,
 * explains why over-injecting creates the dreaded "frozen" look, and shows how The Med Bar's
 * micro-targeted Jeuveau dosing softens expression lines while preserving genuine warmth and smiles.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront, getStorefrontServices } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { FacialMusculatureExplorer } from '@/components/FacialMusculatureExplorer';
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
    title: 'Jeuveau® Neurotoxin in Loveland, CO | Precision Facial Anatomy Guide',
    description:
      'Discover precision-dosed Jeuveau® neurotoxin at The Med Bar in Loveland, CO. Softening forehead lines, 11s, and crow’s feet while preserving natural facial movement.'
  };
}

const INJECTABLE_FAQS = [
  {
    q: 'How does Jeuveau® differ from traditional Botox®?',
    a: 'Both Jeuveau® and Botox® utilize the same active molecule (prabotulinumtoxinA vs onabotulinumtoxinA) at the identical 900kDa molecular weight. However, Jeuveau® (#NEWTOX) is the first neurotoxin developed exclusively for aesthetic use in over a decade. It is manufactured utilizing modern Hi-Pure™ purification technology, which thoroughly removes extraneous proteins and impurities, resulting in a crisp, predictable onset and natural smoothing.'
  },
  {
    q: 'Will Jeuveau make my face feel stiff or look "frozen"?',
    a: 'No. The "frozen" or shiny forehead look is a symptom of outdated, aggressive over-dosing and poor anatomical placement. At The Med Bar, Jamie conducts a dynamic facial assessment prior to injecting—evaluating how your unique elevator and depressor muscles move. Dosing is micro-calibrated to quiet hyperactive furrowing while preserving full, authentic brow lift and warm facial expression.'
  },
  {
    q: 'How quickly does Jeuveau begin working, and how long does it last?',
    a: 'Most clients begin to see softening of dynamic lines within 2 to 4 days following treatment, with full therapeutic onset achieved at day 10 to 14. Results typically last 3 to 4 months. With regular maintenance treatments spaced 12 to 16 weeks apart, the targeted muscles adapt to relaxation, requiring fewer units over time.'
  },
  {
    q: 'What is a "Lip Flip" and how does it differ from lip filler?',
    a: 'A Lip Flip uses a minute amount of neurotoxin (typically 2 to 4 units) placed at the top border of the upper lip to relax the orbicularis oris muscle. When you smile, the lip rolls subtly upward and outward, revealing more natural vermilion pink. Unlike dermal fillers, a Lip Flip adds zero synthetic volume or gel puffiness.'
  },
  {
    q: 'Can Jeuveau be used for jawline slimming and teeth grinding (TMJ)?',
    a: 'Yes. Injections placed into the masseter muscles at the angle of the lower jaw relax chronic nighttime teeth clenching and tension headaches. Over 4 to 6 weeks, this muscular relaxation gently slims an overly square or bulky lower jawline into a sleek, contoured silhouette.'
  },
  {
    q: 'What are the essential pre-care and post-care rules for neurotoxins?',
    a: 'Before your appointment, avoid blood-thinning agents (NSAIDs like ibuprofen, aspirin, fish oil, high doses of vitamin E, and alcohol) for 48 hours to minimize bruising. After your session, remain upright for at least 4 hours, avoid touching or rubbing the injection points, and refrain from strenuous workouts, hot tubs, or saunas for 24 hours.'
  }
];

export default async function InjectablesGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const links = storefrontLinks(await storefrontBase(slug));
  const services = await getStorefrontServices(clinic.id);
  const injectableServices = services.filter((s) => s.category === 'injectables');
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://www.medbarco.com';

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: INJECTABLE_FAQS.map((f) => ({
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
      { '@type': 'ListItem', position: 3, name: 'Precision Injectables Guide', item: `${base}/injectables` }
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
            <span>Precision Injectables</span>
          </div>

          <div className="sf-hero-lead">
            <div className="sf-eyebrow">Facial Architecture · Loveland, Colorado</div>
            <h1 className="sf-display">
              <span className="ln"><span>Natural Movement Over</span></span>
              <span className="ln"><span className="sf-italic">Frozen Artifice.</span></span>
            </h1>
            <p className="sf-lede">
              Jeuveau® neurotoxin dosed with anatomical precision to your unique facial expression patterns.
              Softening forehead lines, 11s, and crow’s feet while preserving your genuine smile.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="sf-matrix-stats">
            <div className="sf-matrix-stat">
              <span className="val">$14+</span>
              <span className="lbl">Per Unit Dosed to Need</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">2–4 Days</span>
              <span className="lbl">Fast Progressive Onset</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">3–4 Mo</span>
              <span className="lbl">Average Duration</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">0 Min</span>
              <span className="lbl">Downtime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Facial Musculature Explorer */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <FacialMusculatureExplorer bookUrl={links.book} />
        </div>
      </section>

      {/* The Science of Jeuveau® #NEWTOX */}
      <section className="sf-section sf-bordered sf-invert">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Molecular Pharmacology</div>
            <h2>How purified neurotoxin relaxes dynamic muscle fibers</h2>
            <p>
              Understanding the neuromuscular junction and why modern purification matters for natural aesthetic results.
            </p>
          </div>

          <div className="sf-editorial-cards">
            <article className="sf-editorial-card">
              <span className="sf-editorial-tag">Step 1 · Neuromuscular Binding</span>
              <h3>Synaptic Transmission Modulation</h3>
              <p>
                When facial nerves signal a muscle to contract, vesicles release the neurotransmitter <b>acetylcholine (ACh)</b>.
                Jeuveau’s 900kDa purified protein binds specifically to presynaptic receptors on hyperactive muscle terminals.
              </p>
            </article>

            <article className="sf-editorial-card">
              <span className="sf-editorial-tag">Step 2 · SNAP-25 Cleavage</span>
              <h3>Targeted Tension Release</h3>
              <p>
                The molecule enters the motor nerve terminal and enzymatically cleaves <b>SNAP-25</b>, a key protein in the
                SNARE complex. This temporarily prevents acetylcholine release, allowing the overlying skin to smooth out.
              </p>
            </article>

            <article className="sf-editorial-card">
              <span className="sf-editorial-tag">Step 3 · Hi-Pure™ Precision</span>
              <h3>No Unnecessary Accessory Load</h3>
              <p>
                Manufactured with modern vacuum-drying Hi-Pure™ technology, Jeuveau achieves an ultra-pure formulation that
                delivers sharp precision to targeted muscle bellies without diffusing into surrounding facial elevators.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Head-to-Head Comparison Matrix: Jeuveau vs Botox vs Dysport vs Daxxify */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Neurotoxin Comparison Matrix</div>
            <h2>Comparing modern aesthetic wrinkle relaxers</h2>
            <p>
              A transparent clinical breakdown of molecular weight, protein purification, and onset speed.
            </p>
          </div>

          <div className="sf-matrix-wrapper" role="region" aria-label="Neurotoxin Comparison Table" tabIndex={0}>
            <table className="sf-matrix-table">
              <thead>
                <tr>
                  <th scope="col">Neurotoxin Brand</th>
                  <th scope="col">Active Molecule</th>
                  <th scope="col">Molecular Weight</th>
                  <th scope="col">Onset Speed</th>
                  <th scope="col">Diffusion Spread</th>
                  <th scope="col">Primary Clinical Strength</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row"><b>Jeuveau® (#NEWTOX)</b></th>
                  <td>PrabotulinumtoxinA</td>
                  <td>900 kDa</td>
                  <td>2 to 4 Days (Fast)</td>
                  <td>Controlled &amp; Precise</td>
                  <td>Aesthetic-exclusive, crisp smoothing, natural movement</td>
                </tr>
                <tr>
                  <th scope="row"><b>Botox® Cosmetic</b></th>
                  <td>OnabotulinumtoxinA</td>
                  <td>900 kDa</td>
                  <td>3 to 7 Days</td>
                  <td>Standard</td>
                  <td>Legacy formulation, widely recognized baseline</td>
                </tr>
                <tr>
                  <th scope="row"><b>Dysport®</b></th>
                  <td>AbobotulinumtoxinA</td>
                  <td>300–500 kDa</td>
                  <td>2 to 3 Days</td>
                  <td>Wider Feathering Spread</td>
                  <td>Effective for broad forehead expanses, requires higher unit ratios</td>
                </tr>
                <tr>
                  <th scope="row"><b>Daxxify®</b></th>
                  <td>DaxibotulinumtoxinA</td>
                  <td>150 kDa (Peptide Bond)</td>
                  <td>2 to 4 Days</td>
                  <td>Controlled</td>
                  <td>Peptide-stabilized for extended duration (5–6 months)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* The Injectables Menu at The Med Bar */}
      <section className="sf-section sf-bordered sf-invert">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Injectables Menu</div>
            <h2>Full injectables &amp; regenerative menu</h2>
            <p>
              Consultation and dynamic muscle assessment are performed before any unit is administered.
            </p>
          </div>

          <div className="sf-facial-full-grid">
            {injectableServices.map((s) => (
              <article className="sf-facial-card" key={s.id}>
                <div className="sf-facial-card-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div className="sf-item-icon-box" aria-hidden="true" style={{ width: '2.5rem', height: '2.5rem' }}>
                      <ServiceIcon name={s.name} category={s.category} />
                    </div>
                    <div>
                      <h3 className="sf-facial-name" style={{ margin: 0 }}>{s.name}</h3>
                      <span className="sf-paired-card-meta">{s.duration_min} min · Clinical Injectable</span>
                    </div>
                  </div>
                  {s.description && <p className="sf-facial-summary">{s.description}</p>}
                </div>

                {s.details && (
                  <div className="sf-altitude-callout" style={{ marginTop: 'var(--gd-3)' }}>
                    <span className="sf-altitude-label">✦ Clinical Protocol Details:</span>
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

      {/* Comprehensive FAQs */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Clinical Inquiries</div>
            <h2>Frequently asked questions about Jeuveau® &amp; Injectables</h2>
            <p>Everything you need to know about dosing, candidacy, safety, and results.</p>
          </div>

          <div className="sf-faq-grid">
            {INJECTABLE_FAQS.map((faq, idx) => (
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

      {/* Booking CTA */}
      <section className="sf-section sf-bordered sf-invert">
        <div className="sf-wrap">
          <div className="sf-story-outro">
            <span className="sf-story-outro-ornament">✦ ✦ ✦</span>
            <h3>Experience natural facial smoothing in Loveland</h3>
            <p>
              Schedule your Jeuveau® neurotoxin session or begin with a complimentary 15-minute dynamic facial
              consultation to map out your precision dosing plan.
            </p>
            <div style={{ display: 'flex', gap: 'var(--gd-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link href={`${links.book}?service=68ea65e5-3598-5f10-93f2-6b886a8f9021`} className="sf-btn sf-btn-ghost">
                Free 15-Min Consult &rarr;
              </Link>
              <Link href={`${links.book}?service=4511ad22-af4a-5f94-8b12-fe42de71129d`} className="sf-btn sf-btn-primary">
                Book Jeuveau® Treatment &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
