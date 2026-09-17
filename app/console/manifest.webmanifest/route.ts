/**
 * app/console/manifest.webmanifest/route.ts
 * The staff console as its own installable app.
 *
 * ===========================================================================
 * WHY A ROUTE AND NOT app/manifest.ts
 * ===========================================================================
 * Next generates exactly one manifest from app/manifest.ts, at the root. That
 * one is the client-facing site: it opens on the shop, which is right for
 * somebody installing from medbarco.com and wrong for the person who runs the
 * place. She wants the app on her phone to open on today's column.
 *
 * `scope: '/console'` is the part that matters. It keeps the installed app
 * inside the console, so a link out to the storefront opens in the browser
 * rather than replacing her working screen, and the two installs stay separate
 * on the home screen instead of one overwriting the other.
 *
 * ===========================================================================
 * NO AUTH ON THIS ROUTE, DELIBERATELY
 * ===========================================================================
 * A manifest must be fetchable for the install prompt to appear, and the
 * browser may request it without credentials. It says the practice's name and
 * which screen to open — the same name already on the front of the building.
 * Nothing here is behind the login because nothing here needs to be.
 */

import { headers } from 'next/headers';
import { clinicForHost } from '@/storefront-domains.mjs';
import { getStorefront } from '@/lib/db/storefront';

export const dynamic = 'force-dynamic';

export async function GET() {
  const host = (await headers()).get('host');
  const slug = clinicForHost(host, process.env.PRIMARY_CLINIC_SLUG);
  const clinic = slug ? await getStorefront(slug).catch(() => null) : null;
  const practice = clinic?.name ?? 'Practice';

  const manifest = {
    name: `${practice} — Console`,
    // What fits under an icon on a home screen. Anything longer is truncated
    // with an ellipsis by the launcher, which looks like a bug.
    short_name: 'Console',
    description: `Appointments, clients and payments for ${practice}.`,
    // Her day, not the dashboard. The first thing she needs at 8am is who is
    // coming in.
    start_url: '/console/today',
    scope: '/console',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#EFE7DA',
    theme_color: '#EFE7DA',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      // Short, because the practice name can change and a manifest cached for a
      // day would keep the old one on her home screen.
      'cache-control': 'public, max-age=300'
    }
  });
}
