/**
 * Types for storefront-domains.mjs.
 *
 * The module itself is .mjs because next.config.mjs has to import it, and the
 * Next config is loaded before any TypeScript is compiled. This gives the
 * TypeScript side the same contract without duplicating the values — which is
 * the whole reason that file exists.
 */

/** Hostname to clinic slug, for domains serving one practice at the root. */
export declare const STOREFRONT_DOMAINS: Record<string, string>;

/** Pages that exist at the root of such a domain. */
export declare const STOREFRONT_PATHS: string[];

/** True when this path is a storefront page on a root-serving domain. */
export declare function isStorefrontPath(pathname: string): boolean;

/** Which clinic a host serves at the root, or null. */
export declare function clinicForHost(
  host: string | null | undefined,
  fallbackSlug?: string | null
): string | null;
