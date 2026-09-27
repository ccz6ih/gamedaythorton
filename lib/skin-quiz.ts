/**
 * lib/skin-quiz.ts
 * The skin quiz: questions, and how answers become a shortlist.
 *
 * ===========================================================================
 * IT DOES NOT DIAGNOSE, AND THAT IS NOT A LIMITATION
 * ===========================================================================
 * Every question asks what somebody has NOTICED, never what they have. "How
 * does your skin usually react to a lot of sun" is a self-report anyone can
 * answer about themselves; "what is your skin type" invites a verdict we are
 * not entitled to give, and "do you have rosacea" is asking a stranger to
 * diagnose themselves on a marketing page.
 *
 * The output is framed the same way: these are treatments worth ASKING ABOUT,
 * with the actual decision explicitly left to the consultation. That is not
 * legal throat-clearing — it is true. Nobody can tell from six taps what
 * somebody's skin needs.
 *
 * Every result string is checked against lib/claims at render, because this is
 * the highest-volume piece of clinical-adjacent copy on the site and the one
 * most likely to drift into promising an outcome.
 *
 * ===========================================================================
 * SHORTLISTS COME FROM HER CATALOGUE, NOT FROM HERE
 * ===========================================================================
 * A concern maps to MATCHERS — a category and some name fragments — which are
 * resolved against the live service table when the page renders. So a renamed
 * or retired treatment silently drops out instead of the result page
 * recommending something she does not offer any more.
 *
 * If a concern resolves to nothing at all, the consultation is the fallback.
 * An empty shortlist is the one outcome that must not happen.
 *
 * ===========================================================================
 * WHO IT IS FOR
 * ===========================================================================
 * Everyone, worded so that a man reading it does not feel he has wandered into
 * somebody else's space. No "girl", no "gorgeous", nothing gendered anywhere —
 * and the concerns men most often come in for (back and chest breakouts,
 * thinning hair, looking tired, jawline) are first-class options rather than
 * an afterthought at the bottom of the list.
 */

export type QuizOption = { value: string; label: string; hint?: string };
export type QuizQuestion = {
  key: string;
  title: string;
  help?: string;
  multi?: boolean;
  options: QuizOption[];
};

/** A concern maps to services by category and name fragment, never by id. */
export type Matcher = { category?: string; nameIncludes?: string[] };

export const QUESTIONS: QuizQuestion[] = [
  {
    key: 'focus',
    title: 'What would you most like to change?',
    help: 'Pick as many as you like.',
    multi: true,
    options: [
      { value: 'lines', label: 'Lines when I move my face' },
      { value: 'texture', label: 'Texture, pores or old marks' },
      { value: 'dull', label: 'Dull, flat or tired-looking skin' },
      { value: 'breakouts_face', label: 'Breakouts on my face' },
      { value: 'breakouts_body', label: 'Breakouts on my back or chest' },
      { value: 'eyes', label: 'Under my eyes' },
      { value: 'redness', label: 'Redness or easily irritated skin' },
      { value: 'hair', label: 'Thinning hair' },
      { value: 'contour', label: 'A stubborn area on my body' },
      { value: 'recovery', label: 'Aches and recovery after training' }
    ]
  },
  {
    key: 'sun',
    title: 'After a long day in the sun with no sunscreen, your skin usually…',
    help: 'This helps with which treatments suit you, and how gently to start.',
    options: [
      { value: 'burns', label: 'Burns, and does not really tan' },
      { value: 'burns_then_tans', label: 'Burns first, then tans' },
      { value: 'tans', label: 'Tans easily, rarely burns' },
      { value: 'never_burns', label: 'Almost never burns' },
      { value: 'unsure', label: 'Not sure' }
    ]
  },
  {
    key: 'feel',
    title: 'Most days, your skin feels…',
    options: [
      { value: 'tight', label: 'Tight or flaky' },
      { value: 'shiny', label: 'Shiny by the afternoon' },
      { value: 'both', label: 'Both, depending where' },
      { value: 'comfortable', label: 'Comfortable' }
    ]
  },
  {
    key: 'reacts',
    title: 'When you try a new product, your skin…',
    help: 'How easily skin is set off changes where a practitioner starts.',
    options: [
      { value: 'often', label: 'Often stings or goes red' },
      { value: 'sometimes', label: 'Occasionally, if it is strong' },
      { value: 'rarely', label: 'Takes most things in its stride' },
      { value: 'unsure', label: 'I have not really tested it' }
    ]
  },
  {
    key: 'downtime',
    title: 'How much downtime can you live with?',
    help: 'Being honest here changes the answer more than anything else.',
    options: [
      { value: 'none', label: 'None — I need to look normal tomorrow' },
      { value: 'weekend', label: 'A weekend' },
      { value: 'week', label: 'A week, if it is worth it' }
    ]
  },
  {
    key: 'history',
    title: 'Where are you starting from?',
    options: [
      { value: 'new', label: 'Never done anything like this' },
      { value: 'basics', label: 'I wash my face and wear sunscreen' },
      { value: 'routine', label: 'I have a real routine' },
      { value: 'treatments', label: 'I have had treatments before' }
    ]
  }
];

