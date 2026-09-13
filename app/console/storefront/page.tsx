/**
 * app/console/storefront/page.tsx
 * Everything about the public page, edited by the practice.
 *
 * Settings was 313 lines of read-only display: it showed the practice its own
 * details and gave it no way to change any of them. That is the gap between a
 * demo and something usable — every field here already drove the public page,
 * and none of it could be touched without a developer.
 *
 * One screen rather than five, because these are all the same job: what the
 * public page says, how it looks, where an enquiry lands, and which account
 * takes the money.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { getClinic } from '@/lib/db/queries';
import { requireRole, text, bool, formMessage } from '@/lib/actions';
import { emailEnabled, emailStatus } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/* The blocks on "What actually happens". Fixed keys so the storefront can order
   them, free text so the practice writes its own answers. */
const FACTS: { key: string; label: string; hint: string }[] = [
  { key: 'parking', label: 'Parking', hint: 'Where to leave the car, and whether it is free.' },
  { key: 'suite', label: 'Finding the door', hint: 'Suite number, which entrance, what the sign says.' },
  { key: 'duration', label: 'How long it takes', hint: 'Typical range. The confirmation gives the exact length.' },
  { key: 'privacy', label: 'Privacy', hint: 'Private room? Who else is around?' },
  { key: 'cost', label: 'Paying', hint: 'When the price is confirmed, and what you accept.' },
  { key: 'draw', label: 'Anything unexpected', hint: 'A blood draw, numbing time, anything a first-timer would want warning about.' }
];

async function save(formData: FormData) {
  'use server';

  const staff = await requireRole(['owner', 'admin']);

  try {
    const facts: Record<string, string> = {};
    for (const f of FACTS) {
      const v = text(formData, `fact_${f.key}`);
      if (v) facts[f.key] = v;
    }

    const account = text(formData, 'stripe_account_id');
    // A secret key pasted into the account field is a mistake worth catching
    // loudly — it means somebody was told to "put the Stripe key here", and the
    // next step would be that key sitting in a database row and every backup.
    if (account && /^(sk_|rk_|pk_)/.test(account)) {
      throw new Error(
        'That looks like an API key, not an account id. This field takes the ' +
        'account id that starts with "acct_". Never paste a secret key here — ' +
        'it is not stored, and it should not be.'
      );
    }
    if (account && !/^acct_/.test(account)) {
      throw new Error('A Stripe account id starts with "acct_".');
    }

    const supabase = await serverClient();
    const { error } = await supabase
      .from('clinic')
      .update({
        listed: bool(formData, 'listed'),
        tagline: text(formData, 'tagline'),
        intro: text(formData, 'intro'),
        booking_note: text(formData, 'booking_note'),
        visit_facts: facts,
        lead_email: text(formData, 'lead_email'),
        lead_sms_to: text(formData, 'lead_sms_to'),
        stripe_account_id: account,
        address_note: text(formData, 'address_note')
      })
      .eq('id', staff.clinicId);

    if (error) throw new Error(error.message);
  } catch (err) {
    redirect(`/console/storefront?error=${encodeURIComponent(formMessage(err))}`);
  }

  revalidatePath('/console/storefront');
  revalidatePath('/c', 'layout');
  redirect('/console/storefront?saved=1');
}

