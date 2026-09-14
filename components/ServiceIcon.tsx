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
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
};

/* ------------------------------------------------------------- the marks -- */

function Lash() {
  return (
    <>
      {/* closed eye with elegant curved extensions */}
      <path d="M3.5 15c4.8 4.5 12.2 4.5 17 0" {...S} strokeWidth={1.8} />
      <path d="M4.2 14c-1.2-2-1.8-4.2-2-5.8" {...S} strokeWidth={1.7} />
      <path d="M8 17c-.9-2.5-1.3-5-1.4-7.2" {...S} strokeWidth={1.7} />
      <path d="M12 18.2V9.5" {...S} strokeWidth={1.8} />
      <path d="M16 17c.9-2.5 1.3-5 1.4-7.2" {...S} strokeWidth={1.7} />
      <path d="M19.8 14c1.2-2 1.8-4.2 2-5.8" {...S} strokeWidth={1.7} />
      <circle cx="12" cy="18.2" r="1.2" fill="currentColor" stroke="none" />
    </>
  );
}

function Syringe() {
  return (
    <>
      {/* cosmetic precision syringe with barrel & plunger */}
      <path
        d="M13.5 8.5 19 3a1.4 1.4 0 0 1 2 2L15.5 10.5"
        {...S}
        strokeWidth={1.7}
      />
      <path
        d="M12.5 9.5 5.5 16.5a1.8 1.8 0 0 0 0 2.5l.5.5a1.8 1.8 0 0 0 2.5 0l7-7Z"
        {...S}
        fill="currentColor"
        fillOpacity="0.25"
      />
      <path d="m4.5 19.5-2.5 2.5" {...S} strokeWidth={1.8} />
      <path d="m11.5 10.5 2 2" {...S} strokeWidth={1.5} />
      <path d="m9 13 2 2" {...S} strokeWidth={1.5} />
      <path d="m17 2 5 5" {...S} strokeWidth={1.8} />
      <circle cx="2" cy="22" r="0.9" fill="currentColor" stroke="none" />
    </>
  );
}

function Droplet() {
  return (
    <>
      {/* PRF platelet droplet with radiant core */}
      <path
        d="M12 2.2C7.8 7 4.8 11.2 4.8 14.8a7.2 7.2 0 0 0 14.4 0c0-3.6-3-7.8-7.2-12.6Z"
        {...S}
        fill="currentColor"
        fillOpacity="0.25"
      />
      {/* internal glow curve & platelets */}
      <path d="M8.2 15.2a3.8 3.8 0 0 0 3.8 3.8" {...S} strokeWidth={1.4} opacity="0.9" />
      <circle cx="12" cy="13.2" r="1.6" fill="#ffffff" stroke="none" opacity="0.9" />
      <circle cx="14.6" cy="10.8" r="1" fill="#ffffff" stroke="none" opacity="0.75" />
      <circle cx="9.6" cy="10.5" r="0.9" fill="#ffffff" stroke="none" opacity="0.75" />
    </>
  );
}

function Microneedle() {
  return (
    <>
      {/* precision microneedling pen with channel matrix */}
      <path
        d="M8.5 16.5 17 8l2.5 2.5-8.5 8.5-4 1Z"
        {...S}
        fill="currentColor"
        fillOpacity="0.25"
      />
      <path d="m17 8 2-2a1.6 1.6 0 0 1 2.3 0l.4.4a1.6 1.6 0 0 1 0 2.3L19.5 10.5" {...S} strokeWidth={1.7} />
      {/* micro-channel active matrix */}
      {[0, 1, 2].map(r => [0, 1, 2].map(c => (
        <circle key={`${r}-${c}`} cx={3.6 + c * 2.4} cy={4 + r * 2.4} r=".75" fill="currentColor" stroke="none" opacity="0.9" />
      )))}
    </>
  );
}

function Hair() {
  return (
    <>
      {/* regenerative hair follicle & strands */}
      <path
        d="M4 21c0-7.2 3.8-12.2 8-12.2s8 5 8 12.2"
        {...S}
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path d="M7.5 21c0-5.2 2.2-8.8 4.5-8.8s4.5 3.6 4.5 8.8" {...S} strokeWidth={1.5} />
      <path d="M12 8.8V2.8" {...S} strokeWidth={1.8} />
      <path d="M12 2.8 9.2 5M12 2.8l2.8 2.2" {...S} strokeWidth={1.8} />
      <circle cx="12" cy="16.8" r="1.5" fill="#ffffff" stroke="none" opacity="0.85" />
    </>
  );
}

function Peel() {
  return (
    <>
      <circle cx="12" cy="12" r="8.8" {...S} fill="currentColor" fillOpacity="0.2" />
      <path d="M12 3.2a8.8 8.8 0 0 0 0 17.6" {...S} strokeDasharray="2.8 2.8" strokeWidth={1.7} />
      <circle cx="8" cy="9" r="1.3" fill="currentColor" stroke="none" opacity="0.85" />
      <circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" opacity="0.85" />
      <circle cx="15" cy="15.5" r="1.3" fill="currentColor" stroke="none" opacity="0.85" />
    </>
  );
}