/**
 * What each concern points at.
 *
 * `low` marks options that suit somebody who said they can take no downtime,
 * so the shortlist can be filtered rather than caveated. A result that
 * recommends microneedling to a person who told you they have a wedding
 * tomorrow has not listened.
 */
export const CONCERNS: Record<string, {
  label: string;
  /** The reasoning, shown instead of "because you mentioned X". */
  why: string;
  /** Said back to them, in their words, not ours. */
  mirror: string;
  matchers: Matcher[];
  low: Matcher[];
  guide?: { href: string; label: string };
}> = {
  lines: {
    label: 'Expression lines',
    why:
      "Expression lines come from muscle movement rather than the skin surface, which is why the usual first conversation here is about relaxing the movement rather than resurfacing.",
    mirror: 'lines that show up when you move your face',
    matchers: [
      { nameIncludes: ['Jeuveau'] },
      { nameIncludes: ['Radiofrequency'] },
      { nameIncludes: ['PRF Microneedling'] }
    ],
    low: [{ nameIncludes: ['Jeuveau'] }, { nameIncludes: ['Radiofrequency'] }],
    guide: { href: '/injectables', label: 'How injectables work here' }
  },
  texture: {
    label: 'Texture and marks',
    why:
      "Texture and old marks sit in the skin itself, so the usual approach is treatments that work on the surface and just below it rather than anything injected for volume.",
    mirror: 'texture, pores or marks left behind',
    matchers: [
      { nameIncludes: ['PRF Microneedling'] },
      { nameIncludes: ['Nano Infusion'] },
      { nameIncludes: ['Hydrodermabrasion'] },
      { nameIncludes: ['Dermaplaning'] }
    ],
    low: [{ nameIncludes: ['Hydrodermabrasion'] }, { nameIncludes: ['Dermaplaning'] }],
    guide: { href: '/prf', label: 'What PRF actually is' }
  },
  dull: {
    label: 'Brightness',
    why:
      "Dullness is generally about the surface layer and hydration, which is why the usual answer is a facial rather than anything more involved.",
    mirror: 'skin that looks flat or tired',
    matchers: [
      { nameIncludes: ['Getaway Glow'] },
      { nameIncludes: ['Golden Hour'] },
      { nameIncludes: ['Hydrodermabrasion'] },
      { nameIncludes: ['Dermaplaning'] },
      { nameIncludes: ['Frotox'] }
    ],
    low: [{ nameIncludes: ['Getaway Glow'] }, { nameIncludes: ['Frotox'] }, { nameIncludes: ['Dermaplaning'] }],
    guide: { href: '/facials', label: 'The facial menu, explained' }
  },
  breakouts_face: {
    label: 'Breakouts',
    why:
      "Facial breakouts are usually approached by calming and clearing rather than resurfacing, since aggravated skin tends to react badly to aggressive treatment.",
    mirror: 'breakouts on your face',
    matchers: [
      { nameIncludes: ['Skin Clearing'] },
      { nameIncludes: ['LED Light'] },
      { nameIncludes: ['Floraessence'] }
    ],
    low: [{ nameIncludes: ['LED Light'] }, { nameIncludes: ['Express Skin Clearing'] }],
    guide: { href: '/led-light-therapy', label: 'About LED light therapy' }
  },
  breakouts_body: {
    label: 'Back and chest',
    why:
      "Back and chest skin is thicker than facial skin with larger follicles, so it is generally treated differently rather than with a scaled-up facial.",
    mirror: 'breakouts on your back or chest',
    matchers: [
      { nameIncludes: ['Bacne'] },
      { nameIncludes: ['SubZero Acne-Prone'] }
    ],
    low: [{ nameIncludes: ['SubZero Acne-Prone'] }],
    guide: { href: '/mens-skin-care', label: 'Skin care, plainly' }
  },
  eyes: {
    label: 'Under-eye',
    why:
      "Under-eye concerns are usually about volume and skin quality rather than pigment, which is why the starting point here addresses the tissue rather than lightening anything.",
    mirror: 'the area under your eyes',
    matchers: [
      { nameIncludes: ['Under-Eye'] },
      { nameIncludes: ['Frotox'] }
    ],
    low: [{ nameIncludes: ['Frotox'] }],
    guide: { href: '/prf/compare', label: 'PRF vs PRP vs filler' }
  },
  redness: {
    label: 'Calming',
    why:
      "Skin that reddens easily is generally calmed before it is treated, so gentler options come first and stronger ones only once it has settled.",
    mirror: 'redness or skin that is easily set off',
    matchers: [
      { nameIncludes: ['LED Light'] },
      { nameIncludes: ['Wellness Signature'] },
      { nameIncludes: ['Frotox'] }
    ],
    low: [{ nameIncludes: ['LED Light'] }, { nameIncludes: ['Wellness Signature'] }],
    guide: { href: '/led-light-therapy', label: 'About LED light therapy' }
  },
  hair: {
    label: 'Hair',
    why:
      "Thinning hair is treated at the scalp rather than the hair itself, which is why this sits with the injectables rather than anything topical.",
    mirror: 'thinning hair',
    matchers: [{ nameIncludes: ['Hair Restoration'] }],
    low: [],
    guide: { href: '/prf/hair-restoration', label: 'PRF for hair, in detail' }
  },
  contour: {
    label: 'Body',
    why:
      "A stubborn area that does not shift with training or diet is generally approached as a contouring question rather than a weight one.",
    mirror: 'a stubborn area you would like to change',
    matchers: [
      { nameIncludes: ['Cryo Body Sculpting'] },
      { nameIncludes: ['Cryo Sculpt'] }
    ],
    low: [{ nameIncludes: ['Cryo Body Sculpting'] }, { nameIncludes: ['Cryo Sculpt'] }]
  },
  recovery: {
    label: 'Recovery',
    why:
      "Recovery and soreness are a different job from anything cosmetic, and are treated locally where it hurts.",
    mirror: 'aches and recovery after training',
    matchers: [{ nameIncludes: ['Localized Cryotherapy'] }],
    low: [{ nameIncludes: ['Localized Cryotherapy'] }]
  }
};

