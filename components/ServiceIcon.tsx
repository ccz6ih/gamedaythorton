/**
 * components/ServiceIcon.tsx
 * Line-art marks for the service menu.
 *
 * WHY SVG RATHER THAN THE IMAGES THE OLD SITE USES
 * The page this replaces gives every service a raster circle — about thirty
 * images, each a few hundred kilobytes, loaded before a visitor can read a
 * price. They also carry a baked-in colour, so rebranding the practice means
 * redrawing thirty files.
 *
 * These draw in the brand accent via currentColor, weigh nothing, stay sharp on
 * any screen, and a new brand kit recolours all of them at once.
 *
 * Matching is by keyword against the service name first, then category, so a
 * practice can add "UV Volume | 4-Week Fill" tomorrow and it picks up the lash
 * mark without anyone touching this file.
 */

/**
 * components/ServiceIcon.tsx
 * Bespoke luxury hand-drawn animated marks for The Med Bar service menu.
 *
 * Each service has a dedicated, meaningful icon tailored to the exact treatment modality:
 * - UV Lashes: Classic (1:1), Hybrid (textured), and Volume (5D blooming fan)
 * - Facials: Dermaplaning blade, Hydro vortex, Nano-infusion, Lactic peel, Sun glow, Firming lift
 * - Injectables & PRF: Precision syringe, Under-eye crescent, Microneedle matrix, Follicle strand
 * - Paramedical: Micro-stipple stylus
 * - Skin Therapies: LED photon canopy, RF tightening waves, Body peel, Waxing honeycomb
 * - Consultation: 15-minute consultation dial & dialogue
 */

type Props = { name: string; category: string; className?: string };

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
};

/* ------------------------------------------------------------- 1. LASHES -- */

/** UV Classic Lashes — 1:1 individual natural extension with UV cure beam */
function UVClassicLash() {
  return (
    <g className="sf-art-classic-lash">
      {/* Eyelid base curve */}
      <path d="M3.5 15.5 C8 11.5 16 11.5 20.5 15.5" {...S} strokeWidth={1.75} className="sf-eye-lid-upper" />
      {/* 1:1 Clean distinct single lash extensions */}
      <path d="M5.5 13.5 C4.8 9.5 4 6.5 2.5 4" {...S} strokeWidth={1.6} className="sf-lash-c1" />
      <path d="M8.5 12.2 C8.2 8 8 5 7 2.5" {...S} strokeWidth={1.75} className="sf-lash-c2" />
      <path d="M12 11.8 C12 7.5 12 4.5 12 1.8" {...S} strokeWidth={1.8} className="sf-lash-c3" />
      <path d="M15.5 12.2 C15.8 8 16 5 17 2.5" {...S} strokeWidth={1.75} className="sf-lash-c4" />
      <path d="M18.5 13.5 C19.2 9.5 20 6.5 21.5 4" {...S} strokeWidth={1.6} className="sf-lash-c5" />
      {/* UV light beam indicator */}
      <circle cx="12" cy="18.5" r="1.8" fill="currentColor" stroke="none" className="sf-uv-beam" />
      <path d="M9 20.5 Q12 22 15 20.5" {...S} strokeWidth={1.2} opacity="0.6" />
    </g>
  );
}

/** UV Hybrid Lashes — Textured mix of classic lengths and wispy volume fans */
function UVHybridLash() {
  return (
    <g className="sf-art-hybrid-lash">
      <path d="M3 15.5 C7.5 11 16.5 11 21 15.5" {...S} strokeWidth={1.75} className="sf-eye-lid-upper" />
      {/* Multi-layered criss-cross wispy texture */}
      <path d="M5 13 C4 9 3 6 1.8 3.5" {...S} strokeWidth={1.5} />
      <path d="M6.5 12.5 C6.8 9.5 7.5 7 9 4.5" {...S} strokeWidth={1.4} opacity="0.75" />
      <path d="M8.5 11.8 C8 7.5 7.5 4.5 6.5 2" {...S} strokeWidth={1.75} />
      <path d="M10.8 11.5 C11.5 8 12.5 5.5 14 3" {...S} strokeWidth={1.4} opacity="0.75" />
      <path d="M12 11.2 C12 7 12 4 12 1.5" {...S} strokeWidth={1.8} />
      <path d="M13.2 11.5 C12.5 8 11.5 5.5 10 3" {...S} strokeWidth={1.4} opacity="0.75" />
      <path d="M15.5 11.8 C16 7.5 16.5 4.5 17.5 2" {...S} strokeWidth={1.75} />
      <path d="M17.5 12.5 C17.2 9.5 16.5 7 15 4.5" {...S} strokeWidth={1.4} opacity="0.75" />
      <path d="M19 13 C20 9 21 6 22.2 3.5" {...S} strokeWidth={1.5} />
      <circle cx="12" cy="18" r="1.5" fill="#ffffff" stroke="none" className="sf-hybrid-spark" />
    </g>
  );
}

