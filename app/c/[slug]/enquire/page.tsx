/**
 * app/c/[slug]/enquire/page.tsx — the booking request.
 *
 * Deliberately a REQUEST, not a confirmed booking. A public page that hands out
 * confirmed slots to anonymous visitors is how a calendar fills with no-shows,
 * and until deposits and card-on-file exist (Phase B) the practice confirms.
 * The button says what it does.
 *
 * TCPA EVIDENCE IS THE POINT OF THE CONSENT BLOCK
 * `lead` carries consent_text_version, consent_captured_at, consent_ip and
 * consent_user_agent because an SMS programme without them is a liability
 * rather than a growth channel. So the exact wording shown is versioned here,
 * stored with the row, and transactional consent is captured separately from
 * marketing consent — because they are legally separate and bundling them
 * invalidates both.
 *
 * The insert runs as `anon` with no session. Migration 0009 grants anon INSERT
 * on named columns of `lead` and no SELECT at all, so a visitor can leave their
 * details and cannot read anybody else's — including their own.
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getStorefront, getStorefrontServices } from '@/lib/db/storefront';

export const dynamic = 'force-dynamic';

/** The exact words shown next to the checkbox. Stored with the row, versioned. */
const CONSENT_V = 'sms-v1';
const CONSENT_TEXT =
  'I agree to be contacted by text message about this request. ' +
  'Message and data rates may apply. Reply STOP to opt out.';

async function submit(formData: FormData) {
  'use server';

  const slug = String(formData.get('slug') ?? '');
  const clinic = await getStorefront(slug);
  if (!clinic) redirect('/');

  const name = String(formData.get('name') ?? '').trim();
  const phoneNo = String(formData.get('phone') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const interest = String(formData.get('interest') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  const smsOk = formData.get('consent_sms') === 'on';

  if (!name || (!phoneNo && !email)) {
    redirect(`/c/${slug}/enquire?error=${encodeURIComponent(
      'Please give a name and either a phone number or an email address.')}`);
  }

  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]?.trim() : null;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const { error } = await supabase.from('lead').insert({
    clinic_id: clinic.id,
    name,
    phone: phoneNo || null,
    email: email || null,
    source: 'website',
    message: [interest && `Interested in: ${interest}`, message].filter(Boolean).join('\n') || null,
    consent_transactional_sms: smsOk,
    consent_email: !!email,
    consent_captured_at: smsOk || email ? new Date().toISOString() : null,
    consent_ip: ip,
    consent_user_agent: h.get('user-agent'),
    consent_text_version: smsOk ? CONSENT_V : null,
    // The pilot guard. While the clinic is in pilot mode the database refuses
    // any row not marked synthetic — including one arriving from a public form,
    // which is exactly the path a real enquiry would come in on.
    synthetic: true
  });

  if (error) {
    redirect(`/c/${slug}/enquire?error=${encodeURIComponent(
      error.message.includes('PILOT MODE')
        ? 'This is a preview site and is not accepting real enquiries yet.'
        : 'Something went wrong sending that. Please call the practice.')}`);
  }

  redirect(`/c/${slug}/enquire?sent=1`);
}

export default async function Enquire({
  params, searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sent?: string; error?: string; service?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const services = await getStorefrontServices(clinic.id);
  const isSpa = clinic.practice_type === 'med_spa';

  if (sp.sent) {
    return (
      <>
        <header className="sf-hero">
          <div className="sf-wrap">
            <div className="sf-eyebrow">{clinic.name}</div>
            <h1>Request sent</h1>
            <p className="sf-tagline">
              The practice will be in touch to confirm a time. Nothing is booked
              until they do.
            </p>
            <div className="sf-note ok" style={{ marginBottom: 'var(--gd-6)' }}>
              <b>This is a preview.</b> No message was actually sent and the
              request was stored as demonstration data. On the live site this is
              where the practice would be notified.
            </div>
            <div className="sf-actions">
              <Link href={`/c/${slug}`} className="sf-btn ghost">Back to {clinic.name}</Link>
            </div>
          </div>
        </header>
      </>
    );
  }

  return (
    <>
      <header className="sf-hero">
        <div className="sf-wrap">
          <div className="sf-eyebrow">{clinic.name}</div>
          <h1>Request an appointment</h1>
          <p className="sf-tagline">
            {clinic.booking_note ??
              'Tell us what you are after and the practice will confirm a time. No card needed to ask.'}
          </p>
        </div>
      </header>

      <section className="sf-section">
        <div className="sf-wrap">
          {sp.error && (
            <div className="sf-note warn" style={{ marginBottom: 'var(--gd-6)' }}>{sp.error}</div>
          )}

          <form action={submit} className="sf-form">
            <input type="hidden" name="slug" value={slug} />

            <div className="sf-field">
              <label htmlFor="name">Your name</label>
              <input id="name" name="name" type="text" required autoComplete="name" />
            </div>

            <div className="sf-row2">
              <div className="sf-field">
                <label htmlFor="phone">Phone</label>
                <input id="phone" name="phone" type="tel" autoComplete="tel"
                  placeholder="(970) 555-0100" />
              </div>
              <div className="sf-field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" autoComplete="email" />
              </div>
            </div>

            <div className="sf-field">
              <label htmlFor="interest">What are you interested in?</label>
              <select id="interest" name="interest" defaultValue={sp.service ?? ''}>
                <option value="">Not sure yet — happy to be advised</option>
                {services.filter(s => s.online_bookable).map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="sf-field">
              <label htmlFor="message">Anything else worth knowing?</label>
              <textarea id="message" name="message"
                placeholder={isSpa
                  ? 'Days that suit, anything you have had done before, questions.'
                  : 'Days that suit, what prompted the enquiry, questions.'} />
              <p style={{ fontSize: 'var(--gd-step--2)', color: 'var(--gd-text-dim)', margin: 0 }}>
                Please don&rsquo;t include medical details here — this form is not
                a secure channel. The practice will ask what it needs to.
              </p>
            </div>

            <label className="sf-consent" htmlFor="consent_sms">
              <input id="consent_sms" name="consent_sms" type="checkbox" />
              <span>{CONSENT_TEXT}</span>
            </label>

            <div className="sf-actions">
              <button type="submit" className="sf-btn primary">Send request</button>
              {clinic.phone_voice && (
                <a href={`tel:${clinic.phone_voice}`} className="sf-btn ghost">Or call instead</a>
              )}
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
