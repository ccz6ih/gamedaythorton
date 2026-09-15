/**
 * app/llms.txt/route.ts — serves /llms.txt.
 *
 * A route handler rather than a file in /public, for the same reason the
 * sitemap is generated: a static summary would carry the prices of the day
 * somebody wrote it, in a file that exists specifically so a machine can quote
 * it without a human checking.
 *
 * Resolves the practice from the Host header, exactly as the sitemap does, so
 * one deployment serving several domains gives each one its own.
 */

import { headers } from 'next/headers';
import { clinicForHost, STOREFRONT_DOMAINS } from '@/storefront-domains.mjs';
import { llmsTxtFor } from '@/lib/llms';

export const dynamic = 'force-dynamic';

export async function GET() {
  const host = (await headers()).get('host');
  const slug = clinicForHost(host, process.env.PRIMARY_CLINIC_SLUG);

  if (!slug) return new Response('Not found\n', { status: 404 });

  const bare = (host ?? '').split(':')[0]?.toLowerCase() ?? '';
  const origin = bare in (STOREFRONT_DOMAINS as Record<string, string>)
    ? `https://${bare}`
    : (process.env.NEXT_PUBLIC_APP_URL || 'https://www.medbarco.com').replace(/\/$/, '');

  const body = await llmsTxtFor(slug, origin);

  // A practice that is not live is not described. 404 rather than an empty
  // file: there is nothing here yet, which is a different statement from
  // "this practice has no treatments".
  if (body === null) return new Response('Not found\n', { status: 404 });

  return new Response(body, {
    headers: {
      /**
       * text/plain, not text/markdown.
       *
       * The convention names a markdown file, but the point of putting it at a
       * URL is that anything can fetch it. text/markdown makes a browser offer
       * to download it, which is hostile to the person most likely to check it
       * exists — whoever is debugging why an answer engine got something wrong.
       * The content is still markdown; only the label is friendlier.
       */
      'content-type': 'text/plain; charset=utf-8',
      // Short cache. It is generated from live rows and a price change should
      // not take a day to reach anything reading this.
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
