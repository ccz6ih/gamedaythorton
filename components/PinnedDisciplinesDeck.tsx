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
      <svg viewBox="0 0 220 110" className="sf-deck-art-svg sf-art-prf" aria-hidden="true">
        <defs>
          <radialGradient id="prfGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--card-accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--card-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="110" cy="55" rx="75" ry="42" fill="url(#prfGlow)" />
        <ellipse cx="110" cy="55" rx="88" ry="40" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" opacity="0.3" className="sf-orbit-outer" />
        <ellipse cx="110" cy="55" rx="62" ry="28" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" className="sf-orbit-mid" />
        <ellipse cx="110" cy="55" rx="36" ry="16" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
        <g className="sf-art-fibrin-core">
          <path d="M110 20 C95 38 82 52 82 66 a28 28 0 0 0 56 0 c0-14-13-28-28-46 Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M110 32 C100 44 92 54 92 64 a18 18 0 0 0 36 0 c0-10-8-20-18-32 Z" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
          <circle cx="110" cy="66" r="4.5" fill="currentColor" className="sf-nucleus-spark" />
          <circle cx="102" cy="56" r="2" fill="currentColor" opacity="0.85" />
          <circle cx="118" cy="58" r="2.2" fill="currentColor" opacity="0.85" />
          <circle cx="105" cy="74" r="1.8" fill="currentColor" opacity="0.75" />
          <circle cx="116" cy="72" r="1.8" fill="currentColor" opacity="0.75" />
        </g>
        <path d="M82 66 C65 68 48 60 35 52" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        <path d="M138 66 C155 68 172 60 185 52" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        <circle cx="35" cy="52" r="2.5" fill="currentColor" opacity="0.7" />
        <circle cx="185" cy="52" r="2.5" fill="currentColor" opacity="0.7" />
        <circle cx="58" cy="42" r="1.5" fill="currentColor" opacity="0.5" />
        <circle cx="162" cy="42" r="1.5" fill="currentColor" opacity="0.5" />
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
      <svg viewBox="0 0 220 110" className="sf-deck-art-svg sf-art-jeuveau" aria-hidden="true">
        <defs>
          <radialGradient id="jeuveauGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--card-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--card-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="110" cy="55" rx="78" ry="42" fill="url(#jeuveauGlow)" />
        <path d="M25 75 C60 30 110 25 150 45 C175 58 195 52 205 40" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.4" />
        <path d="M15 60 C55 20 115 15 165 40 C185 50 198 48 208 35" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <path d="M35 90 C70 50 120 45 160 65 C185 78 200 70 210 58" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" opacity="0.3" />
        <g className="sf-target-nodes">
          <circle cx="75" cy="38" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="75" cy="38" r="1.5" fill="currentColor" />
          <circle cx="115" cy="32" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
          <circle cx="115" cy="32" r="2" fill="currentColor" />
          <circle cx="155" cy="48" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="155" cy="48" r="1.5" fill="currentColor" />
        </g>
        <g className="sf-art-stylus">
          <line x1="85" y1="88" x2="135" y2="38" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="125" y1="28" x2="145" y2="48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="135" y1="38" x2="152" y2="21" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="156" cy="17" r="3" fill="currentColor" className="sf-micro-bead" />
        </g>
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
      { label: 'Focus', val: 'Surface Renewal & Infusion' },
      { label: 'Skin Focus', val: 'TEWL Barrier Rebuilding' },
      { label: 'Treatment Downtime', val: 'Little to none' }
    ],
    pills: ['Hydrodermabrasion Infusion', 'Dermaplaning Polish', 'Floraessence 20% Lactic Peel', 'Nano Infusion'],
    guideUrlKey: 'facialsGuide' as const,
    guideLabel: 'Explore Facials Directory',
    bookServiceId: 'ddd47915-309a-52fc-8bd0-0270524937f8',
    iconSvg: (
      <svg viewBox="0 0 220 110" className="sf-deck-art-svg sf-art-facials" aria-hidden="true">
        <defs>
          <radialGradient id="facialsGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--card-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--card-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="110" cy="55" rx="78" ry="42" fill="url(#facialsGlow)" />
        <path d="M40 75 C60 95 100 95 125 78 C155 58 150 30 118 25 C88 20 72 45 88 65 C102 80 132 75 142 58 C150 45 142 35 128 35" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" className="sf-vortex-stream" />
        <path d="M25 55 C45 85 85 92 120 85 C165 75 185 45 168 25 C152 8 115 12 102 32 C90 52 112 68 132 64 C148 60 152 48 142 40" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" opacity="0.4" />
        <g className="sf-art-botanical-core">
          <path d="M110 32 C125 45 132 62 128 78 C112 75 98 62 110 32 Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M110 32 L120 76" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          <path d="M114 45 L124 50" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
          <path d="M116 56 L126 62" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
          <circle cx="94" cy="52" r="4.5" fill="currentColor" className="sf-dew-spark" />
          <circle cx="145" cy="62" r="2.5" fill="currentColor" opacity="0.75" />
          <circle cx="75" cy="42" r="2" fill="currentColor" opacity="0.5" />
        </g>
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
      { label: 'Pigment', val: 'None — inkless' },
      { label: 'Protocol', val: 'Set at consultation' }
    ],
    pills: ['C-Section & Surgical Scars', 'Abdominal & Hip Stretch Marks', 'Injury & Trauma Scars'],
    guideUrlKey: 'scarRevision' as const,
    guideLabel: 'Explore Scar Revision Guide',
    bookServiceId: '2909d933-4de7-560b-810b-cd22d9be475b',
    iconSvg: (
      <svg viewBox="0 0 220 110" className="sf-deck-art-svg sf-art-scar" aria-hidden="true">
        <defs>
          <radialGradient id="scarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--card-accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--card-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="110" cy="55" rx="78" ry="42" fill="url(#scarGlow)" />
        <path d="M25 45 L45 65 M30 68 L50 40 M20 55 L55 52 M38 32 L42 78" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" strokeDasharray="2 3" />
        <g className="sf-stipple-matrix">
          <circle cx="70" cy="38" r="1.5" fill="currentColor" opacity="0.6" />
          <circle cx="78" cy="48" r="2" fill="currentColor" opacity="0.8" />
          <circle cx="72" cy="60" r="1.8" fill="currentColor" opacity="0.7" />
          <circle cx="85" cy="42" r="2.2" fill="currentColor" opacity="0.9" />
          <circle cx="82" cy="56" r="2.5" fill="currentColor" />
          <circle cx="94" cy="50" r="3" fill="currentColor" className="sf-active-peptide-core" />
          <circle cx="106" cy="52" r="2.5" fill="currentColor" />
        </g>
        <path d="M100 52 C125 38 145 68 175 52 C190 44 200 48 210 52" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M96 62 C120 48 142 78 172 62 C188 54 198 58 208 62" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.65" />
        <path d="M92 42 C118 28 138 58 168 42 C184 34 195 38 205 42" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
        <circle cx="140" cy="58" r="2.2" fill="currentColor" opacity="0.85" />
        <circle cx="165" cy="48" r="2" fill="currentColor" opacity="0.85" />
        <circle cx="192" cy="54" r="1.8" fill="currentColor" opacity="0.75" />
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
                      <span className="sf-deck-corner-bracket tl" aria-hidden="true" />
                      <span className="sf-deck-corner-bracket br" aria-hidden="true" />
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
          <svg
            className="sf-deck-constellation"
            viewBox="0 0 180 54"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M18 27 C49 27 54 10 90 10 S131 27 162 27" />
            <path d="M18 27 C49 27 54 44 90 44 S131 27 162 27" />
            <path d="M90 10 V44" />
            <circle cx="18" cy="27" r="4" />
            <circle cx="90" cy="10" r="5" />
            <circle cx="90" cy="44" r="5" />
            <circle cx="162" cy="27" r="4" />
            <circle cx="90" cy="27" r="2" className="is-core" />
          </svg>
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
