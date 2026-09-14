/**
 * css-test.cjs
 * Every storefront class in the markup must have a rule somewhere.
 *
 *   node scripts/css-test.cjs            # fail on anything unstyled
 *   node scripts/css-test.cjs --list     # just print what is missing
 *
 * ------------------------------------------------------------------------
 * WHY THIS IS A TEST AND NOT A LINT PREFERENCE
 * ------------------------------------------------------------------------
 * A class name in JSX that no stylesheet defines is invisible in every way
 * that normally catches a mistake. TypeScript is happy — it is a string.
 * The build is happy. Nothing throws, nothing warns, the page returns 200,
 * and the only symptom is that a section looks like undecorated HTML.
 *
 * It has happened five times on this project. Two SEO guide pages shipped with
 * thirty undefined classes between them and rendered as stacked divs with
 * browser-default <details> triangles. Three more shipped the same way a day
 * later. `.sf-product-buy` lost its rule in a refactor while staying in the
 * markup, so the quantity stepper and the add button laid out as raw inline
 * blocks on every product page. `.sf-error` never had a rule at all, which
 * meant a failed booking printed its message in the same colour and size as
 * the copy around it.
 *
 * The near-miss is the worst version: `sf-btn-primary` where the component is
 * `sf-btn primary`. It reads correctly, it reviews correctly, and it produces
 * a call-to-action button rendered as a bare link.
 *
 * ------------------------------------------------------------------------
 * WHAT IT DELIBERATELY DOES NOT CHECK
 * ------------------------------------------------------------------------
 * Only `sf-*`, the storefront's own prefix. The console has its own
 * conventions and utility classes from elsewhere are not ours to police.
 *
 * Classes that exist purely as hooks — SVG group wrappers that JavaScript or a
 * keyframe targets, never CSS — are listed in ALLOWED below with the reason.
 * An allowlist entry is a decision; an unexplained one is a bug in waiting.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIST_ONLY = process.argv.includes('--list');

const STYLESHEETS = [
  'prototype/assets/storefront.css',
  'prototype/assets/tokens.css',
  'prototype/assets/app.css',
  'app/app-extras.css'
];

const SCAN = ['app/c', 'components'];

/**
 * Classes with no rule, on purpose.
 *
 * The service line art puts a class on each <g> so the drawing is readable in
 * the DOM and so a future animation has something to hang off. They carry no
 * layout, and giving them empty rules to satisfy a script would be worse than
 * listing them here.
 */
const ALLOWED = new Set([
  // Structural markers inside ServiceIcon's SVGs.
  'sf-art-backpeel', 'sf-art-classic-lash', 'sf-art-clearing', 'sf-art-consult',
  'sf-art-dermaplane', 'sf-art-firming', 'sf-art-glow', 'sf-art-hair',
  'sf-art-hybrid-lash', 'sf-art-hydro', 'sf-art-led', 'sf-art-micro',
  'sf-art-nano', 'sf-art-peel', 'sf-art-rf', 'sf-art-scar', 'sf-art-syringe',
  'sf-art-under-eye', 'sf-art-volume-lash', 'sf-art-wax', 'sf-art-wellness',
  'sf-blade-body', 'sf-hydro-drop', 'sf-matrix-dot',
  'sf-scar-stipple-1', 'sf-scar-stipple-2'
]);

function readStylesheets() {
  let css = '';
  for (const f of STYLESHEETS) {
    try { css += '\n' + fs.readFileSync(path.join(ROOT, f), 'utf8'); }
    catch { /* an optional stylesheet is not an error */ }
  }
  return css;
}

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

function main() {
  const css = readStylesheets();

  const defined = new Set();
  for (const m of css.matchAll(/\.(sf-[a-zA-Z0-9_-]+)/g)) defined.add(m[1]);

  const files = SCAN.flatMap(d => walk(path.join(ROOT, d)));

  /**
   * Every className, including the template-literal forms.
   *
   * `className={`sf-pill ${active ? 'is-active' : ''}`}` has to yield sf-pill,
   * so the whole attribute value is swept for bare sf-* tokens rather than
   * assuming a plain string.
   */
  const used = new Map();
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{([^}]*(?:\}[^}]*)??)\})/g)) {
      const value = m[1] ?? m[2] ?? '';
      for (const t of value.matchAll(/\bsf-[a-zA-Z0-9_-]+/g)) {
        const cls = t[0];
        /**
         * A composed name, e.g. `sf-story-card-${i}`. The literal part ends in
         * a hyphen because the interpolation was cut off, so there is no fixed
         * class to look for and reporting the stub is noise.
         */
        if (cls.endsWith('-')) continue;
        if (!used.has(cls)) used.set(cls, new Set());
        used.get(cls).add(path.relative(ROOT, file).replace(/\\/g, '/'));
      }
    }
  }

  const missing = [...used.keys()]
    .filter(c => !defined.has(c) && !ALLOWED.has(c))
    .sort();

  console.log(`\n  ${used.size} sf-* classes in markup, ${defined.size} defined in css.`);

  if (!missing.length) {
    console.log(`  Every class has a rule (${ALLOWED.size} allowlisted hooks skipped).\n`);
    return 0;
  }

  const byFile = new Map();
  for (const c of missing) {
    for (const f of used.get(c)) {
      if (!byFile.has(f)) byFile.set(f, []);
      byFile.get(f).push(c);
    }
  }

  console.log(`\n  ${missing.length} CLASS(ES) WITH NO CSS RULE:\n`);
  for (const [f, cs] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`    ${f}  (${cs.length})`);
    console.log(`        ${cs.join(', ')}`);
  }

  /**
   * Name a likely cause where one is obvious. A class that differs from a real
   * one only by a hyphen is almost always a modifier written as a compound —
   * `sf-btn-primary` for `sf-btn primary` — and saying so turns a list into a
   * fix.
   */
  const hints = [];
  for (const c of missing) {
    const near = [...defined].find(d => d !== c && (c.startsWith(d + '-') || d.startsWith(c + '-')));
    if (near) hints.push(`    ${c}  →  did you mean "${near}" plus a modifier?`);
  }
  if (hints.length) {
    console.log('\n  LIKELY NEAR-MISSES:');
    console.log(hints.join('\n'));
  }

  console.log('\n  A class with no rule renders as undecorated HTML: no error,');
  console.log('  no warning, a 200, and a section that looks unfinished.\n');

  return LIST_ONLY ? 0 : 1;
}

process.exit(main());
