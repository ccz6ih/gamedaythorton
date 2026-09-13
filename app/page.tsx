/**
 * app/page.tsx
 * Sends whoever arrives to the right place, and gives an unauthenticated visitor
 * something honest to look at rather than a redirect loop.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentViewer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const viewer = await currentViewer();
  if (viewer?.kind === 'staff') redirect('/console');
  if (viewer?.kind === 'patient') redirect('/portal');

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="eyebrow">Pilot build</div>
        <h1>Clinic platform</h1>
        <p className="lede">
          Booking, payments, clinical records and a progress engine for
          membership-and-treatment practices. Currently running two synthetic
          practices: a men&rsquo;s-health clinic and a med spa.
        </p>

        <Link className="btn primary block" href="/sign-in">Sign in</Link>

        <div className="cred-list">
          <div className="lbl">Also here</div>
          <Link className="navlink" href="/prototype/index.html">
            <span className="ico" aria-hidden="true">◱</span>
            <span>Phase A prototype — 27 screens, no backend</span>
          </Link>
          <Link className="navlink" href="/about-pilot">
            <span className="ico" aria-hidden="true">⚠</span>
            <span>Why this is not live yet</span>
          </Link>
        </div>

        <p className="metric-note" style={{ marginTop: '1.2rem' }}>
          Every patient, appointment and payment in here is fabricated. This build
          has no HIPAA controls and the database refuses to store anything not
          marked synthetic.
        </p>
      </div>
    </main>
  );
}
