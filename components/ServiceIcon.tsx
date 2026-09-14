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

type Props = { name: string; category: string; className?: string };

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
};

/* ------------------------------------------------------------- the marks -- */

/**
 * Hand-drawn luxury blinking & fluttering eye for Lashes & Under-Eye PRF.
 */
function EyeFlutter() {
  return (
    <g className="sf-art-eye">
      {/* Upper eyelid arch with natural hand-drawn curvature */}
      <path
        d="M2.5 13.5 C6.5 8 17.5 8 21.5 13.5"
        {...S}
        strokeWidth={1.75}
        className="sf-eye-lid-upper"
      />
      {/* Lower eyelid */}
      <path
        d="M3.5 14 C7.5 18 16.5 18 20.5 14"
        {...S}
        strokeWidth={1.3}
        className="sf-eye-lid-lower"
      />
      {/* Delicate flutter lashes */}
      <path d="M4 11.5 C3.2 9.5 2.5 7.5 1.5 6" {...S} strokeWidth={1.5} className="sf-lash-1" />
      <path d="M7.5 9.5 C7.2 7 6.8 4.8 6 3" {...S} strokeWidth={1.6} className="sf-lash-2" />
      <path d="M12 8.5 C12 6 12 3.8 12 1.8" {...S} strokeWidth={1.75} className="sf-lash-3" />
      <path d="M16.5 9.5 C16.8 7 17.2 4.8 18 3" {...S} strokeWidth={1.6} className="sf-lash-4" />
      <path d="M20 11.5 C20.8 9.5 21.5 7.5 22.5 6" {...S} strokeWidth={1.5} className="sf-lash-5" />

      {/* Iris / Pupil with golden reflection */}
      <circle cx="12" cy="13.5" r="3.2" {...S} strokeWidth={1.4} className="sf-eye-iris" />
      <circle cx="12" cy="13.5" r="1.4" fill="currentColor" stroke="none" className="sf-eye-pupil" />
      <circle cx="13" cy="12.5" r="0.6" fill="#ffffff" stroke="none" opacity="0.9" />

      {/* Under-eye regenerative PRF crescent aura */}
      <path
        d="M6 18.5 C9.5 21.5 14.5 21.5 18 18.5"
        {...S}
        strokeWidth={1.2}
        strokeDasharray="1.5 2"
        opacity="0.6"
        className="sf-under-glow"
      />
    </g>
  );
}

/**
 * Regenerative PRF Liquid Gold Droplet with active bio-platelets.
 */
function PrfDroplet() {
  return (
    <g className="sf-art-drop">
      {/* Radiant golden teardrop */}
      <path
        d="M12 2.2 C7.5 7.5 4.5 11.8 4.5 15.2 a 7.5 7.5 0 0 0 15 0 c 0 -3.4 -3 -7.7 -7.5 -13 z"
        {...S}
        strokeWidth={1.75}
        fill="currentColor"
        fillOpacity="0.22"
        className="sf-drop-body"
      />
      {/* Inner specular curve */}
      <path
        d="M8 15.5 A 4 4 0 0 0 12 19.5"
        {...S}
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* Floating active bio-platelets */}
      <circle cx="12" cy="13" r="1.6" fill="#ffffff" stroke="none" className="sf-platelet-1" />
      <circle cx="14.8" cy="10.5" r="1" fill="#ffffff" stroke="none" className="sf-platelet-2" />
      <circle cx="9.2" cy="10" r="0.9" fill="#ffffff" stroke="none" className="sf-platelet-3" />
      <circle cx="13.8" cy="16.2" r="0.8" fill="#ffffff" stroke="none" className="sf-platelet-4" />
    </g>
  );
}

/**
 * Cosmetic Syringe with pearling micro-droplet at needle tip.
 */
function SyringeRelax() {
  return (
    <g className="sf-art-syringe">
      {/* Syringe barrel & plunger */}
      <path
        d="M13.8 8.2 L19.2 2.8 a 1.4 1.4 0 0 1 2 2 L15.8 10.2"
        {...S}
        strokeWidth={1.75}
      />
      <path
        d="M12.8 9.2 L5.5 16.5 a 1.8 1.8 0 0 0 0 2.5 l .7 .7 a 1.8 1.8 0 0 0 2.5 0 L16 12.4 Z"
        {...S}
        strokeWidth={1.5}
        fill="currentColor"
        fillOpacity="0.22"
        className="sf-syringe-chamber"
      />
      {/* Needle */}
      <path d="M4.5 19.5 L2 22" {...S} strokeWidth={1.8} />
      {/* Graduations */}
      <path d="M11.8 10.2 L13.8 12.2" {...S} strokeWidth={1.3} />
      <path d="M9.4 12.6 L11.4 14.6" {...S} strokeWidth={1.3} />
      {/* Finger flange */}
      <path d="M17.2 1.8 L22.2 6.8" {...S} strokeWidth={1.75} />
      {/* Pearling micro-droplet at the needle tip */}
      <circle cx="1.6" cy="22.4" r="1.3" fill="#ffffff" stroke="currentColor" strokeWidth="0.8" className="sf-needle-bead" />
    </g>
  );
}

