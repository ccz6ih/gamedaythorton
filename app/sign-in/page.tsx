/**
 * app/sign-in/page.tsx
 *
 * Password sign-in for the pilot, magic link as the production path.
 *
 * The pilot accounts are listed on screen because a pilot nobody can get into is
 * not a pilot — and there is no real patient data behind them to protect. That
 * list disappears the moment PILOT_MODE is off, and the accounts themselves are
 * deleted before Phase C (scripts/db-users.cjs --delete).
 */

import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { PilotAccountPicker } from '@/components/PilotAccountPicker';

const PILOT_ACCOUNTS = [
  { email: 'jamie@medbar.pilot.invalid', who: 'Jamie Salazar', what: 'The Med Bar — owner (med spa)' },
  { email: 'owner@gameday.pilot.invalid', who: 'Ray Okonjo', what: 'Gameday Thornton — owner' },
  { email: 'provider@gameday.pilot.invalid', who: 'Dana Whitfield, NP', what: 'Gameday Thornton — provider' },
  { email: 'desk@gameday.pilot.invalid', who: 'Tess Marlow', what: 'Gameday Thornton — front desk' },
  { email: 'delphine@medbar.pilot.invalid', who: 'Delphine Bettencourt', what: 'Med Bar client portal' },
  { email: 'gregory@gameday.pilot.invalid', who: 'Gregory Sunderman', what: 'Gameday patient portal' }
];

async function signIn(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');

  const supabase = await serverClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately vague. A message that distinguishes "no such account" from
    // "wrong password" confirms whether an email address belongs to a patient of
    // this clinic, which is itself a disclosure.
    redirect(`/sign-in?bad=1${next ? `&next=${encodeURIComponent(next)}` : ''}`);
  }

  redirect(next && next.startsWith('/') ? next : '/');
}

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; bad?: string }>;
}) {
  const params = await searchParams;
  const pilot = process.env.PILOT_MODE !== 'false';

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="eyebrow">Sign in</div>
        <h1>Welcome back</h1>
        <p className="lede">
          Staff go to the console, clients go to their own account. The same form
          handles both — where you land depends on who you are.
        </p>

        <form action={signIn}>
          <input type="hidden" name="next" value={params.next ?? ''} />

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required />
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

        {pilot && (
          <>
            <PilotAccountPicker accounts={PILOT_ACCOUNTS} />
            <p className="metric-note">
              Password is whatever <span className="mono">PILOT_DEMO_PASSWORD</span> is
              set to. These accounts are deleted before any real patient exists.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
