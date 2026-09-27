/**
 * app/intake/[token]/page.tsx
 * The client fills in their own intake, from the link in their email.
 *
 * ===========================================================================
 * NO LOGIN, AND NO ACCOUNT TO MAKE
 * ===========================================================================
 * Same bargain as /confirm: a single-purpose token that IS the authorisation.
 * A client asked to create an account before a facial does not create an
 * account, they arrive with the form unfilled and it gets done on paper in the
 * treatment room — which is exactly the outcome this replaces.
 *
 * ===========================================================================
 * WHAT THIS IS NOT
 * ===========================================================================
 * It is NOT an e-signature in the legally-weighted sense. docs/12 is explicit:
 * "legally meaningful signatures need the audit trail first". What is recorded
 * here is a typed affirmation with a timestamp, an IP and — the part that
 * actually matters — the exact wording that was on screen, stored next to it
 * in consent_record.text_snapshot.
 *
 * The page says so in those words rather than drawing a signature box, because
 * a signature box implies something we have not built and she would reasonably
 * assume it had been.
 *
 * ===========================================================================
 * NO JAVASCRIPT
 * ===========================================================================
 * A plain form that POSTs to a server action. It works on the first paint, on
 * a bad connection, in a car park before an appointment. The one thing this
 * page must not do is lose somebody's medical history to a hydration error.
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { anonClient } from '@/lib/db/storefront';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your form',
  robots: { index: false, follow: false }
};

type Field = {
  key: string; type: 'text' | 'choice' | 'yesno'; label: string;
  options?: string[]; multi?: boolean;
};
type Section = { key: string; title: string; fields: Field[] };
type Consent = { key: string; label: string; required?: boolean };

type Form = {
  status: 'open' | 'signed' | 'unavailable' | 'no_form';
  first_name?: string;
  practice_name?: string;
  service_name?: string | null;
  starts_at?: string;
  template_version?: string;
  sections?: Section[];
  consents?: Consent[];
  answers?: Record<string, unknown>;
  signed_at?: string;
};

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function submit(formData: FormData) {
  'use server';

  const token = String(formData.get('token') ?? '');
  if (!TOKEN_RE.test(token)) redirect('/intake/invalid');

  const supabase = anonClient();

  /**
   * The form is rebuilt from the template rather than trusted from the post.
   *
   * A submitted body can name any key it likes. Reading the template again and
   * collecting only ITS keys means a crafted request cannot write arbitrary
   * fields into a clinical record — and cannot claim a consent the practice
   * never asked for.
   */
  const { data } = await supabase.rpc('intake_for_token', { p_token: token });
  const form = (data ?? {}) as Form;
  if (form.status !== 'open') redirect(`/intake/${token}`);

  const answers: Record<string, unknown> = {};
  for (const section of form.sections ?? []) {
    for (const field of section.fields) {
      if (field.type === 'choice' && field.multi) {
        const all = formData.getAll(`f_${field.key}`).map(String).filter(Boolean);
        if (all.length) answers[field.key] = all;
      } else {
        const v = String(formData.get(`f_${field.key}`) ?? '').trim();
        if (v) answers[field.key] = v;
      }
    }
  }

  const consents = (form.consents ?? []).map(c => ({
    key: c.key,
    label: c.label,
    granted: formData.get(`c_${c.key}`) === 'on'
  }));

  // Required consents are enforced by the browser AND here. A required tick
  // that only the browser checks is not a record of anything.
  const missing = (form.consents ?? []).filter(
    c => c.required && !consents.find(x => x.key === c.key)?.granted
  );
  if (missing.length) {
    redirect(`/intake/${token}?error=${encodeURIComponent('Please agree to the required items.')}`);
  }

  const h = await headers();
  const fwd = h.get('x-forwarded-for');

  const { error } = await supabase.rpc('intake_submit', {
    p_token: token,
    p_answers: answers,
    p_consents: consents,
    p_ip: fwd ? fwd.split(',')[0]?.trim() ?? null : null,
    p_agent: h.get('user-agent')
  });

  if (error) {
    redirect(`/intake/${token}?error=${encodeURIComponent('That could not be saved. Please try again.')}`);
  }
  redirect(`/intake/${token}`);
}

