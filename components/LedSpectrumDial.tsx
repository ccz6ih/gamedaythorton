'use client';

import { useState } from 'react';
import Link from 'next/link';

interface WavelengthInfo {
  id: string;
  name: string;
  colorName: string;
  wavelength: string;
  glowColor: string;
  textColor: string;
  bgGradient: string;
  depth: string;
  cellularTarget: string;
  primaryBenefit: string;
  bestFor: string[];
  mechanism: string;
  synergy: string;
}

const WAVELENGTHS: WavelengthInfo[] = [
  {
    id: 'red',
    name: 'Red & Near-Infrared',
    colorName: 'Deep Crimson & NIR',
    wavelength: '630nm – 830nm',
    glowColor: '#ef4444',
    textColor: '#fca5a5',
    bgGradient: 'radial-gradient(circle at center, rgba(239, 68, 68, 0.25) 0%, rgba(22, 32, 26, 0.85) 75%)',
    depth: 'Dermis & Subcutaneous Tissue (up to 8–10mm)',
    cellularTarget: 'Cytochrome C Oxidase (Mitochondrial ATP Synthesis)',
    primaryBenefit: 'Collagen & Elastin Synthesis, Tissue Repair, Fine Line Softening',
    bestFor: [
      'Loss of skin elasticity & firmness',
      'Fine lines, expression wrinkles & crepey skin',
      'Post-procedure rapid tissue repair (PRF, microneedling, peels)',
      'Chronic inflammation & dull cellular turnover'
    ],
    mechanism:
      'Photons at 630–830nm penetrate into the deep dermis where they are absorbed by cytochrome c oxidase within cell mitochondria. This boosts adenosine triphosphate (ATP) cellular energy by up to 200%, stimulating fibroblasts to synthesize new pro-collagen I and elastin fibers while inhibiting matrix metalloproteinases (MMPs) that break down collagen.',
    synergy: 'Pairs exceptionally with PRF Microneedling and Radiofrequency Tightening to accelerate collagen remodeling.'
  },
  {
    id: 'blue',
    name: 'Blue Light',
    colorName: 'Cobalt Blue',
    wavelength: '415nm',
    glowColor: '#3b82f6',
    textColor: '#93c5fd',
    bgGradient: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.25) 0%, rgba(22, 32, 26, 0.85) 75%)',
    depth: 'Epidermis & Sebaceous Follicles (1–2mm)',
    cellularTarget: 'Endogenous Porphyrins in Cutibacterium acnes',
    primaryBenefit: 'Bacterial Acne Elimination, Sebum Regulation, Pore Clarification',
    bestFor: [
      'Active papules, pustules & inflammatory acne',
      'Congested, breakout-prone skin & excess oil',
      'Hormonal breakout flare-ups',
      'Preventative antibacterial pore sanitization'
    ],
    mechanism:
      'Targeted 415nm light excites endogenous coproporphyrin III inside Cutibacterium acnes (formerly P. acnes) bacteria. This photo-excitation produces toxic singlet oxygen species within the bacterial cell wall, selectively destroying acne bacteria without antibiotics, chemical dryness, or UV damage.',
    synergy: 'Pairs with Express Skin Clearing Facials and Salicylic Peels for comprehensive acne eradication.'
  },
  {
    id: 'green',
    name: 'Green Light',
    colorName: 'Emerald Green',
    wavelength: '525nm',
    glowColor: '#10b981',
    textColor: '#6ee7b7',
    bgGradient: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.25) 0%, rgba(22, 32, 26, 0.85) 75%)',
    depth: 'Epidermal-Dermal Junction (2–3mm)',
    cellularTarget: 'Basal Layer Melanocytes & Surface Capillaries',
    primaryBenefit: 'Pigment Regulation, Calming Hyperpigmentation, Evening Tone',
    bestFor: [
      'Sun spots, age spots & photo-damage',
      'Post-inflammatory hyperpigmentation (PIH) from old blemishes',
      'Uneven, blotchy skin tone',
      'Mild surface redness and vascular reactivity'
    ],
    mechanism:
      'Green light at 525nm regulates melanocyte activity at the basal membrane, inhibiting the overproduction and clustering of melanin. It gently breaks down existing hyperpigmented clusters near the surface while soothing surrounding capillary beds for an even, luminous complexion.',
    synergy: 'Pairs with Dermaplaning and Floraessence 20% Lactic Peels for maximum brightening radiance.'
  },
  {
    id: 'yellow',
    name: 'Yellow Light',
    colorName: 'Amber Gold',
    wavelength: '590nm',
    glowColor: '#f59e0b',
    textColor: '#fcd34d',
    bgGradient: 'radial-gradient(circle at center, rgba(245, 158, 11, 0.25) 0%, rgba(22, 32, 26, 0.85) 75%)',
    depth: 'Upper Dermis & Microvascular Plexus (2–4mm)',
    cellularTarget: 'Endothelial Cells & Lymphatic Capillaries',
    primaryBenefit: 'Lymphatic Drainage, Swelling Reduction, Post-Procedure Erythema',
    bestFor: [
      'Post-treatment redness and acute facial swelling',
      'Rosacea symptoms & sensitive, reactive skin',
      'Fluid retention, under-eye puffiness & sluggish lymph flow',
      'Compromised or sensitized skin barriers'
    ],
    mechanism:
      'Amber yellow light stimulates microcirculation and lymphatic flow, accelerating the clearance of metabolic waste and inflammatory cytokines. It down-regulates histamine release, dramatically shortening post-procedure recovery time and soothing sensitive or reactive skin barriers.',
    synergy: 'The ideal soothing finish following PRF Injections or intensive chemical exfoliation.'
  },
  {
    id: 'purple',
    name: 'Purple Light',
    colorName: 'Dual-Band Violet',
    wavelength: '415nm + 630nm Combined',
    glowColor: '#a855f7',
    textColor: '#d8b4fe',
    bgGradient: 'radial-gradient(circle at center, rgba(168, 85, 247, 0.25) 0%, rgba(22, 32, 26, 0.85) 75%)',
    depth: 'Dual-Depth (Surface to Deep Dermis)',
    cellularTarget: 'P. Acnes Bacteria + Fibroblast Mitochondria Simultaneously',
    primaryBenefit: 'Dual-Action Acne Clearing & Cellular Collagen Repair',
    bestFor: [
      'Adult acne with concurrent fine lines or aging concerns',
      'Active breakouts accompanied by post-acne scarring',
      'Compromised breakout-prone skin needing rejuvenation',
      'Comprehensive maintenance for combination skin'
    ],
    mechanism:
      'Combines the antibacterial power of 415nm blue light with the regenerative, collagen-boosting stimulation of 630nm red light. It sanitizes active acne bacteria while simultaneously promoting dermal healing to prevent post-inflammatory scar formation.',
    synergy: 'Pairs with Hydroboration Facials to clear deep sebum while stimulating cellular rejuvenation.'
  },
  {
    id: 'cyan',
    name: 'Cyan Light',
    colorName: 'Glacier Cyan',
    wavelength: '490nm',
    glowColor: '#06b6d4',
    textColor: '#67e8f9',
    bgGradient: 'radial-gradient(circle at center, rgba(6, 182, 212, 0.25) 0%, rgba(22, 32, 26, 0.85) 75%)',
    depth: 'Epidermis & Papillary Dermis (2mm)',
    cellularTarget: 'Cellular Membrane Receptors & Capillary Endothelium',
    primaryBenefit: 'Anti-Inflammatory De-Stressing, Calming Capillaries, Mild Acne Relief',
    bestFor: [
      'Stressed, irritated, or environmentally sensitized skin',
      'Colorado altitude weather-chapped skin',
      'Mild inflammation with capillary fragility',
      'Gentle post-extraction soothing'
    ],
    mechanism:
      'Cyan light operates at 490nm to release cellular tension and neutralize inflammation. It reduces vascular hyper-reactivity, soothes swollen tissues, and promotes cell membrane stabilization in weather-sensitized skin.',
    synergy: 'Pairs with the Wellness Signature Facial for deep restorative calming and barrier recovery.'
  },
  {
    id: 'white',
    name: 'White Light',
    colorName: 'Full-Spectrum White',
    wavelength: 'Full Therapeutic Spectrum (400–850nm)',
    glowColor: '#f8fafc',
    textColor: '#e2e8f0',
    bgGradient: 'radial-gradient(circle at center, rgba(248, 250, 252, 0.25) 0%, rgba(22, 32, 26, 0.85) 75%)',
    depth: 'Multi-Depth Omnidirectional Penetration',
    cellularTarget: 'Full Dermal Matrix & Cellular Energy Centers',
    primaryBenefit: 'Deep Cellular Metabolism, Firming, Overall Skin Revitalization',
    bestFor: [
      'Fatigued, lackluster, or sluggish complexion',
      'Global anti-aging and total skin revitalization',
      'Accelerating nutrient absorption from botanical serums',
      'Comprehensive pre-event radiance boost'
    ],
    mechanism:
      'Full-spectrum therapeutic light penetrates the entire depth of the dermal matrix, activating multiple cellular chromophores simultaneously. It boosts microcirculation, improves active nutrient absorption, and firms skin tone for a vibrant, rested glow.',
    synergy: 'Pairs with Nano Infusion and Getaway Glow Facials for multi-depth radiance.'
  }
];

