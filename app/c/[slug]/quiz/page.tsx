/**
 * app/c/[slug]/quiz/page.tsx
 * The skin quiz — one page, one button, no JavaScript.
 *
 * ===========================================================================
 * WHY NOT A STEP-BY-STEP WIZARD
 * ===========================================================================
 * A multi-step quiz looks more impressive and finishes less often. Every step
 * is a chance to close the tab, it needs client state, and on a phone the
 * progress bar is the only thing that fits above the fold.
 *
 * Five questions on one page is a thirty-second scroll. It also means the
 * whole thing works with no JavaScript at all: the form GETs, the answers land
 * in the URL, and the result page is a pure function of that URL — shareable,
 * refreshable, and back-button-correct for free.
 *
 * ===========================================================================
 * NO EMAIL WALL BEFORE THE RESULT
 * ===========================================================================
 * The result is given away. Asking for an address before showing it is the
 * move that makes people type nonsense@nonsense.com, and an inbox full of
 * those is worse than a smaller list of people who actually wanted to hear
 * back. The ask comes after, once there is something to attach it to.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { QUESTIONS } from '@/lib/skin-quiz';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) return { title: 'Not found' };
  return {
    title: 'Skin quiz',
    description:
      `Answer five questions about your skin and see which ${clinic.name} treatments ` +
      `are worth asking about. Takes under a minute, no email needed to see the result.`
  };
}

export default async function QuizPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const base = await storefrontBase(slug);
  const links = storefrontLinks(base);

  return (
    <>
      <section className="sf-section">
        <div className="sf-wrap quiz-col">
          <p className="sf-eyebrow">Skin quiz</p>
          <h1 className="sf-display">Which treatment is actually for you?</h1>
          <p className="sf-hero-lead">
            Five questions, under a minute. You will get a shortlist worth asking
            about — and no, you do not have to give us your email to see it.
          </p>
        </div>
      </section>

      <section className="sf-section sf-invert">
        <div className="sf-wrap quiz-col">
          {/* GET, so the answers land in the URL and the result is shareable.
              No action attribute needed — it posts to the result route. */}
          <form method="GET" action={`${base}/quiz/result`} className="quiz-form">
            {QUESTIONS.map((q, i) => (
              <fieldset className="quiz-q" key={q.key}>
                <legend>
                  <span className="quiz-n">{i + 1}</span>
                  {q.title}
                </legend>
                {q.help && <p className="quiz-help">{q.help}</p>}

                <div className="quiz-opts">
                  {q.options.map(o => (
                    <label className="quiz-opt" key={o.value}>
                      <input
                        type={q.multi ? 'checkbox' : 'radio'}
                        name={q.key}
                        value={o.value}
                        {...(q.multi ? {} : { required: true })}
                      />
                      <span>
                        {o.label}
                        {o.hint && <em className="quiz-hint">{o.hint}</em>}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            <button className="sf-btn quiz-submit" type="submit">
              See my shortlist
            </button>

            <p className="quiz-note">
              This is a starting point for a conversation, not a diagnosis.
              What suits your skin gets decided with your practitioner.
            </p>
          </form>
        </div>
      </section>

      <section className="sf-section">
        <div className="sf-wrap quiz-col">
          <p className="sf-hero-lead">
            Would rather just talk to someone?{' '}
            <Link className="sf-link" href={links.book}>Book a consultation</Link> —
            fifteen minutes, no obligation.
          </p>
        </div>
      </section>
    </>
  );
}
