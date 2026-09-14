/**
 * lib/prf-content.ts
 * The one place the PRF "draw → spin → place → build" copy lives.
 *
 * It used to be a local constant in app/c/[slug]/page.tsx. The PRF pillar page
 * at app/c/[slug]/prf/page.tsx needs the identical four sentences — this is
 * already-approved practice copy (see scripts/medbar-copy.cjs's provenance
 * rule), and restating it by hand in a second file is exactly how the home
 * page and the education page would quietly start disagreeing about how PRF
 * is made. One export, two importers.
 */

export type ProcessStep = { n: string; h: string; p: string };

/** How PRF actually works, in sequence. */
export const PRF_PROCESS: ProcessStep[] = [
  { n: '01', h: 'Draw', p: 'A small blood draw, done in the treatment room. Roughly the volume of a routine lab panel.' },
  { n: '02', h: 'Spin', p: 'Your sample goes into the centrifuge. Spinning separates it into layers and concentrates the platelets, growth factors and fibrin into PRF.' },
  { n: '03', h: 'Place', p: 'The PRF goes back where you need it — under the eyes, through microneedling channels, or worked into the scalp.' },
  { n: '04', h: 'Build', p: 'Because it works with your own repair process, results develop over weeks rather than the same day. A series is often recommended.' }
];

/**
 * One config entry per PRF treatment, read by app/c/[slug]/prf/[treatment]/
 * page.tsx to build a dedicated, indexable URL for each one.
 *
 * WHY A STATIC SLUG MAP INSTEAD OF A DATABASE COLUMN
 * The `service` table has no slug — it is looked up by id everywhere else
 * (the menu, the booking link) because a UUID in a query string is fine for a
 * link a person never has to remember. A search-engine URL is different: it
 * has to be short, stable and readable. Adding a slug column would mean a
 * migration for three rows; matching on a name pattern here does the same job
 * with no schema change, and `match` is the only place that pattern lives.
 *
 * WHAT THE COPY IS AND IS NOT
 * `intro` and `faq` are general information about the treatment as a modality
 * — the same register as the pillar page's FAQ, hedged and non-superlative —
 * not a claim about this practice's own results. The actual service copy
 * (`description`/`details`) comes from the database, i.e. from the practice
 * itself, and is threaded through unchanged. See docs/23-content-seo-strategy.md
 * §3 and scripts/medbar-copy.cjs for the rule this follows.
 */
export type PrfTreatmentSlug = 'under-eye' | 'microneedling' | 'hair-restoration';

export type PrfTreatmentContent = {
  slug: PrfTreatmentSlug;
  /** Matched against service.name — see note above. */
  match: RegExp;
  eyebrow: string;
  metaTitle: string;
  metaDescription: string;
  /** One or two sentences of general context, above the service's own copy. */
  intro: string;
  faq: { q: string; a: string }[];
};

