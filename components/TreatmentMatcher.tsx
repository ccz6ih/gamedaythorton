'use client';

/**
 * components/TreatmentMatcher.tsx
 *
 * Interactive Treatment Matcher & Concern Navigator.
 * Enables prospective clients to quickly explore treatments based on their
 * specific aesthetic concerns (Under-Eye Hollows, Acne Scars & Texture,
 * Hair Thinning, Expression Lines, Scars/Stretch Marks, Lash Retention).
 *
 * Provides immediate clarity on:
 * - What modality matches their goal (PRF, Jeuveau, SkinAlchemy, Paramedical, UV Lashes)
 * - Why it works (the mechanism)
 * - Number of sessions & typical timeline
 * - Direct link to reserve or learn more
 *
 * 100% Platform native (React state + accessible tabs + zero external CDN scripts).
 */

import { useState } from 'react';
import Link from 'next/link';

interface ConcernOption {
  id: string;
  label: string;
  category: 'regenerative' | 'injectable' | 'paramedical' | 'lashes' | 'skin';
  matchedTreatment: string;
  treatmentSlug?: string;
  bookingUrl?: string;
  priceNote: string;
  timeEstimate: string;
  whyItWorks: string;
  whatToExpect: string;
  keyBenefits: string[];
}

const CONCERNS: ConcernOption[] = [
  {
    id: 'under-eye',
    label: 'Tired, Dark, or Hollow Under-Eyes',
    category: 'regenerative',
    matchedTreatment: 'PRF Under-Eye Injectable Treatment',
    treatmentSlug: 'under-eye',
    priceNote: '$450 per session',
    timeEstimate: '60 minutes',
    whyItWorks:
      'The under-eye area has extremely thin skin with minimal subcutaneous fat. 100% autologous PRF delivers concentrated platelets and a slow-releasing fibrin scaffold directly into the tissue, stimulating natural collagen renewal without synthetic filler risk.',
    whatToExpect:
      'Mild temporary fullness and redness for 24–48 hours. Progressive improvement in skin density and tone develops over 4–8 weeks. A series of 2–3 sessions is commonly recommended.',
    keyBenefits: [
      'Zero synthetic additives or foreign filler risk',
      'Naturally thickens and strengthens delicate under-eye skin',
      'No risk of the bluish Tyndall effect seen with hyaluronic gels'
    ]
  },
  {
    id: 'texture-scars',
    label: 'Fine Lines, Acne Scars & Uneven Texture',
    category: 'regenerative',
    matchedTreatment: 'PRF Microneedling + SkinAlchemy Calm Balm',
    treatmentSlug: 'microneedling',
    priceNote: 'from $800',
    timeEstimate: '85 minutes',
    whyItWorks:
      'Precision microneedling creates controlled micro-channels while saturating the dermis with your own platelet-rich fibrin. The platelets release cellular growth factors into the deeper dermis where genuine structural remodeling takes place.',
    whatToExpect:
      'Rosy, sunburn-like sensation for 24–48 hours. Finished with soothing Calm Balm. Noticeable smoothing and refined pore appearance develops over subsequent weeks as new collagen matures.',
    keyBenefits: [
      'Dual stimulation: mechanical micro-injury + autologous biological growth factors',
      'Refines pores, softens acne scars, and evens overall skin tone',
      'Supports long-term dermal thickness and elasticity'
    ]
  },
  {
    id: 'hair-thinning',
    label: 'Scalp Thinning & Decreased Hair Density',
    category: 'regenerative',
    matchedTreatment: 'PRF + Nue Strand Scalp Restoration',
    treatmentSlug: 'hair-restoration',
    priceNote: 'from $800',
    timeEstimate: '85 minutes',
    whyItWorks:
      'Concentrated autologous PRF and specialized Nue Strand signaling are delivered to dormant or miniaturized follicles. Biological growth factors improve localized micro-circulation and follicle vitality.',
    whatToExpect:
      'Minimal scalp tenderness for 1–2 days. Follicle cycles operate slowly, with early density and shedding reduction typically noticed after 2–3 sessions spaced monthly.',
    keyBenefits: [
      'Works with your existing living follicles to restore natural density',
      'Non-surgical and drug-free regenerative approach',
      'Pairs 100% autologous fibrin with advanced peptide nourishment'
    ]
  },
  {
    id: 'expression-lines',
    label: 'Forehead, Crow’s Feet & Frown Lines',
    category: 'injectable',
    matchedTreatment: 'Jeuveau® Neurotoxin Treatment',
    priceNote: '$14+ / unit',
    timeEstimate: '60 minutes',
    whyItWorks:
      'Jeuveau® (#NEWTOX) temporarily relaxes the specific facial muscles responsible for dynamic expression wrinkles, precision-dosed to preserve natural facial mobility without a frozen appearance.',
    whatToExpect:
      'Quick in-room appointment with tiny micro-injections. Subtle relaxation begins within 2–4 days, with full smoothing visible at day 14 and lasting 3–4 months.',
    keyBenefits: [
      'Modern, purified formulation designed specifically for aesthetics',
      'Preserves natural facial expression and emotion',
      'Dosed individually to your unique muscle anatomy'
    ]
  },
  {
    id: 'scars-stretchmarks',
    label: 'Surgical Scars, Trauma Scars & Stretch Marks',
    category: 'paramedical',
    matchedTreatment: 'Paramedical Inkless Tattoo & Scar Revision',
    priceNote: 'from $200 – $400',
    timeEstimate: '60 – 120 minutes',
    whyItWorks:
      'Inkless scar revision uses microscopic needle stimulation infused with specialized therapeutic serums to break down fibrotic scar tissue and trigger localized cellular melanin and collagen regeneration without pigment.',
    whatToExpect:
      'Treated tissue turns pink and heals over 4–6 weeks. Texture flattens and natural pigmentation gradually blends with surrounding healthy skin over 1–3 sessions.',
    keyBenefits: [
      '100% ink-free — works by waking up your own natural skin pigment',
      'Flattens raised scars and smooths indented stretch mark textures',
      'Permanent revision that ages naturally with your skin'
    ]
  },
  {
    id: 'sensitive-lashes',
    label: 'Lash Extensions for Sensitive Eyes',
    category: 'lashes',
    matchedTreatment: 'UV Lash Extension System (Classic, Hybrid, Volume)',
    priceNote: 'from $175 full set',
    timeEstimate: '120 minutes',
    whyItWorks:
      'UV lash technology cures medical-grade adhesive instantly using a specialized LED light beam, eliminating 80%+ of chemical fumes and adhesive sensitivity while locking in maximum retention.',
    whatToExpect:
      'Completely dry immediately upon leaving the studio. Wash face, shower, or workout immediately with zero 24-hour waiting period. Fills scheduled every 2–3 weeks.',
    keyBenefits: [
      'Immediate 1-second adhesive cure — no glue fumes or red, watery eyes',
      'Zero 24-hour water restrictions — swim, shower, or workout right away',
      'Superior retention across all Classic, Hybrid, and Volume styles'
    ]
  }
];

