'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ScarCategory {
  id: string;
  name: string;
  commonExamples: string;
  recommendedSerum: string;
  serumDetails: string;
  mechanism: string;
  expectedSessions: string;
  sessionInterval: string;
  sizingTier: string;
  priceEstimate: string;
  healingTimeline: string;
}

const SCAR_TYPES: ScarCategory[] = [
  {
    id: 'surgical',
    name: 'Surgical & Incision Scars',
    commonExamples: 'C-Section, Tummy Tuck (Abdominoplasty), Breast Augmentation/Reduction, Thyroidectomy, Orthopedic Scars',
    recommendedSerum: 'NUE Regen (Skin Cell Renewal Formulation)',
    serumDetails:
      'Infused with multi-peptides, hyaluronic acid, and botanical growth factors that trigger fibroblasts to break down rigid, fibrous scar tissue and synthesize smooth, flexible type I & III collagen.',
    mechanism:
      'Inkless revision uses sterile micro-channels to deliver bio-active serums directly into the scar bed without pigment. This softens dense surgical collagen bundles, flattens raised borders, and stimulates cellular repigmentation so the scar blends naturally into surrounding skin tone.',
    expectedSessions: '2 to 4 sessions',
    sessionInterval: '6 to 8 weeks apart',
    sizingTier: 'Small to Medium Area ($200 – $300)',
    priceEstimate: '$200 – $300 per session',
    healingTimeline: 'Initial pinkness for 1–2 weeks, progressive textural softening and color matching over 6–8 weeks.'
  },
  {
    id: 'stretch-marks',
    name: 'Stretch Marks (Striae Albae & Rubrae)',
    commonExamples: 'Post-Pregnancy Abdomen, Hips, Outer/Inner Thighs, Glutes, Breasts, Rapid Growth/Weight Change Marks',
    recommendedSerum: 'NUE Regen + NUE Bright Botanical Complex',
    serumDetails:
      'Proprietary botanical active serums designed specifically to restore lost elastin, fill dermal tears from within, and regulate localized melanin production in hypopigmented (white) stretch marks.',
    mechanism:
      'Stretch marks occur when the dermal collagen and elastin network tears under rapid tension, leaving thin, hypopigmented channels. Inkless paramedical revision triggers neovascularization (blood vessel formation) and neocollagenesis inside each tear, rebuilding dermal thickness and restoring natural skin pigment.',
    expectedSessions: '3 to 5 sessions',
    sessionInterval: '6 to 8 weeks apart',
    sizingTier: 'Large Area (from $400)',
    priceEstimate: 'from $400 per area',
    healingTimeline: 'Mild redness and micro-crusting for 5–7 days, followed by continuous dermal filling and pigment normalization over 2–3 months.'
  },
  {
    id: 'injury',
    name: 'Trauma & Injury Scars',
    commonExamples: 'Accidental Cuts, Facial Lacerations, Childhood Injury Scars, Burn Scars, Hypertrophic Texture Scars',
    recommendedSerum: 'NUE Regen Cell Renewal Formulation',
    serumDetails:
      'High-potency cellular regeneration serum that stimulates deep microcirculation and encourages healthy epithelial migration across damaged dermal tissue.',
    mechanism:
      'Targeted inkless micro-needling loosens restricted fibrotic scar tissue, improves tissue mobility, and encourages dormant melanocytes at the scar borders to migrate inward, naturally evening out skin discoloration without synthetic tattoo inks.',
    expectedSessions: '2 to 4 sessions',
    sessionInterval: '6 to 8 weeks apart',
    sizingTier: 'Small to Medium Area ($200 – $300)',
    priceEstimate: '$200 – $300 per session',
    healingTimeline: 'Erythema subsides within 7–10 days; collagen remodeling continues for up to 90 days.'
  },
  {
    id: 'hyperpigmented',
    name: 'Dark & Hyperpigmented Scars',
    commonExamples: 'Post-Inflammatory Hyperpigmentation (PIH) Scars, Burn Scars, Darkened Blemish Scars',
    recommendedSerum: 'NUE Bright (Botanical Brightening Serum)',
    serumDetails:
      'A non-toxic, inkless botanical complex with natural tyrosinase inhibitors and brightening plant extracts that safely down-regulate excess melanin production in darkened scar tissue.',
    mechanism:
      'Rather than covering dark scars with light tattoo ink (which creates a chalky, mismatched patch), NUE Bright gently breaks up concentrated melanin clusters and normalizes cellular pigment synthesis for a seamless, natural skin tone.',
    expectedSessions: '2 to 3 sessions',
    sessionInterval: '6 to 8 weeks apart',
    sizingTier: 'Small Area ($200)',
    priceEstimate: '$200 per session',
    healingTimeline: 'Gradual lightening and tone evening noticeable by weeks 4 to 6.'
  }
];