export default async function StorefrontSettings({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  // clinic_public omits the operational columns on purpose, so read them here.
  const supabase = await serverClient();
  const { data: priv } = await supabase
    .from('clinic')
    .select('listed, tagline, intro, booking_note, lead_email, lead_sms_to, stripe_account_id, stripe_charges_enabled, logo_path, address_note')
    .eq('id', clinic.id)
    .maybeSingle();

  const facts = (clinic.visit_facts ?? {}) as Record<string, string>;
  const publicUrl = `/c/${clinic.slug}`;

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{clinic.name}</div>
          <h1>Your public page</h1>
        </div>
        <div className="spacer" />
        <a className="btn" href={publicUrl} target="_blank" rel="noreferrer">Open it</a>
      </header>

      <div className="view narrow">
        {sp.saved && (
          <div className="note-band" style={{ marginBottom: 'var(--gd-5)' }}>
            Saved. <a className="banner-link" href={publicUrl} target="_blank" rel="noreferrer">
              See it on your page
            </a>
          </div>
        )}
        {sp.error && (
          <div className="note-band critical" style={{ marginBottom: 'var(--gd-5)' }}>{sp.error}</div>
        )}

        <form action={save}>
          {/* ------------------------------------------------------ live -- */}
          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Visibility</div>
                <h2>Is the page live?</h2>
                <p>
                  When this is off, the address returns &ldquo;not found&rdquo; — not
                  a locked door, which would confirm the page exists.
                </p>
              </div>
            </div>
            <label className="switch">
              <input type="checkbox" name="listed" defaultChecked={priv?.listed !== false} />
              <span className="track" />
              <span className="txt">
                Publish at <code>{publicUrl}</code>
                <br />
                <span className="dim" style={{ fontSize: '.78rem' }}>
                  Anyone with the link can open it. It is not listed in search engines.
                </span>
              </span>
            </label>
          </section>

          {/* ------------------------------------------------------ copy -- */}
          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Words</div>
                <h2>What the page says</h2>
              </div>
            </div>
            <div className="stack">
              <div className="field">
                <label htmlFor="tagline">Headline</label>
                <input id="tagline" name="tagline" type="text"
                  defaultValue={priv?.tagline ?? ''}
                  placeholder={clinic.name} />
                <div className="hint">The big line at the top. Leave blank to use your name.</div>
              </div>
              <div className="field">
                <label htmlFor="intro">Introduction</label>
                <textarea id="intro" name="intro" rows={3} defaultValue={priv?.intro ?? ''}
                  placeholder="Two or three lines on what you do and who you do it for." />
              </div>
              <div className="field">
                <label htmlFor="booking_note">Above the request form</label>
                <textarea id="booking_note" name="booking_note" rows={2}
                  defaultValue={priv?.booking_note ?? ''}
                  placeholder="What happens after someone sends a request." />
              </div>
              <div className="field">
                <label htmlFor="address_note">Finding you</label>
                <input id="address_note" name="address_note" type="text"
                  defaultValue={priv?.address_note ?? ''}
                  placeholder="Behind the building, suite 200, park in the south lot." />
              </div>
            </div>
          </section>

          {/* ----------------------------------------------------- facts -- */}
          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">First visit</div>
                <h2>What actually happens</h2>
                <p>
                  The block most booking pages do not have. Someone nervous about a
                  first appointment reads this and books instead of closing the tab.
                  Blank answers are left off the page.
                </p>
              </div>
            </div>
            <div className="stack">
              {FACTS.map(f => (
                <div className="field" key={f.key}>
                  <label htmlFor={`fact_${f.key}`}>{f.label}</label>
                  <input id={`fact_${f.key}`} name={`fact_${f.key}`} type="text"
                    defaultValue={facts[f.key] ?? ''} placeholder={f.hint} />
                </div>
              ))}
            </div>
          </section>

          {/* --------------------------------------------------- enquiry -- */}
          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Enquiries</div>
                <h2>Where requests go</h2>
              </div>
            </div>
            <div className="stack">
              <div className="field">
                <label htmlFor="lead_email">Email</label>
                <input id="lead_email" name="lead_email" type="email"
                  defaultValue={priv?.lead_email ?? ''} placeholder="front.desk@yourpractice.com" />
              </div>
              <div className="field">
                <label htmlFor="lead_sms_to">Text</label>
                <input id="lead_sms_to" name="lead_sms_to" type="tel"
                  defaultValue={priv?.lead_sms_to ?? ''} placeholder="(970) 555-0100" />
                <div className="hint">For the &ldquo;someone just enquired&rdquo; nudge, not the message itself.</div>
              </div>

              <div className={`note-band${emailEnabled() ? '' : ' warn'}`}>
                <b>{emailEnabled() ? 'Email is being sent.' : 'Nothing is sent yet.'}</b>{' '}
                {emailStatus()} Every message is recorded either way, so the
                activity log always shows what the system tried to do. Requests
                are never lost regardless: they are all on{' '}
                <Link href="/console/clients" className="banner-link">your clients list</Link>.
              </div>

              {!emailEnabled() && (
                <p className="muted" style={{ fontSize: '.82rem', lineHeight: 1.6 }}>
                  Turning it on takes two settings on the hosting environment —{' '}
                  <code>NOTIFY_EMAIL_ENABLED</code> and a provider key. Two rather
                  than one so a key arriving in an environment cannot by itself
                  start sending mail about named people.
                </p>
              )}
            </div>
          </section>

          {/* ---------------------------------------------------- payment -- */}
          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Taking payment</div>
                <h2>Your payment account</h2>
                <p>
                  Each practice connects its own Stripe account. Money settles to
                  your bank, not ours, and we never hold your keys.
                </p>
              </div>
            </div>
            <div className="stack">
              <div className="field">
                <label htmlFor="stripe_account_id">Stripe account ID</label>
                <input id="stripe_account_id" name="stripe_account_id" type="text"
                  defaultValue={priv?.stripe_account_id ?? ''} placeholder="acct_..." />
                <div className="hint">
                  Found in Stripe under Settings &rarr; Business. It starts with{' '}
                  <code>acct_</code>.
                </div>
              </div>

              <div className="note-band">
                <b>Never paste a secret key here.</b> A key beginning{' '}
                <code>sk_</code> can move money and this field will refuse it. The
                account ID is an identifier, not a credential — safe to store, and
                useless on its own.
              </div>

              {priv?.stripe_account_id ? (
                <p className="muted" style={{ fontSize: '.86rem' }}>
                  Connected. Charges are{' '}
                  <b>{priv.stripe_charges_enabled ? 'enabled' : 'not enabled yet'}</b> —
                  Stripe turns them on once your account is fully verified.
                </p>
              ) : (
                <p className="muted" style={{ fontSize: '.86rem' }}>
                  Not connected. Bookings still work; payment is taken in person.
                </p>
              )}
            </div>
          </section>

          <div className="row" style={{ marginTop: 'var(--gd-5)' }}>
            <button className="btn primary" type="submit">Save changes</button>
            <a className="btn ghost" href={publicUrl} target="_blank" rel="noreferrer">
              Preview the page
            </a>
          </div>
        </form>

        <section className="card" style={{ marginTop: 'var(--gd-8)' }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">Elsewhere</div>
              <h2>The rest of the page</h2>
            </div>
          </div>
          <div className="list">
            <Link className="rowlink" href="/console/services">
              <b>Services, pricing and descriptions</b>
              <span className="dim">Everything in the menu, including the public copy</span>
            </Link>
            <Link className="rowlink" href="/console/packages">
              <b>Packages and series</b>
              <span className="dim">What appears on the packages page</span>
            </Link>
            <Link className="rowlink" href="/console/brand">
              <b>Logo, colours and photographs</b>
              <span className="dim">How the page looks, and the images on it</span>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
