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
    a: 'LED Light Therapy operates through photobiomodulation (PBM). Specific wavelengths of light (measured in nanometers) penetrate the epidermis and dermis, where they are absorbed by chromophores—specifically cytochrome c oxidase within cell mitochondria. This photon absorption triggers an immediate surge in adenosine triphosphate (ATP) cellular energy, stimulates collagen synthesis by fibroblasts, improves microcirculation, and modulates pro-inflammatory cytokines.'
  },
  {
    q: 'Does LED Light Therapy contain harmful UV rays or cause sunburn?',
    a: 'No. Clinical LED light therapy utilizes narrow-band visible and near-infrared light spectrums (ranging from 415nm to 830nm) that are 100% free of damaging ultraviolet (UVA/UVB) radiation. It causes zero thermal damage, zero burning, and zero DNA mutation. It is safe for all skin types and Fitzpatrick tones year-round.'
  },
  {
    q: 'Why should I add LED Light Therapy after PRF or Microneedling?',
    a: 'When combined with regenerative procedures like PRF (Platelet-Rich Fibrin) or microneedling, LED therapy acts as a biological recovery accelerator. Red and amber wavelengths stimulate cellular ATP, reduce acute swelling (edema), calm surface redness (erythema), and stimulate fibroblasts to utilize PRF growth factors more efficiently, cutting post-procedure recovery time by up to 50%.'
  },
  {
    q: 'How many LED Light Therapy sessions do I need to see results?',
    a: 'For acute post-procedure recovery and instant radiance, a single 30-minute session provides visible calming and glow. For chronic conditions like active inflammatory acne, rosacea, or collagen rebuilding, a clinical series of 4 to 8 sessions spaced 1 to 2 weeks apart is recommended for cumulative, long-lasting cellular remodeling.'
  },
  {
    q: 'What should I expect during a 30-minute LED treatment at The Med Bar?',
    a: 'Your session begins with a gentle botanical cleanse to ensure optimal photon penetration. Protective blackout eye shields are placed over your eyes, and the calibrated LED phototherapy panel is positioned inches above your skin. You will experience a soothing, gentle warmth and pure relaxation for 20–30 minutes with zero pain. The session concludes with barrier-repair finishing serums and clean mineral SPF.'
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
              Harnessing specific nanometer light spectrums to fuel cellular mitochondria, eliminate acne bacteria,
              stimulate genuine collagen synthesis, and accelerate healing with zero UV radiation and zero downtime.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="sf-matrix-stats">
            <div className="sf-matrix-stat">
              <span className="val">7</span>
              <span className="lbl">Clinical Wavelengths</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">0%</span>
              <span className="lbl">UV Radiation &amp; Thermal Risk</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">+200%</span>
              <span className="lbl">Cellular ATP Synthesis</span>
            </div>
            <div className="sf-matrix-stat">
              <span className="val">0 Min</span>
              <span className="lbl">Recovery &amp; Downtime</span>
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
                chromophores inside cell mitochondria. This activates the enzyme <b>cytochrome c oxidase</b>,
                accelerating the electron transport chain.
              </p>
            </article>

            <article className="sf-editorial-card">
              <span className="sf-editorial-tag">Phase 2 · Cellular Energy Surge</span>
              <h3>ATP Synthesis &amp; Nitric Oxide Release</h3>
              <p>
                Stimulated mitochondria produce up to <b>200% more Adenosine Triphosphate (ATP)</b>—the biological fuel
                cells require to repair damage, divide, and synthesize structural proteins. Simultaneously, microvascular
                nitric oxide is released, boosting oxygen and nutrient delivery.
              </p>
            </article>

            <article className="sf-editorial-card">
              <span className="sf-editorial-tag">Phase 3 · Tissue Remodeling</span>
              <h3>Neocollagenesis &amp; Inflammation Modulation</h3>
              <p>
                Energized dermal fibroblasts synthesize new type I collagen and elastin fibers while down-regulating
                collagen-degrading matrix metalloproteinases (MMPs). Inflammatory cytokines are cleared, soothing redness
                and accelerating tissue remodeling.
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
