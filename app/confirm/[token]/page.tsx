/**
 * app/confirm/[token]/page.tsx — the page the reminder link opens.
 *
 * ---------------------------------------------------------------------------
 * WHY IT CONFIRMS ON SIGHT
 * ---------------------------------------------------------------------------
 * There is no "are you sure" step. The client already decided when they tapped
 * a link that said Confirm; asking again is a second chance to not bother, and
 * the whole point is to be one tap.
 *
 * The usual objection to acting on a GET is that mail scanners and link
 * previewers fetch URLs without a human involved. That matters when the action
 * is destructive. Here the worst case is an appointment marked confirmed that
 * the client never looked at — which is the same state it would have been in
 * under the old "reply to this email" arrangement, and strictly better than an
 * appointment nobody knows about either way. Cancelling is deliberately NOT on
 * this page for exactly that reason: it is the one that must not happen by
 * accident.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT SHOWS
 * ---------------------------------------------------------------------------
 * The time, the treatment, the practice. Not the client's name, not their
 * contact details, not their history. A link in an email reaches more places
 * than the person it was sent to — forwarded, synced to a shared tablet, sat
 * in a browser history on a family computer — and none of those should be able
 * to read a chart.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { anonClient } from '@/lib/db/storefront';

export const dynamic = 'force-dynamic';

// A confirmation page is for one person and has no business in an index.
export const metadata: Metadata = {
  title: 'Appointment',
  robots: { index: false, follow: false }
};

type Result = {
  ok: boolean;
  reason?: string;
  startsAt?: string;
  service?: string | null;
  clinic?: string;
};

export default async function ConfirmPage(
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Shape-check before the round trip. A malformed token is a 404's worth of
  // information either way, and this keeps obvious junk off the database.
  const looksLikeToken = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

  let result: Result = { ok: false, reason: 'unknown' };
  if (looksLikeToken) {
    const supabase = anonClient();
    const { data } = await supabase.rpc('confirm_appointment', { p_token: token });
    if (data) result = data as Result;
  }

  const when = result.startsAt
    ? new Date(result.startsAt).toLocaleString('en-US', {
        timeZone: 'America/Denver',
        weekday: 'long', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit'
      })
    : null;

  return (
    <main className="confirm-page">
      <div className="confirm-card">
        {result.ok ? (
          <>
            <div className="confirm-tick" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="34" height="34">
                <path d="M7 16.5 L13.5 23 L25 10" fill="none" stroke="currentColor"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1>You&rsquo;re confirmed</h1>
            <p className="confirm-when">{when}</p>
            {result.service && <p className="confirm-what">{result.service}</p>}
            <p className="confirm-note">
              Thank you — that tells {result.clinic ?? 'the practice'} to expect you.
              If anything changes, call or reply to your reminder email.
            </p>
          </>
        ) : (
          <>
            <h1>
              {result.reason === 'cancelled' ? 'That appointment was cancelled'
                : result.reason === 'past' ? 'That appointment has passed'
                : 'We couldn’t find that appointment'}
            </h1>
            <p className="confirm-note">
              {result.reason === 'cancelled'
                ? 'Nothing to confirm. If that is a surprise, please get in touch.'
                : result.reason === 'past'
                ? 'No need to confirm this one. We hope it went well.'
                : 'The link may have expired, or been copied incompletely. Please '
                  + 'get in touch and we will sort it out.'}
            </p>
            <Link className="confirm-link" href="/">Go to the website</Link>
          </>
        )}
      </div>
    </main>
  );
}
