/**
 * app/layout.tsx
 *
 * The stylesheets are imported straight from prototype/assets rather than copied
 * into styles/. There is exactly one copy of the design system, so the Phase A
 * prototype and the production app cannot drift apart — and rebranding stays a
 * token swap. docs/15-branding.md.
 */

import type { Metadata, Viewport } from 'next';
import '../prototype/assets/tokens.css';
import '../prototype/assets/app.css';
import '../prototype/assets/storefront.css';
import './app-extras.css';

export const metadata: Metadata = {
  /**
   * NO TEMPLATE AT THE ROOT, deliberately.
   *
   * A `template` here applies to every child segment INCLUDING the one that
   * defines its own — so the storefront's "The Med Bar · Loveland, CO" came out
   * of the browser as "The Med Bar · Loveland, CO · The Med Bar".
   *
   * Both surfaces below already own their titles: the storefront layout builds
   * one per practice, and the console has its own template. The root only needs
   * to say something sensible on the handful of pages that are neither.
   */
  /**
   * Deliberately unnamed. This layout is shared by every tenant, and the only
   * pages that fall through to it are ones with no practice context at all —
   * the gate, the pilot explainer, the prototype. Naming one practice here put
   * it in front of the others.
   *
   * The storefront and the console both build their own titles from the clinic
   * they are rendering, which is where a name belongs.
   */
  title: 'Practice console',
  description: 'Booking, records and payments for an independent practice.',
  icons: {
    /**
     * SVG first. The practice's logo is white on transparent, which disappears
     * on a light tab bar, and a media-query favicon is honoured inconsistently
     * across browsers — so the reliable one leads and the rest are fallbacks
     * for anything that cannot render SVG.
     */
    icon: [
      { url: '/brand/medbar-favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' }
    ],
    apple: '/brand/medbar-logo-black.png'
  },
  // Belt and braces alongside the X-Robots-Tag header in next.config.mjs.
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark light'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-surface="dark">
      <body>{children}</body>
    </html>
  );
}
