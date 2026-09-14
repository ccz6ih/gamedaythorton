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
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
};

/* ------------------------------------------------------------- the marks -- */

function Lash() {
  return (
    <>
      {/* closed eye with elegant curved extensions */}
      <path d="M4 15c4.5 4.2 11.5 4.2 16 0" {...S} strokeWidth={1.6} />
      <path d="M4.6 14.2c-1.1-1.8-1.7-3.8-1.9-5.2" {...S} />
      <path d="M8 17c-.8-2.2-1.2-4.5-1.3-6.5" {...S} />
      <path d="M12 18V10" {...S} strokeWidth={1.5} />
      <path d="M16 17c.8-2.2 1.2-4.5 1.3-6.5" {...S} />
      <path d="M19.4 14.2c1.1-1.8 1.7-3.8 1.9-5.2" {...S} />
      <circle cx="12" cy="18" r="1" fill="currentColor" opacity="0.3" stroke="none" />
    </>
  );
}

function Syringe() {
  return (
    <>
      {/* cosmetic precision syringe with subtle body fill */}
      <path
        d="M13.5 8.5 18.5 3.5a1.4 1.4 0 0 1 2 2L15.5 10.5"
        {...S}
      />
      <path
        d="M12.5 9.5 5.5 16.5a1.8 1.8 0 0 0 0 2.5l.5.5a1.8 1.8 0 0 0 2.5 0l7-7Z"
        {...S}
        fill="currentColor"
        fillOpacity="0.16"
      />
      <path d="m4.5 19.5-2.2 2.2" {...S} strokeWidth={1.6} />
      <path d="m11.5 10.5 2 2" {...S} />
      <path d="m9 13 2 2" {...S} />
      <path d="m17 2 5 5" {...S} strokeWidth={1.6} />
      <circle cx="2.3" cy="21.7" r="0.6" fill="currentColor" stroke="none" />
    </>
  );
}

function Droplet() {
  return (
    <>
      {/* PRF platelet droplet with radiant core */}
      <path
        d="M12 2.5C8.2 7 5.5 10.8 5.5 14.2a6.5 6.5 0 0 0 13 0c0-3.4-2.7-7.2-6.5-11.7Z"
        {...S}
        fill="currentColor"
        fillOpacity="0.18"
      />
      {/* internal glow curve & platelets */}
      <path d="M8.8 14.8a3.5 3.5 0 0 0 3.5 3.5" {...S} strokeWidth={1.2} opacity="0.8" />
      <circle cx="12" cy="13.5" r="1.4" fill="currentColor" stroke="none" opacity="0.75" />
      <circle cx="14.2" cy="11.2" r="0.8" fill="currentColor" stroke="none" opacity="0.6" />
      <circle cx="10" cy="11" r="0.7" fill="currentColor" stroke="none" opacity="0.6" />
    </>
  );
}

function Microneedle() {
  return (
    <>
      {/* precision microneedling pen with channel matrix */}
      <path
        d="M8.5 16.5 17 8l2.5 2.5-8.5 8.5-3.8 1Z"
        {...S}
        fill="currentColor"
        fillOpacity="0.16"
      />
      <path d="m17 8 1.8-1.8a1.6 1.6 0 0 1 2.3 0l.4.4a1.6 1.6 0 0 1 0 2.3L19.5 10.5" {...S} />
      {/* micro-channel active matrix */}
      {[0, 1, 2].map(r => [0, 1, 2].map(c => (
        <circle key={`${r}-${c}`} cx={3.8 + c * 2.2} cy={4.2 + r * 2.2} r=".6" fill="currentColor" stroke="none" opacity="0.8" />
      )))}
    </>
  );
}

function Hair() {
  return (
    <>
      {/* regenerative hair follicle & strands */}
      <path
        d="M4.5 20.5c0-6.8 3.5-11.5 7.5-11.5s7.5 4.7 7.5 11.5"
        {...S}
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path d="M7.8 20.5c0-4.8 2-8.2 4.2-8.2s4.2 3.4 4.2 8.2" {...S} />
      <path d="M12 9V3.5" {...S} strokeWidth={1.5} />
      <path d="M12 3.5 9.5 5.5M12 3.5l2.5 2" {...S} />
      <circle cx="12" cy="16.5" r="1.2" fill="currentColor" stroke="none" opacity="0.7" />
    </>
  );
}

