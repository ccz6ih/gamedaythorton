/**
 * app/c/[slug]/sitemap.ts — every page worth finding.
 *
 * GENERATED, because the product pages are rows in a table. A hand-written XML
 * file would have listed eighteen products on the day it was written and none
 * of the ones added since, which is worse than not having one — a stale sitemap
 * actively tells a crawler that pages it can see do not exist.
 *
 * Only the indexable paths appear. The basket and the receipt are deliberately
 * absent for the same reason they carry noindex: they are per-visitor pages a
 * crawler would fetch empty.
 */

import type { MetadataRoute } from 'next';
import { getStorefront, getStorefrontProducts, getStorefrontServices } from '@/lib/db/storefront';
import { PRF_TREATMENTS } from '@/lib/prf-content';

export const dynamic = 'force-dynamic';

export async function generateSitemaps() {
  // One sitemap per practice. Next requires this even for a single entry when
  // the route is inside a dynamic segment.
  return [{ id: 0 }];
}

export default async function sitemap(
  { params }: { params: Promise<{ slug: string }> }
): Promise<MetadataRoute.Sitemap> {
  const { slug } = await params;
  const clinic = await getStorefront(slug);

  // A practice that has not said its site is live does not get listed. Same
  // rule as the robots meta tag, from the same column.
  if (!clinic || !clinic.live) return [];

  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.medbarco.com').replace(/\/$/, '');
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/services`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/prf`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/prf/compare`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/prf/aftercare`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/facials`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/led-light-therapy`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/scar-revision`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${base}/book`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/packages`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/enquire`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 }
  ];

  const products = await getStorefrontProducts(clinic.id);
  for (const p of products) {
    if (!p.slug) continue;
    pages.push({
      url: `${base}/shop/${p.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7
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
