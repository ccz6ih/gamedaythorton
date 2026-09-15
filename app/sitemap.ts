/**
 * app/sitemap.ts — /sitemap.xml, on whichever practice's domain asked for it.
 *
 * ---------------------------------------------------------------------------
 * WHY IT MOVED HERE
 * ---------------------------------------------------------------------------
 * It used to live at app/c/[slug]/sitemap.ts with a generateSitemaps() export,
 * and it had never worked. Two faults, either of which was enough:
 *
 *   1. generateSitemaps() changes the URL shape. The route stopped being
 *      /c/<slug>/sitemap.xml and became /c/<slug>/sitemap/0.xml — a path no
 *      crawler looks for and nobody would think to check.
 *
 *   2. It crashed anyway. With generateSitemaps(), Next passes `{ id }`, not
 *      `{ params }` — so `const { slug } = await params` threw
 *      "Cannot destructure property 'slug' of undefined" and the route
 *      returned 500.
 *
 * Meanwhile public/robots.txt has been telling every crawler
 * `Sitemap: https://www.medbarco.com/sitemap.xml`, which returned 404. That is
 * worse than having no sitemap at all: a declared sitemap that 404s is a
 * configuration error Search Console reports against the property, rather than
 * a site that simply has not submitted one.
 *
 * ---------------------------------------------------------------------------
 * WHY IT READS THE HOST
 * ---------------------------------------------------------------------------
 * /sitemap.xml is a single fixed path, but this deployment serves more than one
 * practice — medbarco.com is rewritten to /c/medbar-loveland by
 * next.config.mjs, and a second practice on its own domain would work the same
 * way. So the route answers the same question the rewrites and the middleware
 * already answer, using the same function: which clinic is this hostname?
 *
 * storefront-domains.mjs stays the single place that knows.
 */

import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { clinicForHost, STOREFRONT_DOMAINS } from '@/storefront-domains.mjs';
import { sitemapFor } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get('host');
  const slug = clinicForHost(host, process.env.PRIMARY_CLINIC_SLUG);

  // A hostname that serves no practice gets an empty sitemap rather than a
  // crash. The preview URLs are in that position and should list nothing.
  if (!slug) return [];

  /**
   * The origin the URLs are listed under.
   *
   * A sitemap lists absolute URLs, so getting this wrong makes every entry in
   * it wrong. Two ways that happens, and the order below avoids both:
   *
   *   - Trusting the request host blindly would publish the preview
   *     deployment's URLs into the practice's sitemap the first time anybody
   *     opened it on a vercel.app address.
   *
   *   - Trusting NEXT_PUBLIC_APP_URL blindly bakes one practice's address into
   *     a deployment that serves several. It is also just one env var away
   *     from listing localhost, which is exactly what it does in development.
   *
   * So: if the hostname that asked is a practice's own domain — the same map
   * the rewrites and the middleware use — that is the answer, and it stays
   * right for every tenant without anybody setting anything. Otherwise fall
   * back to the configured address.
   */
  // `[0]` is `string | undefined` under noUncheckedIndexedAccess, and a Host
  // header is attacker-controlled, so neither the split nor the header is
  // assumed to have produced anything.
  const clean = (host ?? '').split(':')[0]?.toLowerCase() ?? '';
  const known = clean in STOREFRONT_DOMAINS;

  const origin = known
    ? `https://${clean}`
    : (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://www.medbarco.com');

  return sitemapFor(slug, origin);
}
