'use client';

import Link from 'next/link';
import type { StorefrontLinks } from '@/lib/storefront-links';

interface PinnedDisciplinesDeckProps {
  links: StorefrontLinks;
}

const DISCIPLINES = [
  {
    num: '01',
    kicker: 'Autologous Cellular Concentrate',
    title: 'Regenerative PRF Biostimulation',
    tagline: 'Your own platelets and living fibrin matrix, spun in-room with zero anticoagulants.',
    description:
      'Unlike conventional PRP or synthetic gels, Platelet-Rich Fibrin creates a slow-release biological scaffold. Over 10 to 14 days, it continuously releases vital growth factors (VEGF, PDGF, TGF-β) directly into skin tissue to restore thinning under-eye skin, smooth acne scars, and revitalize dormant hair follicles.',
    themeClass: 'theme-emerald',
    badge: '100% Natural Biology',
    specs: [
      { label: 'Synthetic Additives', val: '0% (No Anticoagulants)' },
      { label: 'Release Cascade', val: '10–14 Days Sustained' },
      { label: 'Cellular Target', val: 'Fibroblasts & Stem Cells' },
      { label: 'Treatment Downtime', val: '24–48 Hours' }
    ],
    pills: ['PRF Under-Eye Hollows', 'PRF Microneedling', 'PRF + Nue Strand Scalp'],
    guideUrlKey: 'prf' as const,
    guideLabel: 'Explore PRF Master Guide',
    bookServiceId: '183f72df-54e7-54b7-acfa-0fb0b0959522',
    iconSvg: (
      <svg viewBox="0 0 48 48" className="sf-deck-icon-svg" aria-hidden="true">
        <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        <circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M24 8 C20 16 14 21 14 28 a10 10 0 0 0 20 0 c0-7-6-12-10-20 Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="24" cy="28" r="3" fill="currentColor" />
        <circle cx="31" cy="18" r="1.5" fill="currentColor" />
        <circle cx="17" cy="20" r="1.5" fill="currentColor" />
      </svg>
    )
  },
  {
    num: '02',
    kicker: 'Anatomical Precision Dosing',
    title: 'Facial Musculature Architecture',
    tagline: 'Jeuveau® neurotoxin dosed to how your face actually moves—softening lines while preserving genuine warmth.',
    description:
      'We reject the frozen, stiff look. Every neurotoxin treatment begins with a comprehensive dynamic facial assessment. By targeting specific hyperactive muscle fibers while leaving surrounding elevators active, we soften forehead lines, 11s, and crow’s feet while maintaining your full, natural range of expression.',
    themeClass: 'theme-cream',
    badge: 'Precision Anatomy',
    specs: [
      { label: 'Active Molecule', val: 'Jeuveau® Purified #NEWTOX' },
      { label: 'Onset Timeline', val: '2 to 7 Days Progressive' },
      { label: 'Duration of Action', val: '3 to 4 Months' },
      { label: 'Treatment Downtime', val: 'Zero (Immediate Return)' }
    ],
    pills: ['Forehead Expression Lines', 'Glabellar Frown Lines (11s)', 'Crow’s Feet & Eye Contours'],
    guideUrlKey: 'services' as const,
    guideHash: '#cat-injectables',
    guideLabel: 'View Injectables Menu',
    bookServiceId: '4511ad22-af4a-5f94-8b12-fe42de71129d',
    iconSvg: (
      <svg viewBox="0 0 48 48" className="sf-deck-icon-svg" aria-hidden="true">
        <path d="M12 36 L36 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M30 6 L42 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
        <circle cx="36" cy="12" r="3" fill="currentColor" />
        <path d="M8 40 L12 36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    num: '03',
    kicker: 'Colorado High-Desert Climate Engineering',
    title: 'Altitude Clinical Esthetics',
    tagline: 'Hydradermabrasion, sterile dermaplaning, and nano-infusions tailored to 5,000+ ft atmospheric stress.',
    description:
      'Living at 5,000+ feet altitude accelerates Transepidermal Water Loss (TEWL) and causes dead stratum corneum cells to thicken. Our clinical facial protocols combine fluid-vortex vacuum pore extraction, sterile blade physical polishing, and transdermal nano-infusion to drench dehydrated skin in clean Green Envee botanicals.',
    themeClass: 'theme-sand',
    badge: '5,000+ Ft Engineered',
    specs: [
      { label: 'Formulations', val: 'Clean Botanical Green Envee' },
      { label: 'Absorption Boost', val: '+60% to +97% Transdermal' },
      { label: 'Skin Focus', val: 'TEWL Barrier Rebuilding' },
      { label: 'Treatment Downtime', val: 'Zero (Instant Radiant Dew)' }
    ],
    pills: ['Hydroboration Infusion', 'Dermaplaning Polish', 'Floraessence 20% Lactic Peel', 'Nano Infusion'],
    guideUrlKey: 'facialsGuide' as const,
    guideLabel: 'Explore Facials Directory',
    bookServiceId: 'ddd47915-309a-52fc-8bd0-0270524937f8',
    iconSvg: (
      <svg viewBox="0 0 48 48" className="sf-deck-icon-svg" aria-hidden="true">
        <path d="M24 4 C14 16 8 24 8 32 a16 16 0 0 0 32 0 c0-8-6-16-16-28 Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 32 C16 36.5 19.5 40 24 40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="24" cy="20" r="2" fill="currentColor" />
        <path d="M12 20 Q24 24 36 20" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      </svg>
    )
  },
  {
    num: '04',
    kicker: 'Zero-Pigment Paramedical Remodeling',
    title: 'Inkless Scar & Stretch Mark Revision',
    tagline: 'Bio-serums that awaken natural melanin and smooth rigid collagen without tattoo ink that discolors.',
    description:
      'Traditional camouflage tattooing covers scars with ink pigments that oxidize, yellow, and cannot tan. Inkless revision uses micro-needling with NUE Conceal peptide serums (NUE Regen & NUE Bright) to soften dense surgical scar tissue, rebuild lost elastin in stretch marks, and trigger endogenous melanin for permanent skin blending.',
    themeClass: 'theme-obsidian',
    badge: 'Zero Tattoo Pigments',
    specs: [
      { label: 'Biological Action', val: 'Endogenous Melanin Awakening' },
      { label: 'Tissue Remodeling', val: 'Type I & III Flexible Collagen' },
      { label: 'Pigment Oxidation Risk', val: '0% (No Synthetic Ink)' },
      { label: 'Average Protocol', val: '2 to 4 Sessions' }
    ],
    pills: ['C-Section & Surgical Scars', 'Abdominal & Hip Stretch Marks', 'Injury & Trauma Scars'],
    guideUrlKey: 'scarRevision' as const,
    guideLabel: 'Explore Scar Revision Guide',
    bookServiceId: '2909d933-4de7-560b-810b-cd22d9be475b',
    iconSvg: (
      <svg viewBox="0 0 48 48" className="sf-deck-icon-svg" aria-hidden="true">
        <path d="M6 24 C14 16 20 16 24 24 C28 32 34 32 42 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M10 28 C16 22 20 22 24 28 C28 34 32 34 38 28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.6" />
        <circle cx="24" cy="24" r="3" fill="currentColor" />
        <circle cx="12" cy="18" r="1.5" fill="currentColor" />
        <circle cx="36" cy="30" r="1.5" fill="currentColor" />
      </svg>
    )
  }
];

export function PinnedDisciplinesDeck({ links }: PinnedDisciplinesDeckProps) {
  return (
    <section className="sf-deck-section" aria-label="The 4 Clinical Disciplines of The Med Bar">
      <div className="sf-wrap">
        {/* Section Lead-in */}
        <div className="sf-deck-intro">
          <div className="sf-eyebrow">The Four Clinical Disciplines</div>
          <h2 className="sf-deck-heading">
            Biology over artifice. <br />
            <span className="sf-italic">Precision in every modality.</span>
          </h2>
          <p className="sf-deck-sub">
            Every service at The Med Bar is rooted in physiological harmony: activating your body’s
            inherent regenerative capacity, respecting your unique facial movement, and engineering
            protective hydration for Colorado’s high-altitude climate.
          </p>
        </div>

        {/* Stacked Pinned Cards Deck */}
        <div className="sf-deck-container">
          {DISCIPLINES.map((d, index) => {
            const guideHref = d.guideHash ? `${links[d.guideUrlKey]}${d.guideHash}` : links[d.guideUrlKey];
            const bookHref = `${links.book}?service=${encodeURIComponent(d.bookServiceId)}`;

            return (
              <div
                className={`sf-deck-card ${d.themeClass}`}
                id={`discipline-card-${d.num}`}
                key={d.num}
                style={{
                  '--card-index': index,
                  zIndex: index + 1
                } as React.CSSProperties}
              >
                <div className="sf-deck-card-inner">
                  {/* Left Column: Narrative & Philosophy */}
                  <div className="sf-deck-card-main">
                    <div className="sf-deck-card-topbar">
                      <div className="sf-deck-num-pill">
                        <span className="sf-deck-num-spark" />
                        <span>DISCIPLINE {d.num}</span>
                      </div>
                      <span className="sf-deck-badge">{d.badge}</span>
                    </div>

                    <div className="sf-deck-kicker">{d.kicker}</div>
                    <h3 className="sf-deck-card-title">{d.title}</h3>
                    <p className="sf-deck-card-tagline">{d.tagline}</p>
                    <p className="sf-deck-card-body">{d.description}</p>

                    {/* Modality Pill Chips */}
                    <div className="sf-deck-pills-row">
                      {d.pills.map((p, i) => (
                        <span className="sf-deck-pill" key={i}>
                          ✦ {p}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="sf-deck-actions">
                      <Link href={guideHref} className="sf-btn sf-btn-ghost">
                        {d.guideLabel} &rarr;
                      </Link>
                      <Link href={bookHref} className="sf-btn sf-btn-primary">
                        Reserve Treatment &rarr;
                      </Link>
                    </div>
                  </div>

                  {/* Right Column: Key Specifications & Dynamic Illustration */}
                  <div className="sf-deck-card-aside">
                    <div className="sf-deck-art-box">
                      {d.iconSvg}
                    </div>

                    <div className="sf-deck-specs-card">
                      <div className="sf-deck-specs-title">✦ Clinical Standards &amp; Metrics</div>
                      <div className="sf-deck-specs-grid">
                        {d.specs.map((s, idx) => (
                          <div className="sf-deck-spec-row" key={idx}>
                            <span className="sf-deck-spec-lbl">{s.label}</span>
                            <span className="sf-deck-spec-val">{s.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Deck Outro CTA */}
        <div className="sf-deck-outro">
          <span className="sf-story-outro-ornament">✦ ✦ ✦</span>
          <h3>Not sure which discipline your skin needs?</h3>
          <p>
            Start with our interactive concern finder or book a complimentary 15-minute consultation to design
            your tailored treatment roadmap with Jamie.
          </p>
          <div style={{ display: 'flex', gap: 'var(--gd-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href={`${links.book}?service=68ea65e5-3598-5f10-93f2-6b886a8f9021`} className="sf-btn sf-btn-ghost">
              Free 15-Min Consult &rarr;
            </Link>
            <Link href={links.services} className="sf-btn sf-btn-primary">
              Browse All Services &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
