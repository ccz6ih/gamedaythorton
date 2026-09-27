/**
 * app/auth/callback/route.ts
 * Where a magic link lands.
 *
 * Supabase sends the client here with a one-time `code`. Exchanging it sets
 * the session cookies, and from then on currentViewer() can see them.
 *
 * THE CLAIM HAPPENS HERE, once, rather than on every portal render. It is the
 * only moment we know a sign-in just occurred, and doing it here means the
 * portal itself stays a read: a page that quietly mutates who you are on every
 * load is a page whose behaviour depends on how many times you refreshed it.
 *
 * `next` is validated as a relative path. An open redirect on the one route
 * that hands out a session is how a phishing page borrows somebody's login —
 * "sign in to your clinic" that bounces to an attacker's copy, now with a real
 * session cookie set on the way past.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  // Relative, single-slash, no scheme. Anything else goes to the portal root.
  const requested = url.searchParams.get('next') ?? '/portal';
  const next = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*$/.test(requested)
    ? requested
    : '/portal';

  if (!code) {
    return NextResponse.redirect(new URL('/portal/sign-in?error=1', url.origin));
  }

  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (all: CookieToSet[]) => { for (const c of all) jar.set(c.name, c.value, c.options); }
      }
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Expired or already used. Both mean "ask for another one".
    return NextResponse.redirect(new URL('/portal/sign-in?error=1', url.origin));
  }

  /**
   * Link them to their record, or explain why not.
   *
   * Never throws into the redirect: a claim that fails unexpectedly should
   * land them on the portal, which will send them back here with a reason,
   * rather than on a 500 immediately after a successful sign-in.
   */
  try {
    const { data } = await supabase.rpc('claim_patient_account');
    const status = (data as { status?: string } | null)?.status;

    if (status === 'staff') {
      return NextResponse.redirect(new URL('/console', url.origin));
    }
    if (status === 'no_match' || status === 'ambiguous' || status === 'no_email') {
      return NextResponse.redirect(
        new URL(`/portal/sign-in?reason=${status}`, url.origin)
      );
    }
  } catch {
    // fall through to the portal
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
