/**
 * app/about-pilot/page.tsx
 * The page the banner links to.
 *
 * docs/09-compliance-register.md exists to be shown to the client. This is the
 * in-product version of it: when someone asks "can we just try it with a couple
 * of real patients", this is the answer, and it is reachable in one tap rather
 * than living in a repository nobody opens.
 */

import Link from 'next/link';

export const metadata = { title: 'Why this says pilot' };

export default function AboutPilotPage() {
  return (
    <main className="view narrow" style={{ margin: '0 auto', paddingTop: 'var(--gd-8)' }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Pilot build</div>
          <h1>Why no real patient data goes in here</h1>
        </div>
      </div>

      <section className="card critical">
        <p style={{ fontSize: '.95rem', lineHeight: 1.65 }}>
          This system has <b>no HIPAA controls yet</b>. No Business Associate
          Agreements are signed, there is no audit logging on reads, no
          encryption-at-rest guarantee, and no per-user access control worth the
          name.
        </p>
        <p className="muted" style={{ fontSize: '.9rem', lineHeight: 1.65, marginTop: '.8rem' }}>
          That is a deliberate sequencing decision, not an oversight. It lets the
          practice see and argue with the product before anyone pays for
          compliance infrastructure — BAAs, enterprise hosting tiers and a
          penetration test are expensive to buy before you know what you are
          buying them for.
        </p>
        <p style={{ fontSize: '.95rem', lineHeight: 1.65, marginTop: '.8rem' }}>
          It is legitimate <b>only</b> while no real patient data exists here. The
          moment one real record is entered, every deferred item becomes a live
          legal exposure, retroactively, with no grace period.
        </p>
      </section>

      <section className="card">
        <div className="eyebrow">The rule</div>
        <h2 style={{ fontSize: 'var(--gd-step-1)', fontWeight: 700, margin: '.3rem 0 .8rem' }}>
          No real patient data until Phase C sign-off
        </h2>
        <p className="muted" style={{ fontSize: '.9rem', lineHeight: 1.65 }}>
          No names. No &ldquo;just my own record as a test&rdquo;. No importing an
          existing client list. No screenshots of real labs typed into the lab grid.
        </p>
        <div className="note-band" style={{ marginTop: '1rem' }}>
          <b>Enforced by the database, not by memory.</b> While a practice is in
          pilot mode, every table that can hold patient information rejects any row
          not explicitly marked synthetic. Payment descriptors and notification
          previews are checked for clinical terms and refused if they contain any.
        </div>
        <p className="metric-note" style={{ marginTop: '.8rem' }}>
          Honest about the limit: someone determined could mark real data as
          synthetic. This is friction plus an audit trail, not a guarantee. Its job
          is to stop the accident.
        </p>
      </section>

      <section className="card">
        <div className="eyebrow">What is actually at stake</div>
        <p className="muted" style={{ fontSize: '.9rem', lineHeight: 1.65 }}>
          A practice like this holds hormone prescriptions, sexual-health diagnoses,
          lab values, injectable treatment records and progress photographs. The
          fact that a named, identifiable person is a patient of this kind of clinic
          is itself a disclosure, independent of any clinical detail attached to it.
        </p>
        <p className="muted" style={{ fontSize: '.9rem', lineHeight: 1.65, marginTop: '.8rem' }}>
          A breach is reportable under the HIPAA Breach Notification Rule. Penalties
          are tiered by culpability, and &ldquo;we knew and deferred it&rdquo; sits
          in the worst tier. <b>The practice owner carries that liability</b> — which
          is exactly why this rule is not negotiable, for their sake rather than ours.
        </p>
      </section>

      <section className="card">
        <div className="eyebrow quiet">What happens next</div>
        <ol style={{ paddingLeft: '1.2rem', fontSize: '.9rem', lineHeight: 1.8, color: 'var(--gd-text-muted)' }}>
          <li>Use this on synthetic data and tell us what is wrong with it.</li>
          <li>We scope production from those reactions rather than our assumptions.</li>
          <li>Phase C buys the compliance infrastructure: BAAs, audit logging,
              encryption, per-user accounts with MFA, a penetration test.</li>
          <li>Only then does a real name enter the system.</li>
        </ol>
      </section>

      <p style={{ textAlign: 'center', marginTop: 'var(--gd-6)' }}>
        <Link className="btn" href="/">Back</Link>
      </p>
    </main>
  );
}
