/**
 * class-collision-test.cjs — one word cannot be both a component and a modifier.
 *
 *   node scripts/class-collision-test.cjs
 *
 * WHY THIS EXISTS
 * The calendar rendered as a gold spike the height of the viewport, sitting
 * under an empty-looking week grid. The cause was a class name:
 *
 *     .intake { min-height: 100dvh; ... }     the intake PAGE
 *     <i class="cal-dot intake" />            "intake incomplete", a 6px dot
 *
 * One stylesheet is shared by every screen here, so a rule named after a plain
 * word eventually meets that word used as a modifier. The dot inherited a
 * full-viewport min-height and a 50% radius, and the result looked like broken
 * layout rather than a naming problem — which is why it took an hour to find
 * instead of a minute.
 *
 * ===========================================================================
 * THE SIGNATURE IS BOTH POSITIONS, AND GETTING THAT RIGHT MATTERED
 * ===========================================================================
 * The first version of this test flagged every `class="grid g4"` in the
 * codebase — thirty-odd lines of noise — because it treated any single-word
 * class in a multi-class attribute as suspect. But `grid g4` is the INTENDED
 * pattern: `grid` is the component, `g4` modifies it.
 *
 * A real collision is one word doing both jobs on DIFFERENT elements: a
 * component root in one place, a modifier on something unrelated in another.
 * That is precisely what `.intake` was, and nothing else in the codebase is.
 *
 * A test that cries wolf gets switched off — the same failure as the intake
 * pill nobody read.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHEETS = [
  'app/app-extras.css',
  'prototype/assets/storefront.css',
  'prototype/assets/app.css'
];
const MARKUP_DIRS = ['app', 'components'];

/**
 * Single words designed to be combined. Each is a deliberate entry, not a list
 * to extend whenever the test complains.
 */
const ALLOWED = new Set([
  'ok', 'warn', 'critical', 'dim', 'muted', 'num', 'sm', 'lg', 'primary',
  'ghost', 'active', 'open', 'closed', 'today', 'wide', 'narrow', 'flush',
  'tight', 'clickable', 'quiet', 'mono', 'linkish', 'note', 'dot', 'av',
  'pill', 'row', 'card', 'view', 'stat', 'lab', 'crumb', 'spacer', 'btn',
  'hint', 'field', 'check', 'shut', 'dow', 'dat', 'n', 't', 'd'
]);

/** The properties that turn a name clash into a visible catastrophe. */
const LAYOUT = /(?:^|;)\s*(?:min-height|height|min-width|width|position|display|padding|margin|inset|top|left|right|bottom|background)\s*:/;

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/* ------------------------------- single-word rules that carry layout ------ */

const RULE = /(?:^|})\s*(\.[a-z][a-z0-9]*)\s*(?:,[^{]*)?\{([^}]*)\}/gim;
const risky = new Map();

for (const rel of SHEETS) {
  let css;
  try { css = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { continue; }
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');

  let m;
  while ((m = RULE.exec(css)) !== null) {
    const cls = m[1].slice(1);
    if (ALLOWED.has(cls)) continue;
    if (!LAYOUT.test(m[2])) continue;
    if (!risky.has(cls)) risky.set(cls, rel);
  }
}

/* --------------------------------------- where each word is used, and how -- */

const asRoot = new Map();
const asModifier = new Map();
const files = MARKUP_DIRS.flatMap(d => walk(path.join(ROOT, d)));
const CLASSNAME = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).split(path.sep).join('/');

  let m;
  while ((m = CLASSNAME.exec(src)) !== null) {
    const raw = m[1] || m[2] || '';
    // Template expressions are stripped to their literal class tokens.
    const tokens = raw
      .split(/[\s${}?:'"]+/)
      .filter(t => /^[a-z][a-z0-9-]*$/.test(t));
    if (!tokens.length) continue;

    if (!asRoot.has(tokens[0])) asRoot.set(tokens[0], rel);
    for (const t of tokens.slice(1)) {
      if (!asModifier.has(t)) asModifier.set(t, { file: rel, attr: raw.trim().slice(0, 56) });
    }
  }
}

const problems = [];
for (const [cls, sheet] of risky) {
  if (!asRoot.has(cls) || !asModifier.has(cls)) continue;
  problems.push({ cls, sheet, root: asRoot.get(cls), mod: asModifier.get(cls) });
}

/* ------------------------------------------------------------------------- */

console.log('\nClass collisions\n');
console.log(`  ${risky.size} single-word rule(s) with layout, ${files.length} markup files scanned.\n`);

if (problems.length === 0) {
  console.log('  No word is serving as both a component root and a modifier.\n');
  process.exit(0);
}

for (const p of problems) {
  console.log(`  .${p.cls}  (${p.sheet})`);
  console.log(`      as a root     ${p.root}`);
  console.log(`      as a modifier ${p.mod.file}  class="${p.mod.attr}"\n`);
}
console.log('  One word cannot be both. Give the component root a hyphenated name.\n');
process.exit(1);
