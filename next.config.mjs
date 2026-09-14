import { STOREFRONT_DOMAINS, STOREFRONT_PATHS, STOREFRONT_HEADER_SOURCES } from './storefront-domains.mjs';
/**
 * next.config.mjs
 *
 * The headers below are not boilerplate. This is a pre-compliance build that is
 * reachable from the internet, so the two things that matter most are that no
 * search engine indexes it and that no third-party script can run on an
 * authenticated route.
 *
 * docs/06-architecture.md rule 2: no third-party tracking behind login. Ever.
 * HHS OCR has published guidance on tracking technologies and PHI, and there is
 * active litigation in this exact vertical. The CSP here is what makes that a
 * property of the deployment rather than a promise in a document.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Referrers can leak a patient id in a URL to whatever a user clicks through
  // to. Strip them at the origin.
  async headers() {
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co';
    const supabaseOrigin = (() => {
      try {
        return new URL(supabase).origin;
      } catch {
        return supabase;
      }
    })();

    /**
     * Two policies, not one.
     *
     * The strict policy allows no external origin of any kind, which is the
     * documented control behind "no third-party code behind login". It stays
     * exactly as it was for the console, the portal and everything private.
     *
     * The storefront gets ONE addition: Google Fonts. A practice whose whole
     * identity is a particular serif cannot have it silently fall back to
     * Georgia, which is what was happening — the CSS asked for Cormorant and
     * the policy blocked it, with no error anywhere.
     *
     * The tradeoff is real and bounded: Google sees the IP of someone browsing
     * a public marketing page. That is the same exposure as every other font
     * on the web, it applies to no authenticated route, and no script origin
     * is opened — only fonts and the stylesheet that declares them.
     *
     * Self-hosting the font would remove even that, and is the better answer
     * once the typeface is settled. Noted rather than done, because picking
     * the face is still in flux.
     */
    const base = [
      "default-src 'self'",
      // 'unsafe-inline' is required for Next's inline hydration script. No
      // external script origins are allowed at all, which is the point.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${supabaseOrigin} https://*.supabase.co`,
      "font-src 'self' data:",
      // Supabase only. No analytics, no pixels, no session replay.
      `connect-src 'self' ${supabase} wss://*.supabase.co`,
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'"
    ];

    const csp = base.join('; ');

    /**
     * The storefront additions, and the reasoning for each.
     *
     * FONTS. A practice whose identity is a particular serif cannot have it
     * silently fall back to Georgia. Cost: Google sees the IP of someone
     * browsing a public marketing page.
     *
     * ANALYTICS. A SCRIPT origin, which is a materially bigger concession than
     * a font — a script can read the whole page it runs on. It is admitted here
     * and ONLY here: the catch-all above, which covers the console, the portal,
     * the sign-in page and the gate, still allows no external script of any
     * kind. That asymmetry is the entire control. A business cannot be asked to
     * run without knowing where its customers come from; it also cannot have a
     * third party reading a page with client names on it.
     *
     * If the practice sets no measurement id these origins are simply unused —
     * the policy permits them, nothing loads from them.
     */
    const GA_SCRIPT = 'https://www.googletagmanager.com';
    const GA_COLLECT = 'https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com';

    const storefrontCsp = base
      .map(d => d.startsWith('style-src') ? `${d} https://fonts.googleapis.com` : d)
      .map(d => d.startsWith('font-src') ? `${d} https://fonts.gstatic.com` : d)
      .map(d => d.startsWith('script-src') ? `${d} ${GA_SCRIPT}` : d)
      .map(d => d.startsWith('connect-src') ? `${d} ${GA_COLLECT} ${GA_SCRIPT}` : d)
      .map(d => d.startsWith('img-src') ? `${d} ${GA_COLLECT}` : d)
      .join('; ');

    /**
     * NO X-Robots-Tag on the storefront.
     *
     * A header cannot know which clinic is being served, and the answer differs
     * per tenant: a live practice wants to be found, a pilot tenant must not
     * be. The page's own robots meta tag is rendered from the clinic record and
     * gets it right — but a header saying noindex OVERRIDES a meta tag saying
     * index, so leaving it here would have quietly kept her site out of search
     * while the page insisted otherwise.
     *
     * Everything private keeps the header, in the strict block below.
     */
    const commonHeaders = [
      // Explicitly permissive, because headers ACCUMULATE: the strict block
      // above already set noindex, and simply omitting the key here leaves that
      // in place. Her page would have kept insisting it was indexable in its
      // meta tag while the header quietly said otherwise.
      //
      // This is safe for a pilot tenant too. Where a meta tag and a header
      // disagree, crawlers take the more restrictive of the two — so Gameday's
      // "noindex" meta still wins over this "all".
      { key: 'X-Robots-Tag', value: 'all' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
      { key: 'Cache-Control', value: 'no-store, max-age=0' }
    ];

    // ORDER MATTERS AND IS THE OPPOSITE OF WHAT IT LOOKS LIKE.
    //
    // Next applies every matching block, and for a repeated header key the LAST
    // one wins. So the strict catch-all goes FIRST and the storefront blocks
    // after it, overriding on the paths they match. Listing the specific rules
    // first — the intuitive order — silently gave every page the strict policy
    // and the font never loaded.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: csp },
          // Belt and braces: nothing in a pilot should ever be cached by a proxy.
          { key: 'Cache-Control', value: 'no-store, max-age=0' }
        ]
      },

      // The public storefront — the only pages allowed an external origin, and
      // only for fonts. Listed after the catch-all so these win.
      {
        source: '/c/:path*',
        headers: [...commonHeaders, { key: 'Content-Security-Policy', value: storefrontCsp }]
      },
      /**
       * DERIVED FROM STOREFRONT_PATHS, not typed out again.
       *
       * This was a third hardcoded list of storefront paths, and it drifted the
       * moment /book was added: the booking page — the one page on the site
       * that exists to convert — was served
       * `X-Robots-Tag: noindex, nofollow` by the catch-all, AND the strict CSP,
       * so Google was told to ignore it and its typeface never loaded.
       *
       * storefront-domains.mjs exists precisely because two lists that must
       * agree will not. It was already shared by the middleware and the
       * rewrites; this is the third consumer it should always have had.
       */
      ...STOREFRONT_HEADER_SOURCES.map(({ source, index }) => ({
        source,
        headers: [
          ...commonHeaders,
          // A basket and a receipt have no business in search results — they
          // are per-visitor pages that would be indexed empty. They still need
          // the storefront CSP, because they still need the practice's font.
          ...(index ? [] : [{ key: 'X-Robots-Tag', value: 'noindex, follow' }]),
          { key: 'Content-Security-Policy', value: storefrontCsp }
        ]
      }))
    ];
  },

  /**
   * The practice's own domain serves the practice's own site at the root.
   *
   * medbarco.com/            -> /c/medbar-loveland
   * medbarco.com/services    -> /c/medbar-loveland/services
   *
   * A rewrite rather than a second copy of the pages: one storefront
   * implementation, reached two ways. Duplicating the routes would mean every
   * future change had to be made twice and would be made once.
   *
   * The /c/<slug> paths keep working, which is what makes a second location or
   * a second practice possible without unpicking any of this — Jamie works at
   * Gameday some days, and that clinic is already a tenant here.
   *
   * PRIMARY_CLINIC_SLUG does the same thing on whatever host is running, so the
   * root-domain experience can be seen on the preview URL before DNS moves.
   */
  async rewrites() {
    const primary = process.env.PRIMARY_CLINIC_SLUG;
    // Paths and domains come from storefront-domains.mjs, which middleware.ts
    // reads too. They were separate lists once and immediately drifted.
    const storefrontPaths = STOREFRONT_PATHS.map(p => (p === '/' ? '' : p));

    /**
     * Sub-paths forwarded wholesale. The PREFIX HAS TO APPEAR ON BOTH SIDES:
     * `/shop/:path*` -> `/c/<slug>/:path*` drops the segment and sends
     * /shop/renew-eye-complex to /c/<slug>/renew-eye-complex, which is a 404.
     *
     * It was written that way and nothing noticed, because no /shop sub-path
     * existed until product pages did — /shop/thanks is an exact entry in
     * STOREFRONT_PATHS and matched the rule above it. A wildcard with nothing
     * under it is untested by definition.
     */
    const WILDCARDS = ['/shop'];

    const forSlug = (slug, host) => [
      ...storefrontPaths.map(p => ({
        source: p === '' ? '/' : p,
        destination: `/c/${slug}${p}`,
        ...(host ? { has: [{ type: 'host', value: host }] } : {})
      })),
      ...WILDCARDS.map(prefix => ({
        source: `${prefix}/:path*`,
        destination: `/c/${slug}${prefix}/:path*`,
        ...(host ? { has: [{ type: 'host', value: host }] } : {})
      }))
    ];

    const rules = Object.entries(STOREFRONT_DOMAINS)
      .flatMap(([host, slug]) => forSlug(slug, host));

    if (primary) rules.push(...forSlug(primary, null));

    return { beforeFiles: rules };
  }
};

export default nextConfig;