/** UV Volume Lashes — Dense, dramatic Russian volume 5D-6D blooming fan */
function UVVolumeLash() {
  return (
    <g className="sf-art-volume-lash">
      <path d="M2.5 16 C7 11.5 17 11.5 21.5 16" {...S} strokeWidth={2} className="sf-eye-lid-upper" />
      {/* Blooming dense bouquet of lashes */}
      <path d="M4 14 C2.5 9.5 1.5 6 0.8 3" {...S} strokeWidth={1.5} />
      <path d="M6 13 C4.8 9 4 5.5 3.5 2.5" {...S} strokeWidth={1.6} />
      <path d="M8 12.2 C7 8 6.5 4.8 6 2" {...S} strokeWidth={1.7} />
      <path d="M10 11.6 C9.5 7.5 9.2 4.2 9 1.5" {...S} strokeWidth={1.75} />
      <path d="M12 11.2 C12 6.8 12 3.8 12 1.2" {...S} strokeWidth={2} />
      <path d="M14 11.6 C14.5 7.5 14.8 4.2 15 1.5" {...S} strokeWidth={1.75} />
      <path d="M16 12.2 C17 8 17.5 4.8 18 2" {...S} strokeWidth={1.7} />
      <path d="M18 13 C19.2 9 20 5.5 20.5 2.5" {...S} strokeWidth={1.6} />
      <path d="M20 14 C21.5 9.5 22.5 6 23.2 3" {...S} strokeWidth={1.5} />
      {/* Radiant volume crown spark */}
      <circle cx="12" cy="18.5" r="2.2" fill="currentColor" stroke="none" className="sf-vol-glow" />
    </g>
  );
}

/* ------------------------------------------------------------- 2. INJECTABLES & PRF -- */

/** Jeuveau & Neurotoxin — Cosmetic precision syringe */
function SyringeRelax() {
  return (
    <g className="sf-art-syringe">
      <path d="M13.8 8.2 L19.2 2.8 a 1.4 1.4 0 0 1 2 2 L15.8 10.2" {...S} strokeWidth={1.75} />
      <path
        d="M12.8 9.2 L5.5 16.5 a 1.8 1.8 0 0 0 0 2.5 l .7 .7 a 1.8 1.8 0 0 0 2.5 0 L16 12.4 Z"
        {...S}
        strokeWidth={1.5}
        fill="currentColor"
        fillOpacity="0.22"
      />
      <path d="M4.5 19.5 L2 22" {...S} strokeWidth={1.8} />
      <path d="M11.8 10.2 L13.8 12.2" {...S} strokeWidth={1.3} />
      <path d="M9.4 12.6 L11.4 14.6" {...S} strokeWidth={1.3} />
      <path d="M17.2 1.8 L22.2 6.8" {...S} strokeWidth={1.75} />
      <circle cx="1.6" cy="22.4" r="1.3" fill="#ffffff" stroke="currentColor" strokeWidth="0.8" className="sf-needle-bead" />
    </g>
  );
}

