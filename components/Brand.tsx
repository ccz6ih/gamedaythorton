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
  const font = FONTS[brand.font ?? 'system'] ?? FONTS.system!;

  return (
    <div
      style={{
        // Same custom properties tokens.css declares, so every component follows
        // without knowing anything about branding.
        ['--brand-accent' as string]: accent,
        ['--brand-accent-ink' as string]: ink,
        ['--brand-radius' as string]: `${radius}px`,
        ['--brand-font' as string]: font,
        display: 'contents'
      }}
    >
      {children}
    </div>
  );
}
