/**
 * app/c/[slug]/led-light-therapy/page.tsx
 *
 * Dedicated Master Guide: Medical 7-Wavelength LED Light Therapy & Photobiomodulation.
 *
 * WHY THIS PAGE EXISTS
 * "LED light therapy Loveland CO", "red light therapy vs blue light", and "7 color LED benefits"
 * are high-volume, high-conversion search queries with immense AI citation value (ChatGPT,
 * Perplexity, Google AI Overviews).
 *
 * This guide provides an in-depth clinical explanation of photobiomodulation (PBM): how specific
 * nanometer wavelengths interact with cellular mitochondria (cytochrome c oxidase), the clinical
 * indications of all 7 therapeutic spectrums, and why LED accelerates recovery following
 * PRF, microneedling, and chemical peels.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { LedSpectrumDial } from '@/components/LedSpectrumDial';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) return { title: 'Not found' };

  return {
    title: 'Medical LED Light Therapy in Loveland, CO | 7-Wavelength Phototherapy Guide',
    description:
      'Discover medical-grade 7-wavelength LED Light Therapy at The Med Bar in Loveland, CO. Red, Blue, Green, Yellow, Cyan, Purple & White light for acne, collagen, and healing.'
  };
}

const LED_FAQS = [
  {
    q: 'How does LED Light Therapy actually work inside skin cells?',
    a: 'LED Light Therapy operates through photobiomodulation (PBM). Specific wavelengths of light (measured in nanometers) penetrate the epidermis and dermis, where they are absorbed by chromophores—specifically cytochrome c oxidase within cell mitochondria. Absorption is thought to raise cellular ATP production, support fibroblast activity, improve local circulation and moderate inflammation. That is the proposed mechanism rather than a measured outcome, and it is why results are described here in terms of what the light does rather than what it guarantees.'
  },
  {
    q: 'Does LED Light Therapy contain harmful UV rays or cause sunburn?',
    a: 'No. Clinical LED light therapy utilizes narrow-band visible and near-infrared light spectrums (ranging from 415nm to 830nm) that contain no ultraviolet (UVA/UVB) light. It is non-thermal and non-ablative — nothing is burned, removed or broken — and it is used across skin types. Whether it suits you is confirmed at your appointment.'
  },
  {
    q: 'Why should I add LED Light Therapy after PRF or Microneedling?',
    a: 'When combined with regenerative procedures like PRF (Platelet-Rich Fibrin) or microneedling, LED therapy acts as a biological recovery accelerator. Red and amber wavelengths stimulate cellular ATP, reduce acute swelling (edema), calm surface redness (erythema), and and is often added after a procedure for that reason. How much difference it makes to recovery varies from person to person, so no figure is quoted.'
  },
  {
    q: 'How many LED Light Therapy sessions do I need to see results?',
    a: 'For acute post-procedure recovery and instant radiance, a single 30-minute session provides visible calming and glow. For ongoing concerns it is usually recommended as a course rather than a single visit, and how many sessions is decided with you at your appointment.'
  },
  {
    q: 'What should I expect during a 30-minute LED treatment at The Med Bar?',
    a: 'Your session begins with a gentle botanical cleanse to ensure optimal photon penetration. Protective blackout eye shields are placed over your eyes, and the calibrated LED phototherapy panel is positioned inches above your skin. Most people describe it as a gentle warmth, and the panel does not touch the skin. The session concludes with barrier-repair finishing serums and clean mineral SPF.'
  },
  {
    q: 'Can I do LED therapy if I have sensitive or rosacea-prone skin?',
    a: 'Yes. Amber yellow (590nm) and cyan (490nm) wavelengths are specifically indicated for reactive, vascular, and rosacea-prone skin. They strengthen fragile capillary walls, stimulate lymphatic drainage, and dramatically reduce facial redness without irritating the lipid moisture barrier.'
  }
];

export default async function LedLightTherapyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const links = storefrontLinks(await storefrontBase(slug));
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://www.medbarco.com';

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: LED_FAQS.map((f) => ({
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
      { '@type': 'ListItem', position: 3, name: 'LED Light Therapy Guide', item: `${base}/led-light-therapy` }
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
            <span>LED Light Therapy</span>
          </div>

          <div className="sf-hero-lead">
            <div className="sf-eyebrow">Medical Photobiomodulation · Loveland, Colorado</div>
            <h1 className="sf-display">
              <span className="ln"><span>The 7-Wavelength</span></span>
              <span className="ln"><span className="sf-italic">LED Light Therapy Guide.</span></span>
            </h1>
            <p className="sf-lede">
              Narrow-band visible and near-infrared light, used on the skin at wavelengths chosen for what you came in for.
              No ultraviolet, nothing ablative, and you can go straight back to your day.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="sf-matrix-stats">
            <div className="sf-matrix-stat">
              <span className="val">7</span>
              <span className="lbl">Clinical Wavelengths</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">Non-UV</span>
              <span className="lbl">Visible &amp; Near-Infrared Light</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">Non-ablative</span>
              <span className="lbl">Nothing Is Removed Or Broken</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">30 Min</span>
              <span className="lbl">Typical Session</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive 7-Color Spectrum Dial */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <LedSpectrumDial bookUrl={links.book} />
        </div>
      </section>

      {/* The Science of Photobiomodulation */}
      <section className="sf-section sf-bordered sf-invert">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Cellular Physiology</div>
            <h2>How light photons heal skin from the inside out</h2>
            <p>
              Photobiomodulation (PBM) is not a surface heating treatment—it is a photochemical reaction
              occurring deep within living cells, similar to photosynthesis in plants.
            </p>
          </div>

          <div className="sf-editorial-cards">
            <article className="sf-editorial-card">
              <span className="sf-editorial-tag">Phase 1 · Photon Absorption</span>
              <h3>Cytochrome C Oxidase Activation</h3>
              <p>
                Specific light wavelengths pass through the stratum corneum and are captured by photo-acceptor
                chromophores inside cell mitochondria. The photo-acceptor understood to do most of this work is
                <b>cytochrome c oxidase</b>, an enzyme in the electron transport chain.
              </p>
            </article>

            <article className="sf-editorial-card">
              <span className="sf-editorial-tag">Phase 2 · Cellular Energy Surge</span>
              <h3>ATP Synthesis &amp; Nitric Oxide Release</h3>
              <p>
                The proposed mechanism is that absorbed light increases mitochondrial production of adenosine
                triphosphate (ATP), the fuel cells use to repair damage, divide and build structural proteins, and
                that nitric oxide release improves local blood flow. How much of an increase, and in whom, is not
                settled — so no figure is quoted here.
              </p>
            </article>

            <article className="sf-editorial-card">
              <span className="sf-editorial-tag">Phase 3 · Tissue Remodeling</span>
              <h3>Neocollagenesis &amp; Inflammation Modulation</h3>
              <p>
                Over the following weeks the skin is thought to lay down new collagen and elastin, and to moderate the
                enzymes that break collagen down. Changes of this kind appear gradually rather than after a single
                session.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* 7-Wavelength Clinical Matrix Table */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Wavelength Comparison Matrix</div>
            <h2>Full 7-spectrum clinical directory</h2>
            <p>
              Compare nanometer frequencies, tissue penetration depths, and therapeutic targets across the entire spectrum.
            </p>
          </div>

          <div className="sf-matrix-wrapper" role="region" aria-label="7-Wavelength Comparison Table" tabIndex={0}>
            <table className="sf-matrix-table">
              <thead>
                <tr>
                  <th scope="col">Spectrum Color</th>
                  <th scope="col">Wavelength (nm)</th>
                  <th scope="col">Penetration Depth</th>
                  <th scope="col">Primary Target Organelle</th>
                  <th scope="col">Key Clinical Indication</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row"><b>Red &amp; Near-Infrared</b></th>
                  <td>630nm – 830nm</td>
                  <td>Deep Dermis &amp; Subcutaneous (8–10mm)</td>
                  <td>Fibroblast Mitochondria (ATP)</td>
                  <td>Collagen synthesis, fine lines, rapid tissue healing</td>
                </tr>
                <tr>
                  <th scope="row"><b>Blue Light</b></th>
                  <td>415nm</td>
                  <td>Epidermis &amp; Follicles (1–2mm)</td>
                  <td>Coproporphyrin III in P. Acnes</td>
                  <td>Destroys active acne bacteria, balances sebum</td>
                </tr>
                <tr>
                  <th scope="row"><b>Green Light</b></th>
                  <td>525nm</td>
                  <td>Dermal-Epidermal Junction (2–3mm)</td>
                  <td>Basal Layer Melanocytes</td>
                  <td>Hyperpigmentation, sun spots, evening skin tone</td>
                </tr>
                <tr>
                  <th scope="row"><b>Amber Yellow Light</b></th>
                  <td>590nm</td>
                  <td>Upper Dermis (2–4mm)</td>
                  <td>Capillary Endothelium &amp; Lymphatics</td>
                  <td>Flushes swelling, calms rosacea &amp; post-procedure redness</td>
                </tr>
                <tr>
                  <th scope="row"><b>Dual-Band Purple</b></th>
                  <td>415nm + 630nm</td>
                  <td>Surface to Deep Dermis</td>
                  <td>P. Acnes + Fibroblast Mitochondria</td>
                  <td>Adult acne, blemish clearing with concurrent anti-aging</td>
                </tr>
                <tr>
                  <th scope="row"><b>Cyan Light</b></th>
                  <td>490nm</td>
                  <td>Papillary Dermis (2mm)</td>
                  <td>Membrane Receptors &amp; Capillaries</td>
                  <td>De-stresses irritated, chapped, or weather-sensitized skin</td>
                </tr>
                <tr>
                  <th scope="row"><b>Full-Spectrum White</b></th>
                  <td>400nm – 850nm</td>
                  <td>Omnidirectional Multi-Depth</td>
                  <td>Global Cellular Chromophores</td>
                  <td>Total skin revitalization, tightening, nutrient uptake</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Standalone vs. Treatment Synergy */}
      <section className="sf-section sf-bordered sf-invert">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Treatment Synergy</div>
            <h2>Why LED is the ultimate treatment booster</h2>
            <p>
              While powerful as a standalone rejuvenation session, LED Light Therapy multiplies the clinical
              outcomes of other aesthetic modalities when added directly post-treatment.
            </p>
          </div>

          <div className="sf-editorial-cards">
            <div className="sf-editorial-card">
              <span className="sf-editorial-tag">Synergy 01</span>
              <h3>Post-PRF &amp; Microneedling</h3>
              <p>
                Micro-channels created during PRF microneedling allow red light photons to penetrate even deeper.
                The surge in cellular ATP enables fibroblasts to process PRF growth factors at maximum velocity,
                reducing downtime from 48 hours to less than a single day.
              </p>
            </div>

            <div className="sf-editorial-card">
              <span className="sf-editorial-tag">Synergy 02</span>
              <h3>Post-Chemical Peel Calming</h3>
              <p>
                Following a Floraessence Lactic or Salicylic Peel, amber yellow and cyan LED therapy instantly
                quenches chemical heat, down-regulates histamine release, and prevents post-inflammatory
                hyperpigmentation (PIH).
              </p>
            </div>

            <div className="sf-editorial-card">
              <span className="sf-editorial-tag">Synergy 03</span>
              <h3>Acne Eradication Protocol</h3>
              <p>
                Paired with an Express or Intensive Skin Clearing Facial, blue 415nm light provides immediate
                deep-pore sterilization following extractions, preventing bacteria from recolonizing freshly cleared pores.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comprehensive FAQs */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">Clinical Questions</div>
            <h2>Frequently asked questions about LED Light Therapy</h2>
            <p>Everything you need to know about safety, wavelengths, session length, and results.</p>
          </div>

          <div className="sf-faq-grid">
            {LED_FAQS.map((faq, idx) => (
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
            <h3>Experience medical-grade phototherapy in Loveland</h3>
            <p>
              Available as a standalone 30-minute relaxation session ($40) or as a rapid-healing add-on
              to your facial, peel, or PRF treatment.
            </p>
            <div style={{ display: 'flex', gap: 'var(--gd-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link href={`${links.book}?service=3affd9d8-50ab-5cab-a413-0a9055acbb80`} className="sf-btn primary">
                Book LED Therapy ($40) &rarr;
              </Link>
              <Link href={links.services} className="sf-btn ghost">
                View All Treatments &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
