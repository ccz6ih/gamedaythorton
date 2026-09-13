/**
 * app/gate/page.tsx
 * The pilot passcode.
 *
 * This is NOT authentication and nothing downstream treats it as any. It keeps a
 * pre-compliance build with real practice names, real prices and realistic
 * clinical data from being browsable by whoever finds the hostname.
 * docs/06-architecture.md: "not discoverable".
 *
 * Real access control is RLS, proved by scripts/db-test.cjs and
 * scripts/auth-test.cjs.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const GATE_COOKIE = 'gd_pilot_gate';

async function unlock(formData: FormData) {
  'use server';

  const submitted = String(formData.get('passcode') ?? '');
  const next = String(formData.get('next') ?? '/');
  const expected = process.env.PILOT_PASSCODE;

  if (!expected || submitted !== expected) {
    redirect(`/gate?next=${encodeURIComponent(next)}&bad=1`);
  }

  const store = await cookies();
  store.set(GATE_COOKIE, expected, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12          // a working day, then ask again
  });

  // Only ever redirect to a path on this origin. Accepting an absolute URL here
  // turns the gate into an open redirect.
  redirect(next.startsWith('/') ? next : '/');
}

export default async function GatePage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; bad?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="auth-wrap">
      <form className="auth-card" action={unlock}>
        <h1>Private preview</h1>
        <p className="lede">
          This deployment is not public yet. Enter the passcode to continue.
        </p>

        <input type="hidden" name="next" value={params.next ?? '/'} />

        <div className="field">
          <label htmlFor="passcode">Passcode</label>
          <input
            id="passcode"
            name="passcode"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
          />
          {params.bad && <div className="err">That passcode is not right.</div>}
        </div>

        <button className="btn primary block" type="submit">Continue</button>
      </form>
    </main>
  );
}
