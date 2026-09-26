/**
 * lib/claims.ts
 * The four things a practice cannot say without standing behind them.
 *
 * ===========================================================================
 * WHY THIS MOVED OUT OF THE TEST
 * ===========================================================================
 * These patterns lived only in scripts/claims-test.cjs, which scans app/c,
 * components and lib. That caught 49 claims in JSX — and never once looked at
 * the catalogue, where every service and package description actually lives.
 * All of that copy is published on the storefront and none of it had been
 * checked. One live row still says "Series of 3", which fails PROTOCOL.
 *
 * A test cannot fix that on its own, because the copy is typed into a form by
 * the practice, months after any test ran. So the rule moves here, where the
 * form can apply it at the moment somebody writes the sentence — which is also
 * the only moment the person who wrote it is around to rephrase it.
 *
 * ===========================================================================
 * WHAT IT IS FOR, AND WHAT IT IS NOT
 * ===========================================================================
 * It is a prompt to rephrase, not a compliance guarantee. It catches four
 * shapes of sentence that a cash-pay aesthetics practice should not publish
 * without a source. It cannot tell a true claim from an invented one, and it
 * will never catch everything — a description can be misleading in perfect
 * compliance with all four patterns.
 *
 * It deliberately does NOT flag prices, durations, sizes, or the word "may"
 * doing honest work.
 */

export type ClaimKind = 'EFFICACY' | 'SAFETY' | 'PROTOCOL' | 'MECHANISM';

export type ClaimHit = {
  kind: ClaimKind;
  /** The exact words that matched, so the message can quote them back. */
  phrase: string;
  /** What to do about it, in words the practice can act on. */
  why: string;
};

const PATTERNS: { kind: ClaimKind; why: string; re: RegExp }[] = [
  {
    kind: 'EFFICACY',
    why: 'a number the practice would have to be able to prove. Say what it is designed to do instead.',
    re: /(?:by |up to |increases?|boosts?|improves?|reduces?|\+)\s*[0-9]{1,3}\s*%|[0-9]{1,3}\s*%\s*(?:more|faster|greater|increase|improvement|absorption|uptake|reduction)/i
  },
  {
    kind: 'SAFETY',
    why: 'an absolute. "Minimal downtime" and "typically well tolerated" are defensible; "zero" and "painless" are not.',
    re: /(?<!little to )(?<!minimal )(?<!usually )(?<!typically )\b(?:zero|no|0%?)\s+(?:pain|downtime|redness|irritation|recovery|side ?effects?|scratching|needles)\b|\bpainless\b/i
  },
  {
    kind: 'PROTOCOL',
    why: 'a course of treatment only the practitioner can set. Leave the spacing to the consultation.',
    re: /\b[0-9]+\s*(?:to|–|-|and)\s*[0-9]+\s+(?:sessions?|treatments?|visits?)\b|\b[0-9]+\s*(?:sessions?|treatments?)\s+spaced\b|\bseries of\s+[0-9]|\blasts?\s+[0-9]+\s*(?:to|–|-)\s*[0-9]+\s+(?:months?|years?)\b/i
  },
  {
    kind: 'MECHANISM',
    why: 'a physiological assertion stated as fact. "Designed to support" says the same thing honestly.',
    re: /\b(?:penetrat\w+|trigger\w*|stimulat\w+|activat\w+|synthesi\w+)\b[^.]{0,60}\b(?:dermis|epidermis|mitochondri\w+|cellular|collagen|ATP|fibroblast\w*|stratum corneum|cytochrome)\b/i
  }
];

/** Every pattern a piece of copy trips, in the order they are defined. */
export function claimsIn(value: unknown): ClaimHit[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  const hits: ClaimHit[] = [];
  for (const p of PATTERNS) {
    const m = value.match(p.re);
    if (m) hits.push({ kind: p.kind, phrase: m[0].trim(), why: p.why });
  }
  return hits;
}

/**
 * One sentence a practitioner can act on, or null if the copy is clean.
 *
 * Quotes the offending words back rather than naming the rule, because
 * "PROTOCOL violation" tells somebody writing a package description nothing at
 * all, and "3 to 6 sessions" tells them exactly what to change.
 */
export function claimsMessage(value: unknown): string | null {
  const hits = claimsIn(value);
  if (!hits.length) return null;
  const first = hits[0]!;
  const more = hits.length > 1 ? ` (and ${hits.length - 1} more)` : '';
  return `“${first.phrase}” is ${first.why}${more}`;
}
