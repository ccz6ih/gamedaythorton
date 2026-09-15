/**
 * lib/sitemap.ts — every page worth finding, for one practice.
 *
 * GENERATED, because the product pages are rows in a table. A hand-written XML
 * file would have listed eighteen products on the day it was written and none
 * of the ones added since, which is worse than not having one: a stale sitemap
 * actively tells a crawler that pages it can see do not exist.
 *
 * Only indexable paths appear. The basket and the receipt are deliberately
 * absent for the same reason they carry noindex — they are per-visitor pages a
 * crawler would fetch empty.
 *
 * The URL-building lives here rather than in the route so that the route is
 * only responsible for deciding WHICH practice it is serving.
 */

import type { MetadataRoute } from 'next';
import { getStorefront, getStorefrontProducts, getStorefrontServices } from '@/lib/db/storefront';
import { PRF_TREATMENTS } from '@/lib/prf-content';

/**
 * The practice's sitemap, or an empty one.
 *
 * Empty rather than a 404 when the practice is not live: a sitemap that
 * responds and lists nothing is a true statement, and it keeps the URL in
 * robots.txt honest. A 404 there tells Search Console the site is misconfigured.
 */
export async function sitemapFor(slug: string, origin: string): Promise<MetadataRoute.Sitemap> {
  const clinic = await getStorefront(slug);

  // A practice that has not said its site is live does not get listed. Same
  // rule as the robots meta tag, from the same column.
  if (!clinic || !clinic.live) return [];

  const base = origin.replace(/\/$/, '');
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/services`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/prf`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/prf/compare`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/prf/aftercare`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/facials`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/mens-skin-care`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/led-light-therapy`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/scar-revision`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/injectables`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/book`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/packages`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/enquire`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 }
  ];

  const products = await getStorefrontProducts(clinic.id);
  for (const p of products) {
    if (!p.slug) continue;
    /**
     * The product photograph goes in the entry.
     *
     * A modest win and a cheap one — the row is already loaded. Google finds
     * images through the pages they sit on regardless, but declaring them
     * associates each photograph with the product page rather than leaving
     * that to be inferred, which is what gets a jar of moisturiser into image
     * results under its own name.
     *
     * Absolute, because a sitemap has no base to resolve against.
     */
    const images = [p.image_path, p.secondary_image_path]
      .filter((u): u is string => Boolean(u))
      .map(u => (u.startsWith('http') ? u : `${base}${u}`));

    pages.push({
      url: `${base}/shop/${p.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
      ...(images.length ? { images } : {})
    });
  }

  // One entry per PRF treatment that actually exists in this clinic's menu —
  // same "only list what's real" rule as the product loop above.
  const services = await getStorefrontServices(clinic.id);
  for (const t of PRF_TREATMENTS) {
    if (!services.some(s => t.match.test(s.name))) continue;
    pages.push({
      url: `${base}/prf/${t.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8
    });
  }

  return pages;
}
