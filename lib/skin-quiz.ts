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
  /** Said back to them, in their words, not ours. */
  mirror: string;
  matchers: Matcher[];
  low: Matcher[];
  guide?: { href: string; label: string };
}> = {
  lines: {
    label: 'Expression lines',
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
    mirror: 'thinning hair',
    matchers: [{ nameIncludes: ['Hair Restoration'] }],
    low: [],
    guide: { href: '/prf/hair-restoration', label: 'PRF for hair, in detail' }
  },
  contour: {
    label: 'Body',
    mirror: 'a stubborn area you would like to change',
    matchers: [
      { nameIncludes: ['Cryo Body Sculpting'] },
      { nameIncludes: ['Cryo Sculpt'] }
    ],
    low: [{ nameIncludes: ['Cryo Body Sculpting'] }, { nameIncludes: ['Cryo Sculpt'] }]
  },
  recovery: {
    label: 'Recovery',
    mirror: 'aches and recovery after training',
    matchers: [{ nameIncludes: ['Localized Cryotherapy'] }],
    low: [{ nameIncludes: ['Localized Cryotherapy'] }]
  }
};

export type QuizAnswers = {
  focus: string[];
  sun?: string;
  feel?: string;
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
