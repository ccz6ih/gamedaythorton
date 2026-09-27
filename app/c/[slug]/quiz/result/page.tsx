/**
 * app/c/[slug]/quiz/result/page.tsx
 * The shortlist, and the ask.
 *
 * ===========================================================================
 * A PURE FUNCTION OF THE URL
 * ===========================================================================
 * Nothing is stored to produce this page. The answers are in the query string,
 * so the result is shareable ("this is what it said for me"), refreshable, and
 * survives the back button — and somebody who does not give their email leaves
 * no trace, which is the correct default for a page about their skin.
 *
 * ===========================================================================
 * IT RECOMMENDS WHAT SHE ACTUALLY OFFERS
 * ===========================================================================
 * The shortlist resolves against the live service table every render. A
 * treatment she retires disappears from the quiz the same day, without anybody
 * remembering that the quiz exists — which is the failure mode of every
 * hard-coded recommendation engine.
 *
 * If nothing resolves, the consultation is the answer. An empty result page is
 * the one outcome that must not happen.
 *
 * ===========================================================================
 * THE COPY IS CLAIMS-CHECKED AT RENDER
 * ===========================================================================
 * This is the highest-volume clinical-adjacent copy on the site, assembled
 * from fragments rather than written as a paragraph, which is exactly how a
 * promise sneaks in. Anything tripping lib/claims is dropped rather than
 * printed — silently for the visitor, because a half-sentence about their skin
 * is worse than one fewer sentence.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront, anonClient } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { answersFromParams, shortlist, mirrorLine, summaryForPractice, CONCERNS } from '@/lib/skin-quiz';
import { claimsIn } from '@/lib/claims';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your shortlist',
  // Somebody's answers are in this URL. It is not for an index.
  robots: { index: false, follow: false }
};

type SP = Record<string, string | string[] | undefined>;

/** Drop any assembled sentence that reads as a claim. */
function safe(line: string): string | null {
  return claimsIn(line).length === 0 ? line : null;
}

async function capture(formData: FormData) {
  'use server';

  const slug = String(formData.get('slug') ?? '');
  const email = String(formData.get('email') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const summary = String(formData.get('summary') ?? '');
  const back = String(formData.get('back') ?? `/c/${slug}/quiz`);

  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return;
  }

  /**
   * Through submit_enquiry, the same function the enquiry form uses.
   *
   * It already reads the practice's notify address inside the function —
   * lead_email is not readable by anon — sets `synthetic` from the clinic's
   * own pilot flag, and lands the result in the same place Jamie already
   * looks. A second lead-capture path would be a second thing to fix the day
   * that routing changes.
   */
  const supabase = anonClient();
  await supabase.rpc('submit_enquiry', {
    p_clinic_slug: slug,
    p_name: name,
    p_phone: null,
    p_email: email,
    p_interest: 'Skin quiz',
    p_message: summary,
    p_sms_consent: false,
    p_consent_ver: null,
    p_ip: null,
    p_agent: null
  });

  const { redirect } = await import('next/navigation');
  redirect(`${back}&sent=1`);
}