function Led() {
  return (
    <>
      <path d="M4.5 4.5h15v6h-15z" {...S} fill="currentColor" fillOpacity="0.22" />
      <path d="M12 10.5v4" {...S} strokeWidth={1.8} />
      <path d="M5.5 18.5h13" {...S} strokeWidth={1.8} />
      <path d="M7.5 21.5h9" {...S} strokeWidth={1.6} />
      {[7.2, 10.4, 13.6, 16.8].map(x => (
        <path key={x} d={`M${x} 13.5v2.2`} {...S} strokeWidth={1.4} />
      ))}
    </>
  );
}

function ScarPen() {
  return (
    <>
      <path d="M5.5 18.5 16.5 7.5l3 3-11 11H5.5Z" {...S} fill="currentColor" fillOpacity="0.24" />
      <path d="m16.5 7.5 1.8-1.8a1.5 1.5 0 0 1 2.2 0l.7.7a1.5 1.5 0 0 1 0 2.2l-1.8 1.8" {...S} strokeWidth={1.7} />
      <path d="M2.5 13.5c1.6-1.4 2.8-.5 4.4-1.6" {...S} strokeDasharray="2 2" strokeWidth={1.6} />
      <path d="M2.5 8.5c1.6-1.4 2.8-.5 4.4-1.6" {...S} strokeDasharray="2 2" strokeWidth={1.6} />
    </>
  );
}

function Waves() {
  return (
    <>
      <path d="M3 8c2-2.2 4-2.2 6 0s4 2.2 6 0 4-2.2 6 0" {...S} strokeWidth={1.7} />
      <path d="M3 13c2-2.2 4-2.2 6 0s4 2.2 6 0 4-2.2 6 0" {...S} strokeWidth={1.7} />
      <path d="M3 18c2-2.2 4-2.2 6 0s4 2.2 6 0 4-2.2 6 0" {...S} strokeWidth={1.7} />
    </>
  );
}

function Face() {
  return (
    <>
      <path
        d="M12 2.8c4.5 0 7.5 3 7.5 7.2 0 5.2-3.4 11.8-7.5 11.8S4.5 15.2 4.5 10c0-4.2 3-7.2 7.5-7.2Z"
        {...S}
        fill="currentColor"
        fillOpacity="0.2"
      />
      <circle cx="8.8" cy="9.8" r="1.2" fill="currentColor" stroke="none" opacity="0.9" />
      <circle cx="15.2" cy="9.8" r="1.2" fill="currentColor" stroke="none" opacity="0.9" />
      <path d="M9.8 15.5c1.3 1 3.1 1 4.4 0" {...S} strokeWidth={1.6} />
    </>
  );
}

function Chat() {
  return (
    <>
      <path d="M3 5.5h13.5V15H8.5L4 19V15H3Z" {...S} fill="currentColor" fillOpacity="0.2" />
      <path d="M19.5 9.2H21v9h-1.5V21.5L16.2 18.2H12.5" {...S} strokeWidth={1.5} />
      <path d="M6.8 9.8h6" {...S} strokeWidth={1.5} />
    </>
  );
}

function Jar() {
  return (
    <>
      <path d="M7.5 3.5h9v2.8h-9z" {...S} strokeWidth={1.7} />
      <path
        d="M6 9c0-1.5 1.3-2.7 2.8-2.7h6.4c1.5 0 2.8 1.2 2.8 2.7v9.5c0 1.5-1.3 2.7-2.8 2.7H8.8A2.8 2.8 0 0 1 6 18.5Z"
        {...S}
        fill="currentColor"
        fillOpacity="0.22"
      />
      <path d="M9.2 13.5h5.6" {...S} strokeWidth={1.5} />
    </>
  );
}

/* --------------------------------------------------------------- mapping -- */
/* Name keywords win over category: "PRF Microneedling" is filed under
   injectables but reads as microneedling to anyone looking at the menu. */

const BY_NAME: [RegExp, () => React.JSX.Element][] = [
  [/lash|fill\b|full set|volume|hybrid|classic/i, Lash],
  [/hair|strand|scalp/i, Hair],
  [/microneedl/i, Microneedle],
  [/prf|platelet|under-?eye/i, Droplet],
  [/neurotoxin|jeuveau|botox|tox\b|filler|inject/i, Syringe],
  [/paramedical|scar|stretch mark|tattoo/i, ScarPen],
  [/led|light therapy/i, Led],
  [/radiofrequency|rf\b|tighten/i, Waves],
  [/peel|bacne|acne/i, Peel],
  [/consult/i, Chat],
  [/facial|hydra|dermaplane|glow/i, Face],
  [/serum|product|retail|kit\b/i, Jar]
];

const BY_CATEGORY: Record<string, () => React.JSX.Element> = {
  lashes: Lash,
  injectables: Syringe,
  paramedical: ScarPen,
  skin: Peel,
  facials: Face,
  consult: Chat,
  consumable: Jar,
  topical: Jar
};

export function ServiceIcon({ name, category, className }: Props) {
  const byName = BY_NAME.find(([re]) => re.test(name));
  const Mark = byName ? byName[1] : (BY_CATEGORY[category] ?? Face);

  return (
    <svg
      className={className}
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