/** PRF Under-Eye Injectable Treatment — Delicate eye crescent with PRF bio-infusion */
function PrfUnderEye() {
  return (
    <g className="sf-art-under-eye">
      {/* Serene almond eye contour */}
      <path d="M2.5 11.5 C6.5 6.5 17.5 6.5 21.5 11.5" {...S} strokeWidth={1.6} />
      <path d="M4 12.5 C8 16.5 16 16.5 20 12.5" {...S} strokeWidth={1.4} />
      <circle cx="12" cy="11.5" r="2.8" {...S} strokeWidth={1.3} />
      <circle cx="12" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
      {/* Under-eye PRF restorative crescent aura */}
      <path
        d="M5 16 C8.5 21 15.5 21 19 16"
        {...S}
        strokeWidth={2}
        fill="currentColor"
        fillOpacity="0.2"
        className="sf-under-crescent"
      />
      {/* PRF platelet sparks */}
      <circle cx="9" cy="18" r="1.2" fill="#ffffff" stroke="none" className="sf-platelet-1" />
      <circle cx="12" cy="19.2" r="1.4" fill="#ffffff" stroke="none" className="sf-platelet-2" />
      <circle cx="15" cy="18" r="1.2" fill="#ffffff" stroke="none" className="sf-platelet-3" />
    </g>
  );
}

/** PRF Microneedling Treatment — Handpiece with active collagen-induction matrix */
function MicroneedleMatrix() {
  return (
    <g className="sf-art-micro">
      <path
        d="M8.5 16.5 L17.5 7.5 l 2.8 2.8 L11.5 19.5 L7 20.8 Z"
        {...S}
        strokeWidth={1.6}
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path d="M17.5 7.5 L19.5 5.5 a 1.6 1.6 0 0 1 2.3 0 l .4 .4 a 1.6 1.6 0 0 1 0 2.3 L20.3 10.3" {...S} strokeWidth={1.6} />
      {[0, 1, 2].map(r => [0, 1, 2].map(c => (
        <circle
          key={`${r}-${c}`}
          cx={3.2 + c * 2.5}
          cy={3.5 + r * 2.5}
          r=".85"
          fill="currentColor"
          stroke="none"
          className={`sf-matrix-dot sf-dot-${r}-${c}`}
        />
      )))}
    </g>
  );
}

/** PRF + Nue Strand Hair Restoration — Follicle root vitality */
function HairFollicle() {
  return (
    <g className="sf-art-hair">
      <path
        d="M3.5 21.5 C3.5 13.5 7.5 8 12 8 S20.5 13.5 20.5 21.5"
        {...S}
        strokeWidth={1.75}
        fill="currentColor"
        fillOpacity="0.16"
      />
      <path d="M7 21.5 C7 15.5 9.2 11.5 12 11.5 S17 15.5 17 21.5" {...S} strokeWidth={1.4} />
      <path d="M12 8 V2" {...S} strokeWidth={1.75} />
      <path d="M12 2 L9 4.8 M12 2 L15 4.8" {...S} strokeWidth={1.6} />
      <circle cx="12" cy="16.5" r="1.8" fill="#ffffff" stroke="none" className="sf-hair-glow" />
    </g>
  );
}

/* ------------------------------------------------------------- 3. FACIALS & PEELS -- */

/** Dermaplaning Facial — Surgical blade exfoliating smooth crescent */
function DermaplaneBlade() {
  return (
    <g className="sf-art-dermaplane">
      {/* Precision 10R butter blade */}
      <path
        d="M4 19 L16 7 C18.5 4.5 21 5.5 21.5 7.5 C22 9.5 20 12 17.5 14.5 L7.5 21 Z"
        {...S}
        strokeWidth={1.6}
        fill="currentColor"
        fillOpacity="0.22"
        className="sf-blade-body"
      />
      {/* Honed blade edge bevel */}
      <path d="M6 17 L17.5 5.5" {...S} strokeWidth={1.8} stroke="#ffffff" strokeOpacity="0.9" />
      <line x1="12" y1="13" x2="15" y2="10" {...S} strokeWidth={1.2} />
      {/* Gliding exfoliation gleam */}
      <path d="M2.5 14.5 C6.5 11 12 11 16 14.5" {...S} strokeDasharray="1.8 2" strokeWidth={1.3} opacity="0.65" />
      <circle cx="19.5" cy="5.5" r="1.2" fill="#ffffff" stroke="none" className="sf-blade-spark" />
    </g>
  );
}

