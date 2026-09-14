/**
 * components/Centrifuge.tsx
 * The hero mark: a blood tube separating into platelet-rich fibrin.
 *
 * WHY THIS AND NOT A PHOTOGRAPH
 * PRF is the practice's signature and nobody's booking page explains it. A
 * stock image of a treatment room says nothing; this says "your own blood, spun
 * here, and the gold layer is the part that goes back in" before a word is
 * read.
 *
 * WHY CSS AND NOT GSAP
 * The design it came from loads two scripts from a CDN. The content security
 * policy admits no external script origin at all, and opening one for an
 * animation is a far bigger concession than the font — a script can do anything
 * on the page, a font cannot.
 *
 * So the ring spins, the whole blood fades, the red cells settle and the PRF
 * layer fills, all on keyframes. It costs nothing, needs no hydration, and
 * still runs if the JavaScript never arrives. Under prefers-reduced-motion it
 * renders the finished state rather than the journey.
 *
 * Colours come from the brand kit, so this is gold on green here and whatever
 * the next practice chooses there.
 */

export function Centrifuge() {
  return (
    <div className="sf-cent" aria-hidden="true">
      <div className="sf-cent-halo" />
      <svg viewBox="0 0 400 400" className="sf-cent-svg">
        <defs>
          {/* PRF liquid gold gradient */}
          <linearGradient id="sf-prf-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f7dc87" />
            <stop offset="45%" stopColor="#e5b842" />
            <stop offset="100%" stopColor="#c59825" />
          </linearGradient>

          {/* Deep cellular red blood gradient */}
          <linearGradient id="sf-rbc-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9c2d3c" />
            <stop offset="60%" stopColor="#761d2a" />
            <stop offset="100%" stopColor="#4a0f19" />
          </linearGradient>

          {/* Whole blood before spin */}
          <linearGradient id="sf-whole-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a2a38" />
            <stop offset="100%" stopColor="#541722" />
          </linearGradient>

          {/* Specular glass tube highlight */}
          <linearGradient id="sf-glass-spec" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="25%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.18" />
          </linearGradient>

          {/* Molecular spine emblem gradient */}
          <linearGradient id="sf-spine-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--gd-accent)" stopOpacity="0.75" />
            <stop offset="100%" stopColor="var(--gd-accent)" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Ambient background: The Med Bar molecular spine constellation */}
        <g className="sf-cent-spine" stroke="url(#sf-spine-gold)" strokeWidth="1.75">
          {/* The signature 5-node vertical serpentine molecular chain */}
          <path
            d="M200,68 L228,118 L192,176 L226,236 L196,294"
            fill="none"
            strokeDasharray="3 3"
            strokeOpacity="0.45"
          />
          {/* Connecting bonds */}
          <line x1="200" y1="68" x2="228" y2="118" strokeWidth="2" strokeOpacity="0.65" />
          <line x1="228" y1="118" x2="192" y2="176" strokeWidth="2" strokeOpacity="0.65" />
          <line x1="192" y1="176" x2="226" y2="236" strokeWidth="2" strokeOpacity="0.65" />
          <line x1="226" y1="236" x2="196" y2="294" strokeWidth="2" strokeOpacity="0.65" />

          {/* Nodes with concentric bio-rings */}
          <circle cx="200" cy="68" r="9" fill="none" strokeWidth="2" />
          <circle cx="200" cy="68" r="3.5" fill="var(--gd-accent)" stroke="none" opacity="0.8" />

          <circle cx="228" cy="118" r="11" fill="none" strokeWidth="2" />
          <circle cx="228" cy="118" r="4.5" fill="var(--gd-accent)" stroke="none" opacity="0.85" />

          <circle cx="192" cy="176" r="13" fill="none" strokeWidth="2.2" />
          <circle cx="192" cy="176" r="5.5" fill="var(--gd-accent)" stroke="none" opacity="0.9" />

          <circle cx="226" cy="236" r="11" fill="none" strokeWidth="2" />
          <circle cx="226" cy="236" r="4.5" fill="var(--gd-accent)" stroke="none" opacity="0.85" />

          <circle cx="196" cy="294" r="9" fill="none" strokeWidth="2" />
          <circle cx="196" cy="294" r="3.5" fill="var(--gd-accent)" stroke="none" opacity="0.8" />
        </g>

        {/* The rotating centrifuge rotor */}
        <g className="sf-cent-ring">
          <circle cx="200" cy="200" r="172" fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth="1" strokeDasharray="4 6" />
          <circle cx="200" cy="200" r="156" fill="none" stroke="currentColor" strokeOpacity=".10" strokeWidth="1" />
          <circle cx="200" cy="200" r="140" fill="none" stroke="currentColor" strokeOpacity=".06" strokeWidth="1" />

          {/* Precision axis ticks */}
          <g stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5">
            <line x1="200" y1="20" x2="200" y2="44" />
            <line x1="380" y1="200" x2="356" y2="200" />
            <line x1="200" y1="380" x2="200" y2="356" />
            <line x1="20" y1="200" x2="44" y2="200" />
          </g>
          {/* Diagonals */}
          <g stroke="currentColor" strokeOpacity=".18" strokeWidth="1">
            <line x1="326" y1="74" x2="310" y2="90" />
            <line x1="326" y1="326" x2="310" y2="310" />
            <line x1="74" y1="326" x2="90" y2="310" />
            <line x1="74" y1="74" x2="90" y2="90" />
          </g>
          {/* Micro degree ticks */}
          <circle cx="200" cy="28" r="2" fill="var(--gd-accent)" stroke="none" opacity="0.7" />
          <circle cx="372" cy="200" r="2" fill="var(--gd-accent)" stroke="none" opacity="0.7" />
          <circle cx="200" cy="372" r="2" fill="var(--gd-accent)" stroke="none" opacity="0.7" />
          <circle cx="28" cy="200" r="2" fill="var(--gd-accent)" stroke="none" opacity="0.7" />
        </g>

        {/* The glass tube with anatomical meniscus and organic fluid layers */}
        <clipPath id="sf-tube">
          <path d="M174,104 L174,258 C174,293 186,308 200,308 C214,308 226,293 226,258 L226,104 Z" />
        </clipPath>

        <g clipPath="url(#sf-tube)">
          {/* Tube glass background */}
          <rect x="170" y="100" width="60" height="212" className="sf-cent-glass" />

          {/* Whole blood before spin */}
          <rect x="170" y="100" width="60" height="212" className="sf-cent-whole" fill="url(#sf-whole-grad)" />

          {/* Separated Red Blood Cell layer */}
          <path
            d="M170,210 Q200,215 230,210 L230,312 L170,312 Z"
            className="sf-cent-rbc"
            fill="url(#sf-rbc-grad)"
          />

          {/* Separated PRF liquid gold layer with organic curved meniscus */}
          <path
            d="M170,102 L230,102 L230,212 Q200,217 170,212 Z"
            className="sf-cent-prf"
            fill="url(#sf-prf-grad)"
          />

          {/* Luminous buffy coat interface line */}
          <path
            d="M170,211 Q200,216 230,211"
            className="sf-cent-buffy"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.8"
            strokeOpacity="0.75"
          />

          {/* Floating active platelet sparks in PRF */}
          <g className="sf-cent-platelets">
            <circle cx="190" cy="135" r="1.8" fill="#ffffff" opacity="0.8" />
            <circle cx="210" cy="155" r="1.4" fill="#ffffff" opacity="0.65" />
            <circle cx="184" cy="178" r="1.6" fill="#ffffff" opacity="0.7" />
            <circle cx="204" cy="192" r="2" fill="#ffffff" opacity="0.85" />
            <circle cx="196" cy="164" r="1.2" fill="#ffffff" opacity="0.5" />
          </g>

          {/* Glass 3D reflection highlight */}
          <rect x="174" y="104" width="52" height="204" fill="url(#sf-glass-spec)" />
          <path d="M177,108 L177,258 C177,288 184,300 192,303" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.35" />
        </g>

        {/* Tube outer glass contour */}
        <path
          d="M174,104 L174,258 C174,293 186,308 200,308 C214,308 226,293 226,258 L226,104"
          fill="none" stroke="currentColor" strokeOpacity=".38" strokeWidth="1.75" strokeLinecap="round"
        />

        {/* Test tube cap */}
        <rect x="168" y="86" width="64" height="20" rx="4" className="sf-cent-cap-rect" />
        <line x1="174" y1="110" x2="226" y2="110" stroke="currentColor" strokeOpacity=".25" strokeWidth="1" />

        <text x="200" y="348" textAnchor="middle" className="sf-cent-label">
          platelet-rich fibrin
        </text>
      </svg>
    </div>
  );
}
