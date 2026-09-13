/**
 * brand-test.cjs
 * Catches the one branding bug that has now shipped twice.
 *
 * ------------------------------------------------------------------------
 * THE BUG
 * ------------------------------------------------------------------------
 * tokens.css declares, on :root:
 *
 *     --gd-accent: var(--brand-accent);
 *
 * That RESOLVES on :root, against the default red. Setting --brand-accent on a
 * descendant later does nothing to it, because descendants inherit the
 * already-computed value rather than the expression. It is one of the few
 * genuinely counter-intuitive corners of custom properties, and it fails
 * silently: the variable is set, the page looks wrong, and nothing errors.
 *
 * It shipped once on the storefront (The Med Bar's page rendered Gameday's red
 * while her kit said gold) and was fixed by re-deriving the chain inside `.sf`.
 * It then shipped again on the console, because the fix was applied to one
 * surface and the other was never checked.
 *
 * ------------------------------------------------------------------------
 * WHAT THIS ASSERTS
 * ------------------------------------------------------------------------
 * Every token tokens.css derives from a --brand-* value must be re-derived in
 * BOTH places that apply a tenant's kit: components/Brand.tsx for the console
 * and portal, and the `.sf` block in storefront.css for the public page.
 *
 * So adding a new derived token to tokens.css fails this suite until both
 * consumers know about it. That is the actual protection — not a colour
 * comparison, which would need a browser, but a structural rule that makes the
 * omission impossible to miss.
 *
 * Run:  node scripts/brand-test.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (m, n) => { pass++; console.log(`  ✓ ${m}${n ? '  ' + n : ''}`); };
const bad = (m, e) => { fail++; console.log(`  ✗ ${m}`); if (e) console.log('      ' + e); };

const tokens = read('prototype/assets/tokens.css');
const brandTsx = read('components/Brand.tsx');
const storefrontCss = read('prototype/assets/storefront.css');

console.log('\nBRAND KIT — every derived token reaches every surface\n');

/* ------------------------------------------------------------------------
   1. Which tokens does :root derive from --brand-* ?
   ------------------------------------------------------------------------ */
const rootBlock = tokens.slice(tokens.indexOf(':root'), tokens.indexOf('}', tokens.indexOf(':root')));

const derived = [...rootBlock.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]*var\(--brand-[^;]*)/gim)]
  .map(m => ({ token: m[1].trim(), value: m[2].trim() }))
  // --brand-display-font derives from --brand-font, which is a brand token
  // defining another brand token rather than a themed one. Both consumers set
  // it explicitly, so it is checked like the rest.
  .filter(d => d.token !== '--gd-r-md' || true);

if (derived.length === 0) {
  bad('found the derived tokens in tokens.css', 'the :root parse returned nothing — did the file move?');
} else {
  ok(`found ${derived.length} token(s) derived from the brand kit`,
     derived.map(d => d.token).join(' '));
}

/* ------------------------------------------------------------------------
   2. The console path — components/Brand.tsx
   ------------------------------------------------------------------------ */
console.log('\nCONSOLE (components/Brand.tsx)');

for (const { token } of derived) {
  if (brandTsx.includes(`'${token}'`) || brandTsx.includes(`"${token}"`)) {
    ok(`re-derives ${token}`);
  } else {
    bad(`re-derives ${token}`,
        `tokens.css computes it from --brand-* on :root, so it resolves to the ` +
        `DEFAULT and the tenant's value is ignored. Add it to Brand.tsx.`);
  }
}

// It must reach :root, not a wrapper — body's background is declared on an
// ancestor of anything this component renders.
if (/:root\{/.test(brandTsx)) {
  ok('applies the kit at :root', 'so body repaints too, not only the panels');
} else {
  bad('applies the kit at :root',
      'body { background: var(--gd-bg) } is on an ancestor; a wrapper cannot reach it');
}

// The practice's own ground, not just its accent.
for (const surface of ['--gd-bg', '--gd-surface', '--gd-surface-raised', '--gd-border']) {
  if (brandTsx.includes(surface)) ok(`carries ${surface} from the kit`);
  else bad(`carries ${surface} from the kit`, 'the console will stay neutral while the public page is branded');
}

/* ------------------------------------------------------------------------
   3. The storefront path — the .sf block
   ------------------------------------------------------------------------ */
console.log('\nSTOREFRONT (.sf in storefront.css)');

const sfStart = storefrontCss.indexOf('.sf {');
const sfBlock = sfStart === -1 ? '' : storefrontCss.slice(sfStart, storefrontCss.indexOf('}', sfStart));

if (!sfBlock) {
  bad('found the .sf block', 'storefront.css no longer opens with `.sf {`');
} else {
  for (const { token } of derived) {
    // The storefront sets fonts and radii through its own names too; accept
    // either the token itself or an explicit re-declaration.
    if (sfBlock.includes(token)) ok(`re-derives ${token}`);
    else bad(`re-derives ${token}`, 'the public page will render in the default accent');
  }
}

/* ------------------------------------------------------------------------
   4. The fallback must be a real colour, not a tenant's
   ------------------------------------------------------------------------ */
console.log('\nDEFAULTS');

const fallback = (brandTsx.match(/hexToRgb\(brand\.accent\)\s*\?\s*brand\.accent\s*:\s*'(#[0-9a-f]{6})'/i) || [])[1];
if (fallback) ok('a practice with no accent gets a defined fallback', fallback);
else bad('a practice with no accent gets a defined fallback', 'no literal fallback found in Brand.tsx');

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