/** Hydrodermabrasion Facial — Swirling aqua-infusion vortex */
function HydroVortex() {
  return (
    <g className="sf-art-hydro">
      {/* Swirling fluid hydro vortex */}
      <path
        d="M12 3 A9 9 0 0 1 21 12 A9 9 0 0 1 12 21 A9 9 0 0 1 4.5 7.5"
        {...S}
        strokeWidth={1.75}
        strokeLinecap="round"
        className="sf-vortex-outer"
      />
      <path
        d="M12 6.5 A5.5 5.5 0 0 1 17.5 12 A5.5 5.5 0 0 1 12 17.5 A5.5 5.5 0 0 1 7.2 9.5"
        {...S}
        strokeWidth={1.5}
        className="sf-vortex-inner"
      />
      {/* Central micro-droplet */}
      <circle cx="12" cy="12" r="2.2" fill="#ffffff" stroke="currentColor" strokeWidth="1" className="sf-hydro-drop" />
    </g>
  );
}

/** Nano Infusion Facial — Transdermal stamping array with nutrient infusion */
function NanoInfusion() {
  return (
    <g className="sf-art-nano">
      {/* Precision nano tip */}
      <path
        d="M9 16 L15 16 L17 9 L7 9 Z"
        {...S}
        strokeWidth={1.6}
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path d="M10 9 L10 3 L14 3 L14 9" {...S} strokeWidth={1.5} />
      {/* Nano infusion pyramid needles & serum micro-droplets */}
      <line x1="9" y1="16" x2="9" y2="19.5" {...S} strokeWidth={1.5} />
      <line x1="12" y1="16" x2="12" y2="20.5" {...S} strokeWidth={1.75} />
      <line x1="15" y1="16" x2="15" y2="19.5" {...S} strokeWidth={1.5} />
      <circle cx="9" cy="21.5" r="0.9" fill="#ffffff" stroke="none" className="sf-platelet-1" />
      <circle cx="12" cy="22.5" r="1.1" fill="#ffffff" stroke="none" className="sf-platelet-2" />
      <circle cx="15" cy="21.5" r="0.9" fill="#ffffff" stroke="none" className="sf-platelet-3" />
      {/* Ambient radiance */}
      <path d="M4 11 C2.5 13 2.5 16 4 18" {...S} strokeDasharray="1.5 2" opacity="0.6" />
      <path d="M20 11 C21.5 13 21.5 16 20 18" {...S} strokeDasharray="1.5 2" opacity="0.6" />
    </g>
  );
}

/** Floraessence Lactic Peel 20% — Organic botanical chemical peel renewal */
function LacticPeel() {
  return (
    <g className="sf-art-peel">
      {/* Renewal cell boundary */}
      <circle cx="12" cy="12" r="8.5" {...S} strokeWidth={1.5} fill="currentColor" fillOpacity="0.16" />
      {/* Chemical exfoliation peel layer lifting away */}
      <path
        d="M12 3.5 C16.5 3.5 20.5 7.5 20.5 12 C20.5 15.5 18 18.5 15 20"
        {...S}
        strokeWidth={1.8}
        strokeDasharray="2.5 2.5"
        className="sf-peel-ring"
      />
      {/* Botanical AHA lactic droplets */}
      <path d="M12 6 C10.5 8 9.5 9.5 9.5 11 A2.5 2.5 0 0 0 14.5 11 C14.5 9.5 13.5 8 12 6 Z" fill="#ffffff" stroke="none" className="sf-drop-body" />
      <circle cx="8" cy="15" r="1" fill="#ffffff" stroke="none" opacity="0.75" />
      <circle cx="15.5" cy="14" r="1.2" fill="#ffffff" stroke="none" opacity="0.85" />
    </g>
  );
}

/** Wellness Signature Facial — Harmonious botanical lotus petal & glowing skin */
function BotanicalWellness() {
  return (
    <g className="sf-art-wellness">
      {/* Central sacred lotus / petal contour */}
      <path
        d="M12 3 C9.5 7.5 7.5 12.5 7.5 16.5 A4.5 4.5 0 0 0 16.5 16.5 C16.5 12.5 14.5 7.5 12 3 Z"
        {...S}
        strokeWidth={1.6}
        fill="currentColor"
        fillOpacity="0.22"
        className="sf-drop-body"
      />
      {/* Left & right radiating wellness petals */}
      <path d="M8 15 C5.5 13.5 4 11 4 8 C6.5 8 9 10 10 12.5" {...S} strokeWidth={1.4} opacity="0.8" />
      <path d="M16 15 C18.5 13.5 20 11 20 8 C17.5 8 15 10 14 12.5" {...S} strokeWidth={1.4} opacity="0.8" />
      <circle cx="12" cy="14.5" r="1.5" fill="#ffffff" stroke="none" />
    </g>
  );
}

