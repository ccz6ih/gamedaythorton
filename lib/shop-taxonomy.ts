/**
 * lib/shop-taxonomy.ts
 * How the shop is organised, defined once.
 *
 * ---------------------------------------------------------------------------
 * WHY THE ORDER IS THE ROUTINE, NOT THE ALPHABET
 * ---------------------------------------------------------------------------
 * The shop used to render its categories in whatever order the rows happened to
 * arrive in, which put masques above cleansers and SPF in the middle. Skincare
 * has an order that everybody who uses it already knows — you cleanse, then you
 * treat, then you seal, then you protect — and a shop laid out that way can be
 * read top to bottom as a routine rather than as an inventory.
 *
 * It is also the order the product pages already implied through their step
 * labels, which lived in a map inside app/c/[slug]/shop/[product]/page.tsx. Two
 * copies of one sequence is a drift waiting to happen, so it lives here now and
 * both read from it.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS A LABEL MAP AS WELL
 * ---------------------------------------------------------------------------
 * titleCase('spf') is "Spf" and titleCase('eye_care') is "Eye Care". The second
 * is fine and the first is not, which is exactly the kind of thing that ships:
 * the helper is right most of the time, so nobody checks the one case it gets
 * wrong. Acronyms and brand-ish names are named here instead of guessed.
 */

/** Routine order. Anything not listed falls to the end, in its own order. */
export const CATEGORY_ORDER = [
  'cleanser',
  'exfoliator',
  'toner',
  'masque',
  'serum',
  'eye_care',
  'moisturizer',
  'facial_oil',
  'spf',
  'lip_care',
  'kit'
];

/** Display names. Only the ones titleCase() would get wrong, plus clarity. */
const CATEGORY_LABEL: Record<string, string> = {
  spf: 'SPF',
  eye_care: 'Eye Care',
  facial_oil: 'Facial Oils',
  lip_care: 'Lip Care',
  kit: 'Kits',
  masque: 'Masques',
  toner: 'Mists & Toners',
  // Plural, because every one of these labels sits next to a count. "Cleanser
  // 4" reads as a stutter; "Cleansers 4" reads as a shelf.
  cleanser: 'Cleansers',
  exfoliator: 'Exfoliants',
  serum: 'Serums',
  moisturizer: 'Moisturizers'
};

