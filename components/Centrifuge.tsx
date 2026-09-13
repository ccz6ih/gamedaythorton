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
        {/* the rotor */}
        <g className="sf-cent-ring">
          <circle cx="200" cy="200" r="168" fill="none" stroke="currentColor" strokeOpacity=".16" strokeWidth="1" />
          <circle cx="200" cy="200" r="150" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth="1" />
          <g stroke="currentColor" strokeOpacity=".30" strokeWidth="1.5">
            <line x1="200" y1="26" x2="200" y2="48" />
            <line x1="374" y1="200" x2="352" y2="200" />
            <line x1="200" y1="374" x2="200" y2="352" />
            <line x1="26" y1="200" x2="48" y2="200" />
          </g>
          <g stroke="currentColor" strokeOpacity=".14" strokeWidth="1">
            <line x1="323" y1="77" x2="309" y2="91" />
            <line x1="323" y1="323" x2="309" y2="309" />
            <line x1="77" y1="323" x2="91" y2="309" />
            <line x1="77" y1="77" x2="91" y2="91" />
          </g>
        </g>

        {/* the tube, clipped so the layers fill inside its shape */}
        <clipPath id="sf-tube">
          <path d="M175,106 L175,258 C175,292 186,306 200,306 C214,306 225,292 225,258 L225,106 Z" />
        </clipPath>
        <g clipPath="url(#sf-tube)">
          <rect x="172" y="104" width="56" height="206" className="sf-cent-glass" />
          <rect x="172" y="104" width="56" height="206" className="sf-cent-whole" />
          <rect x="172" y="212" width="56" height="98" className="sf-cent-rbc" />
          <rect x="172" y="104" width="56" height="108" className="sf-cent-prf" />
          <rect x="172" y="104" width="18" height="206" fill="#fff" fillOpacity=".07" />
        </g>

        <path
          d="M175,106 L175,258 C175,292 186,306 200,306 C214,306 225,292 225,258 L225,106"
          fill="none" stroke="currentColor" strokeOpacity=".28" strokeWidth="1.5" strokeLinecap="round"
        />
        <rect x="169" y="88" width="62" height="19" rx="3" className="sf-cent-cap-rect" />
        <line x1="175" y1="112" x2="225" y2="112" stroke="currentColor" strokeOpacity=".16" strokeWidth="1" />

        <text x="200" y="344" textAnchor="middle" className="sf-cent-label">
          platelet-rich fibrin
        </text>
      </svg>
    </div>
  );
}