/** Golden Hour Glow Firming Facial — Golden sun contour with upward firming lift */
function GoldenFirming() {
  return (
    <g className="sf-art-firming">
      {/* Golden hour sun arch */}
      <path d="M4 14 A8 8 0 0 1 20 14" {...S} strokeWidth={1.8} />
      {/* Sun rays */}
      <line x1="12" y1="3" x2="12" y2="1" {...S} strokeWidth={1.8} />
      <line x1="6.5" y1="5.5" x2="5" y2="4" {...S} strokeWidth={1.6} />
      <line x1="17.5" y1="5.5" x2="19" y2="4" {...S} strokeWidth={1.6} />
      <line x1="3" y1="12" x2="1" y2="12" {...S} strokeWidth={1.6} />
      <line x1="21" y1="12" x2="23" y2="12" {...S} strokeWidth={1.6} />
      {/* Upward firming contour arrows */}
      <path d="M7 17 L12 13 L17 17" {...S} strokeWidth={1.6} stroke="#ffffff" className="sf-lift-1" />
      <path d="M8.5 21 L12 18 L15.5 21" {...S} strokeWidth={1.4} stroke="#ffffff" opacity="0.75" className="sf-lift-2" />
    </g>
  );
}

/** Getaway Glow — Vacation sunbeams & radiance spark */
function GetawaySunGlow() {
  return (
    <g className="sf-art-glow">
      <circle cx="12" cy="12" r="5" {...S} strokeWidth={1.8} fill="currentColor" fillOpacity="0.25" />
      {/* 8-point radiance sunburst */}
      <line x1="12" y1="2" x2="12" y2="4.5" {...S} strokeWidth={1.75} />
      <line x1="12" y1="19.5" x2="12" y2="22" {...S} strokeWidth={1.75} />
      <line x1="2" y1="12" x2="4.5" y2="12" {...S} strokeWidth={1.75} />
      <line x1="19.5" y1="12" x2="22" y2="12" {...S} strokeWidth={1.75} />
      <line x1="5" y1="5" x2="6.8" y2="6.8" {...S} strokeWidth={1.5} />
      <line x1="17.2" y1="17.2" x2="19" y2="19" {...S} strokeWidth={1.5} />
      <line x1="5" y1="19" x2="6.8" y2="17.2" {...S} strokeWidth={1.5} />
      <line x1="17.2" y1="6.8" x2="19" y2="5" {...S} strokeWidth={1.5} />
      <circle cx="12" cy="12" r="2" fill="#ffffff" stroke="none" className="sf-blade-spark" />
    </g>
  );
}

/** Skin Clearing Facial & Express Clearing — Purifying blemish clarity */
function SkinClearing() {
  return (
    <g className="sf-art-clearing">
      {/* Botanical clarity shield / droplet */}
      <path
        d="M12 3 C6.5 8 6 13 9 17.5 C12 21.5 16 21 18.5 17 C21 13 20 8 12 3 Z"
        {...S}
        strokeWidth={1.6}
        fill="currentColor"
        fillOpacity="0.2"
      />
      {/* Clarifying purifying sparks */}
      <path d="M12 7 L12 13 M9 10 L15 10" {...S} strokeWidth={1.5} stroke="#ffffff" className="sf-blade-spark" />
      <circle cx="15.5" cy="16" r="1.2" fill="#ffffff" stroke="none" className="sf-platelet-1" />
      <circle cx="8.5" cy="15" r="1" fill="#ffffff" stroke="none" className="sf-platelet-2" />
    </g>
  );
}

/* ------------------------------------------------------------- 4. SKIN & BODY THERAPIES -- */

