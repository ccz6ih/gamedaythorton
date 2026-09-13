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
  title: 'Pilot — synthetic data only',
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
