/**
 * storefront-domains.mjs
 * Which hostnames serve a practice's own site at the root.
 *
 * ONE SOURCE, IMPORTED TWICE, AND THAT IS THE POINT.
 *
 * next.config.mjs rewrites medbarco.com/services to /c/medbar-loveland/services.
 * middleware.ts decides whether a request needs the passcode gate. Middleware
 * runs BEFORE rewrites, so it sees "/" and "/services", never the destination.
 *
 * When those two lists were maintained separately, the rewrite knew about
 * medbarco.com and the middleware did not — so the practice's own customers
 * landed on a passcode box at their own domain while every test passed, because
 * the tests ran against a host that happened to have the env var set.
 *
 * Adding a domain or a page now means editing this file, and both sides follow.
 *
 * `.mjs` rather than `.ts` because next.config.mjs has to import it too, and the
 * Next config is loaded before any TypeScript is compiled.
 */

/** Hostnames that serve a single practice at the root, and which practice. */
export const STOREFRONT_DOMAINS = {
  'medbarco.com': 'medbar-loveland',
  'www.medbarco.com': 'medbar-loveland'
};

/**
 * The pages that exist at the root of such a domain.
 *
 * Deliberately explicit rather than "everything that is not /console". A private
 * area added later should be private because nobody listed it here, not public
 * because a wildcard already swept it up.
 */
export const STOREFRONT_PATHS = [
  '/', '/services', '/packages', '/about', '/shop', '/enquire',
  // The PRF education/pillar page — public and indexable like every other
  // storefront page, and specifically NOT a booking or checkout step.
  '/prf',
  // Booking. Public by necessity: a person picking a treatment and a time has
  // no account and must never meet a passcode on the way to giving money.
  '/book',
  // The basket and the page Stripe returns to. Both must be public: a customer
  // coming back from paying has no session and must not meet a passcode box
  // holding a receipt they have already been charged for.
  '/cart', '/shop/thanks'
];

/**
 * Which storefront pages belong in search results.
 *
 * A basket and a receipt do not: they are per-visitor pages that a crawler
 * would index empty, and a "your order is confirmed" page turning up in search
 * results is worse than useless. They still get the storefront CSP — they still
 * need the practice's typeface — so this is about indexing alone.
 */
const NOT_INDEXABLE = new Set(['/cart', '/shop/thanks']);

/**
 * Header rules for next.config.mjs, derived from the paths above rather than
 * typed out a third time.
 *
 * This existed as a separate hardcoded list and drifted the moment /book was
 * added: the booking page was served `noindex, nofollow` by the catch-all and
 * the strict CSP along with it, so Google was told to ignore the one page on
 * the site whose whole job is converting, and its font never loaded there.
 */
export const STOREFRONT_HEADER_SOURCES = [
  ...STOREFRONT_PATHS.map(p => ({ source: p, index: !NOT_INDEXABLE.has(p) })),
  // Product pages, which are exactly the ones worth having in search.
  { source: '/shop/:path*', index: true },
  // One PRF treatment per URL, equally worth having in search.
  { source: '/prf/:path*', index: true }
];

/** True when this path is a storefront page on a root-serving domain. */
export function isStorefrontPath(pathname) {
  return STOREFRONT_PATHS.includes(pathname)
    || pathname.startsWith('/shop/')
    // One PRF treatment per URL — /prf/under-eye, /prf/microneedling,
    // /prf/hair-restoration. Same reasoning as /shop/: a fixed list here would
    // drift the moment a fourth PRF treatment or a renamed one shipped.
    || pathname.startsWith('/prf/');
}

/**
 * Which clinic a host serves at the root, or null.
 *
 * PRIMARY_CLINIC_SLUG is the fallback so the root experience can be seen on a
 * preview URL before DNS moves — but it is only a fallback. The domain map is
 * what makes the live site work without anyone remembering a Vercel setting.
 */
export function clinicForHost(host, fallbackSlug) {
  if (!host) return fallbackSlug ?? null;
  const clean = host.split(':')[0].toLowerCase();
  return STOREFRONT_DOMAINS[clean] ?? fallbackSlug ?? null;
}
