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
  svgHighlightCoords: {
    cx?: number;
    cy?: number;
    path?: string;
  };
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
    naturalBenefit: 'Smooth, relaxed forehead while maintaining natural brow expressiveness and zero eyelid heaviness.',
    svgHighlightCoords: {
      path: 'M40 28 C60 18 100 18 120 28 C115 42 45 42 40 28 Z'
    }
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
    naturalBenefit: 'Eliminates chronic tired or unapproachable resting furrow while keeping genuine warmth.',
    svgHighlightCoords: {
      path: 'M62 38 C75 33 85 33 98 38 C90 48 70 48 62 38 Z'
    }
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
    naturalBenefit: 'Radiant, smooth eye contours that soften fine lines without taking away the sparkle of your real smile.',
    svgHighlightCoords: {
      path: 'M25 45 C32 40 36 55 28 65 C22 58 20 48 25 45 Z M135 45 C128 40 124 55 132 65 C138 58 140 48 135 45 Z'
    }
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
    naturalBenefit: 'Relieves chronic clenching while sculpting an elegant, softened jawline silhouette.',
    svgHighlightCoords: {
      path: 'M32 80 C36 72 45 74 42 90 C36 94 30 90 32 80 Z M128 80 C124 72 115 74 118 90 C124 94 130 90 128 80 Z'
    }
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
    naturalBenefit: 'A fuller, natural-looking upper lip when you smile with zero filler volume or puffiness.',
    svgHighlightCoords: {
      path: 'M66 84 C74 81 86 81 94 84 C88 88 72 88 66 84 Z'
    }
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
          Click any anatomical muscle zone on the facial map to see how dynamic expression occurs,
          the mistake conventional injectors make, and how our micro-targeted Jeuveau® protocol preserves your genuine expression.
        </p>
      </div>

      {/* Main Interactive Grid: Left SVG Face + Right Clinical Deep Dive */}
      <div className="sf-muscle-grid">
        {/* Left Column: Interactive Face Diagram & Selector Buttons */}
        <div className="sf-muscle-diagram-col">
          <div className="sf-face-diagram-wrap">
            <svg viewBox="0 0 160 140" className="sf-face-svg" aria-hidden="true">
              <defs>
                <radialGradient id="faceGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="var(--card-accent, #D4AF37)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="var(--card-accent, #D4AF37)" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Ambient Glow */}
              <ellipse cx="80" cy="70" rx="65" ry="60" fill="url(#faceGlow)" />

              {/* Anatomical Head & Face Outline */}
              <path
                d="M80 12 C46 12 30 35 30 65 C30 92 48 118 80 132 C112 118 130 92 130 65 C130 35 114 12 80 12 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity="0.35"
              />

              {/* Facial Symmetry Central Axis */}
              <line x1="80" y1="14" x2="80" y2="130" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.2" />

              {/* Eye Shapes */}
              <path d="M48 56 Q62 50 72 56 Q62 62 48 56 Z" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
              <path d="M88 56 Q98 50 112 56 Q98 62 88 56 Z" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />

              {/* Nose Bridge and Tip */}
              <path d="M80 46 L78 72 Q80 75 82 72 Z" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />

              {/* Subtle Lip Outline */}
              <path d="M68 94 Q80 88 92 94 Q80 102 68 94 Z" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />

              {/* Interactive Highlighted Muscle Zone Overlay */}
              <path
                d={active.svgHighlightCoords.path}
                fill="var(--card-accent, #D4AF37)"
                fillOpacity="0.45"
                stroke="var(--card-accent, #D4AF37)"
                strokeWidth="1.8"
                className="sf-active-muscle-path"
              />
            </svg>

            <div className="sf-face-active-label">
              <span className="sf-face-spark" />
              <span>{active.latinName}</span>
            </div>
          </div>

          {/* Quick Zone Selector Buttons */}
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

        {/* Right Column: In-Depth Anatomical Analysis Card */}
        <div className="sf-muscle-detail-col">
          <div className="sf-muscle-detail-card">
            <div className="sf-muscle-detail-header">
              <div>
                <div className="sf-muscle-latin-badge">{active.latinName}</div>
                <h4 className="sf-muscle-name">{active.name}</h4>
                <p className="sf-muscle-target"><b>Primary Indication:</b> {active.commonTarget}</p>
              </div>

              <div className="sf-muscle-dosing-pill">
                <span className="sf-dosing-lbl">Target Dosing</span>
                <span className="sf-dosing-val">{active.typicalUnits}</span>
              </div>
            </div>

            {/* Natural Movement vs Conventional Mistake Matrix */}
            <div className="sf-muscle-comparison-grid">
              <div className="sf-muscle-compare-card warning">
                <span className="sf-compare-badge danger">✕ The Conventional Injector Flaw</span>
                <p className="sf-compare-text">{active.conventionalMistake}</p>
              </div>

              <div className="sf-muscle-compare-card success">
                <span className="sf-compare-badge success">✓ The Med Bar Precision Standard</span>
                <p className="sf-compare-text">{active.medBarTechnique}</p>
              </div>
            </div>

            {/* Anatomical Role & Timeline Breakdown */}
            <div className="sf-muscle-specs-box">
              <div className="sf-muscle-spec-item">
                <span className="sf-muscle-spec-lbl">Anatomical Muscle Function:</span>
                <p className="sf-muscle-spec-body">{active.anatomicalRole}</p>
              </div>

              <div className="sf-muscle-spec-item">
                <span className="sf-muscle-spec-lbl">Onset Timeline &amp; Longevity:</span>
                <p className="sf-muscle-spec-body">{active.onsetAndDuration}</p>
              </div>

              <div className="sf-muscle-spec-item">
                <span className="sf-muscle-spec-lbl">Natural Aesthetic Outcome:</span>
                <p className="sf-muscle-spec-body highlight">{active.naturalBenefit}</p>
              </div>
            </div>

            {/* Action Footer */}
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
