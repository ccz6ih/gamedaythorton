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
  strokeWidth: 1.25,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
};

/* ------------------------------------------------------------- the marks -- */

function Lash() {
  return (
    <>
      {/* closed eye with extensions — the lashes are the point, so they get
          the weight and the lid stays quiet */}
      <path d="M6 21c3.6 3.4 8.4 3.4 12 0" {...S} strokeWidth={1.5} />
      <path d="M6.4 20.4c-.9-1.1-1.5-2.2-1.8-3.2" {...S} />
      <path d="M9.2 22.6c-.5-1.3-.8-2.6-.9-3.8" {...S} />
      <path d="M12 23.3V19.2" {...S} />
      <path d="M14.8 22.6c.5-1.3.8-2.6.9-3.8" {...S} />
      <path d="M17.6 20.4c.9-1.1 1.5-2.2 1.8-3.2" {...S} />
    </>
  );
}

function Syringe() {
  return (
    <>
      <path d="M14.5 9.5 20 4" {...S} />
      <path d="M17.4 3.2 20.8 6.6" {...S} />
      <path d="m13.2 10.8 4 4" {...S} />
      <path d="M12.6 10.2 5.8 17a2 2 0 0 0 0 2.8l.4.4a2 2 0 0 0 2.8 0l6.8-6.8Z" {...S} />
      <path d="m5.2 18.8-1.9 1.9" {...S} />
      <path d="m10 12.8 1.6 1.6" {...S} />
      <path d="m8 14.8 1.6 1.6" {...S} />
    </>
  );
}

function Droplet() {
  return (
    <>
      {/* PRF — drawn from the client's own blood, so a droplet reads right */}
      <path d="M12 3.5c3.2 3.9 5.2 6.8 5.2 9.4a5.2 5.2 0 0 1-10.4 0c0-2.6 2-5.5 5.2-9.4Z" {...S} />
      <path d="M9.4 13.4a2.6 2.6 0 0 0 2.6 2.6" {...S} />
    </>
  );
}

function Microneedle() {
  return (
    <>
      <path d="M8.5 15.5 16 8l3 3-7.5 7.5-3.6.9Z" {...S} />
      <path d="m16 8 1.6-1.6a1.8 1.8 0 0 1 2.6 0l.4.4a1.8 1.8 0 0 1 0 2.6L19 11" {...S} />
      {[0, 1, 2].map(r => [0, 1, 2].map(c => (
        <circle key={`${r}-${c}`} cx={4.5 + c * 2} cy={5 + r * 2} r=".55" fill="currentColor" stroke="none" />
      )))}
    </>
  );
}

function Hair() {
  return (
    <>
      <path d="M4.5 20c0-6.5 3.4-11 7.5-11s7.5 4.5 7.5 11" {...S} />
      <path d="M7.6 20c0-4.6 2-7.8 4.4-7.8s4.4 3.2 4.4 7.8" {...S} />
      <path d="M12 9V4.7" {...S} />
      <path d="M12 4.7 9.8 6.2M12 4.7l2.2 1.5" {...S} />
    </>
  );
}

function Peel() {
  return (
    <>
      <circle cx="12" cy="12" r="8.2" {...S} />
      <path d="M12 3.8a8.2 8.2 0 0 0 0 16.4" {...S} strokeDasharray="2.2 2.2" />
      <path d="M8.6 9.2a1 1 0 1 0 .01 0M14.4 8.4a1 1 0 1 0 .01 0M15 14.6a1 1 0 1 0 .01 0" {...S} />
    </>
  );
}

function Led() {
  return (
    <>
      <path d="M5 5.5h14v5H5z" {...S} />
      <path d="M12 10.5v3.2" {...S} />
      <path d="M6.5 17.5h11" {...S} strokeWidth={1.5} />
      <path d="M8.4 20.5h7.2" {...S} />
      {[7.6, 10.4, 13.2, 16].map(x => (
        <path key={x} d={`M${x} 12.6v1.6`} {...S} strokeWidth={1} />
      ))}
    </>
  );
}

function ScarPen() {
  return (
    <>
      <path d="M6.5 17.2 16.4 7.3l2.9 2.9-9.9 9.9H6.5Z" {...S} />
      <path d="m16.4 7.3 1.5-1.5a1.6 1.6 0 0 1 2.3 0l.6.6a1.6 1.6 0 0 1 0 2.3l-1.5 1.5" {...S} />
      <path d="M3.4 12.4c1.4-1.1 2.4-.3 3.8-1.4" {...S} strokeDasharray="1.6 1.6" />
      <path d="M3.4 8.2c1.4-1.1 2.4-.3 3.8-1.4" {...S} strokeDasharray="1.6 1.6" />
    </>
  );
}

function Waves() {
  return (
    <>
      <path d="M3.5 9.2c1.7-2 3.4-2 5.1 0s3.4 2 5.1 0 3.4-2 5.1 0" {...S} />
      <path d="M3.5 13.4c1.7-2 3.4-2 5.1 0s3.4 2 5.1 0 3.4-2 5.1 0" {...S} />
      <path d="M3.5 17.6c1.7-2 3.4-2 5.1 0s3.4 2 5.1 0 3.4-2 5.1 0" {...S} />
    </>
  );
}

function Face() {
  return (
    <>
      <path d="M12 3.6c4 0 6.6 2.6 6.6 6.4 0 4.6-3 10.4-6.6 10.4S5.4 14.6 5.4 10c0-3.8 2.6-6.4 6.6-6.4Z" {...S} />
      <path d="M9.2 10.4a1.1 1.1 0 1 0 .01 0M14.8 10.4a1.1 1.1 0 1 0 .01 0" {...S} />
      <path d="M10.2 15.2c1.1.9 2.5.9 3.6 0" {...S} />
    </>
  );
}

function Chat() {
  return (
    <>
      <path d="M4 6.4h11.4v7.8H8.8L5.2 17V14.2H4Z" {...S} />
      <path d="M18.2 9.4H20v7.8h-1.4V20l-3.2-2.8h-3" {...S} />
      <path d="M7.2 10.2h5" {...S} />
    </>
  );
}

function Jar() {
  return (
    <>
      <path d="M8.4 4.6h7.2v2.2H8.4z" {...S} />
      <path d="M7 9.2c0-1.3 1.1-2.4 2.4-2.4h5.2c1.3 0 2.4 1.1 2.4 2.4v8.4a2.4 2.4 0 0 1-2.4 2.4H9.4A2.4 2.4 0 0 1 7 17.6Z" {...S} />
      <path d="M9.8 13h4.4" {...S} />
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
