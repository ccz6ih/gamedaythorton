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
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      // Supabase only. No analytics, no pixels, no session replay.
      `connect-src 'self' ${supabase} wss://*.supabase.co`,
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'"
    ];

    const csp = base.join('; ');

    const storefrontCsp = base
      .map(d => d.startsWith('style-src') ? `${d} https://fonts.googleapis.com` : d)
      .map(d => d.startsWith('font-src') ? `${d} https://fonts.gstatic.com` : d)
      .join('; ');

    const commonHeaders = [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
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
      ...['/', '/services', '/packages', '/about', '/shop', '/shop/:path*', '/enquire'].map(source => ({
        source,
        headers: [...commonHeaders, { key: 'Content-Security-Policy', value: storefrontCsp }]
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
    const storefrontPaths = ['', '/services', '/packages', '/about', '/shop', '/enquire'];

    const forSlug = (slug, host) =>
      storefrontPaths.map(p => ({
        source: p === '' ? '/' : p,
        destination: `/c/${slug}${p}`,
        ...(host ? { has: [{ type: 'host', value: host }] } : {})
      })).concat([{
        source: p_wildcard(),
        destination: `/c/${slug}/:path*`,
        ...(host ? { has: [{ type: 'host', value: host }] } : {})
      }]);

    // Only the shop has sub-paths worth forwarding wholesale today.
    function p_wildcard() { return '/shop/:path*'; }

    const rules = [
      // Her domain, however it resolves.
      ...forSlug('medbar-loveland', 'medbarco.com'),
      ...forSlug('medbar-loveland', 'www.medbarco.com')
    ];

    if (primary) rules.push(...forSlug(primary, null));

    return { beforeFiles: rules };
  }
};

export default nextConfig;
