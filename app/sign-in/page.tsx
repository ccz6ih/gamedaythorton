/**
 * app/sign-in/page.tsx
 *
 * Password sign-in for the pilot; magic link remains the production design.
 *
 * THE ACCOUNT LIST IS OFF BY DEFAULT.
 * An earlier version printed every pilot account on this page. That was wrong for
 * two reasons: it showed one practice's staff the other practice's account list,
 * which leaks the tenant structure to anyone who reaches the page — and it makes a
 * sign-in screen look like a test harness rather than a product. It now renders
 * only when PILOT_SHOW_ACCOUNTS=true is set deliberately for a hands-off demo.
 */

import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { PilotAccountPicker } from '@/components/PilotAccountPicker';

const PILOT_ACCOUNTS = [
  { email: 'jamie@medbar.pilot.invalid', who: 'Jamie Salazar', what: 'The Med Bar — owner' },
  { email: 'owner@gameday.pilot.invalid', who: 'Ray Okonjo', what: 'Gameday Thornton — owner' },
  { email: 'provider@gameday.pilot.invalid', who: 'Dana Whitfield, NP', what: 'Gameday Thornton — provider' },
  { email: 'desk@gameday.pilot.invalid', who: 'Tess Marlow', what: 'Gameday Thornton — front desk' },
  { email: 'delphine@medbar.pilot.invalid', who: 'Delphine Bettencourt', what: 'Med Bar client account' },
  { email: 'gregory@gameday.pilot.invalid', who: 'Gregory Sunderman', what: 'Gameday patient account' }
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
    // "wrong password" confirms whether an address belongs to a patient of this
    // practice, which is itself a disclosure.
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
  const showAccounts =
    process.env.PILOT_MODE !== 'false' && process.env.PILOT_SHOW_ACCOUNTS === 'true';

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <h1>Sign in</h1>
        <p className="lede">
          Staff go to the console; clients go to their own account.
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

        {showAccounts && <PilotAccountPicker accounts={PILOT_ACCOUNTS} />}
      </div>
    </main>
  );
}
