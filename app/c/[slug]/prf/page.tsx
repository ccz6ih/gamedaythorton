/**
 * app/c/[slug]/prf/page.tsx — the PRF education/pillar page.
 *
 * WHY THIS PAGE EXISTS
 * Three of the four Injectables rows on /services are PRF treatments, and none
 * of them had anywhere for a generic search ("what is PRF", "PRF vs PRP", "is
 * PRF safe") to land. A menu row can say what a treatment costs; it cannot be
 * the best answer on the internet to "what is platelet-rich fibrin" — that
 * needs a page whose whole job is the question. See
 * docs/23-content-seo-strategy.md for the full plan this page is one piece of.
 *
 * WHAT THIS PAGE DOES NOT DO
 * It makes no claim about this practice's own results, no promise, no invented
 * statistic and no before/after. Per scripts/medbar-copy.cjs's provenance
 * rule, every clinical claim on this storefront is the practice's own claim —
 * so this page stays at the level of general, widely published information
 * about PRF as a treatment modality (what it is, how it is made, what it is
 * not), phrased the way the practice's own already-approved copy is phrased,
 * and reusing that copy verbatim wherever the same ground is covered (the
 * draw/spin/place/build process lives once, in lib/prf-content.ts). It should
 * get the same sign-off pass as any other clinical copy here before it is
 * unhidden from the practice's own review.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront, getStorefrontServices } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { ServiceIcon } from '@/components/ServiceIcon';
import { Centrifuge } from '@/components/Centrifuge';
import { ProcessRail } from '@/components/ProcessRail';
import { priceLabel } from '@/lib/format';
import { PRF_PROCESS, PRF_TREATMENTS } from '@/lib/prf-content';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'What Is PRF? Platelet-Rich Fibrin Explained',
  description:
    'What platelet-rich fibrin (PRF) is, how it differs from PRP, how it is made from your own blood, what it can and cannot do, and who it is right for.'
};

/**
 * One array, read twice: once to render the visible <details> list, once to
 * emit FAQPage structured data with the identical text. Two different
 * strings answering the same question is worse than answering it once.
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: 'Is PRF the same thing as PRP?',
    a: "No, though they are related and often confused. Both start with a blood draw that is spun in a centrifuge, but PRP (platelet-rich plasma) is processed with an anticoagulant and yields a liquid concentrate of platelets. PRF (platelet-rich fibrin) is spun without an anticoagulant, so it clots naturally into a solid fibrin matrix that holds platelets, white blood cells and growth factors and releases them more gradually. In short: PRP is a faster, more concentrated liquid; PRF is a slower-release, structural material."
  },
  {
    q: 'What is PRF not?',
    a: "PRF is not a dermal filler — it does not add volume the way a hyaluronic-acid filler does, and it is not a synthetic or foreign material of any kind. It is not an instant result — because it works with your body's own repair process, changes develop over weeks, not overnight. It is not FDA-approved as a drug, because it is not one: it is your own blood, processed at the point of care with FDA-cleared collection and centrifuge equipment. And it is not a substitute for a medical evaluation of a skin lesion, mole, infection or other condition that needs a diagnosis rather than a cosmetic treatment."
  },
  {
    q: 'Why does PRF work?',
    a: "Platelets carry growth factors that are part of the body's normal wound-healing and tissue-repair response. Concentrating them and placing them where treatment is needed is intended to support that same natural process — encouraging collagen and elastin production, and supporting skin and follicle quality — rather than introducing a foreign substance to do the job. The fibrin matrix itself also acts as a scaffold at the treatment site. Results and timelines vary by person and by treatment area, and a consultation is how a specific plan gets set."
  },
  {
    q: 'Does a PRF treatment hurt?',
    a: 'Most people describe mild discomfort — a pinch during the blood draw, and a sensation during injection or microneedling similar to other in-office aesthetic treatments. Numbing options can be discussed at consultation.'
  },
  {
    q: 'How many PRF sessions will I need?',
    a: "It depends on the treatment and the goal. Because PRF works progressively with your body's own repair process rather than producing an immediate change, a series is often recommended rather than a single visit. Your provider sets a specific plan at consultation."
  },
  {
    q: 'Is PRF safe?',
    a: 'Because PRF is made from your own blood with nothing synthetic added, it carries a lower risk of allergic reaction or rejection than treatments built on a foreign material. As with any injection or microneedling procedure, there are still risks — bruising, swelling and soreness at the treatment site are the most common — which are reviewed as part of consent before treatment. Not everyone is a candidate; a consultation is how that is confirmed.'
  },
  {
    q: 'How is PRF different from Botox or dermal filler?',
    a: "They solve different problems. A neurotoxin like Jeuveau\u00ae relaxes the muscles that cause expression lines. A dermal filler adds volume directly. PRF is regenerative — it is intended to support the skin's own quality and repair process over time, using your own platelets and growth factors, rather than relaxing muscle or adding foreign volume. Some people use more than one approach for different goals; that is a conversation for consultation, not something to decide from a page like this one."
  },
  {
    q: 'Who should not get PRF?',
    a: 'Certain platelet or blood disorders, some blood-thinning medications, an active infection or skin condition at the treatment site, and pregnancy are all things a provider needs to know about before treatment — some may rule PRF out and some may not. This page cannot make that determination; a consultation and candidacy assessment is required before any PRF treatment here.'
  }
];

export default async function StorefrontPRF({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const links = storefrontLinks(await storefrontBase(slug));
  const services = await getStorefrontServices(clinic.id);
  const prfServices = services.filter(s => /PRF/.test(s.name));
  const consult = services.find(s => s.category === 'consult');

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="sf-hero">
        <div className="sf-wrap">
          <div className="sf-eyebrow">Regenerative treatments</div>
          <h1>What is PRF?</h1>
          <p className="sf-tagline">
            Platelet-rich fibrin (PRF) is a regenerative preparation made from
            your own blood — drawn and spun in the treatment room, with
            nothing synthetic added — used to support skin quality, tissue
            repair and follicle health. Here is what it is, what it is not,
            and how {clinic.name} uses it.
          </p>

          <div className="sf-actions">
            <Link href={links.services} className="sf-btn primary">See PRF treatments &amp; pricing</Link>
            {consult && (
              <Link
                href={`${links.book}?service=${encodeURIComponent(consult.id)}`}
                className="sf-btn ghost"
              >
                Free 15-minute consult
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="sf-section">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>PRF, in plain terms</h2>
            <p>
              The name describes exactly what it is: platelets (the part of
              your blood that drives clotting and healing), concentrated, and
              held in fibrin (the structural protein your body uses to form a
              clot and begin repair). Nothing foreign is added at any step.
            </p>
          </div>

          <dl className="sf-facts">
            <div className="sf-fact">
              <dt>Made from</dt>
              <dd>A small sample of your own blood — nothing donated, synthetic or animal-derived.</dd>
            </div>
            <div className="sf-fact">
              <dt>Processed by</dt>
              <dd>A centrifuge, in the treatment room, during the same visit. It never leaves the building.</dd>
            </div>
            <div className="sf-fact">
              <dt>Applied as</dt>
              <dd>An injection (under the eyes), worked into microneedling channels, or massaged into the scalp, depending on the treatment.</dd>
            </div>
            <div className="sf-fact">
              <dt>Where it comes from</dt>
              <dd>First described for oral and maxillofacial surgery in the early 2000s, and since adopted across dermatology, aesthetics, orthopedics and hair restoration.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="sf-section sf-bordered">
        <div className="sf-wrap sf-stage-grid">
          <div>
            <div className="sf-section-head">
              <h2>No lab. No second visit. One appointment, start to finish.</h2>
              <p>
                PRF is your own blood, concentrated. It never leaves the
                building, and nothing synthetic is added to it.
              </p>
            </div>
            <ProcessRail steps={PRF_PROCESS} />
          </div>
          <Centrifuge />
        </div>
      </section>

      <section className="sf-section">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>What PRF is not</h2>
            <p>As much confusion comes from what PRF gets mistaken for as from what it actually is.</p>
          </div>

          <dl className="sf-facts">
            <div className="sf-fact">
              <dt>Not a dermal filler</dt>
              <dd>It does not add volume the way a hyaluronic-acid filler does. It supports the tissue that is already there rather than filling a hollow with material.</dd>
            </div>
            <div className="sf-fact">
              <dt>Not instant</dt>
              <dd>Because it works with your body&rsquo;s own repair process, change is gradual over weeks — not a same-day transformation.</dd>
            </div>
            <div className="sf-fact">
              <dt>Not a drug</dt>
              <dd>It is not FDA-approved as a drug because it is not one — it is your own blood, processed at the point of care with cleared collection and centrifuge equipment.</dd>
            </div>
            <div className="sf-fact">
              <dt>Not risk-free</dt>
              <dd>Bruising, swelling and soreness at the treatment site are the most common effects, reviewed as part of consent before any treatment.</dd>
            </div>
            <div className="sf-fact">
              <dt>Not for everyone</dt>
              <dd>Certain blood or platelet conditions, some medications, active infection at the site, and pregnancy are all things a provider needs to know before treatment.</dd>
            </div>
            <div className="sf-fact">
              <dt>Not a diagnosis</dt>
              <dd>It is not a substitute for medical evaluation of a mole, lesion, infection or anything else that needs a diagnosis rather than a cosmetic treatment.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>PRF vs. PRP</h2>
            <p>The two get used interchangeably in casual conversation, and they are not the same preparation.</p>
          </div>

          <dl className="sf-facts">
            <div className="sf-fact">
              <dt>Anticoagulant</dt>
              <dd>PRP is drawn with an anticoagulant added, so it stays liquid. PRF is drawn without one, so it clots naturally into a solid matrix.</dd>
            </div>
            <div className="sf-fact">
              <dt>Form</dt>
              <dd>PRP is a liquid concentrate of platelets. PRF is a fibrin-based matrix that holds platelets, white blood cells and growth factors within its structure.</dd>
            </div>
            <div className="sf-fact">
              <dt>Release</dt>
              <dd>PRP tends to release its growth factors quickly. PRF&rsquo;s fibrin scaffold is intended to release them more gradually as it breaks down.</dd>
            </div>
            <div className="sf-fact">
              <dt>Preparation</dt>
              <dd>Both are spun from a blood draw in a centrifuge, in one visit, with nothing added but the choice of anticoagulant.</dd>
            </div>
          </dl>
        </div>
      </section>

      {prfServices.length > 0 && (
        <section className="sf-section">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <h2>PRF treatments at {clinic.name}</h2>
              <p>
                Every regenerative service begins with a consultation to
                confirm candidacy and set a realistic plan.
              </p>
            </div>

            <div className="sf-menu-group">
              {prfServices.map(s => {
                const cluster = PRF_TREATMENTS.find(t => t.match.test(s.name));
                const learnMoreHref = cluster ? `${links.prf}/${cluster.slug}` : null;
                return (
                <article className="sf-item" key={s.id}>
                  <div className="sf-item-icon-box" aria-hidden="true">
                    <ServiceIcon name={s.name} category={s.category} />
                  </div>

                  <div className="sf-item-body">
                    <h3 className="sf-item-name">
                      <Link
                        href={learnMoreHref
                          ?? (s.online_bookable
                            ? `${links.book}?service=${encodeURIComponent(s.id)}`
                            : `${links.enquire}?service=${encodeURIComponent(s.name)}`)}
                        className="sf-item-title-link"
                      >
                        {s.name}
                      </Link>
                    </h3>
                    {s.description && <p className="sf-item-desc">{s.description}</p>}
                    {s.details && (
                      <details className="sf-more">
                        <summary>What this involves</summary>
                        <p>{s.details}</p>
                      </details>
                    )}
                  </div>

                  <div className="sf-item-price">
                    <span className="amount">{priceLabel(s)}</span>
                    <span className="dur">{s.duration_min} min</span>
                    <Link
                      className="sf-item-reserve"
                      href={s.online_bookable
                        ? `${links.book}?service=${encodeURIComponent(s.id)}`
                        : `${links.enquire}?service=${encodeURIComponent(s.name)}`}
                    >
                      {s.online_bookable ? 'Reserve' : 'Enquire'} <span>&rarr;</span>
                    </Link>
                  </div>
                </article>
                );
              })}
            </div>

            <div className="sf-actions" style={{ marginTop: 'var(--gd-8)' }}>
              <Link href={links.services} className="sf-btn ghost">All treatments &amp; pricing</Link>
              <Link href={links.book} className="sf-btn primary">Book an appointment</Link>
            </div>
          </div>
        </section>
      )}

      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>Common questions</h2>
          </div>

          <div className="sf-menu-group">
            {FAQ.map(f => (
              <details className="sf-more" key={f.q} style={{ marginBottom: 'var(--gd-4)' }}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>

          <p className="sf-note" style={{ marginTop: 'var(--gd-8)' }}>
            This page is general information about platelet-rich fibrin as a
            treatment, not medical advice, and it is not a substitute for an
            in-person consultation. Candidacy, dosing and a realistic plan are
            confirmed with a provider before any treatment. Individual results
            vary.
          </p>

          <div className="sf-actions" style={{ marginTop: 'var(--gd-6)' }}>
            <Link href={links.book} className="sf-btn primary">Book an appointment</Link>
            {consult && (
              <Link
                href={`${links.book}?service=${encodeURIComponent(consult.id)}`}
                className="sf-btn ghost"
              >
                Free 15-minute consult
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