export function LedSpectrumDial({ bookUrl }: { bookUrl: string }) {
  const [selectedId, setSelectedId] = useState<string>('red');
  const active = WAVELENGTHS.find((w) => w.id === selectedId) || WAVELENGTHS[0]!;

  return (
    <div className="sf-led-explorer" role="region" aria-label="Interactive LED Light Therapy Spectrum Explorer">
      {/* Header */}
      <div className="sf-led-explorer-head">
        <div className="sf-matcher-kicker">Interactive Phototherapy Explorer</div>
        <h3 className="sf-led-explorer-title">Explore the 7 Clinical Wavelengths</h3>
        <p className="sf-led-explorer-subtitle">
          Select any therapeutic wavelength to see how specific light frequencies penetrate
          skin layers, activate cellular mitochondria, and address targeted clinical concerns.
        </p>
      </div>

      {/* Spectrum Color Selector Buttons */}
      <div className="sf-led-spectrum-bar" role="tablist" aria-label="LED Light Colors">
        {WAVELENGTHS.map((item) => {
          const isSelected = item.id === active.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isSelected}
              className={`sf-led-tab${isSelected ? ' is-active' : ''}`}
              onClick={() => setSelectedId(item.id)}
              style={{
                '--led-glow': item.glowColor,
                '--led-text': item.textColor
              } as React.CSSProperties}
            >
              <span className="sf-led-dot" style={{ backgroundColor: item.glowColor, boxShadow: `0 0 10px ${item.glowColor}` }} />
              <span className="sf-led-tab-name">{item.name}</span>
              <span className="sf-led-tab-nm">{item.wavelength}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Wavelength Detail Card */}
      <div
        className="sf-led-detail-card"
        style={{
          background: active.bgGradient,
          borderColor: active.glowColor,
          boxShadow: `0 8px 32px -4px ${active.glowColor}25`
        }}
      >
        <div className="sf-led-detail-header">
          <div>
            <div className="sf-led-badge" style={{ color: active.textColor, borderColor: `${active.glowColor}60` }}>
              <span className="sf-led-pulse-dot" style={{ backgroundColor: active.glowColor, boxShadow: `0 0 8px ${active.glowColor}` }} />
              {active.wavelength} · {active.colorName}
            </div>
            <h4 className="sf-led-detail-title">{active.name}</h4>
            <p className="sf-led-detail-lead">{active.primaryBenefit}</p>
          </div>

          <div className="sf-led-depth-badge">
            <span className="sf-led-meta-label">Tissue Penetration Depth</span>
            <span className="sf-led-depth-val">{active.depth}</span>
          </div>
        </div>

        {/* Biological Mechanism */}
        <div className="sf-led-mechanism-box">
          <div className="sf-led-section-label">Cellular Mechanism & Action</div>
          <p className="sf-led-mechanism-text">{active.mechanism}</p>
        </div>

        {/* Clinical Targets & Synergy */}
        <div className="sf-led-grid-two">
          <div className="sf-led-subcard">
            <div className="sf-led-section-label">Target Indications & Concerns</div>
            <ul className="sf-led-bullets">
              {active.bestFor.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>

          <div className="sf-led-subcard">
            <div className="sf-led-section-label">Cellular Target & Modality Synergy</div>
            <div className="sf-led-synergy-item">
              <span className="sf-led-meta-label">Target Organelle:</span>
              <span className="sf-led-target-val">{active.cellularTarget}</span>
            </div>
            <div className="sf-led-synergy-item">
              <span className="sf-led-meta-label">Treatment Synergy:</span>
              <p className="sf-led-synergy-text">{active.synergy}</p>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="sf-led-card-footer">
          <div className="sf-led-price-note">
            <span className="sf-led-price-val">from $40</span>
            <span className="sf-led-price-time">30 Min · Zero Downtime</span>
          </div>
          <Link href={`${bookUrl}?service=3affd9d8-50ab-5cab-a413-0a9055acbb80`} className="sf-btn sf-btn-primary">
            Reserve LED Therapy &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
