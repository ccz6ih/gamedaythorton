/**
 * lib/storefront-links.ts
 * Where a storefront link points, given the domain the visitor is actually on.
 *
 * THE BUG THIS EXISTS TO FIX
 *
 * Every link on the storefront was written as `/c/medbar-loveland/services`.
 * That is correct on the shared deployment, where the practice is one tenant
 * among several. On the practice's own domain it is a small betrayal: the
 * visitor arrives at medbarco.com, clicks "Services", and the address bar
 * becomes medbarco.com/c/medbar-loveland/services — a URL that exposes an
 * internal slug, reads like a directory listing the practice has been filed
 * into, and is not the one anybody would ever want to share or print.
 *
 * The pages still LIVE at /c/[slug]. next.config.mjs rewrites the domain's root
 * onto them, which is why the ugly path also works. This module makes the links
 * agree with the rewrite instead of ignoring it.
 *
 * HOW THE PREFIX IS DECIDED
 *
 * By the request's own Host header, and by nothing else. Deliberately NOT by
 * PRIMARY_CLINIC_SLUG, which middleware.ts does use as a fallback: that env var
 * decides whether a page is PUBLIC, and being wrong there shows a preview to
 * someone who should have seen a passcode. Here being wrong emits `/services`
 * on a host where no rewrite exists, which is a 404 on every link in the nav.
 *
 * Same map, two consumers, two different failure modes — so this one reads the
 * map directly and takes no fallback.
 */

import { headers } from 'next/headers';
import { STOREFRONT_DOMAINS } from '../storefront-domains.mjs';

/**
 * The prefix every storefront link should carry: '' on the practice's own
 * domain, '/c/<slug>' anywhere else.
 *
 * Returns '' rather than '/' so callers can concatenate — `${base}/services`
 * is a valid path in both cases, while `${'/'}/services` is not.
 */
export async function storefrontBase(slug: string): Promise<string> {
  const host = (await headers()).get('host');
  if (!host) return `/c/${slug}`;

  const bare = host.split(':')[0]!.toLowerCase();
  const owner = (STOREFRONT_DOMAINS as Record<string, string>)[bare];

  // The host must map to THIS practice. A second practice's domain pointed at
  // the same deployment must not produce root links for somebody else's pages.
  return owner === slug ? '' : `/c/${slug}`;
}

/**
 * Links for a storefront, built once per page.
 *
 * Returned as an object rather than assembled inline at each call site because
 * the home link is the one that differs: '' is not a usable href, so it has to
 * become '/'. Getting that wrong yields a link to the current page's directory,
 * which behaves correctly on `/` and incorrectly everywhere else — the kind of
 * bug that only shows up on the subpages nobody tests.
 */
export function storefrontLinks(base: string) {
  return {
    base,
    home: base || '/',
    services: `${base}/services`,
    shop: `${base}/shop`,
    packages: `${base}/packages`,
    about: `${base}/about`,
    enquire: `${base}/enquire`,
    cart: `${base}/cart`,
    /** Stripe returns here. Absolute URL built by the checkout route. */
    thanks: `${base}/shop/thanks`
  };
}

export type StorefrontLinks = ReturnType<typeof storefrontLinks>;
