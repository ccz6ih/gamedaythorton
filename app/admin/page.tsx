/**
 * app/admin/page.tsx — the staff sign-in.
 *
 * WHY IT MOVED OFF /sign-in
 *
 * The practice's own domain now serves the shop at the root. On medbarco.com,
 * "/sign-in" reads as a customer account — somebody who has just bought a
 * moisturiser and wants to check their order. It is not: it is the door to the
 * console holding thirty-five clients' contact details.
 *
 * A URL that invites the wrong person is a small usability problem and a
 * slightly larger security one. Every stranger who tries a password there is
 * noise in the logs that looks exactly like a real attempt, and the owner
 * cannot tell them apart.
 *
 * So the door is at /admin, which says what it is, and nothing on the public
 * site links to it. /sign-in still works and redirects here, because bookmarks
 * and old links should not break.
 *
 * THERE IS NO CUSTOMER SIGN-IN, deliberately. Checkout is guest checkout,
 * enquiries are a form, and a receipt arrives by email. Asking someone to
 * create an account to buy a cleanser loses sales for no benefit to anyone. If
 * a client portal is wanted later it belongs at /portal, which already exists.
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { serverClient } from '@/lib/supabase/server';
import { getStorefront } from '@/lib/db/storefront';
import { Brand } from '@/components/Brand';
import { clinicForHost } from '../../storefront-domains.mjs';
import type { Clinic } from '@/lib/db/queries';

async function signIn(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');

  const supabase = await serverClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately vague. A message that distinguishes "no such account" from
    // "wrong password" confirms whether an address belongs to a patient of this
    // practice, which is itself a disclosure.
    redirect(`/admin?bad=1${next ? `&next=${encodeURIComponent(next)}` : ''}`);
  }

  redirect(next && next.startsWith('/') ? next : '/console');
}

export default async function AdminSignIn({
  searchParams
}: {
  searchParams: Promise<{ next?: string; bad?: string }>;
}) {
  const params = await searchParams;

  /**
   * Branded from the DOMAIN, because there is no session yet to tell us whose
   * practice this is.
   *
   * Without it the sign-in page is the one screen in the whole product still
   * wearing the default red — the first thing the owner sees each morning, and
   * the last impression anyone gets before the console loads. Reading the host
   * costs one public query against the storefront view, which is already
   * anonymous-readable, so no session is needed and nothing private is touched.
   */
  const host = (await headers()).get('host');
  const slug = clinicForHost(host, process.env.PRIMARY_CLINIC_SLUG);
  const storefront = slug ? await getStorefront(slug) : null;
  const clinic = storefront ? ({ brand: storefront.brand } as unknown as Clinic) : null;

  return (
    <Brand clinic={clinic}>
    <main className="auth-wrap">
      <div className="auth-card">
        <h1>Staff sign in</h1>
        <p className="lede">
          The practice console. If you are a client looking for an order, check
          your email for the receipt.
        </p>

        <form action={signIn}>
          <input type="hidden" name="next" value={params.next ?? ''} />

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>

          {params.bad && (
            <div className="err" style={{ marginTop: '.6rem' }}>
              That email and password do not match an account.
            </div>
          )}

          <button className="btn primary block" type="submit">Sign in</button>
        </form>
      </div>
    </main>
    </Brand>
  );
}