export default async function IntakePage({
  params, searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  let form: Form = { status: 'unavailable' };
  if (TOKEN_RE.test(token)) {
    const { data } = await anonClient().rpc('intake_for_token', { p_token: token });
    if (data) form = data as Form;
  }

  const shell = (title: string, body: React.ReactNode) => (
    <main className="intake-page">
      <div className="intake-wrap">
        <h1>{title}</h1>
        {body}
      </div>
    </main>
  );

  if (form.status === 'signed') {
    return shell('All done', (
      <>
        <p className="intake-lead">
          Thank you{form.first_name ? `, ${form.first_name}` : ''} — your form is with
          {' '}{form.practice_name ?? 'the practice'}. There is nothing else to do
          before your visit.
        </p>
        <p className="intake-note">
          If something changes in the meantime, tell them when you arrive.
        </p>
      </>
    ));
  }

  if (form.status !== 'open') {
    // Unknown, expired and "no form set up" deliberately read the same from
    // outside, so this page cannot be used to test whether a token is real.
    return shell('This form is not available', (
      <p className="intake-lead">
        The link may have expired, or the form may already be complete. Please
        contact the practice and they will sort it out.
      </p>
    ));
  }

  const answers = form.answers ?? {};

  return (
    <main className="intake-page">
      <div className="intake-wrap">
        <div className="intake-head">
          <h1>Before your visit</h1>
          <p className="intake-lead">
            Hello{form.first_name ? ` ${form.first_name}` : ''} — {form.practice_name} needs
            a few details before
            {form.service_name ? ` your ${form.service_name}` : ' your appointment'}.
            It takes about three minutes, and everything here is seen only by
            your practitioner.
          </p>
        </div>

        {error && <div className="intake-error" role="alert">{error}</div>}

        <form action={submit}>
          <input type="hidden" name="token" value={token} />

          {(form.sections ?? []).map(section => (
            <section className="intake-section" key={section.key}>
              <h2>{section.title}</h2>
              {section.fields.map(field => {
                const prior = answers[field.key];
                const id = `f_${field.key}`;

                if (field.type === 'yesno') {
                  return (
                    <fieldset className="intake-field" key={field.key}>
                      <legend>{field.label}</legend>
                      <div className="intake-choices">
                        {['Yes', 'No', 'Not sure'].map(opt => (
                          <label className="intake-opt" key={opt}>
                            <input type="radio" name={id} value={opt}
                                   defaultChecked={prior === opt} />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  );
                }

                if (field.type === 'choice') {
                  const chosen = Array.isArray(prior) ? prior.map(String) : [];
                  return (
                    <fieldset className="intake-field" key={field.key}>
                      <legend>{field.label}</legend>
                      <div className="intake-choices">
                        {(field.options ?? []).map(opt => (
                          <label className="intake-opt" key={opt}>
                            <input
                              type={field.multi ? 'checkbox' : 'radio'}
                              name={id}
                              value={opt}
                              defaultChecked={field.multi ? chosen.includes(opt) : prior === opt}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  );
                }

                return (
                  <div className="intake-field" key={field.key}>
                    <label htmlFor={id}>{field.label}</label>
                    <textarea id={id} name={id} rows={2}
                              defaultValue={typeof prior === 'string' ? prior : ''} />
                  </div>
                );
              })}
            </section>
          ))}

          <section className="intake-section">
            <h2>Consent</h2>
            {(form.consents ?? []).map(c => (
              <label className="intake-consent" key={c.key}>
                <input type="checkbox" name={`c_${c.key}`} required={c.required} />
                <span>
                  {c.label}
                  {c.required && <em className="intake-req"> Required.</em>}
                </span>
              </label>
            ))}

            {/*
              Said plainly, because the alternative is a signature box that
              implies an audit trail we have not built. What is recorded is a
              tick, a time, an address, and the exact words above.
            */}
            <p className="intake-note">
              Ticking these records your agreement, the date and time, and the
              wording you were shown. It is not a handwritten signature.
            </p>
          </section>

          <button className="intake-submit" type="submit">Send to the practice</button>
        </form>
      </div>
    </main>
  );
}
