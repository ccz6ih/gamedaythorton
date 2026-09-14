/**
 * app/c/[slug]/prf/aftercare/page.tsx
 *
 * Dedicated PRF Pre-Care, Recovery Timeline & Aftercare Guide.
 *
 * WHY THIS PAGE EXISTS
 * "PRF recovery timeline", "what to do after PRF microneedling", and "PRF under eye swelling"
 * are top queries from both prospective patients researching downtime and existing patients
 * needing immediate post-care instructions.
 *
 * This guide provides a clear, structured roadmap of what to do before the appointment,
 * what to expect day-by-day, and how to protect and nurture your results.
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
    title: 'PRF Pre-Care & Recovery Guide: Preparation & Timeline',
    description:
      'What to do before your PRF appointment, what to expect day-by-day during recovery, and essential aftercare instructions for under-eye, microneedling, and hair restoration.'
  };
}

const AFTERCARE_FAQS = [
  {
    q: 'How should I prepare for my PRF appointment?',
    a: 'Hydration is the single most critical factor: drink plenty of water (at least 48–64 oz daily) for 48 hours prior to your visit to ensure an easy blood draw and optimal plasma volume. Avoid alcohol and excessive caffeine for 24 hours beforehand. If medically appropriate and cleared by your prescribing physician, avoid NSAIDs (such as ibuprofen or naproxen) for 3–5 days prior, as these can inhibit platelet function.'
  },
  {
    q: 'How long does swelling last after PRF under-eye treatment?',
    a: 'Mild to moderate swelling and temporary fullness under the eyes is completely normal and typically peaks within 24 to 36 hours before subsiding significantly over days 2 and 3. Minor pinpoint bruising may take 4 to 7 days to fully resolve and can be gently concealed with mineral makeup after 24 hours.'
  },
  {
    q: 'When can I wash my face after PRF microneedling?',
    a: 'We recommend leaving the residual PRF on your skin for at least 4 to 6 hours (ideally overnight) so the growth factors continue nourishing the micro-channels. After that, gently cleanse with lukewarm water and a mild, non-exfoliating cleanser. Apply a soothing barrier treatment such as SkinAlchemy Calm Balm.'
  },
  {
    q: 'Can I exercise after a PRF treatment?',
    a: 'Avoid vigorous workouts, hot yoga, saunas, and steam rooms for 24 to 48 hours post-treatment. Elevated heart rate and heavy perspiration can increase swelling, localized bruising, and inflammation at the injection or microneedling sites.'
  },
  {
    q: 'When do PRF results become visible?',
    a: 'Because PRF works biologically with your natural cellular turnover rather than placing synthetic gel, initial changes in skin luminosity and texture often emerge around weeks 3 to 4. Deeper collagen remodeling, tissue density, and structural improvements continue building between weeks 6 and 12.'
  }
];

export default async function PrfAftercarePage({ params }: { params: Promise<{ slug: string }> }) {
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
    mainEntity: AFTERCARE_FAQS.map((f) => ({
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
      { '@type': 'ListItem', position: 3, name: 'Pre-Care & Aftercare', item: `${base}${links.prfAftercare}` }
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
            <span>Pre-Care & Aftercare</span>
          </nav>

          <div className="sf-eyebrow">Patient Care Guide</div>
          <h1>PRF Pre-Care & Recovery Guide</h1>
          <p className="sf-tagline">
            Everything you need to know before your appointment, what to expect day-by-day,
            and how to support your body&rsquo;s natural collagen synthesis for optimal results.
          </p>

          <div className="sf-cluster-nav">
            <Link href={links.prf} className="sf-chip">
              &larr; What Is PRF?
            </Link>
            <Link href={links.prfCompare} className="sf-chip">
              PRF vs PRP vs Fillers &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Pre-Care Protocol */}
      <section className="sf-section">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>Preparing for your appointment</h2>
            <p>
              Because PRF is formulated entirely from your own blood, pre-treatment preparation directly
              influences your sample quality and recovery speed.
            </p>
          </div>

          <div className="sf-aftercare-grid">
            <article className="sf-aftercare-card">
              <span className="sf-aftercare-step-num">01</span>
              <h3>Hydrate generously</h3>
              <p>
                Drink 48–64 oz of water daily for 2–3 days leading up to your visit.
                Proper hydration expands blood volume, making the blood draw smoother and maximizing
                the yield of active platelets.
              </p>
            </article>

            <article className="sf-aftercare-card">
              <span className="sf-aftercare-step-num">02</span>
              <h3>Pause blood-thinning agents</h3>
              <p>
                If medically safe and approved by your doctor, avoid NSAIDs (aspirin, ibuprofen, Advil, Aleve),
                fish oil, and vitamin E supplements for 3–5 days prior to minimize bruising and protect platelet viability.
              </p>
            </article>

            <article className="sf-aftercare-card">
              <span className="sf-aftercare-step-num">03</span>
              <h3>Avoid alcohol & excess caffeine</h3>
              <p>
                Refrain from alcohol for at least 24 hours before your session. Alcohol dehydrates tissue
                and dilates blood vessels, which increases the likelihood of post-treatment bruising.
              </p>
            </article>

            <article className="sf-aftercare-card">
              <span className="sf-aftercare-step-num">04</span>
              <h3>Eat a nutritious meal</h3>
              <p>
                Do not arrive on an empty stomach. Eat a balanced meal or healthy snack containing protein and complex
                carbohydrates 1–2 hours before your appointment to prevent lightheadedness during the blood draw.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Recovery Timeline */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>The recovery & results timeline</h2>
            <p>What happens in the hours, days, and weeks following your PRF treatment:</p>
          </div>

          <div className="sf-timeline-list">
            <div className="sf-timeline-item">
              <div className="sf-timeline-badge">Hours 0–24</div>
              <div className="sf-timeline-content">
                <h3>Initial Placement & Cellular Activation</h3>
                <p>
                  Mild temporary swelling, slight tenderness, and pinkness are expected. The concentrated
                  platelets immediately begin releasing signaling proteins into the fibrin scaffold.
                </p>
                <ul>
                  <li>Keep treated areas clean; avoid touching or massaging.</li>
                  <li>Sleep with your head slightly elevated to minimize under-eye fluid buildup.</li>
                  <li>Avoid makeup, strenuous exercise, saunas, and hot showers for 24 hours.</li>
                </ul>
              </div>
            </div>

            <div className="sf-timeline-item">
              <div className="sf-timeline-badge">Days 2–3</div>
              <div className="sf-timeline-content">
                <h3>Settling & Barrier Healing</h3>
                <p>
                  Initial swelling rapidly subsides. Any minor pinpoint bruising shifts from reddish to yellowish.
                  The fibrin matrix continues sustained growth factor release.
                </p>
                <ul>
                  <li>Gently cleanse with lukewarm water and a mild non-stripping cleanser.</li>
                  <li>Apply soothing botanical barrier care such as <strong>SkinAlchemy Calm Balm</strong>.</li>
                  <li>Apply a clean, broad-spectrum physical SPF 30+ if exposed to daylight.</li>
                </ul>
              </div>
            </div>

            <div className="sf-timeline-item">
              <div className="sf-timeline-badge">Weeks 1–4</div>
              <div className="sf-timeline-content">
                <h3>Neovascularization & Cellular Renewal</h3>
                <p>
                  New micro-capillaries form around the treatment site, enhancing blood flow and nutrient delivery.
                  Fibroblasts begin producing new collagen and elastin fibers in the deeper dermal layers.
                </p>
                <ul>
                  <li>Early improvements in skin radiance, tone, and hydration become visible.</li>
                  <li>Resume regular skincare (such as retinols or AHAs) around day 7 if skin feels calm.</li>
                </ul>
              </div>
            </div>

            <div className="sf-timeline-item">
              <div className="sf-timeline-badge">Months 2–3</div>
              <div className="sf-timeline-content">
                <h3>Collagen Maturation & Peak Density</h3>
                <p>
                  This is the period over which any change in firmness and texture tends to appear,
                  smoother overall texture, and improved follicle health across the treated series.
                </p>
                <ul>
                  <li>Results from a multi-session series compound over this window.</li>
                  <li>Maintenance visits can be scheduled every 9–12 months as desired.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modality-Specific Care Instructions */}
      <section className="sf-section">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>Modality-specific instructions</h2>
          </div>

          <div className="sf-compare-details-grid">
            <article className="sf-compare-card">
              <span className="sf-compare-tag">Under-Eye Area</span>
              <h3>PRF Under-Eye Injections</h3>
              <p>
                The skin under the eyes is exceptionally delicate. To protect the placed fibrin matrix:
              </p>
              <ul className="sf-detail-list">
                <li>Do not press, rub, or massage the tear trough area for 7 days.</li>
                <li>If bruising occurs, apply arnica gel or a light cold compress (wrapped in clean cloth) for 5-minute intervals without downward pressure.</li>
                <li>Avoid sleeping on your stomach or sides for the first 2 nights.</li>
              </ul>
            </article>

            <article className="sf-compare-card">
              <span className="sf-compare-tag">Facial Remodeling</span>
              <h3>PRF Microneedling</h3>
              <p>
                Your skin channels remain open for several hours after treatment. Follow these guidelines:
              </p>
              <ul className="sf-detail-list">
                <li>Leave residual PRF on skin for 4–6 hours before your first gentle rinse.</li>
                <li>Use clean pillowcases and clean phone screens to prevent bacterial contamination.</li>
                <li>Avoid active acids, vitamin C, and retinoids for 5 full days post-procedure.</li>
              </ul>
            </article>

            <article className="sf-compare-card">
              <span className="sf-compare-tag">Scalp Restoration</span>
              <h3>PRF Hair Restoration</h3>
              <p>
                To allow follicles to absorb maximum growth factor nourishment:
              </p>
              <ul className="sf-detail-list">
                <li>Leave the PRF on your scalp overnight; do not wash hair for at least 24 hours.</li>
                <li>Avoid hats, helmets, or tight headwear for 24 hours to prevent friction.</li>
                <li>Avoid chemical hair treatments (color, bleach, perms) for 7 days post-treatment.</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>Frequently asked recovery questions</h2>
          </div>

          <div className="sf-faq-list">
            {AFTERCARE_FAQS.map((f, i) => (
              <details className="sf-faq-item" key={i}>
                <summary className="sf-faq-q">{f.q}</summary>
                <p className="sf-faq-a">{f.a}</p>
              </details>
            ))}
          </div>

          <div className="sf-cta-block" style={{ marginTop: 'var(--gd-8)' }}>
            <h3>Ready to schedule your appointment?</h3>
            <p>
              Every treatment at The Med Bar in Loveland includes dedicated consultation time
              and thorough personalized post-care instructions.
            </p>
            <div className="sf-cta-actions">
              <Link href={links.book} className="sf-btn primary">
                Reserve Appointment <span>&rarr;</span>
              </Link>
              <Link href={links.prf} className="sf-btn ghost">
                Back to PRF Overview
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
