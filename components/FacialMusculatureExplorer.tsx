'use client';

import { useState } from 'react';
import Link from 'next/link';

interface MuscleZone {
  id: string;
  name: string;
  latinName: string;
  commonTarget: string;
  anatomicalRole: string;
  conventionalMistake: string;
  medBarTechnique: string;
  typicalUnits: string;
  onsetAndDuration: string;
  naturalBenefit: string;
}

const MUSCLE_ZONES: MuscleZone[] = [
  {
    id: 'frontalis',
    name: 'Forehead Elevation Muscle',
    latinName: 'Musculus Frontalis',
    commonTarget: 'Horizontal Forehead Expression Lines',
    anatomicalRole:
      'The frontalis is the sole elevator muscle of the upper face—its fibers vertically pull the eyebrows upward to convey surprise, attentiveness, and openness.',
    conventionalMistake:
      'Over-dosing or injecting too low on the forehead freezes the entire muscle and paralyzes brow elevation, creating a heavy, dropped "caveman" brow and hooded eyelids.',
    medBarTechnique:
      'Micro-targeted dosing placed exclusively in the upper two-thirds of the frontalis, preserving the critical lower 2cm lateral brow arch so your eyebrows lift effortlessly and your eyes stay wide and bright.',
    typicalUnits: '8 – 16 Units (Customized to muscle mass)',
    onsetAndDuration: 'Onset in 3–5 days; peak at day 14; lasts 3–4 months.',
    naturalBenefit: 'Smooth, relaxed forehead while maintaining natural brow expressiveness and zero eyelid heaviness.'
  },
  {
    id: 'glabella',
    name: 'Frown & Furrow Complex ("The 11s")',
    latinName: 'Corrugator Supercilii & Procerus',
    commonTarget: 'Vertical Furrow Lines & Central Brow Tension',
    anatomicalRole:
      'Depressor muscles that pull the brows inward and downward during concentration, squinting, or frustration, etching deep vertical lines between the eyebrows.',
    conventionalMistake:
      'Ignoring the central procerus belly or injecting too close to the lateral brow, causing unnatural peaked "Spock brows" or flat, harsh facial resting expressions.',
    medBarTechnique:
      'A calibrated 5-point vector protocol targeting both corrugator heads, the corrugator tails, and the central procerus. This releases chronic tension while preserving authentic emotional responsiveness.',
    typicalUnits: '15 – 25 Units',
    onsetAndDuration: 'Onset in 2–4 days; peak at day 10; lasts 3–4 months.',
    naturalBenefit: 'Eliminates chronic tired or unapproachable resting furrow while keeping genuine warmth.'
  },
  {
    id: 'orbicularis',
    name: 'Lateral Eye Sphincter (Crow’s Feet)',
    latinName: 'Orbicularis Oculi (Pars Lateralis)',
    commonTarget: 'Crow’s Feet & Lateral Smile Lines',
    anatomicalRole:
      'A circular sphincter muscle encircling the eye socket that contracts during squinting, bright sunlight exposure, and joyful smiling.',
    conventionalMistake:
      'Paralyzing the entire lateral eye margin, which destroys the genuine "Duchenne smile" and forces unnatural compensatory wrinkling across the upper cheeks and nose bridge.',
    medBarTechnique:
      'Superficial micro-droplets placed precisely along the lateral outer fan, softening deep static etching while allowing the lower eyelid and cheek to lift naturally when you laugh.',
    typicalUnits: '6 – 12 Units per side',
    onsetAndDuration: 'Onset in 3–5 days; peak at day 14; lasts 3–4 months.',
    naturalBenefit: 'Radiant, smooth eye contours that soften fine lines without taking away the sparkle of your real smile.'
  },
  {
    id: 'masseter',
    name: 'Lower Jaw Contouring & TMJ Muscle',
    latinName: 'Musculus Masseter',
    commonTarget: 'Jaw Clenching, Teeth Grinding (Bruxism) & Square Jawline',
    anatomicalRole:
      'The primary muscle of mastication (chewing). Hypertrophy from stress, nighttime clenching, or genetics creates a widened, bulky lower jawline and tension headaches.',
    conventionalMistake:
      'Injecting too superficially into salivary glands or too far anteriorly into the risorius (smile muscle), which can restrict your smile.',
    medBarTechnique:
      'Deep intramuscular placement into the safe lower-posterior triangle of the masseter belly, relieving chronic jaw tension and gently slimming the facial silhouette into a soft contour.',
    typicalUnits: '15 – 30 Units per side',
    onsetAndDuration: 'Tension relief in 1–2 weeks; visible slimming in 4–6 weeks; lasts 4–6 months.',
    naturalBenefit: 'Relieves chronic clenching while sculpting an elegant, softened jawline silhouette.'
  },
  {
    id: 'lipflip',
    name: 'Perioral Sphincter ("Lip Flip")',
    latinName: 'Orbicularis Oris (Superior Border)',
    commonTarget: 'Thinning Upper Lip When Smiling & Gummy Smile',
    anatomicalRole:
      'The circular muscle framing the mouth that controls lip pursing and closure.',
    conventionalMistake:
      'Over-dosing units that impair straw drinking, whistle sounds, or clear articulation.',
    medBarTechnique:
      'Micro-dosing (typically 2 to 4 units total) placed superficially at the vermilion border to gently relax the curling muscle fibers, allowing the top lip to subtly roll outward ("flip") without synthetic filler.',
    typicalUnits: '2 – 4 Units Total',
    onsetAndDuration: 'Onset in 3–5 days; peak at day 10; lasts 2–3 months.',
    naturalBenefit: 'A fuller, natural-looking upper lip when you smile with zero filler volume or puffiness.'
  }
];