export function ScarRevisionExplorer({ bookUrl }: { bookUrl: string }) {
  const [selectedId, setSelectedId] = useState<string>('surgical');
  const active = SCAR_TYPES.find((s) => s.id === selectedId) || SCAR_TYPES[0]!;

  return (
    <div className="sf-scar-explorer" role="region" aria-label="Inkless Scar and Stretch Mark Revision Explorer">
      <div className="sf-scar-explorer-head">
        <div className="sf-matcher-kicker">Interactive Paramedical Explorer</div>
        <h3 className="sf-scar-explorer-title">Explore Inkless Revision by Scar Type</h3>
        <p className="sf-scar-explorer-sub">
          Select your scar or stretch mark category to review the recommended NUE Conceal serum protocol,
          cellular remodeling mechanism, expected session count, and healing trajectory.
        </p>
      </div>

      {/* Scar Type Selector Tabs */}
      <div className="sf-scar-tabs" role="tablist" aria-label="Scar Categories">
        {SCAR_TYPES.map((item) => {
          const isActive = item.id === active.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              className={`sf-scar-tab${isActive ? ' is-active' : ''}`}
              onClick={() => setSelectedId(item.id)}
            >
              <span className="sf-scar-tab-icon" aria-hidden="true">✦</span>
              <span className="sf-scar-tab-name">{item.name}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Scar Detail Card */}
      <div className="sf-scar-card">
        <div className="sf-scar-card-header">
          <div>
            <div className="sf-scar-tag">Paramedical Protocol</div>
            <h4 className="sf-scar-name">{active.name}</h4>
            <p className="sf-scar-examples"><b>Common Examples:</b> {active.commonExamples}</p>
          </div>

          <div className="sf-scar-price-box">
            <span className="sf-scar-price-val">{active.sizingTier}</span>
            <span className="sf-scar-price-sub">{active.expectedSessions}</span>
          </div>
        </div>

        {/* Serum and Mechanism Grid */}
        <div className="sf-scar-body-grid">
          <div className="sf-scar-info-card highlight">
            <span className="sf-scar-info-label">✦ Recommended Bio-Serum Formula</span>
            <h5 className="sf-scar-serum-title">{active.recommendedSerum}</h5>
            <p className="sf-scar-serum-desc">{active.serumDetails}</p>
          </div>

          <div className="sf-scar-info-card">
            <span className="sf-scar-info-label">✦ Dermal Remodeling Mechanism</span>
            <p className="sf-scar-mechanism-desc">{active.mechanism}</p>
          </div>
        </div>

        {/* Treatment Specifications Grid */}
        <div className="sf-scar-specs-grid">
          <div className="sf-scar-spec">
            <span className="sf-spec-lbl">Recommended Protocol:</span>
            <span className="sf-spec-val">{active.expectedSessions}</span>
          </div>
          <div className="sf-scar-spec">
            <span className="sf-spec-lbl">Interval Between Sessions:</span>
            <span className="sf-spec-val">{active.sessionInterval}</span>
          </div>
          <div className="sf-scar-spec">
            <span className="sf-spec-lbl">Healing Trajectory:</span>
            <span className="sf-spec-val">{active.healingTimeline}</span>
          </div>
        </div>

        {/* Action Foot */}
        <div className="sf-scar-card-foot">
          <p className="sf-scar-consult-hint">
            Every scar is unique. A complimentary consultation is conducted before your session to assess scar maturity,
            depth, and cellular pigmentation candidacy.
          </p>
          <div className="sf-scar-actions">
            <Link href={`${bookUrl}?service=68ea65e5-3598-5f10-93f2-6b886a8f9021`} className="sf-btn sf-btn-ghost">
              Free 15-Min Consult &rarr;
            </Link>
            <Link href={`${bookUrl}?service=2909d933-4de7-560b-810b-cd22d9be475b`} className="sf-btn sf-btn-primary">
              Reserve Revision Session &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
