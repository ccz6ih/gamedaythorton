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
  title: {
    default: 'The Med Bar · Aesthetics & Wellness',
    template: '%s · The Med Bar'
  },
  description: 'The Med Bar — cash-pay aesthetics in Loveland, CO. Skin, lashes, and regenerative treatments.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/brand/medbar-logo-white.png', media: '(prefers-color-scheme: dark)' },
      { url: '/brand/medbar-logo-black.png', media: '(prefers-color-scheme: light)' }
    ],
    apple: '/brand/medbar-logo-white.png'
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