export const PRF_TREATMENTS: PrfTreatmentContent[] = [
  {
    slug: 'under-eye',
    match: /Under-Eye/i,
    eyebrow: 'PRF for the under-eye area',
    metaTitle: 'PRF Under-Eye Treatment: What It Is & What to Expect',
    metaDescription:
      'What a PRF under-eye injectable treatment is, how it differs from under-eye filler, what the appointment involves, and what to expect afterward.',
    intro:
      'The under-eye area is thin, delicate skin over very little fat or muscle, which is part of why it shows tiredness, dehydration and age before the rest of the face does. Because a PRF injection here is your own concentrated platelets and fibrin rather than an added volume, it is intended to support that thin tissue directly rather than fill a hollow with material.',
    faq: [
      {
        q: 'What does PRF under-eye treatment actually do?',
        a: 'Small amounts of PRF are injected into the under-eye area, where the fibrin matrix and the growth factors it carries are intended to support the skin\u2019s own repair process — the same general mechanism described on the main PRF page, applied to a specifically thin, delicate area of skin.'
      },
      {
        q: 'How is it different from under-eye filler?',
        a: 'A hyaluronic-acid filler adds volume directly and the change is visible immediately. PRF adds nothing foreign and works with tissue that is already there, so change is gradual, developing over weeks rather than at the appointment itself. Some people choose one, some the other, and some use both for different concerns — that is a consultation question, not one this page can answer for you.'
      },
      {
        q: 'Who is a good candidate for PRF under the eyes?',
        a: 'People bothered by tired-, crepey- or hollow-looking under-eyes who want a gradual, non-filler approach are typically the ones asking about this treatment. Certain blood or platelet conditions, some medications, active infection at the site, and pregnancy are all things a provider needs to know about first, and candidacy is confirmed at consultation, not on this page.'
      },
      {
        q: 'How long until I see a difference?',
        a: 'Because PRF works progressively with the body\u2019s own repair process rather than producing an immediate change, results are typically described as developing over several weeks, and a series is often recommended rather than a single session. A specific timeline is set with your provider based on your own starting point.'
      }
    ]
  },
  {
    slug: 'microneedling',
    match: /Microneedling/i,
    eyebrow: 'PRF microneedling',
    metaTitle: 'PRF Microneedling: What It Is & What It Treats',
    metaDescription:
      'What PRF microneedling is, how it differs from standard microneedling, what it is typically used for, and what to expect from the appointment and afterward.',
    intro:
      'Microneedling on its own creates a controlled pattern of micro-channels in the skin, prompting the skin\u2019s own repair response. Working PRF into those same channels adds your own concentrated platelets and fibrin at the point they can be most directly useful, rather than treating the needling and the PRF as two separate steps.',
    faq: [
      {
        q: 'How is PRF microneedling different from regular microneedling?',
        a: 'Standard microneedling relies on the micro-injury response alone. PRF microneedling adds your own platelet-rich fibrin into the same channels the needling creates, pairing the mechanical stimulus with the platelets\u2019 and fibrin\u2019s role in the body\u2019s repair process. Nothing synthetic is added either way — PRF is drawn from your own blood in the same visit.'
      },
      {
        q: 'What does PRF microneedling treat?',
        a: 'It is generally discussed for fine lines, acne scarring, enlarged pores and uneven texture — concerns where supporting the skin\u2019s own collagen and repair response, rather than adding volume or relaxing muscle, is the relevant approach. Whether it suits a specific concern is a consultation question.'
      },
      {
        q: 'Is there downtime?',
        a: 'Redness and mild swelling similar to other microneedling treatments is typical in the first day or two, with makeup generally avoidable rather than required immediately after. Exact aftercare guidance is given at your appointment and should be followed over anything general written here.'
      },
      {
        q: 'How many PRF microneedling sessions are usually recommended?',
        a: 'Because it works progressively rather than producing an immediate change, a series of sessions spaced some weeks apart is commonly recommended rather than a single visit, with the specific plan set at consultation based on the concern being treated.'
      }
    ]
  },
  {
    slug: 'hair-restoration',
    match: /Hair Restoration/i,
    eyebrow: 'PRF for hair restoration',
    metaTitle: 'PRF Hair Restoration: What It Is & Who It\u2019s For',
    metaDescription:
      'What PRF scalp treatment for hair restoration is, how it is combined with microneedling, what it is typically used for, and what to expect.',
    intro:
      'Hair follicles, like any other tissue, depend on a healthy local environment to function well. Scalp microneedling with PRF is intended to bring your own concentrated platelets and growth factors directly to areas of thinning or decreased density, using the same draw-and-spin process described on the main PRF page, applied to the scalp rather than the face.',
    faq: [
      {
        q: 'Who is PRF hair restoration typically for?',
        a: 'It is generally discussed for early-to-moderate thinning or decreased density rather than areas with no remaining follicles to support — PRF is intended to work with follicles that are still present, not to create new ones. Whether it is appropriate for a specific pattern of hair loss is a consultation and candidacy question.'
      },
      {
        q: 'How does the scalp treatment work?',
        a: 'The same draw-and-spin process used for any PRF treatment produces the PRF, which is then worked into the scalp via microneedling, following the same draw \u2192 spin \u2192 place \u2192 build sequence described on the main PRF page.'
      },
      {
        q: 'How many sessions does hair restoration typically take?',
        a: 'Because hair growth cycles are slow and PRF works progressively rather than producing an immediate change, a series of sessions spaced weeks apart is standard, with a specific plan and timeline set at consultation.'
      },
      {
        q: 'Does it hurt?',
        a: 'Most people describe scalp microneedling as mild discomfort rather than significant pain, similar to other in-office microneedling treatments. Numbing options can be discussed at consultation.'
      }
    ]
  }
];