function Peel() {
  return (
    <>
      <circle cx="12" cy="12" r="8.5" {...S} fill="currentColor" fillOpacity="0.14" />
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17" {...S} strokeDasharray="2.5 2.5" />
      <circle cx="8.5" cy="9" r="1.1" fill="currentColor" stroke="none" opacity="0.7" />
      <circle cx="15" cy="8.5" r="1.1" fill="currentColor" stroke="none" opacity="0.7" />
      <circle cx="14.5" cy="15" r="1.1" fill="currentColor" stroke="none" opacity="0.7" />
    </>
  );
}

function Led() {
  return (
    <>
      <path d="M5 5h14v5.5H5z" {...S} fill="currentColor" fillOpacity="0.15" />
      <path d="M12 10.5v3.5" {...S} />
      <path d="M6 18h12" {...S} strokeWidth={1.6} />
      <path d="M8 21h8" {...S} />
      {[7.5, 10.5, 13.5, 16.5].map(x => (
        <path key={x} d={`M${x} 13v2`} {...S} strokeWidth={1.2} />
      ))}
    </>
  );
}

function ScarPen() {
  return (
    <>
      <path d="M6 18 16.5 7.5l3 3L9 21H6Z" {...S} fill="currentColor" fillOpacity="0.16" />
      <path d="m16.5 7.5 1.6-1.6a1.5 1.5 0 0 1 2.2 0l.7.7a1.5 1.5 0 0 1 0 2.2l-1.6 1.6" {...S} />
      <path d="M3 13c1.5-1.2 2.6-.4 4.1-1.5" {...S} strokeDasharray="1.8 1.8" />
      <path d="M3 8.5c1.5-1.2 2.6-.4 4.1-1.5" {...S} strokeDasharray="1.8 1.8" />
    </>
  );
}

function Waves() {
  return (
    <>
      <path d="M3.5 8.5c1.7-2 3.4-2 5.1 0s3.4 2 5.1 0 3.4-2 5.1 0" {...S} strokeWidth={1.5} />
      <path d="M3.5 13c1.7-2 3.4-2 5.1 0s3.4 2 5.1 0 3.4-2 5.1 0" {...S} strokeWidth={1.5} />
      <path d="M3.5 17.5c1.7-2 3.4-2 5.1 0s3.4 2 5.1 0 3.4-2 5.1 0" {...S} strokeWidth={1.5} />
    </>
  );
}

function Face() {
  return (
    <>
      <path
        d="M12 3.2c4.2 0 7 2.8 7 6.8 0 4.8-3.2 11-7 11s-7-6.2-7-11c0-4 2.8-6.8 7-6.8Z"
        {...S}
        fill="currentColor"
        fillOpacity="0.14"
      />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" opacity="0.8" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" opacity="0.8" />
      <path d="M10 15.2c1.2.9 2.8.9 4 0" {...S} />
    </>
  );
}

function Chat() {
  return (
    <>
      <path d="M3.5 6h12.5v8.5H8.5L4.5 18V14.5H3.5Z" {...S} fill="currentColor" fillOpacity="0.14" />
      <path d="M19 9.5h1.5v8.5h-1.5V21L16 18h-3.5" {...S} />
      <path d="M7 10h5.5" {...S} />
    </>
  );
}

function Jar() {
  return (
    <>
      <path d="M8 4h8v2.5H8z" {...S} />
      <path
        d="M6.5 9c0-1.4 1.2-2.5 2.6-2.5h5.8c1.4 0 2.6 1.1 2.6 2.5v9c0 1.4-1.2 2.5-2.6 2.5H9.1A2.6 2.6 0 0 1 6.5 18Z"
        {...S}
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path d="M9.5 13h5" {...S} />
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