export default async function QuizResult({
  params, searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const base = await storefrontBase(slug);
  const links = storefrontLinks(base);
  const answers = answersFromParams(sp);
  const sent = sp.sent === '1';

  const { data } = await anonClient()
    .from('service')
    .select('id, name, category, description, price_cents, price_from_cents, price_mode, duration_min')
    .eq('clinic_id', clinic.id)
    .eq('active', true)
    .eq('online_bookable', true);

  const services = (data ?? []) as {
    id: string; name: string; category: string | null; description: string | null;
    price_cents: number | null; price_from_cents: number | null;
    price_mode: string | null; duration_min: number | null;
  }[];

  const picks = shortlist(answers, services);
  const consult = services.find(s => (s.category ?? '').toLowerCase() === 'consult');

  const guides = [...new Set(
    answers.focus.map(k => CONCERNS[k]?.guide).filter(Boolean)
  )] as { href: string; label: string }[];

  const mirror = safe(mirrorLine(answers));
  const summary = summaryForPractice(answers);

  const priceOf = (s: typeof services[number]) => {
    if (s.price_mode === 'free') return 'Complimentary';
    if (s.price_cents) return money(s.price_cents);
    if (s.price_from_cents) return `from ${money(s.price_from_cents)}`;
    return null;
  };

  return (
    <>
      <section className="sf-section">
        <div className="sf-wrap quiz-col">
          <p className="sf-eyebrow">Your shortlist</p>
          <h1 className="sf-display">Here is where I would start</h1>
          {mirror && <p className="sf-hero-lead">{mirror}</p>}
          {answers.downtime === 'none' && (
            <p className="quiz-note">
              You said you cannot take downtime, so everything below is chosen
              with that in mind.
            </p>
          )}
        </div>
      </section>

      <section className="sf-section sf-invert">
        <div className="sf-wrap quiz-col">
          {picks.length === 0 ? (
            <>
              <h2>Let us talk it through</h2>
              <p className="sf-hero-lead">
                Nothing on the menu lines up neatly with what you told us, which
                usually means a conversation gets you further than a list.
              </p>
            </>
          ) : (
            <div className="quiz-picks">
              {picks.map(({ service, because }, i) => {
                const price = priceOf(service);
                const blurb = service.description ? safe(service.description) : null;
                return (
                  <article className="quiz-pick" key={service.id}>
                    <div className="quiz-pick-rank">{i + 1}</div>
                    <div>
                      <h3>{service.name}</h3>
                      <p className="quiz-pick-why">
                        Because you mentioned {because.join(' and ').toLowerCase()}.
                      </p>
                      {blurb && <p className="quiz-pick-blurb">{blurb}</p>}
                      <p className="quiz-pick-meta">
                        {price}
                        {price && service.duration_min ? ' · ' : ''}
                        {service.duration_min ? `${service.duration_min} min` : ''}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="quiz-cta">
            <Link className="sf-btn" href={links.book}>Book a consultation</Link>
            {consult && (
              <p className="quiz-note">
                {consult.name} — {priceOf(consult) ?? 'ask us'}. Fifteen minutes to
                work out what is actually worth doing, with no obligation to book
                anything on the day.
              </p>
            )}
          </div>
        </div>
      </section>

      {guides.length > 0 && (
        <section className="sf-section">
          <div className="sf-wrap quiz-col">
            <h2>Before you go, worth a read</h2>
            <p className="sf-hero-lead">
              Written for what you asked about, so you arrive knowing what
              actually happens.
            </p>
            <ul className="quiz-guides">
              {guides.map(g => (
                <li key={g.href}>
                  <Link className="sf-link" href={`${base}${g.href}`}>{g.label}</Link>
                </li>
              ))}
              <li>
                <Link className="sf-link" href={`${base}/prf/aftercare`}>
                  How to prepare for an appointment
                </Link>
              </li>
            </ul>
          </div>
        </section>
      )}

      <section className="sf-section sf-invert">
        <div className="sf-wrap quiz-col">
          {sent ? (
            <>
              <h2>Sent</h2>
              <p className="sf-hero-lead">
                Your shortlist is on its way to the practice, and they will be in
                touch. No need to do anything else.
              </p>
            </>
          ) : (
            <>
              <h2>Want this sent over?</h2>
              <p className="sf-hero-lead">
                Leave your name and email and the practice will pick it up with
                your answers attached, so you do not have to explain it twice.
              </p>
              <form action={capture} className="quiz-capture">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="summary" value={summary} />
                <input
                  type="hidden"
                  name="back"
                  value={`${base}/quiz/result?${new URLSearchParams(
                    Object.entries({
                      focus: answers.focus.join(','),
                      sun: answers.sun ?? '',
                      feel: answers.feel ?? '',
                      downtime: answers.downtime ?? '',
                      history: answers.history ?? ''
                    }).filter(([, v]) => v) as [string, string][]
                  ).toString()}`}
                />
                <div className="quiz-capture-row">
                  <input name="name" placeholder="Your name" required autoComplete="name" />
                  <input name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
                </div>
                <button className="sf-btn" type="submit">Send it over</button>
              </form>
              <p className="quiz-note">
                Used to answer you about this. Nothing else.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="sf-section">
        <div className="sf-wrap quiz-col">
          <p className="quiz-note">
            <Link className="sf-link" href={`${base}/quiz`}>Start again</Link> — or{' '}
            <Link className="sf-link" href={links.services}>see the whole menu</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