/* =========================================================================
   THE PROFILE — what the quiz is actually for
   =========================================================================
   The first version went straight from answers to a list of treatments, and
   Craig's read was right: it felt like every product quiz, told somebody
   nothing about themselves, and arrived at a shortlist that looked like a
   sales pitch because no reasoning came before it.

   So the result now leads with a profile and an explanation, and the
   treatments come last, each carrying its own why.

   ---------------------------------------------------------------------------
   WHY FITZPATRICK IS DEFENSIBLE HERE
   ---------------------------------------------------------------------------
   It is not a diagnosis and not something we invented. It is a classification
   published in 1975 that sorts skin by how it RESPONDS TO SUN rather than by
   colour, it was designed from the start to be self-reported, and it is the
   thing practitioners actually ask about before choosing settings for a laser
   or the strength of a peel.

   So explaining it is teaching somebody the vocabulary their practitioner
   already uses — which is genuinely interesting, genuinely useful, and
   shareable in a way "you are a Glow Girl" is not.

   ALL OF THIS COPY STILL NEEDS JAMIE'S EYE, same as the intake questions. It
   is reference material about a standard scale rather than a claim about a
   treatment, and every line is run through lib/claims at render — but she is
   the clinician and it goes out in her name.
   ========================================================================= */

export type Phototype = {
  roman: string;
  name: string;
  /** What they told us, restated as the scale describes it. */
  behaviour: string;
  /** What practitioners generally do with that information. */
  practice: string;
};

