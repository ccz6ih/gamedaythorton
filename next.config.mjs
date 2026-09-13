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

    const csp = [
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
    ].join('; ');

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
      }
    ];
  }
};

export default nextConfig;
