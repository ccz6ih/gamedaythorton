/**
 * app/manifest.ts
 * What a practice's site calls itself when somebody installs it.
 *
 * ===========================================================================
 * PER TENANT, LIKE THE SITEMAP
 * ===========================================================================
 * One deployment serves several practices on their own domains, so a manifest
 * baked at build time would put The Med Bar's name on the home screen of
 * anybody who installed a different tenant's site. Same resolution as
 * app/sitemap.ts and for the same reason: ask the hostname which practice it
 * serves.
 *
 * ===========================================================================
 * THIS IS THE CUSTOMER'S APP, NOT THE PRACTICE'S
 * ===========================================================================
 * `start_url` is the storefront root, because the overwhelming majority of
 * people who install from medbarco.com are clients who want to book, not the
 * owner. The staff console ships its own manifest at
 * /console/manifest.webmanifest, so installing from behind the login gives a
 * console app that opens on Today rather than the shop.
 *
 * Two manifests rather than one compromise: an app that opens on the wrong
 * screen gets uninstalled, and there is no single start_url that is right for
 * both a client booking a facial and an owner checking her day.
 */

import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { clinicForHost } from '@/storefront-domains.mjs';
import { getStorefront } from '@/lib/db/storefront';

export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const host = (await headers()).get('host');
  const slug = clinicForHost(host, process.env.PRIMARY_CLINIC_SLUG);

  // A hostname serving no practice still needs a valid manifest — an installed
  // preview deployment is nobody's problem, but a 500 on /manifest.webmanifest
  // shows up in the console on every page load.
  const clinic = slug ? await getStorefront(slug).catch(() => null) : null;
  const name = clinic?.name ?? 'Book online';

  return {
    name,
    short_name: name.length > 12 ? name.split(' ').slice(-2).join(' ') : name,
    description: clinic?.tagline ?? `Book an appointment with ${name}.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // The paper colour, so the splash screen and the status bar are the brand
    // rather than a white flash before the first paint.
    background_color: '#EFE7DA',
    theme_color: '#EFE7DA',
    categories: ['health', 'lifestyle', 'beauty'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Separate files, because Android crops a maskable icon to the launcher's
      // shape and an `any` icon must not be padded for a crop that may not come.
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
