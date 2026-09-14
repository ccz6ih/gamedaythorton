/**
 * claims-test.cjs
 * Finds unsourced clinical claims in public storefront copy.
 *
 *   node scripts/claims-test.cjs           # fail if any are found
 *   node scripts/claims-test.cjs --list    # report only
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * Everything on the storefront is published in Jamie Salazar's name. A sentence
 * on her page is her claim, and she is the one a client quotes it back to.
 *
 * It has gone wrong three times already, each time the same way — copy written
 * to fill a gap, phrased with the confidence of a citation, sourced from
 * nothing. Flora Elixir was publicly described as a "probiotic essence mist"
 * while its own supplier filename read Botanic-Oil-Serum. Eleven treatments
 * were given protocols nobody at the practice had ever described, complete with
 * cryo-globes and session counts. The LED guide put "+200% Cellular ATP
 * Synthesis" on the page as a headline figure.
 *
 * None of it was malicious and none of it was flagged, because invented copy
 * reads better than honest copy. That is exactly the problem: the failure mode
 * of a language model writing marketing is confident specificity, and confident
 * specificity is indistinguishable from expertise until somebody checks.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT FLAGS, AND WHAT IT DELIBERATELY DOES NOT
 * ---------------------------------------------------------------------------
 * It flags four things, all of which are claims a practice can be held to:
 *
 *   EFFICACY   a quantified outcome — "+97% absorption", "boosts by 200%"
 *   SAFETY     an absolute — "zero pain", "no downtime", "painless"
 *   PROTOCOL   a course of treatment — "3 to 6 sessions, 2 to 4 weeks apart"
 *   MECHANISM  a physiological assertion — "penetrates into the dermis to
 *              trigger collagen induction"
 *
 * It does NOT flag prices, durations, sizes, measurements, or anything inside a
 * comment. It does not flag the word "may" doing honest work. And it cannot
 * tell a sourced claim from an invented one — that is the point of the
 * allowlist: a claim the practice has actually made, or that carries a citation
 * in the copy, is listed there with where it came from.
 *
 * A finding is not automatically wrong. It is automatically UNVERIFIED, and
 * somebody has to say which.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIST_ONLY = process.argv.includes('--list');

/** Public storefront only. The console is staff-facing and not published. */
const SCAN_DIRS = ['app/c', 'components', 'lib'];
const SCAN_EXT = /\.(tsx|ts)$/;

/** Files that are not customer-facing copy. */
const SKIP = [
  'lib/db/', 'lib/supabase/', 'lib/phi/', 'lib/stripe',
  'components/Brand.tsx'
];

const PATTERNS = [
  {
    kind: 'EFFICACY',
    why: 'a quantified outcome the practice would have to stand behind',
    re: /(?:by |up to |increases?|boosts?|improves?|reduces?|\+)\s*[0-9]{1,3}\s*%|[0-9]{1,3}\s*%\s*(?:more|faster|greater|increase|improvement|absorption|uptake|reduction)/i
  },
  {
    kind: 'SAFETY',
    why: 'an absolute safety claim — "generally" and "typically" are defensible, "zero" is not',
    /**
     * The negative lookbehind matters more than the pattern.
     *
     * "Little to no downtime" and "minimal downtime" are the honest phrasings
     * this test is trying to produce, and flagging them alongside "zero
     * downtime" would mean the only way to pass is to say nothing about
     * recovery at all. A test that punishes the correct answer gets switched
     * off.
     */
    re: /(?<!little to )(?<!minimal )(?<!usually )(?<!typically )\b(?:zero|no|0%?)\s+(?:pain|downtime|redness|irritation|recovery|side ?effects?|scratching|needles)\b|\bpainless\b/i
  },
  {
    kind: 'PROTOCOL',
    why: 'a course of treatment only the practitioner can prescribe',
    /**
     * Every branch requires a NUMBER. "A series of sessions spaced some weeks
     * apart, with the plan set at consultation" is the phrasing that should
     * pass — it defers to the practitioner instead of prescribing. Flagging it
     * for containing the word "spaced" taught nothing.
     */
    re: /\b[0-9]+\s*(?:to|–|-|and)\s*[0-9]+\s+(?:sessions?|treatments?|visits?)\b|\b[0-9]+\s*(?:sessions?|treatments?)\s+spaced\b|\bseries of\s+[0-9]|\blasts?\s+[0-9]+\s*(?:to|–|-)\s*[0-9]+\s+(?:months?|years?)\b/i
  },
  {
    kind: 'MECHANISM',
    why: 'a physiological assertion stated as fact',
    re: /\b(?:penetrat\w+|trigger\w*|stimulat\w+|activat\w+|synthesi\w+)\b[^.]{0,60}\b(?:dermis|epidermis|mitochondri\w+|cellular|collagen|ATP|fibroblast\w*|stratum corneum|cytochrome)\b/i
  }
];

