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
  // The basket and the page Stripe returns to. Both must be public: a customer
  // coming back from paying has no session and must not meet a passcode box
  // holding a receipt they have already been charged for.
  '/cart', '/shop/thanks'
];

/** True when this path is a storefront page on a root-serving domain. */
export function isStorefrontPath(pathname) {
  return STOREFRONT_PATHS.includes(pathname)
    || pathname.startsWith('/shop/');
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