/** LED Light Therapy — Canopy emission canopy with photon wavelengths */
function LedTherapy() {
  return (
    <g className="sf-art-led">
      {/* LED Phototherapy curved emitter canopy */}
      <path
        d="M3 8 C8 4 16 4 21 8 L20 10.5 C15.5 7 8.5 7 4 10.5 Z"
        {...S}
        strokeWidth={1.6}
        fill="currentColor"
        fillOpacity="0.3"
      />
      {/* LED light emitters */}
      <circle cx="6" cy="8" r="0.9" fill="#ffffff" stroke="none" />
      <circle cx="10" cy="6.8" r="0.9" fill="#ffffff" stroke="none" />
      <circle cx="14" cy="6.8" r="0.9" fill="#ffffff" stroke="none" />
      <circle cx="18" cy="8" r="0.9" fill="#ffffff" stroke="none" />
      {/* Cascading photon rays */}
      <line x1="6" y1="12" x2="6" y2="18" {...S} strokeWidth={1.4} className="sf-photon-1" stroke="#ffffff" />
      <line x1="10" y1="11" x2="10" y2="21" {...S} strokeWidth={1.6} className="sf-photon-2" stroke="var(--gd-accent)" />
      <line x1="14" y1="11" x2="14" y2="21" {...S} strokeWidth={1.6} className="sf-photon-3" stroke="var(--gd-accent)" />
      <line x1="18" y1="12" x2="18" y2="18" {...S} strokeWidth={1.4} className="sf-photon-4" stroke="#ffffff" />
    </g>
  );
}

/** Radiofrequency Skin Tightening — Thermal RF collagen contraction waves */
function RfTightening() {
  return (
    <g className="sf-art-rf">
      {/* Concentric RF energy waves */}
      <path d="M3 6.5 C7.5 4 16.5 4 21 6.5" {...S} strokeWidth={1.6} className="sf-rf-wave-1" />
      <path d="M4.5 11.5 C8 9.5 16 9.5 19.5 11.5" {...S} strokeWidth={1.8} className="sf-rf-wave-2" />
      <path d="M6.5 16.5 C9 15 15 15 17.5 16.5" {...S} strokeWidth={2} className="sf-rf-wave-3" />
      {/* Focal thermal tightening energy core */}
      <circle cx="12" cy="20" r="2.2" fill="#ffffff" stroke="currentColor" strokeWidth="1.2" className="sf-blade-spark" />
    </g>
  );
}

/** Performance Bacne Peel — Deep botanical back/body peel */
function BackPeel() {
  return (
    <g className="sf-art-backpeel">
      {/* Anatomical back & shoulder contour */}
      <path d="M3 8 C7 10 10 14 10 21 M21 8 C17 10 14 14 14 21" {...S} strokeWidth={1.75} />
      <path d="M10 21 C11 21.5 13 21.5 14 21" {...S} strokeWidth={1.5} />
      {/* Active botanical peel droplets along spinal contour */}
      <circle cx="12" cy="9" r="1.4" fill="#ffffff" stroke="none" className="sf-platelet-1" />
      <circle cx="12" cy="13" r="1.6" fill="currentColor" stroke="none" className="sf-platelet-2" />
      <circle cx="12" cy="17" r="1.4" fill="#ffffff" stroke="none" className="sf-platelet-3" />
    </g>
  );
}

/** Waxing — Botanical honeycomb honey drip & smooth silky finish */
function WaxingSmooth() {
  return (
    <g className="sf-art-wax">
      {/* Honeycomb cell */}
      <path
        d="M12 3 L18 6.5 L18 13.5 L12 17 L6 13.5 L6 6.5 Z"
        {...S}
        strokeWidth={1.6}
        fill="currentColor"
        fillOpacity="0.22"
      />
      {/* Honey nectar drop */}
      <path d="M12 13 C10.8 15 10 16.5 10 18 A2 2 0 0 0 14 18 C14 16.5 13.2 15 12 13 Z" fill="#ffffff" stroke="none" className="sf-needle-bead" />
      <path d="M19.5 16 C21 17.5 21.5 19.5 21.5 21" {...S} strokeWidth={1.4} />
      <circle cx="12" cy="9" r="1.2" fill="#ffffff" stroke="none" />
    </g>
  );
}

/* ------------------------------------------------------------- 5. PARAMEDICAL & CONSULT -- */