/**
 * Claims that are allowed, each with the reason.
 *
 * A line belongs here only when somebody can say where it came from. "It sounds
 * right" is not a source; neither is "it is probably true".
 */
const ALLOWED = [
  {
    match: /platelet-rich fibrin|your own platelets|blood draw/i,
    why: 'Describes what the treatment IS, which the practice performs and advertises.'
  },
  {
    match: /consultation and candidacy assessment/i,
    why: 'A statement about her own process, not an outcome.'
  },
  {
    match: /results (?:develop|build|appear) (?:progressively|gradually|over)/i,
    why: 'Deliberately unquantified — the honest phrasing this test exists to encourage.'
  },
  {
    match: /\b(?:thought to|understood to|proposed mechanism|is believed to|appears to)\b/i,
    why:
      'Hedged. The test exists to catch mechanism stated as settled fact; a sentence '
      + 'that says openly it is a proposed mechanism has already done the honest thing, '
      + 'and rewriting it further would only make the page vaguer without making it truer.'
  },
  {
    match: /wavelengths of light[^.]*penetrate the epidermis and dermis/i,
    why:
      'How far light of a given wavelength travels into tissue is measurable physics, '
      + 'not an efficacy claim. The sentence says where the light goes; the claims about '
      + 'what it then achieves are hedged separately in the same paragraph.'
  }
];

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (SCAN_EXT.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * Strips comments before scanning.
 *
 * Without this the file documenting why a claim was REMOVED trips the test for
 * containing the claim, which trains everyone to ignore the output.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(Math.max(0, m.length - p1.length)));
}

function main() {
  const files = SCAN_DIRS
    .flatMap(d => walk(path.join(ROOT, d)))
    .filter(f => {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      return !SKIP.some(s => rel.startsWith(s));
    });

  const findings = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n');

    lines.forEach((line, i) => {
      // Only prose. A line with no letters-and-spaces run is code.
      if (!/[a-z]{3}\s+[a-z]{3}/i.test(line)) return;

      for (const p of PATTERNS) {
        const m = line.match(p.re);
        if (!m) continue;
        if (ALLOWED.some(a => a.match.test(line))) continue;
        findings.push({
          file: rel,
          line: i + 1,
          kind: p.kind,
          why: p.why,
          text: line.trim().replace(/\s+/g, ' ').slice(0, 130)
        });
        break;
      }
    });
  }

  if (!findings.length) {
    console.log(`\n  ${files.length} storefront files scanned. No unsourced clinical claims.\n`);
    return 0;
  }

  const byFile = new Map();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }

  console.log(`\n  ${findings.length} UNSOURCED CLAIM(S) in ${byFile.size} file(s):\n`);
  for (const [file, fs_] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${file}`);
    for (const f of fs_) {
      console.log(`      ${f.line}  [${f.kind}]  ${f.text}`);
    }
    console.log('');
  }

  const counts = {};
  for (const f of findings) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
  console.log('  ' + Object.entries(counts).map(([k, n]) => `${k}: ${n}`).join('   '));
  console.log('\n  Every line above is published in the practice owner\'s name.');
  console.log('  Either source it, soften it to what is actually known, or remove it.\n');

  return LIST_ONLY ? 0 : 1;
}

process.exit(main());
