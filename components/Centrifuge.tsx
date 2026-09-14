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
      <svg
        viewBox="0 0 440 440"
        className="sf-cent-svg"
        aria-hidden="true"
        role="presentation"
        focusable="false"
      >
        <defs>
          {/* PRF liquid gold gradient with warm luminescent core */}
          <linearGradient id="sf-prf-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff2ba" />
            <stop offset="25%" stopColor="#f5ce62" />
            <stop offset="65%" stopColor="#dca52e" />
            <stop offset="100%" stopColor="#ad7c15" />
          </linearGradient>

          {/* Deep cellular red blood gradient with rich organic undertones */}
          <linearGradient id="sf-rbc-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a32838" />
            <stop offset="35%" stopColor="#821d2a" />
            <stop offset="70%" stopColor="#5e121d" />
            <stop offset="100%" stopColor="#3d0a12" />
          </linearGradient>

          {/* Whole blood before separation */}
          <linearGradient id="sf-whole-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#872b38" />
            <stop offset="50%" stopColor="#671c26" />
            <stop offset="100%" stopColor="#440f17" />
          </linearGradient>

          {/* 3D cylindrical glass reflection */}
          <linearGradient id="sf-glass-spec" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
            <stop offset="18%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="65%" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="85%" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.28" />
          </linearGradient>

          {/* Gold constellation gradient */}
          <linearGradient id="sf-gold-beam" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--gd-accent)" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#f7e199" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--gd-accent)" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* -------------------------------------------------------------
            BRAND MOLECULAR SPINE CONSTELLATION (Flanked & Illuminated)
            Mirrors the iconic Med Bar molecular mark in the hero background
            ------------------------------------------------------------- */}
        <g className="sf-cent-spine">
          {/* Constellation connector vectors */}
          <path
            d="M84,104 L114,152 L82,216 L118,284 L86,346"
            fill="none"
            stroke="url(#sf-gold-beam)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Orbital connection threads leading into the centrifuge core */}
          <path d="M114,152 C150,165 170,180 194,188" fill="none" stroke="var(--gd-accent)" strokeOpacity="0.25" strokeDasharray="3 4" />
          <path d="M82,216 C130,218 160,220 194,222" fill="none" stroke="var(--gd-accent)" strokeOpacity="0.3" strokeDasharray="3 4" />
          <path d="M118,284 C150,270 170,255 194,248" fill="none" stroke="var(--gd-accent)" strokeOpacity="0.25" strokeDasharray="3 4" />

          {/* Node 1 */}
          <circle cx="84" cy="104" r="14" fill="color-mix(in srgb, var(--gd-accent) 12%, transparent)" stroke="url(#sf-gold-beam)" strokeWidth="2.2" />
          <circle cx="84" cy="104" r="5" fill="var(--gd-accent)" />
          <circle cx="84" cy="104" r="1.5" fill="#ffffff" />

          {/* Node 2 */}
          <circle cx="114" cy="152" r="16" fill="color-mix(in srgb, var(--gd-accent) 14%, transparent)" stroke="url(#sf-gold-beam)" strokeWidth="2.4" />
          <circle cx="114" cy="152" r="6" fill="var(--gd-accent)" />
          <circle cx="114" cy="152" r="2" fill="#ffffff" />

          {/* Node 3 (Major central atom) */}
          <circle cx="82" cy="216" r="19" fill="color-mix(in srgb, var(--gd-accent) 18%, transparent)" stroke="url(#sf-gold-beam)" strokeWidth="2.8" />
          <circle cx="82" cy="216" r="7.5" fill="var(--gd-accent)" />
          <circle cx="82" cy="216" r="2.5" fill="#ffffff" />

          {/* Node 4 */}
          <circle cx="118" cy="284" r="16" fill="color-mix(in srgb, var(--gd-accent) 14%, transparent)" stroke="url(#sf-gold-beam)" strokeWidth="2.4" />
          <circle cx="118" cy="284" r="6" fill="var(--gd-accent)" />
          <circle cx="118" cy="284" r="2" fill="#ffffff" />

          {/* Node 5 */}
          <circle cx="86" cy="346" r="14" fill="color-mix(in srgb, var(--gd-accent) 12%, transparent)" stroke="url(#sf-gold-beam)" strokeWidth="2.2" />
          <circle cx="86" cy="346" r="5" fill="var(--gd-accent)" />
          <circle cx="86" cy="346" r="1.5" fill="#ffffff" />
        </g>

        {/* Right-side precision telemetry */}
        <g className="sf-cent-telemetry" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1">
          <line x1="262" y1="140" x2="278" y2="140" />
          <text x="286" y="143" className="sf-tel-num">10 mL</text>

          <line x1="262" y1="172" x2="274" y2="172" />
          <text x="286" y="175" className="sf-tel-num">8 mL</text>

          <line x1="262" y1="204" x2="282" y2="204" stroke="var(--gd-accent)" strokeOpacity="0.6" strokeWidth="1.5" />
          <text x="290" y="208" className="sf-tel-num is-gold">PRF · 5.5 mL</text>

          <line x1="262" y1="236" x2="274" y2="236" />
          <text x="286" y="239" className="sf-tel-num">4 mL</text>

          <line x1="262" y1="268" x2="278" y2="268" />
          <text x="286" y="271" className="sf-tel-num">2 mL</text>
        </g>

        {/* -------------------------------------------------------------
            THE ROTATING CENTRIFUGE ROTOR & ORBITAL RINGS
            ------------------------------------------------------------- */}
        <g className="sf-cent-ring">
          {/* Outer astronomical compass ring */}
          <circle cx="220" cy="220" r="185" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="1" strokeDasharray="6 8" />
          <circle cx="220" cy="220" r="168" fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth="1.2" />
          <circle cx="220" cy="220" r="150" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth="1" />

          {/* Precision cardinal axes */}
          <g stroke="currentColor" strokeOpacity=".38" strokeWidth="1.5">
            <line x1="220" y1="24" x2="220" y2="52" />
            <line x1="416" y1="220" x2="388" y2="220" />
            <line x1="220" y1="416" x2="220" y2="388" />
            <line x1="24" y1="220" x2="52" y2="220" />
          </g>
          {/* Degree angle marks */}
          <g stroke="currentColor" strokeOpacity=".20" strokeWidth="1">
            <line x1="351" y1="89" x2="333" y2="107" />
            <line x1="351" y1="351" x2="333" y2="333" />
            <line x1="89" y1="351" x2="107" y2="333" />
            <line x1="89" y1="89" x2="107" y2="107" />
          </g>
          {/* Gold orbital reticle accents */}
          <circle cx="220" cy="34" r="2.5" fill="var(--gd-accent)" stroke="none" />
          <circle cx="406" cy="220" r="2.5" fill="var(--gd-accent)" stroke="none" />
          <circle cx="220" cy="406" r="2.5" fill="var(--gd-accent)" stroke="none" />
          <circle cx="34" cy="220" r="2.5" fill="var(--gd-accent)" stroke="none" />
        </g>

        {/* -------------------------------------------------------------
            THE PRF TUBE (Luxury Laboratory Glass with Organic Fluid Flow)
            ------------------------------------------------------------- */}
        <clipPath id="sf-tube">
          <path d="M192,112 L192,274 C192,312 205,328 220,328 C235,328 248,312 248,274 L248,112 Z" />
        </clipPath>

        <g clipPath="url(#sf-tube)">
          {/* Glass vial base background */}
          <rect x="188" y="108" width="64" height="230" className="sf-cent-glass" />

          {/* Whole Blood (dissolves as centrifuge accelerates) */}
          <rect x="188" y="108" width="64" height="230" className="sf-cent-whole" fill="url(#sf-whole-grad)" />

          {/* Red Blood Cell Cellular Matrix with organic meniscus wave */}
          <path
            d="M188,222 C204,227 236,217 252,223 L252,332 L188,332 Z"
            className="sf-cent-rbc"
            fill="url(#sf-rbc-grad)"
          />

          {/* Deep cellular density waves in RBC */}
          <path
            d="M188,252 C208,256 232,248 252,253 L252,332 L188,332 Z"
            fill="#32060c"
            opacity="0.45"
            className="sf-cent-rbc"
          />

          {/* Liquid Gold PRF with organic upper & lower meniscus curves */}
          <path
            d="M188,110 L252,110 L252,224 C236,218 204,228 188,223 Z"
            className="sf-cent-prf"
            fill="url(#sf-prf-grad)"
          />

          {/* Luminous Buffy Coat Interface Spark Line */}
          <path
            d="M188,223 C204,228 236,218 252,224"
            className="sf-cent-buffy"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeOpacity="0.85"
            strokeLinecap="round"
          />

          {/* Active Bioactive Platelet & Fibrin Strands */}
          <g className="sf-cent-platelets">
            <circle cx="210" cy="142" r="2.2" fill="#ffffff" opacity="0.9" />
            <circle cx="232" cy="165" r="1.6" fill="#ffffff" opacity="0.75" />
            <circle cx="204" cy="192" r="2" fill="#ffffff" opacity="0.85" />
            <circle cx="226" cy="208" r="2.4" fill="#ffffff" opacity="0.95" />
            <circle cx="218" cy="174" r="1.4" fill="#ffffff" opacity="0.6" />

            {/* Micro fibrin matrix webs */}
            <line x1="210" y1="142" x2="218" y2="174" stroke="#ffffff" strokeWidth="0.7" strokeOpacity="0.4" />
            <line x1="218" y1="174" x2="204" y2="192" stroke="#ffffff" strokeWidth="0.7" strokeOpacity="0.45" />
            <line x1="204" y1="192" x2="226" y2="208" stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.55" />
          </g>

          {/* 3D Curved Glass Specular Highlight */}
          <rect x="192" y="112" width="56" height="216" fill="url(#sf-glass-spec)" />
          <path d="M195,116 L195,274 C195,306 202,320 212,324" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeOpacity="0.45" />
        </g>

        {/* Vial Outer Rim & Glass Bevel */}
        <path
          d="M192,112 L192,274 C192,312 205,328 220,328 C235,328 248,312 248,274 L248,112"
          fill="none"
          stroke="currentColor"
          strokeOpacity=".45"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Polished Glass Lip & Frosted Cap */}
        <ellipse cx="220" cy="112" rx="28" ry="4.5" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.2" />
        <rect x="184" y="92" width="72" height="22" rx="4" className="sf-cent-cap-rect" />
        <line x1="192" y1="118" x2="248" y2="118" stroke="currentColor" strokeOpacity=".3" strokeWidth="1.2" />

        {/* Telemetry labels */}
        <text x="220" y="372" textAnchor="middle" className="sf-cent-label">
          PLATELET-RICH FIBRIN · 2200 RPM
        </text>
      </svg>
    </div>
  );
}