export function TreatmentMatcher({
  bookUrl,
  prfBaseUrl
}: {
  bookUrl?: string;
  prfBaseUrl?: string;
}) {
  const [selectedId, setSelectedId] = useState<string>('under-eye');
  const activeConcern = CONCERNS.find((c) => c.id === selectedId) ?? CONCERNS[0]!;

  return (
    <div className="sf-matcher">
      <div className="sf-matcher-head">
        <span className="sf-matcher-eyebrow">Personalized Treatment Guide</span>
        <h3 className="sf-matcher-title">Find What Matches Your Skin & Goals</h3>
        <p className="sf-matcher-desc">
          Select what you would like to address to explore the science, timeline, and recommended modality.
        </p>
      </div>

      {/* Concern selector pills */}
      <div className="sf-matcher-pills" role="tablist" aria-label="Aesthetic Concerns">
        {CONCERNS.map((c) => {
          const isSelected = c.id === selectedId;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={isSelected}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={`sf-matcher-pill ${isSelected ? 'is-active' : ''}`}
            >
              <span className="sf-matcher-pill-dot" aria-hidden="true" />
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* Matched card readout */}
      <div className="sf-matcher-card" role="tabpanel">
        <div className="sf-matcher-card-header">
          <div className="sf-matcher-card-meta">
            <span className="sf-matcher-match-tag">Recommended Modality</span>
            <h4 className="sf-matcher-treatment-name">{activeConcern.matchedTreatment}</h4>
          </div>
          <div className="sf-matcher-badge-group">
            <span className="sf-matcher-stat-badge">{activeConcern.priceNote}</span>
            <span className="sf-matcher-stat-badge duration">{activeConcern.timeEstimate}</span>
          </div>
        </div>

        <div className="sf-matcher-card-grid">
          <div className="sf-matcher-col">
            <h5 className="sf-matcher-section-title">Why It Works</h5>
            <p className="sf-matcher-prose">{activeConcern.whyItWorks}</p>

            <h5 className="sf-matcher-section-title" style={{ marginTop: 'var(--gd-4)' }}>What to Expect</h5>
            <p className="sf-matcher-prose">{activeConcern.whatToExpect}</p>
          </div>

          <div className="sf-matcher-col">
            <h5 className="sf-matcher-section-title">Key Advantages</h5>
            <ul className="sf-matcher-benefits">
              {activeConcern.keyBenefits.map((b, idx) => (
                <li key={idx}>
                  <span className="sf-matcher-check" aria-hidden="true">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="sf-matcher-actions">
              {bookUrl && (
                <Link href={bookUrl} className="sf-btn primary">
                  Reserve This Treatment <span>&rarr;</span>
                </Link>
              )}
              {activeConcern.treatmentSlug && prfBaseUrl && (
                <Link
                  href={`${prfBaseUrl}/${activeConcern.treatmentSlug}`}
                  className="sf-btn ghost"
                >
                  Read Treatment Deep-Dive
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
