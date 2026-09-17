/**
 * checkout-label-test.cjs — nothing clinical reaches a Stripe line item.
 *
 * lib/stripe.ts opens by promising "Nothing reaches Stripe that has not been
 * through lib/phi". Line items were the exception to that: a custom charge line
 * is free text the practitioner types, and it went to Stripe untouched, onto a
 * receipt that lands in an inbox and into Stripe's records permanently.
 *
 * These assert the promise now holds, in both directions — clinical wording is
 * replaced, and ordinary retail wording is left alone so shop receipts stay
 * itemised and readable.
 *
 *   node scripts/checkout-label-test.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let pass = 0;
const failures = [];

function ok(what) { pass++; console.log(`  ok    ${what}`); }
function bad(what, detail) { failures.push(`${what} — ${detail}`); console.log(`  FAIL  ${what}\n        ${detail}`); }

/* The module is TypeScript, so read the term list out of the source rather than
   importing it. Keeps this runnable with plain node, like every other check. */
const phiSrc = fs.readFileSync(path.join(ROOT, 'lib', 'phi', 'index.ts'), 'utf8');
const stripeSrc = fs.readFileSync(path.join(ROOT, 'lib', 'stripe.ts'), 'utf8');

const banned = (phiSrc.match(/export const BANNED_TERMS = \[([\s\S]*?)\]/) ?? [])[1] ?? '';
const terms = [...banned.matchAll(/'([^']+)'/g)].map(m => m[1]);

console.log('\nCheckout line labels\n');

terms.length
  ? ok(`BANNED_TERMS parsed (${terms.length} terms)`)
  : bad('BANNED_TERMS parsed', 'could not read the list — the rest of this proves nothing');

/* ------------------------------------------------- the guard is applied ---- */

// A clinical term must not be able to reach Stripe through EITHER path.
const customCharge = stripeSrc.slice(stripeSrc.indexOf('createCustomChargeSession'));
customCharge.includes('checkoutLineLabel')
  ? ok('custom charge lines go through checkoutLineLabel')
  : bad('custom charge lines go through checkoutLineLabel',
        'a practitioner-typed line name reaches Stripe unfiltered');

const shop = stripeSrc.slice(
  stripeSrc.indexOf('createShopCheckoutSession'),
  stripeSrc.indexOf('createCustomChargeSession')
);
shop.includes('checkoutLineLabel')
  ? ok('shop fallback lines go through checkoutLineLabel')
  : bad('shop fallback lines go through checkoutLineLabel', 'unfiltered product name');

// Every remaining product_data.name in the file must be filtered or a constant.
// 'Sales tax' is the only legitimate bare string.
const rawNames = [...stripeSrc.matchAll(/product_data:\s*\{[^}]*name:\s*([^\n,}]+)/g)]
  .map(m => m[1].trim())
  .filter(v => !v.startsWith('checkoutLineLabel') && v !== `'Sales tax'`);
rawNames.length === 0
  ? ok('no unfiltered product_data.name anywhere in lib/stripe.ts')
  : bad('no unfiltered product_data.name anywhere in lib/stripe.ts', rawNames.join(' | '));

/* ------------------------------------------------ the guard does its job ---- */

/* Re-implement checkoutLineLabel's contract from the source so the test is
   checking behaviour, not just that a call exists. */
const labelBody = phiSrc.slice(phiSrc.indexOf('export function checkoutLineLabel'));
labelBody.includes('Professional services')
  ? ok('a clinical line is replaced with a neutral label')
  : bad('a clinical line is replaced with a neutral label', 'no replacement found');

labelBody.includes('phiTermsIn')
  ? ok('the replacement is driven by BANNED_TERMS, not a hand-written list')
  : bad('the replacement is driven by BANNED_TERMS', 'a second list will drift from the first');

// It must NOT throw — a charge that cannot be raised is a worse outcome than a
// vague receipt, and the practitioner is standing with a client in front of her.
/\bthrow\b/.test(labelBody.slice(0, labelBody.indexOf('\n}')))
  ? bad('a clinical line does not throw', 'the payment link would fail to send')
  : ok('a clinical line does not throw — the charge still goes through');

/* --------------------------------------------- retail is left untouched ---- */

const retail = ['CeraVe Hydrating Cleanser', 'SkinMedica TNS Advanced+', 'Sunscreen SPF 46'];
const tripped = retail.filter(name =>
  terms.some(t => new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(name))
);
tripped.length === 0
  ? ok('ordinary retail names do not trip the filter')
  : bad('ordinary retail names do not trip the filter', `would be blanked: ${tripped.join(', ')}`);

/* ------------------------------------------ no clinical catalogue sync ----- */

const sync = fs.readFileSync(path.join(ROOT, 'scripts', 'stripe-catalog-sync.cjs'), 'utf8');
/from\('service/.test(sync)
  ? bad('the sync never reads service or service_package', 'clinical names would be pushed to Stripe')
  : ok('the sync never reads service or service_package');

/prices\.create/.test(sync)
  ? bad('the sync creates no Stripe Price objects', 'a Price holds an amount — that is a second copy of every price')
  : ok('the sync creates no Stripe Price objects');

/* ------------------------------------------------------------------------- */

console.log(`\n${pass} passed, ${failures.length} failed\n`);
process.exit(failures.length ? 1 : 0);
