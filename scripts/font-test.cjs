/**
 * font-test.cjs
 * Which face actually wins on the elements that are meant to be UI.
 *
 *   node scripts/font-test.cjs
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * The interface face was applied in one appended block:
 *
 *   .sf-btn, .sf-eyebrow, .sf-nav-links .sf-link, … { font-family: var(--brand-ui-font) }
 *
 * The rule shipped, the custom property was set correctly on the storefront
 * root, the font file served — and the navigation still rendered in the display
 * serif, because an existing `.sf-nav a.sf-link` rule carried one more element
 * in its selector and quietly won. Six more rules were doing the same to the
 * prices, the stat numerals and the routine tag.
 *
 * Nothing about that is visible from reading either rule on its own, and
 * nothing errors. The page just looks unchanged, which is exactly what it did.
 *
 * So this resolves the cascade: for every element the design says belongs in
 * the UI face, it finds every rule in the stylesheet that could set a font on
 * it, ranks them by specificity and then source order, and reports the winner.
 * A regression here is somebody adding a more specific rule later, which is the
 * one thing that cannot be caught by looking at the rule you just wrote.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSS = ['prototype/assets/storefront.css'];

/**
 * The elements the split puts in the interface face.
 *
 * Deliberately a hand-written list rather than derived from the CSS: the point
 * is to assert the DESIGN decision, and deriving it from the rules would make
 * the test agree with whatever the stylesheet currently happens to do.
 */
const SHOULD_BE_UI = [
  { el: 'a', classes: ['sf-link'], within: ['sf-nav', 'sf-nav-links'], what: 'nav links' },
  { el: 'a', classes: ['sf-btn', 'primary'], within: ['sf-nav'], what: 'the Book button' },
  { el: 'a', classes: ['sf-btn'], within: ['sf'], what: 'buttons' },
  { el: 'div', classes: ['sf-eyebrow'], within: ['sf'], what: 'eyebrows' },
  { el: 'span', classes: ['sf-chip'], within: ['sf'], what: 'chips' },
  { el: 'a', classes: ['sf-jump-link'], within: ['sf'], what: 'the category rail' },
  { el: 'a', classes: ['sf-item-reserve'], within: ['sf'], what: 'reserve buttons' },
  { el: 'span', classes: ['amount'], within: ['sf', 'sf-item-price'], what: 'service prices' },
  { el: 'span', classes: ['sf-card-price'], within: ['sf'], what: 'product prices' },
  { el: 'span', classes: ['sf-product-price'], within: ['sf'], what: 'the product page price' },
  { el: 'span', classes: ['val'], within: ['sf', 'sf-matrix-stat'], what: 'stat numerals' },
  { el: 'span', classes: ['sf-step-idx'], within: ['sf', 'sf-step-pill'], what: 'routine step numbers' },
  { el: 'div', classes: ['sf-product-routine-tag'], within: ['sf'], what: 'the routine tag' },
  { el: 'button', classes: ['sf-finder-pill'], within: ['sf'], what: 'finder pills' },
  { el: 'dl', classes: ['sf-product-spec'], within: ['sf'], what: 'the product spec row' }
];

/** These must STAY in the display serif. A test that only pushes one way would
 *  be satisfied by setting the whole site in sans, which is not the decision. */
const SHOULD_BE_DISPLAY = [
  { el: 'h1', classes: ['sf-display'], within: ['sf'], what: 'the hero heading' },
  { el: 'h2', classes: [], within: ['sf', 'sf-section-head'], what: 'section headings' }
];

function readCss() {
  return CSS.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
}

/** Strips comments so a selector quoted in prose is not parsed as a rule. */
function strip(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** [ids, classes, elements] — enough for the selectors this stylesheet uses. */
function specificity(sel) {
  const s = sel.replace(/::?[a-z-]+(\([^)]*\))?/g, m => (m.startsWith('::') ? ' ELEMENT ' : ' CLASS '));
  return [
    (s.match(/#[\w-]+/g) || []).length,
    (s.match(/\.[\w-]+/g) || []).length + (s.match(/CLASS/g) || []).length + (s.match(/\[[^\]]*\]/g) || []).length,
    (s.match(/\b(?:a|div|span|h[1-6]|p|button|input|select|textarea|dl|dt|dd|li|ul|table|th|td|nav|section|article|small|i|b)\b/g) || []).length
      + (s.match(/ELEMENT/g) || []).length
  ];
}

function cmp(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/**
 * Does this compound selector match the element?
 *
 * Only the forms this stylesheet actually uses — descendant combinators of
 * classes and element names. Anything cleverer is reported as unmatched rather
 * than guessed at, which keeps a false pass impossible.
 */
function matches(selector, node) {
  const parts = selector.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  const ancestors = parts.slice(0, -1);

  const own = [...(last.match(/\.[\w-]+/g) || []).map(c => c.slice(1))];
  const ownEl = (last.match(/^[a-z][a-z0-9]*/) || [])[0];

  if (ownEl && ownEl !== node.el) return false;
  if (!own.every(c => node.classes.includes(c))) return false;

  // Every ancestor part must be satisfied by something in `within`, in order.
  let i = 0;
  for (const part of ancestors) {
    const need = (part.match(/\.[\w-]+/g) || []).map(c => c.slice(1));
    const needEl = (part.match(/^[a-z][a-z0-9]*/) || [])[0];
    let found = false;
    while (i < node.within.length) {
      const anc = node.within[i++];
      if (need.every(c => anc === c) && (!needEl || needEl === 'div' || true)) { found = true; break; }
    }
    if (!found) return false;
  }
  return true;
}

function winnerFor(css, node) {
  const rules = [...strip(css).matchAll(/([^{}]+)\{([^}]*)\}/g)];
  let best = null;
  rules.forEach(([, selectorList, body], order) => {
    const decl = (body.match(/font-family\s*:\s*([^;]+)/) || [])[1];
    if (!decl) return;
    for (const sel of selectorList.split(',')) {
      if (!matches(sel, node)) continue;
      const spec = specificity(sel);
      if (!best || cmp(spec, best.spec) > 0 || (cmp(spec, best.spec) === 0 && order >= best.order)) {
        best = { spec, order, decl: decl.trim(), sel: sel.trim() };
      }
    }
  });
  return best;
}

function main() {
  const css = readCss();
  let pass = 0;
  const fails = [];

  console.log('\n  WHICH FACE WINS, after specificity and source order\n');

  for (const [group, want, label] of [
    [SHOULD_BE_UI, 'brand-ui-font', 'interface'],
    [SHOULD_BE_DISPLAY, 'brand-display-font', 'display']
  ]) {
    console.log(`  ${label.toUpperCase()}`);
    for (const node of group) {
      const w = winnerFor(css, node);
      const got = w?.decl ?? '(inherited)';
      const ok = w ? got.includes(want) : want === 'brand-display-font';
      if (ok) { pass++; console.log(`    ok    ${node.what}`); }
      else {
        fails.push({ node, w, want });
        console.log(`    FAIL  ${node.what}`);
        console.log(`            wants ${want}, gets ${got}`);
        if (w) console.log(`            from "${w.sel}"  specificity ${w.spec.join(',')}`);
      }
    }
    console.log('');
  }

  console.log(`  ${pass} correct, ${fails.length} wrong.`);
  if (fails.length) {
    console.log('\n  A rule with more classes or elements in its selector beats the');
    console.log('  general one, silently. Fix it where it is declared rather than');
    console.log('  adding specificity on top.\n');
  } else {
    console.log('');
  }
  return fails.length ? 1 : 0;
}

process.exit(main());