export const PHOTOTYPES: Record<string, Phototype> = {
  burns: {
    roman: 'I–II',
    name: 'Burns easily, rarely tans',
    behaviour:
      'On the Fitzpatrick scale this is the fair end — skin that goes red in the sun and does not '
      + 'hold much colour afterwards.',
    practice:
      'Practitioners generally consider this the most straightforward end of the scale for '
      + 'resurfacing treatments, with daily sun protection doing more of the work than anything '
      + 'done in a clinic.'
  },
  burns_then_tans: {
    roman: 'III',
    name: 'Burns first, then tans',
    behaviour:
      'The middle of the Fitzpatrick scale, and the most common answer — skin that catches the sun '
      + 'before it settles into a tan.',
    practice:
      'This sits comfortably with most of what a med spa offers. The usual caution is timing rather '
      + 'than suitability: treatments are generally kept away from a fresh tan.'
  },
  tans: {
    roman: 'IV',
    name: 'Tans easily, rarely burns',
    behaviour:
      'Further down the Fitzpatrick scale — skin with more background pigment, which browns rather '
      + 'than burns.',
    practice:
      'Practitioners generally start more gently here, because pigment can respond unpredictably to '
      + 'aggressive treatment. It is the single most common reason to build up slowly rather than '
      + 'go in hard on a first visit.'
  },
  never_burns: {
    roman: 'V–VI',
    name: 'Almost never burns',
    behaviour:
      'The deeper end of the Fitzpatrick scale, where burning is rare and pigment is abundant.',
    practice:
      'Conservative settings and patch testing are the norm here, and plenty of treatments are a '
      + 'poor fit. Asking a practitioner what they have done on skin like yours specifically is a '
      + 'fair and useful question.'
  },
  unsure: {
    roman: '—',
    name: 'Worth working out together',
    behaviour:
      'Not knowing is a perfectly normal answer, especially if you are careful with sun in the '
      + 'first place.',
    practice:
      'A practitioner can usually place it in about a minute by asking two or three follow-up '
      + 'questions. It matters because it is what settings and strengths get chosen from.'
  }
};

export const FITZPATRICK_NOTE =
  'The Fitzpatrick scale was published in 1975 and is still what practitioners reach for. It sorts '
  + 'skin by how it responds to sun rather than by colour, which is why the question asked about '
  + 'burning rather than showing you a shade card.';

export const MOISTURE: Record<string, { name: string; note: string }> = {
  tight: {
    name: 'Dry-leaning',
    note:
      'Skin that feels tight is usually described as dry, which is about oil rather than water — '
      + 'which is why a richer moisturiser tends to help more than drinking more water.'
  },
  shiny: {
    name: 'Oil-rich',
    note:
      'Shine by the afternoon usually means skin producing plenty of oil. Stripping it back hard '
      + 'often makes it produce more, so the usual approach is to manage it rather than fight it.'
  },
  both: {
    name: 'Combination',
    note:
      'Oily through the middle and drier around the edges is the most common pattern there is. It '
      + 'usually means treating areas differently rather than looking for one product that does '
      + 'everything.'
  },
  comfortable: {
    name: 'Balanced',
    note:
      'Skin that mostly behaves is a good starting point, and the honest advice is to change less '
      + 'rather than more.'
  }
};

export const REACTIVITY: Record<string, { name: string; note: string }> = {
  often: {
    name: 'Easily set off',
    note:
      'Skin that stings or reddens with new products is generally treated as reactive, which shapes '
      + 'the order things are introduced far more than it rules treatments out.'
  },
  sometimes: {
    name: 'Mildly reactive',
    note: 'Reacting only to stronger actives is ordinary, and mostly a question of introducing them slowly.'
  },
  rarely: {
    name: 'Resilient',
    note:
      'Skin that tolerates most things gives a practitioner more room — though tolerating something '
      + 'and needing it are different questions.'
  },
  unsure: {
    name: 'Untested',
    note: 'Worth mentioning at a consultation, since it is easier to find out gently than the hard way.'
  }
};

export type SkinProfile = {
  /** The headline, built from what they said rather than a personality label. */
  title: string;
  phototype: Phototype;
  moisture?: { name: string; note: string };
  reactivity?: { name: string; note: string };
};