/**
 * Precision Microneedling Handpiece with collagen-stimulating matrix aura.
 */
function MicroneedleMatrix() {
  return (
    <g className="sf-art-micro">
      {/* Sleek pen chassis */}
      <path
        d="M8.5 16.5 L17.5 7.5 l 2.8 2.8 L11.5 19.5 L7 20.8 Z"
        {...S}
        strokeWidth={1.6}
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path d="M17.5 7.5 L19.5 5.5 a 1.6 1.6 0 0 1 2.3 0 l .4 .4 a 1.6 1.6 0 0 1 0 2.3 L20.3 10.3" {...S} strokeWidth={1.6} />
      {/* Micro-channel pulse dots */}
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

/**
 * Hair Follicle & Nue Strand with ascending regenerative droplets.
 */
function HairFollicle() {
  return (
    <g className="sf-art-hair">
      {/* Flowing hair arches */}
      <path
        d="M3.5 21.5 C3.5 13.5 7.5 8 12 8 S20.5 13.5 20.5 21.5"
        {...S}
        strokeWidth={1.75}
        fill="currentColor"
        fillOpacity="0.16"
        className="sf-hair-strand-1"
      />
      <path
        d="M7 21.5 C7 15.5 9.2 11.5 12 11.5 S17 15.5 17 21.5"
        {...S}
        strokeWidth={1.4}
        className="sf-hair-strand-2"
      />
      {/* Follicle root spark */}
      <path d="M12 8 V2" {...S} strokeWidth={1.75} className="sf-hair-root" />
      <path d="M12 2 L9 4.8 M12 2 L15 4.8" {...S} strokeWidth={1.6} />
      <circle cx="12" cy="16.5" r="1.8" fill="#ffffff" stroke="none" className="sf-hair-glow" />
    </g>
  );
}

/**
 * Paramedical Tattoo & Inkless Scar Revision.
 */
function ScarPenPrecision() {
  return (
    <g className="sf-art-scar">
      {/* Precision stylus */}
      <path
        d="M5.5 18.5 L16.8 7.2 l 3 3 L8.5 21.5 H5.5 Z"
        {...S}
        strokeWidth={1.6}
        fill="currentColor"
        fillOpacity="0.22"
      />
      <path d="M16.8 7.2 L18.8 5.2 a 1.5 1.5 0 0 1 2.2 0 l .7 .7 a 1.5 1.5 0 0 1 0 2.2 L19.8 10.2" {...S} strokeWidth={1.6} />
      {/* Micro-stipple revision paths */}
      <path d="M2.5 14 C4.2 12.5 5.5 13.2 7.2 12" {...S} strokeDasharray="1.8 1.8" strokeWidth={1.6} className="sf-scar-stipple-1" />
      <path d="M2.5 8.5 C4.2 7 5.5 7.7 7.2 6.5" {...S} strokeDasharray="1.8 1.8" strokeWidth={1.6} className="sf-scar-stipple-2" />
      <circle cx="4.5" cy="19.5" r="1.2" fill="#ffffff" stroke="none" className="sf-scar-spark" />
    </g>
  );
}

function FaceGlow() {
  return (
    <g className="sf-art-face">
      <path
        d="M12 2.8 c 4.5 0 7.5 3 7.5 7.2 0 5.2 -3.4 11.8 -7.5 11.8 S 4.5 15.2 4.5 10 c 0 -4.2 3 -7.2 7.5 -7.2 Z"
        {...S}
        strokeWidth={1.6}
        fill="currentColor"
        fillOpacity="0.18"
      />
      <circle cx="8.8" cy="9.8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.2" cy="9.8" r="1.3" fill="currentColor" stroke="none" />
      <path d="M9.8 15.5 c 1.3 1 3.1 1 4.4 0" {...S} strokeWidth={1.6} />
    </g>
  );
}

/* --------------------------------------------------------------- mapping -- */

const BY_NAME: [RegExp, () => React.JSX.Element][] = [
  [/under-?eye/i, EyeFlutter],
  [/lash|fill\b|full set|volume|hybrid|classic/i, EyeFlutter],
  [/hair|strand|scalp/i, HairFollicle],
  [/microneedl/i, MicroneedleMatrix],
  [/prf|platelet/i, PrfDroplet],
  [/neurotoxin|jeuveau|botox|tox\b|filler|inject/i, SyringeRelax],
  [/paramedical|scar|stretch mark|tattoo/i, ScarPenPrecision],
  [/facial|hydra|dermaplane|glow/i, FaceGlow]
];

const BY_CATEGORY: Record<string, () => React.JSX.Element> = {
  lashes: EyeFlutter,
  injectables: SyringeRelax,
  paramedical: ScarPenPrecision,
  skin: PrfDroplet,
  facials: FaceGlow
};

export function ServiceIcon({ name, category, className }: Props) {
  const byName = BY_NAME.find(([re]) => re.test(name));
  const Mark = byName ? byName[1] : (BY_CATEGORY[category] ?? FaceGlow);

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
