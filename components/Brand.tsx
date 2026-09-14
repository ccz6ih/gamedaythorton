/**
 * components/Brand.tsx
 * Applies a tenant's Brand Kit by writing the same custom properties the
 * prototype writes. One code path, two front ends. docs/15-branding.md.
 *
 * Contrast is computed, not trusted: a client will paste a brand colour that
 * fails AA against a dark surface, and the button ink is chosen to pass rather
 * than assumed to be white.
 */

import type { Clinic } from '@/lib/db/queries';

type BrandKit = {
  accent?: string;
  accentInk?: string;
  radius?: number;
  font?: string;
  surface?: 'dark' | 'light' | 'auto';
  sportsVocabulary?: boolean;
  clinicName?: string;
  locationName?: string;
  tagline?: string;
  /**
   * A ground of the practice's own. "dark" in tokens.css is a neutral
   * near-black, which is right for a men's health clinic and wrong for a
   * practice whose identity is plants and brass.
   */
  bg?: string;
  surfaceColor?: string;
  surfaceRaised?: string;
  borderColor?: string;
  displayFont?: string;
  text?: string;
  textMuted?: string;
  textDim?: string;
  logoHeight?: number;
  logoUrl?: string;
};

const FONTS: Record<string, string> = {
  system: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  grotesk: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  rounded: 'ui-rounded, "Segoe UI Variable", "Trebuchet MS", system-ui, sans-serif',
  mono: 'ui-monospace, "Cascadia Mono", Consolas, monospace'
};

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function luminance(rgb: [number, number, number]) {
  const [r, g, b] = rgb.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  if (!ra || !rb) return 0;
  const la = luminance(ra), lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Black or white on the accent, whichever actually passes. */
export function inkFor(accent: string) {
  return contrastRatio(accent, '#ffffff') >= contrastRatio(accent, '#141414') ? '#ffffff' : '#141414';
}

export function brandOf(clinic: Clinic | null): BrandKit {
  return (clinic?.brand ?? {}) as BrandKit;
}

/** Themed nouns, or their plain clinical equivalents. */
export function vocab(clinic: Clinic | null) {
  const themed = !!brandOf(clinic).sportsVocabulary;
  return {
    console: themed ? 'PRESS BOX' : 'Console',
    portal: themed ? 'GAMEPLAN' : 'Your account',
    dashboard: themed ? 'Scoreboard' : 'Dashboard',
    progress: themed ? 'Stat Sheet' : 'Progress',
    photos: themed ? 'Game Film' : 'Progress photos',
    plan: themed ? 'Game Plan' : 'Treatment plan',
    // A med spa has clients, not patients. Using the wrong noun in front of a
    // practitioner reads as software built for somebody else.
    person: themed ? 'patient' : 'client',
    people: themed ? 'Patients' : 'Clients'
  };
}

export function Brand({ clinic, children }: { clinic: Clinic | null; children: React.ReactNode }) {
  const brand = brandOf(clinic);
  const accent = brand.accent && hexToRgb(brand.accent) ? brand.accent : '#d7262f';
  const ink = brand.accentInk && brand.accentInk !== 'auto' ? brand.accentInk : inkFor(accent);
  const radius = typeof brand.radius === 'number' ? brand.radius : 10;

  // The kit stores either a key from FONTS ("serif") or a full stack the
  // storefront already uses ('"Cormorant Garamond", Georgia, serif'). Accept
  // both: a practice that picked a face on its public page should not find the
  // console rendering in something else.
  const rawFont = brand.font ?? 'system';
  const font = FONTS[rawFont] ?? (rawFont.includes(',') || rawFont.includes('"') ? rawFont : FONTS.system!);
  const displayFont = brand.displayFont ?? font;

  const tokens: Record<string, string> = {
    '--brand-accent': accent,
    '--brand-accent-ink': ink,
    '--brand-radius': `${radius}px`,
    '--brand-font': font,
    '--brand-display-font': displayFont,
    '--brand-logo-height': `${typeof brand.logoHeight === 'number' ? brand.logoHeight : 75}px`,

    /* ------------------------------------------------------------------
       RE-DERIVE EVERYTHING tokens.css DERIVES FROM --brand-*.

       This is not redundant, and leaving it out is why the console rendered
       in Gameday's red while the practice's own site was gold.

       tokens.css declares `--gd-accent: var(--brand-accent)` on :root, so it
       RESOLVES on :root — against the default red. Setting --brand-accent on
       a descendant does not change it, because descendants inherit the
       already-computed value rather than the expression. The storefront hit
       exactly this and fixed it inside `.sf`; the console needed the same
       treatment and did not get it.

       Anything tokens.css writes as var(--brand-…) has to be restated here.
       ------------------------------------------------------------------ */
    '--gd-accent': accent,
    '--gd-accent-hover': `color-mix(in srgb, ${accent} 82%, white)`,
    '--gd-accent-press': `color-mix(in srgb, ${accent} 82%, black)`,
    '--gd-accent-dim': `color-mix(in srgb, ${accent} 14%, transparent)`,
    '--gd-accent-line': `color-mix(in srgb, ${accent} 38%, transparent)`,
    '--gd-ring': `0 0 0 3px color-mix(in srgb, ${accent} 14%, transparent)`,
    '--gd-font': font,
    '--gd-font-num': font,
    '--gd-r-sm': `${Math.round(radius * 0.6)}px`,
    '--gd-r-md': `${radius}px`,
    '--gd-r-lg': `${Math.round(radius * 1.6)}px`
  };

  /**
   * The practice's own ground, when it has set one.
   *
   * The storefront layout has applied these since the day her page went green.
   * The console did not, so the two halves of the same product looked like
   * different software — which is the specific thing a practice notices when
   * it shows the system to somebody.
   *
   * Only set what the kit actually specifies: a practice with no opinion keeps
   * the neutral dark from tokens.css rather than being given a colour.
   */
  const SURFACES: [keyof BrandKit, string][] = [
    ['bg', '--gd-bg'],
    ['surfaceColor', '--gd-surface'],
    ['surfaceRaised', '--gd-surface-raised'],
    ['borderColor', '--gd-border'],
    ['text', '--gd-text'],
    ['textMuted', '--gd-text-muted'],
    ['textDim', '--gd-text-dim']
  ];
  for (const [key, token] of SURFACES) {
    const value = brand[key];
    if (typeof value === 'string' && value) tokens[token] = value;
  }

  /**
   * APPLIED AT :root, NOT ON A WRAPPER DIV, and that is the whole reason this
   * renders a <style> tag instead of a style attribute.
   *
   * `body { background: var(--gd-bg) }` lives in app.css. body is an ANCESTOR
   * of anything this component renders, so tokens set on a wrapper cannot
   * reach it — the panels inside would turn green while the page behind them
   * stayed neutral charcoal. Setting them on :root is the only place that
   * covers both.
   *
   * Values are drawn from the practice's own brand kit, which is written by the
   * console's appearance screen and validated there. They are still filtered
   * here: anything containing a brace or a semicolon is dropped, so a malformed
   * value cannot close the declaration and inject rules of its own.
   */
  const declarations = Object.entries(tokens)
    .filter(([, v]) => !/[{};<>]/.test(v))
    .map(([k, v]) => `${k}:${v}`)
    .join(';');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root{${declarations}}` }} />
      {children}
    </>
  );
}