export function profileOf(a: QuizAnswers): SkinProfile {
  const phototype = PHOTOTYPES[a.sun ?? 'unsure'] ?? PHOTOTYPES.unsure!;
  const moisture = a.feel ? MOISTURE[a.feel] : undefined;
  const reactivity = a.reacts ? REACTIVITY[a.reacts] : undefined;

  /* Descriptive, not a personality quiz result. "Dry-leaning, easily set off,
     type II" is something somebody recognises and can repeat to a
     practitioner; "You are a Dewy Dreamer" is something they screenshot once
     and never think about again. */
  const parts = [moisture?.name, reactivity?.name === 'Resilient' ? 'resilient' : reactivity?.name?.toLowerCase()]
    .filter(Boolean);
  const title = parts.length
    ? `${parts.join(', ')} — Fitzpatrick ${phototype.roman}`
    : `Fitzpatrick ${phototype.roman}`;

  return { title, phototype, moisture, reactivity };
}

export type QuizAnswers = {
  focus: string[];
  sun?: string;
  feel?: string;
  reacts?: string;
  downtime?: string;
  history?: string;
};

/** Read answers out of a URL, so a result is shareable and needs no session. */
export function answersFromParams(params: Record<string, string | string[] | undefined>): QuizAnswers {
  const raw = params.focus;
  const focus = (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .flatMap(v => String(v).split(','))
    .map(v => v.trim())
    .filter(v => v in CONCERNS);

  const one = (k: string) => {
    const v = params[k];
    return typeof v === 'string' && v ? v : undefined;
  };

  return {
    focus: [...new Set(focus)].slice(0, 6),
    sun: one('sun'),
    feel: one('feel'),
    downtime: one('downtime'),
    history: one('history')
  };
}

type ServiceLike = { id: string; name: string; category: string | null };

function matches(s: ServiceLike, m: Matcher): boolean {
  if (m.category && (s.category ?? '').toLowerCase() !== m.category.toLowerCase()) return false;
  if (m.nameIncludes && !m.nameIncludes.some(f => s.name.toLowerCase().includes(f.toLowerCase()))) {
    return false;
  }
  return true;
}

/**
 * The shortlist, resolved against whatever she actually offers today.
 *
 * Ordered by how many of their concerns a treatment answers, so one that
 * covers three things they mentioned comes first. That is the closest thing
 * here to intelligence, and it is just counting.
 */
export function shortlist<T extends ServiceLike>(
  answers: QuizAnswers,
  services: T[]
): { service: T; because: string[] }[] {
  const noDowntime = answers.downtime === 'none';
  const hits = new Map<string, { service: T; because: string[] }>();

  for (const key of answers.focus) {
    const concern = CONCERNS[key];
    if (!concern) continue;
    const use = noDowntime && concern.low.length ? concern.low : concern.matchers;

    for (const m of use) {
      for (const s of services) {
        if (!matches(s, m)) continue;
        const found = hits.get(s.id);
        if (found) {
          if (!found.because.includes(concern.label)) found.because.push(concern.label);
        } else {
          hits.set(s.id, { service: s, because: [concern.label] });
        }
      }
    }
  }

  return [...hits.values()]
    .sort((a, b) => b.because.length - a.because.length || a.service.name.localeCompare(b.service.name))
    .slice(0, 6);
}

/** Their answers, said back to them in a sentence. */
export function mirrorLine(answers: QuizAnswers): string {
  const bits = answers.focus.map(k => CONCERNS[k]?.mirror).filter(Boolean) as string[];
  if (!bits.length) return 'You are having a look at what is possible.';
  if (bits.length === 1) return `You told us about ${bits[0]}.`;
  const last = bits[bits.length - 1];
  return `You told us about ${bits.slice(0, -1).join(', ')} and ${last}.`;
}

/** A plain-text summary for the enquiry that reaches the practice. */
export function summaryForPractice(answers: QuizAnswers): string {
  const label = (q: string, v?: string) =>
    QUESTIONS.find(x => x.key === q)?.options.find(o => o.value === v)?.label;

  return [
    `Focus: ${answers.focus.map(k => CONCERNS[k]?.label ?? k).join(', ') || '—'}`,
    `Sun response: ${label('sun', answers.sun) ?? '—'}`,
    `Skin feels: ${label('feel', answers.feel) ?? '—'}`,
    `Downtime: ${label('downtime', answers.downtime) ?? '—'}`,
    `Starting from: ${label('history', answers.history) ?? '—'}`
  ].join('\n');
}
