/**
 * app/not-found.tsx
 *
 * A raw Next.js 404 in a clinical product reads as broken software. If a link in
 * this app leads here, that is a bug in the app rather than a wrong turn by the
 * user, so the page says so and offers a way back rather than a bare message.
 */

import Link from 'next/link';

export const metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="eyebrow">Not found</div>
        <h1>That page does not exist</h1>
        <p className="lede">
          If you got here from a link inside the app, that is our bug and worth
          mentioning — a navigation link should never lead to a dead end.
        </p>
        {/* "Back to the console" is wrong for the person most likely to be here.
        On a practice's own domain this page is reached by a customer who
        mistyped a URL, not by staff. */}
    <Link className="btn primary block" href="/">Back to the home page</Link>
        <Link className="btn ghost block" href="/" style={{ marginTop: '.6rem' }}>Start again</Link>
      </div>
    </main>
  );
}