export function categoryLabel(category: string) {
  return CATEGORY_LABEL[category]
    ?? category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Where a product sits in the routine, for the product page's step chip. */
export const STEP_MAP: Record<string, string> = {
  cleanser: 'Step 01 · Cleanse',
  exfoliator: 'Step 02 · Exfoliate',
  toner: 'Step 03 · Tone & Prep',
  masque: 'Step 04 · Treatment Masque',
  serum: 'Step 05 · Target Serum',
  eye_care: 'Step 06 · Eye Care',
  moisturizer: 'Step 07 · Moisturize & Seal',
  spf: 'Step 08 · Daily Defense SPF',
  facial_oil: 'Step 08 · Botanical Facial Oil',
  lip_care: 'Specialty · Lip Barrier Care',
  kit: 'Complete Routine Kit'
};

export function sortByRoutine<T extends { category: string }>(
  groups: [string, T[]][]
): [string, T[]][] {
  return [...groups].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a[0]);
    const ib = CATEGORY_ORDER.indexOf(b[0]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

/* ==========================================================================
   THE FINDER
   ==========================================================================
   A shop of thirty-one jars is hard to enter. Somebody who knows they want the
   Renew Eye Complex can find it; somebody who just knows their skin is dry and
   tight has to read every label.

   THE RULE THIS OBEYS, AND WHY IT MATTERS MORE HERE THAN ANYWHERE:
   a concern matches a product ONLY IF the product's own copy says so.

   There is no hand-written table mapping "breakouts" to a list of jars. Every
   line of product copy on this site was verified against the supplier's
   material, and a mapping written separately from it is a second set of claims
   that can drift from the first — which is precisely how Flora Elixir came to
   be described as a probiotic mist while its own supplier filename read
   Botanic-Oil-Serum.

   So the terms below are searched against each product's real name,
   description and details. If nothing matches, the finder says nothing matched
   rather than offering its best guess. A shop that confidently recommends the
   wrong moisturiser for eczema is worse than a shop that says "ask us".
   ========================================================================== */

export type Concern = {
  key: string;
  /** What a customer would say, in their words rather than an ingredient's. */
  label: string;
  /** Shown once a concern is chosen, to frame the results honestly. */
  blurb: string;
  /**
   * Matched against name + description + details, case-insensitively.
   *
   * Word stems rather than whole words, so "hydrate", "hydrating" and
   * "hydration" are one term. Deliberately specific: "oil" would match every
   * cleansing oil and facial oil regardless of what it is for, so the terms
   * name the CONCERN's vocabulary, not the product's format.
   */
  terms: string[];
  /**
   * Restrict to these categories, where the category IS the answer.
   *
   * Added because of a real false positive that makes the case better than any
   * argument: the Purify Botanic Cleansing Oil scored on "sun protection",
   * because its own copy says it REMOVES SPF. Keyword matching cannot tell
   * "contains" from "removes", and recommending a cleanser to somebody asking
   * for sun protection is the kind of wrong answer that makes a shop look like
   * it is guessing.
   *
   * Where a concern corresponds to a product format the practice already
   * classifies — sun protection is the SPF category, the eye area is eye care —
   * the category is authoritative data rather than an inferred claim, so it is
   * allowed to gate the list. The terms still do the ranking within it.
   */
  categories?: string[];
};

export const CONCERNS: Concern[] = [
  {
    key: 'dryness',
    label: 'Dry or tight',
    blurb: 'Products whose own description mentions hydration, moisture or the skin barrier.',
    terms: ['hydrat', 'moistur', 'dry ', 'dryness', 'barrier', 'nourish', 'replenish', 'dehydrat']
  },
  {
    key: 'breakouts',
    label: 'Breakouts or congestion',
    blurb: 'Products whose own description mentions acne, congestion or clogged pores.',
    terms: ['acne', 'breakout', 'blemish', 'clog', 'congest', 'clarify', 'clarifying', 'salicylic', 'charcoal', 'oily', 'excess oil']
  },
  {
    key: 'dullness',
    label: 'Dull or uneven tone',
    blurb: 'Products whose own description mentions brightness, radiance or uneven tone.',
    terms: ['bright', 'radian', 'dull', 'glow', 'uneven tone', 'pigment', 'vitamin c', 'luminos']
  },
  {
    key: 'texture',
    label: 'Rough texture',
    blurb: 'Products whose own description mentions exfoliation, resurfacing or texture.',
    terms: ['exfoliat', 'resurfac', 'texture', 'polish', 'peel', 'enzyme', 'dead skin', 'smooth']
  },
  {
    key: 'ageing',
    label: 'Fine lines or firmness',
    blurb: 'Products whose own description mentions collagen, firmness or fine lines.',
    terms: ['collagen', 'firm', 'fine line', 'retinal', 'peptide', 'elastic', 'plump', 'lift']
  },
  {
    key: 'sensitivity',
    label: 'Sensitive or red',
    blurb: 'Products whose own description mentions soothing, calming or sensitive skin.',
    terms: ['sooth', 'calm', 'sensitiv', 'redness', 'gentle', 'irritat', 'herbal']
  },
  {
    key: 'sun',
    label: 'Sun protection',
    blurb: 'Daily sun protection.',
    terms: ['spf', 'sun shield', 'broad spectrum', 'uva', 'uvb', 'sunscreen'],
    categories: ['spf']
  },
  {
    key: 'eyes',
    label: 'Under-eye area',
    blurb: 'Products whose own description mentions the eye area.',
    terms: ['eye', 'under-eye', 'crepey', 'puffi', 'dark circle'],
    categories: ['eye_care']
  }
];

type Matchable = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  details?: string | null;
};

/**
 * Products whose own copy speaks to a concern, best first.
 *
 * "Best" is how many distinct terms the copy hits, which is a crude score and
 * an honest one — it ranks by how much the practice's own words are about this
 * concern, and nothing else. A tie falls back to routine order so the results
 * still read as a sequence you could follow.
 */
export function matchConcern<T extends Matchable>(concern: Concern, products: T[]): T[] {
  const pool = concern.categories
    ? products.filter(p => concern.categories!.includes(p.category))
    : products;

  const scored = pool
    .map(p => {
      const hay = `${p.name} ${p.description ?? ''} ${p.details ?? ''}`.toLowerCase();
      const hits = concern.terms.filter(t => hay.includes(t)).length;
      return { p, hits };
    })
    .filter(x => x.hits > 0);

  /**
   * A single term hit is a coincidence when better answers exist.
   *
   * The Soothe Herbal Cleansing Cream surfaced under "fine lines or firmness"
   * on one incidental word, below three products that are actually about
   * collagen. One glancing mention is not a recommendation.
   *
   * So the stragglers are dropped only when the concern already has three
   * solid answers. A sparse concern keeps everything it has — better a thin
   * list than an empty one — and a well-covered concern stops padding itself
   * out with near-misses.
   */
  const solid = scored.filter(x => x.hits >= 2).length;
  const kept = solid >= 3 ? scored.filter(x => x.hits >= 2) : scored;

  return kept
    .sort((a, b) =>
      b.hits - a.hits
      || CATEGORY_ORDER.indexOf(a.p.category) - CATEGORY_ORDER.indexOf(b.p.category)
      || a.p.name.localeCompare(b.p.name))
    .map(x => x.p);
}