/** Paramedical Tattoo & Inkless Scar Revision — Precision restorative stylus */
function ScarPenPrecision() {
  return (
    <g className="sf-art-scar">
      <path
        d="M5.5 18.5 L16.8 7.2 l 3 3 L8.5 21.5 H5.5 Z"
        {...S}
        strokeWidth={1.6}
        fill="currentColor"
        fillOpacity="0.22"
      />
      <path d="M16.8 7.2 L18.8 5.2 a 1.5 1.5 0 0 1 2.2 0 l .7 .7 a 1.5 1.5 0 0 1 0 2.2 L19.8 10.2" {...S} strokeWidth={1.6} />
      <path d="M2.5 14 C4.2 12.5 5.5 13.2 7.2 12" {...S} strokeDasharray="1.8 1.8" strokeWidth={1.6} className="sf-scar-stipple-1" />
      <path d="M2.5 8.5 C4.2 7 5.5 7.7 7.2 6.5" {...S} strokeDasharray="1.8 1.8" strokeWidth={1.6} className="sf-scar-stipple-2" />
      <circle cx="4.5" cy="19.5" r="1.2" fill="#ffffff" stroke="none" className="sf-scar-spark" />
    </g>
  );
}

/** Consultation | 15 Minutes — 15-minute dial with welcoming clinical dialogue */
function ConsultClock() {
  return (
    <g className="sf-art-consult">
      {/* Precision 15-min timer dial */}
      <circle cx="12" cy="12" r="8.5" {...S} strokeWidth={1.6} fill="currentColor" fillOpacity="0.14" />
      {/* 15-minute quadrant highlighted (12 to 3 o'clock) */}
      <path d="M12 3.5 A8.5 8.5 0 0 1 20.5 12 L12 12 Z" fill="currentColor" fillOpacity="0.28" stroke="none" />
      <polyline points="12,6.5 12,12 16.5,12" {...S} strokeWidth={1.8} stroke="#ffffff" />
      {/* Compass / Dialogue spark */}
      <circle cx="12" cy="12" r="1.5" fill="#ffffff" stroke="none" />
    </g>
  );
}

/* ------------------------------------------------------------- MAPPING ENGINE -- */

/**
 * High-specificity exact matching rules so every service in the catalogue gets its
 * own unique, tailored artwork.
 */
const BY_NAME: [RegExp, () => React.JSX.Element][] = [
  // 1. Lashes (Distinguished by tier)
  [/classic/i, UVClassicLash],
  [/hybrid/i, UVHybridLash],
  [/volume/i, UVVolumeLash],
  [/lash/i, UVClassicLash],

  // 2. Injectables & PRF
  [/under-?eye/i, PrfUnderEye],
  [/hair|nue strand|scalp/i, HairFollicle],
  [/microneedl/i, MicroneedleMatrix],
  [/jeuveau|neurotoxin|botox|tox\b/i, SyringeRelax],

  // 3. Facials & Peels
  [/dermaplan/i, DermaplaneBlade],
  // Matches both spellings. The treatment was listed as "Hydroboration Facial"
  // — a term from organic chemistry — until it was renamed to hydrodermabrasion,
  // and an icon that silently stopped matching is how a row loses its artwork
  // without anyone noticing.
  [/hydro(boration|dermabrasion)/i, HydroVortex],
  [/nano infusion/i, NanoInfusion],
  [/lactic|floraessence/i, LacticPeel],
  [/golden hour/i, GoldenFirming],
  [/getaway glow/i, GetawaySunGlow],
  [/bacne/i, BackPeel],
  [/skin clearing|express clearing|\bacne\b/i, SkinClearing],
  [/wellness signature/i, BotanicalWellness],

  // 4. Skin Therapies
  [/led|light therapy/i, LedTherapy],
  [/radiofrequency|rf\b|tightening/i, RfTightening],
  [/waxing|wax\b/i, WaxingSmooth],

  // 5. Paramedical & Consult
  [/paramedical|tattoo|scar|stretch mark/i, ScarPenPrecision],
  [/consult/i, ConsultClock]
];

const BY_CATEGORY: Record<string, () => React.JSX.Element> = {
  lashes: UVClassicLash,
  injectables: SyringeRelax,
  facials: BotanicalWellness,
  paramedical: ScarPenPrecision,
  skin: LedTherapy,
  consult: ConsultClock
};

export function ServiceIcon({ name, category, className }: Props) {
  const byName = BY_NAME.find(([re]) => re.test(name));
  const Mark = byName ? byName[1] : (BY_CATEGORY[category] ?? BotanicalWellness);

  return (
    <svg
      className={`sf-service-svg ${className ?? ''}`}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
    >
      <Mark />
    </svg>
  );
}