export function FacialMusculatureExplorer({ bookUrl }: { bookUrl: string }) {
  const [selectedId, setSelectedId] = useState<string>('frontalis');
  const active = MUSCLE_ZONES.find((z) => z.id === selectedId) || MUSCLE_ZONES[0]!;

  return (
    <div className="sf-muscle-explorer" role="region" aria-label="Interactive Facial Musculature Architecture Explorer">
      {/* Header */}
      <div className="sf-muscle-explorer-head">
        <div className="sf-matcher-kicker">Interactive Anatomical Atlas</div>
        <h3 className="sf-muscle-explorer-title">Precision Facial Musculature Explorer</h3>
        <p className="sf-muscle-explorer-sub">
          Select any anatomical muscle group to see how dynamic expression occurs,
          the mistake conventional injectors make, and how our micro-targeted Jeuveau® protocol preserves your genuine expression.
        </p>
      </div>

      {/* Main Interactive Grid: Left Realistic Anatomical Face + Right Analysis Card */}
      <div className="sf-muscle-grid">
        {/* Left Column: Realistic Face SVG & Zone Selector */}
        <div className="sf-muscle-diagram-col">
          <div className="sf-face-diagram-wrap">
            <svg viewBox="0 0 200 240" className="sf-face-svg sf-face-natural" aria-hidden="true">
              <defs>
                {/* Radial Glow Backdrop */}
                <radialGradient id="natGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#0E1711" stopOpacity="0" />
                </radialGradient>

                {/* Muscle Active Shading Gradient */}
                <linearGradient id="muscleActiveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.85" />
                  <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#B45309" stopOpacity="0.9" />
                </linearGradient>

                {/* Filter for Muscle Glow */}
                <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Ambient Atmosphere */}
              <ellipse cx="100" cy="120" rx="85" ry="95" fill="url(#natGlow)" />

              {/* ========================================================= */}
              {/* NATURAL REALISTIC FACIAL BASE (ANATOMICAL LINEWORK) */}
              {/* ========================================================= */}

              {/* Head Silhouette / Jawline / Neck */}
              <g className="sf-face-contours" stroke="#EFE7DA" fill="none" strokeLinecap="round" strokeLinejoin="round">
                {/* Cranium & Hairline */}
                <path d="M48 60 C40 90 40 125 54 158 C66 186 82 208 100 216 C118 208 134 186 146 158 C160 125 160 90 152 60 C144 32 124 16 100 16 C76 16 56 32 48 60 Z" strokeWidth="1.6" opacity="0.45" />

                {/* Neck Base */}
                <path d="M68 198 C65 215 58 230 45 238 M132 198 C135 215 142 230 155 238" strokeWidth="1.2" opacity="0.3" />

                {/* Cheekbone & Zygomatic Arch Contours */}
                <path d="M52 118 C64 128 72 138 76 155 M148 118 C136 128 128 138 124 155" strokeWidth="0.9" strokeDasharray="3 4" opacity="0.25" />

                {/* Natural Eyebrows */}
                {/* Left Eyebrow */}
                <path d="M58 82 C68 76 80 75 90 80" strokeWidth="2.2" opacity="0.65" />
                <path d="M60 84 C70 78 80 78 88 82" strokeWidth="1.2" opacity="0.4" />
                {/* Right Eyebrow */}
                <path d="M142 82 C132 76 120 75 110 80" strokeWidth="2.2" opacity="0.65" />
                <path d="M140 84 C130 78 120 78 112 82" strokeWidth="1.2" opacity="0.4" />

                {/* Natural Eyes & Eyelids */}
                {/* Left Eye */}
                <path d="M62 96 C70 90 80 90 88 96 C80 102 70 102 62 96 Z" strokeWidth="1.4" opacity="0.6" />
                <path d="M64 92 C72 87 80 87 86 92" strokeWidth="0.8" opacity="0.35" />
                <circle cx="75" cy="96" r="3.2" fill="#EFE7DA" opacity="0.75" />
                <circle cx="76" cy="95" r="1" fill="#16201A" />

                {/* Right Eye */}
                <path d="M138 96 C130 90 120 90 112 96 C120 102 130 102 138 96 Z" strokeWidth="1.4" opacity="0.6" />
                <path d="M136 92 C128 87 120 87 114 92" strokeWidth="0.8" opacity="0.35" />
                <circle cx="125" cy="96" r="3.2" fill="#EFE7DA" opacity="0.75" />
                <circle cx="124" cy="95" r="1" fill="#16201A" />

                {/* Natural Sculpted Nose */}
                <path d="M96 82 L96 130 C96 138 92 142 100 142 C108 142 104 138 104 130 L104 82" strokeWidth="1" opacity="0.35" />
                <path d="M88 138 C92 144 108 144 112 138" strokeWidth="1.3" opacity="0.6" />
                {/* Nostril Curves */}
                <path d="M86 138 C84 135 88 132 92 136 M114 138 C116 135 112 132 108 136" strokeWidth="1" opacity="0.5" />

                {/* Philtrum Ridge */}
                <path d="M97 148 L96 156 M103 148 L104 156" strokeWidth="0.8" opacity="0.3" />

                {/* Natural Lips & Mouth */}
                {/* Upper Lip with Cupid's Bow */}
                <path d="M82 165 C88 160 96 158 100 160 C104 158 112 160 118 165 C112 168 106 169 100 169 C94 169 88 168 82 165 Z" strokeWidth="1.4" opacity="0.6" />
                {/* Lip Separation Line */}
                <path d="M80 165 C90 167 100 166 100 166 C100 166 110 167 120 165" strokeWidth="1.2" opacity="0.6" />
                {/* Lower Lip Curve */}
                <path d="M84 167 C92 176 108 176 116 167" strokeWidth="1.3" opacity="0.5" />

                {/* Chin Shadow / Mental Crease */}
                <path d="M92 188 C97 191 103 191 108 188" strokeWidth="1" opacity="0.35" />
              </g>

              {/* ========================================================= */}
              {/* DYNAMIC ACTIVE MUSCLE OVERLAYS (HIGH-PRECISION ANATOMY) */}
              {/* ========================================================= */}

              {/* ZONE 1: FRONTALIS (FOREHEAD ELEVATION) */}
              {active.id === 'frontalis' && (
                <g className="sf-active-muscle-layer" filter="url(#goldGlow)">
                  <path
                    d="M56 46 C60 32 95 30 96 46 L96 74 C86 72 65 72 56 74 Z"
                    fill="url(#muscleActiveGrad)"
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M144 46 C140 32 105 30 104 46 L104 74 C114 72 135 72 144 74 Z"
                    fill="url(#muscleActiveGrad)"
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                  />
                  <line x1="68" y1="36" x2="68" y2="72" stroke="#FEF3C7" strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />
                  <line x1="82" y1="34" x2="82" y2="73" stroke="#FEF3C7" strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />
                  <line x1="118" y1="34" x2="118" y2="73" stroke="#FEF3C7" strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />
                  <line x1="132" y1="36" x2="132" y2="72" stroke="#FEF3C7" strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />
                  <circle cx="70" cy="48" r="2.8" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="84" cy="46" r="2.8" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="116" cy="46" r="2.8" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="130" cy="48" r="2.8" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                </g>
              )}

              {/* ZONE 2: GLABELLA (CORRUGATOR & PROCERUS - 11s) */}
              {active.id === 'glabella' && (
                <g className="sf-active-muscle-layer" filter="url(#goldGlow)">
                  <path d="M94 92 L100 70 L106 92 Z" fill="url(#muscleActiveGrad)" stroke="#F59E0B" strokeWidth="1.4" />
                  <path d="M95 78 C88 74 74 72 66 77 C72 82 85 84 95 82 Z" fill="url(#muscleActiveGrad)" stroke="#F59E0B" strokeWidth="1.5" />
                  <path d="M105 78 C112 74 126 72 134 77 C128 82 115 84 105 82 Z" fill="url(#muscleActiveGrad)" stroke="#F59E0B" strokeWidth="1.5" />
                  <circle cx="100" cy="74" r="2.8" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="90" cy="78" r="2.8" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="76" cy="76" r="2.8" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="110" cy="78" r="2.8" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="124" cy="76" r="2.8" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                </g>
              )}

              {/* ZONE 3: ORBICULARIS OCULI (CROW’S FEET) */}
              {active.id === 'orbicularis' && (
                <g className="sf-active-muscle-layer" filter="url(#goldGlow)">
                  <path
                    d="M58 84 C46 88 42 102 52 114 C58 110 58 92 60 86 Z"
                    fill="url(#muscleActiveGrad)"
                    stroke="#F59E0B"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M142 84 C154 88 158 102 148 114 C142 110 142 92 140 86 Z"
                    fill="url(#muscleActiveGrad)"
                    stroke="#F59E0B"
                    strokeWidth="1.4"
                  />
                  <circle cx="48" cy="90" r="2.5" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="45" cy="99" r="2.5" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="49" cy="108" r="2.5" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="152" cy="90" r="2.5" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="155" cy="99" r="2.5" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="151" cy="108" r="2.5" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                </g>
              )}

              {/* ZONE 4: MASSETER (JAWLINE & TMJ) */}
              {active.id === 'masseter' && (
                <g className="sf-active-muscle-layer" filter="url(#goldGlow)">
                  <path
                    d="M52 138 C56 128 66 130 68 148 L64 184 C56 182 48 168 52 138 Z"
                    fill="url(#muscleActiveGrad)"
                    stroke="#F59E0B"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M148 138 C144 128 134 130 132 148 L136 184 C144 182 152 168 148 138 Z"
                    fill="url(#muscleActiveGrad)"
                    stroke="#F59E0B"
                    strokeWidth="1.6"
                  />
                  <circle cx="58" cy="155" r="3" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="60" cy="168" r="3" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="142" cy="155" r="3" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="140" cy="168" r="3" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                </g>
              )}

              {/* ZONE 5: LIP FLIP (ORBICULARIS ORIS) */}
              {active.id === 'lipflip' && (
                <g className="sf-active-muscle-layer" filter="url(#goldGlow)">
                  <path
                    d="M80 162 C88 156 96 154 100 156 C104 154 112 156 120 162 C114 164 106 166 100 166 C94 166 86 164 80 162 Z"
                    fill="url(#muscleActiveGrad)"
                    stroke="#F59E0B"
                    strokeWidth="1.4"
                  />
                  <circle cx="88" cy="160" r="2.2" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="96" cy="157" r="2.2" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="104" cy="157" r="2.2" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                  <circle cx="112" cy="160" r="2.2" fill="#FFFFFF" stroke="#D4AF37" strokeWidth="1.5" />
                </g>
              )}
            </svg>

            {/* Active Muscle Floating Tag */}
            <div className="sf-face-active-label">
              <span className="sf-face-spark" />
              <span>{active.latinName}</span>
            </div>
          </div>

          {/* Muscle Zone Selection Rail */}
          <div className="sf-muscle-zone-buttons" role="tablist" aria-label="Facial Muscle Zones">
            {MUSCLE_ZONES.map((zone) => {
              const isSelected = zone.id === active.id;
              return (
                <button
                  key={zone.id}
                  role="tab"
                  aria-selected={isSelected}
                  className={`sf-muscle-zone-btn${isSelected ? ' is-active' : ''}`}
                  onClick={() => setSelectedId(zone.id)}
                >
                  <span className="sf-zone-btn-dot" />
                  <span className="sf-zone-btn-text">{zone.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: High-Contrast, Crystal-Clear Clinical Analysis */}
        <div className="sf-muscle-detail-col">
          <div className="sf-muscle-detail-card">
            <div className="sf-muscle-detail-header">
              <div>
                <div className="sf-muscle-latin-badge">{active.latinName}</div>
                <h4 className="sf-muscle-name">{active.name}</h4>
                <p className="sf-muscle-target">
                  <span className="sf-target-lbl">Primary Indication:</span> {active.commonTarget}
                </p>
              </div>

              <div className="sf-muscle-dosing-pill">
                <span className="sf-dosing-lbl">Target Dosing</span>
                <span className="sf-dosing-val">{active.typicalUnits}</span>
              </div>
            </div>

            {/* High-Contrast Comparison Matrix: Flaw vs Standard */}
            <div className="sf-muscle-comparison-grid">
              <div className="sf-muscle-compare-card warning">
                <div className="sf-compare-head danger">
                  <span className="sf-compare-icon">✕</span>
                  <span className="sf-compare-title">The Conventional Injector Flaw</span>
                </div>
                <p className="sf-compare-text">{active.conventionalMistake}</p>
              </div>

              <div className="sf-muscle-compare-card success">
                <div className="sf-compare-head success">
                  <span className="sf-compare-icon">✓</span>
                  <span className="sf-compare-title">The Med Bar Precision Standard</span>
                </div>
                <p className="sf-compare-text">{active.medBarTechnique}</p>
              </div>
            </div>

            {/* Anatomical Role & Outcome Specifications */}
            <div className="sf-muscle-specs-box">
              <div className="sf-muscle-spec-item">
                <span className="sf-muscle-spec-lbl">Anatomical Muscle Function</span>
                <p className="sf-muscle-spec-body">{active.anatomicalRole}</p>
              </div>

              <div className="sf-muscle-spec-item">
                <span className="sf-muscle-spec-lbl">Onset Timeline &amp; Longevity</span>
                <p className="sf-muscle-spec-body">{active.onsetAndDuration}</p>
              </div>

              <div className="sf-muscle-spec-item">
                <span className="sf-muscle-spec-lbl">Natural Aesthetic Outcome</span>
                <p className="sf-muscle-spec-body highlight">{active.naturalBenefit}</p>
              </div>
            </div>

            {/* Card Action Foot */}
            <div className="sf-muscle-card-foot">
              <div className="sf-muscle-price-note">
                <span className="sf-muscle-price-val">$14+ / Unit</span>
                <span className="sf-muscle-price-sub">Jeuveau® Purified #NEWTOX</span>
              </div>

              <div className="sf-muscle-actions">
                <Link href={`${bookUrl}?service=68ea65e5-3598-5f10-93f2-6b886a8f9021`} className="sf-btn sf-btn-ghost">
                  Free 15-Min Consult &rarr;
                </Link>
                <Link href={`${bookUrl}?service=4511ad22-af4a-5f94-8b12-fe42de71129d`} className="sf-btn sf-btn-primary">
                  Reserve Jeuveau® &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
