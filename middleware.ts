/**
 * middleware.ts
 * Two gates, in order.
 *
 * 1. THE PILOT PASSCODE.
 *    This deployment is reachable from the internet on a guessable Vercel URL.
 *    Even with only synthetic data in it, an open medical-looking app with real
 *    practice names and prices in it should not be browsable by anyone who finds
 *    the hostname. docs/06-architecture.md calls for exactly this: "staff console
 *    behind a shared pilot passcode, not discoverable".
 *
 * 2. THE SESSION.
 *    Refreshes the Supabase session on every request and sends unauthenticated
 *    users to sign-in. Also keeps staff out of the patient portal and patients
 *    out of the console, because getting that wrong is a cross-role data leak.
 *
 * The passcode is NOT authentication and is not treated as any. It is a hedge
 * against casual discovery. Real access control is RLS, proved by
 * scripts/db-test.cjs and scripts/auth-test.cjs.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const GATE_COOKIE = 'gd_pilot_gate';

/**
 * Three tiers, explicitly. An earlier version had only two and it broke four
 * things at once: the gate page redirected to sign-in (so the gate was
 * unreachable), robots.txt redirected (so crawlers got an HTML page instead of a
 * Disallow), and the Stripe webhook redirected — meaning webhooks would have
 * silently never arrived, which is the kind of bug you discover by reconciling a
 * month of payments by hand.
 */

/**
 * Skip BOTH the gate and the session check.
 *
 * The webhook belongs here because Stripe cannot present a passcode or a session
 * — it authenticates with a signature, which the route verifies itself and
 * refuses without. Putting it behind the gate does not make it safer; it makes it
 * broken.
 */
const ALWAYS_OPEN = [
  '/gate',
  '/robots.txt',
  '/favicon.ico',
  '/api/stripe/webhook'
];

/** Past the gate, but readable before signing in. */
const ANONYMOUS_OK = [
  '/',
  '/sign-in',
  '/auth/callback',
  '/about-pilot',     // the compliance explainer must never require a login
  '/prototype',
  '/c'                // public storefronts: /c/<slug>. No session, by design.
];

function isUnder(pathname: string, paths: string[]) {
  return paths.some(p => pathname === p || pathname.startsWith(p === '/' ? '/' : p + '/'));
}

function isExactlyOrUnder(pathname: string, paths: string[]) {
  return paths.some(p => pathname === p || (p !== '/' && pathname.startsWith(p + '/')));
}

/**
 * Environment variables without which this deployment must not serve anything.
 *
 * PILOT_PASSCODE is on the list while PILOT_MODE is on, deliberately: an unset
 * passcode would otherwise mean the gate quietly does nothing, which is the
 * failure mode where a pre-compliance clinical app ends up publicly browsable
 * because somebody forgot one Vercel setting.
 */
function missingConfig(): string[] {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  if (process.env.PILOT_MODE !== 'false') required.push('PILOT_PASSCODE');
  return required.filter(key => !process.env[key]);
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Next internals, static assets, and the always-open tier.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    isExactlyOrUnder(pathname, ALWAYS_OPEN)
  ) {
    return NextResponse.next();
  }

  // ------------------------------------------------- fail closed ----
  // A missing control must not read as "no control needed". If this is deployed
  // without its environment configured, every route says so plainly rather than
  // either crashing with a stack trace or — far worse — serving the app wide open
  // because PILOT_PASSCODE happened to be undefined.
  const misconfigured = missingConfig();
  if (misconfigured.length) {
    return new NextResponse(
      `This deployment is not configured.\n\nMissing: ${misconfigured.join(', ')}\n\n` +
      `Set these in the hosting environment before using it.\n` +
      `See docs/19-environment.md.\n`,
      {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' }
      }
    );
  }

  // ---------------------------------------------------------- gate ----
  const passcode = process.env.PILOT_PASSCODE;
  if (passcode) {
    const held = request.cookies.get(GATE_COOKIE)?.value;
    if (held !== passcode) {
      const url = request.nextUrl.clone();
      url.pathname = '/gate';
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }

  // ------------------------------------------------------- session ----
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet: CookieToSet[]) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user && !isExactlyOrUnder(pathname, ANONYMOUS_OK)) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // --------------------------------------------- role separation ----
  // A patient reaching a console route, or staff reaching the portal, is either
  // a bug or an attempt. Either way it redirects rather than rendering, so no
  // query for the wrong role's data is ever issued.
  if (user && (pathname.startsWith('/console') || pathname.startsWith('/portal'))) {
    const { data: staff } = await supabase
      .from('staff_user')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .maybeSingle();

    const isStaff = !!staff;
    if (pathname.startsWith('/console') && !isStaff) {
      const url = request.nextUrl.clone();
      url.pathname = '/portal';
      url.search = '';
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith('/portal') && isStaff) {
      const url = request.nextUrl.clone();
      url.pathname = '/console';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  /**
   * Static assets skip the middleware entirely.
   *
   * `/practitioners/*` is a public marketing image referenced by the public
   * storefront, so an anonymous visitor must be able to load it. Without this
   * exclusion the middleware sent it to /sign-in and the headshot rendered as
   * a broken image for exactly the people the page exists for — and it looked
   * fine to anyone testing while signed in, which is how it would have shipped.
   *
   * Only non-sensitive asset paths belong here. Patient media is never served
   * from /public; it lives in private storage behind short-TTL signed URLs.
   * docs/16-media-pipeline.md.
   */
  matcher: [
    '/((?!_next/static|_next/image|practitioners|brand|favicon.ico|robots.txt).*)'
  ]
};
