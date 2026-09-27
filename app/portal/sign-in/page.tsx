/**
 * app/portal/sign-in/page.tsx
 * The client's way in. No password, ever.
 *
 * ===========================================================================
 * WHY A MAGIC LINK AND NOT A PASSWORD
 * ===========================================================================
 * A client comes in every six or eight weeks. Nobody remembers a password on
 * that cadence, so a password portal is really a password-reset portal — the
 * same email round trip, plus a form that makes people feel stupid first.
 *
 * It is also the same proof: control of the inbox. The difference is that a
 * password additionally creates something to leak, reuse across sites, and
 * store.
 *
 * ===========================================================================
 * THE ANSWER IS ALWAYS THE SAME
 * ===========================================================================
 * "If that address is on file, a link is on its way" — whether or not it is.
 * A page that says "no account found" answers the question "is this person a
 * client of this practice?" for anybody who can type, and at a medical
 * aesthetics practice that is not a question a stranger gets to ask.
 *
 * The real outcome is decided after they click, by claim_patient_account().
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieToSet = { name: string; value: string; options?: CookieOptions };
import { cookies } from 'next/headers';
import { emailOrigin } from '@/lib/email-theme';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false }
};

async function sendLink(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect('/portal/sign-in?error=1');
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

  /**
   * shouldCreateUser is TRUE, and that is not a hole.
   *
   * An auth user on its own reaches nothing: the portal requires a PATIENT row
   * linked to it, and claim_patient_account() only links when the verified
   * address matches exactly one client record. A stranger who signs in gets an
   * account attached to no chart and a page telling them to call the practice.
   *
   * The alternative — refusing unknown addresses at this step — would answer
   * the "is this person a client here" question at the door, which is the one
   * thing this page must not do.
   */
  await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${emailOrigin()}/auth/callback?next=/portal`
    }
  });

  redirect('/portal/sign-in?sent=1');
}

export default async function PortalSignIn({
  searchParams
}: {
  searchParams: Promise<{ sent?: string; error?: string; reason?: string }>;
}) {
  const { sent, error, reason } = await searchParams;

  return (
    <main className="intake-page">
      <div className="intake-wrap" style={{ maxWidth: '26rem' }}>
        <h1>Your visits</h1>

        {reason === 'no_match' && (
          <div className="intake-error" role="alert">
            We could not match that address to a client record. If you have
            visited before, the practice may have a different address on file —
            please give them a call and they will sort it out.
          </div>
        )}
        {reason === 'ambiguous' && (
          <div className="intake-error" role="alert">
            That address appears on more than one record here, so we have not
            guessed. Please call the practice and they will link it for you.
          </div>
        )}

        {sent ? (
          <>
            <p className="intake-lead">
              If that address is on file, a sign-in link is on its way. It is
              good for one use.
            </p>
            <p className="intake-note">
              Nothing in your inbox after a few minutes? Check the spam folder,
              or call the practice — they may have a different address for you.
            </p>
          </>
        ) : (
          <>
            <p className="intake-lead">
              See your upcoming appointments, what you have had done, and any
              prepaid sessions you have left.
            </p>

            {error && (
              <div className="intake-error" role="alert">
                That does not look like an email address.
              </div>
            )}

            <form action={sendLink}>
              <section className="intake-section">
                <div className="intake-field">
                  <label htmlFor="email">Your email address</label>
                  {/* Not a textarea like the intake fields — this is one short
                      value and wants the email keyboard on a phone. */}
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
                  />
                  <div className="hint">
                    We will email you a link. No password to remember.
                  </div>
                </div>
              </section>
              <button className="intake-submit" type="submit">Email me a link</button>
            </form>
          </>
        )}

        <p className="intake-note" style={{ marginTop: 'var(--gd-5)' }}>
          Staff sign in <Link href="/admin">here</Link>.
        </p>
      </div>
    </main>
  );
}
