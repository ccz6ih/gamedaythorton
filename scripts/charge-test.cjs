/**
 * charge-test.cjs
 * The custom-charge path: who may name a price, and does the arithmetic hold.
 *
 * This is the one place in the system where the CALLER supplies the amount, so
 * the guard is different from the shop's and deserves its own proof. In the
 * shop a price is not an input at all; here it is the whole feature, and the
 * control is "only staff of this practice".
 *
 * Run:  node scripts/charge-test.cjs
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.MEDBAR_OWNER_EMAIL ?? 'themedbar.co@gmail.com';
const PW = process.env.MEDBAR_OWNER_PASSWORD;

let pass = 0, fail = 0;
const ok = (m, n) => { pass++; console.log(`  ✓ ${m}${n ? '  ' + n : ''}`); };
const bad = (m, e) => { fail++; console.log(`  ✗ ${m}`); if (e) console.log('      ' + String(e).slice(0, 240)); };

async function signIn() {
  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PW })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.msg || `${r.status}`);
  return j.access_token;
}

function rpcWith(token) {
  return async (fn, args) => {
    const headers = { apikey: KEY, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${URL_SB}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers, body: JSON.stringify(args)
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

(async () => {
  console.log('\nCUSTOM CHARGES — only staff may name a price\n');

  if (!URL_SB || !KEY) { console.error('  Missing Supabase config.\n'); process.exit(1); }
  if (!PW) { console.log('  SKIPPED: MEDBAR_OWNER_PASSWORD is not set.\n'); process.exit(0); }

  const anon = rpcWith(null);
  const token = await signIn();
  const staff = rpcWith(token);
  ok('signed in as staff');

  // The clinic id, read as staff.
  const clinicRes = await fetch(`${URL_SB}/rest/v1/clinic_public?select=id&limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` }
  });
  const clinicId = (await clinicRes.json())[0]?.id;
  if (!clinicId) { bad('found the clinic'); process.exit(1); }

  const raised = [];

  /* ===================================================================
     1. ANONYMOUS CANNOT RAISE A CHARGE
     =================================================================== */
  console.log('\nA STRANGER CANNOT NAME A PRICE');

  const byAnon = await anon('custom_charge_create', {
    p_clinic: clinicId,
    p_lines: [{ name: 'Free stuff', amount_cents: 1, qty: 1 }],
    p_name: 'Charge Test', p_email: 'charge-test@example.invalid'
  });
  if (byAnon.status >= 400) ok('anon cannot raise a charge', `refused (${byAnon.status})`);
  else { bad('anon cannot raise a charge', 'a stranger priced their own treatment'); }

  const paidByAnon = await anon('custom_charge_mark_paid', {
    p_order: '00000000-0000-0000-0000-000000000000'
  });
  if (paidByAnon.status >= 400) ok('anon cannot mark a charge paid', `refused (${paidByAnon.status})`);
  else bad('anon cannot mark a charge paid');

  /* ===================================================================
     2. THE ARITHMETIC
     =================================================================== */
  console.log('\nTHE ARITHMETIC HOLDS');

  // $10.00 x 3 less $1.00 = $29.00 — the case that cannot be expressed as a
  // whole-cent unit price, and the reason Stripe lines are sent as line totals.
  const awkward = await staff('custom_charge_create', {
    p_clinic: clinicId,
    p_lines: [{ name: 'Awkward line', amount_cents: 1000, qty: 3, discount_cents: 100 }],
    p_name: 'Charge Test', p_email: 'charge-test@example.invalid',
    p_taxable: false
  });

  if (awkward.status < 300 && awkward.body) {
    raised.push(awkward.body.order_id);
    if (awkward.body.subtotal_cents === 2900 && awkward.body.total_cents === 2900) {
      ok('a per-line discount is exact', '$10.00 x3 less $1.00 = $29.00');
    } else {
      bad('a per-line discount is exact',
          `subtotal ${awkward.body.subtotal_cents}, total ${awkward.body.total_cents}`);
    }
  } else {
    bad('staff can raise a charge', JSON.stringify(awkward.body).slice(0, 200));
  }

  const discounted = await staff('custom_charge_create', {
    p_clinic: clinicId,
    p_lines: [{ name: 'Service', amount_cents: 20000, qty: 1 }],
    p_name: 'Charge Test', p_email: 'charge-test@example.invalid',
    p_discount: 5000, p_discount_note: 'Friends and family', p_taxable: false
  });
  if (discounted.status < 300 && discounted.body?.total_cents === 15000) {
    raised.push(discounted.body.order_id);
    ok('an order-level discount comes off the total', '$200 less $50 = $150');
  } else {
    bad('an order-level discount comes off the total', JSON.stringify(discounted.body).slice(0, 200));
  }

  /* ===================================================================
     3. NONSENSE IS REFUSED RATHER THAN FLOORED
     =================================================================== */
  console.log('\nNONSENSE IS REFUSED, NOT QUIETLY FIXED');

  const overDiscounted = await staff('custom_charge_create', {
    p_clinic: clinicId,
    p_lines: [{ name: 'Small thing', amount_cents: 1000, qty: 1, discount_cents: 5000 }],
    p_name: 'Charge Test', p_email: 'charge-test@example.invalid'
  });
  if (overDiscounted.status >= 400) {
    ok('a discount larger than its line is refused', `refused (${overDiscounted.status})`);
  } else {
    raised.push(overDiscounted.body?.order_id);
    bad('a discount larger than its line is refused',
        'flooring it to zero hides a typo until somebody reconciles');
  }

  const negative = await staff('custom_charge_create', {
    p_clinic: clinicId,
    p_lines: [{ name: 'Refund-ish', amount_cents: -5000, qty: 1 }],
    p_name: 'Charge Test', p_email: 'charge-test@example.invalid'
  });
  if (negative.status >= 400) ok('a negative line is refused', `refused (${negative.status})`);
  else { raised.push(negative.body?.order_id); bad('a negative line is refused'); }

  const nothing = await staff('custom_charge_create', {
    p_clinic: clinicId,
    p_lines: [{ name: 'Thing', amount_cents: 5000, qty: 1 }],
    p_name: 'Charge Test', p_email: 'charge-test@example.invalid',
    p_discount: 5000, p_taxable: false
  });
  if (nothing.status >= 400) ok('a charge that comes to nothing is refused', `refused (${nothing.status})`);
  else { raised.push(nothing.body?.order_id); bad('a charge that comes to nothing is refused'); }

  const noLines = await staff('custom_charge_create', {
    p_clinic: clinicId, p_lines: [],
    p_name: 'Charge Test', p_email: 'charge-test@example.invalid'
  });
  if (noLines.status >= 400) ok('an empty charge is refused', `refused (${noLines.status})`);
  else bad('an empty charge is refused');

  /* ===================================================================
     4. A WEBSITE ORDER CANNOT BE MARKED PAID BY HAND
     =================================================================== */
  console.log('\nA WEBSITE ORDER STILL SETTLES THROUGH STRIPE ONLY');

  // Whatever shop orders exist, none may be marked paid from the console —
  // otherwise our record and Stripe's could disagree with nothing to catch it.
  const shopRes = await fetch(
    `${URL_SB}/rest/v1/shop_order?select=id&kind=eq.shop&status=eq.pending&limit=1`,
    { headers: { apikey: KEY, Authorization: `Bearer ${token}` } });
  const shopOrder = (await shopRes.json().catch(() => []))[0];

  if (shopOrder) {
    const attempt = await staff('custom_charge_mark_paid', { p_order: shopOrder.id });
    if (attempt.status >= 400) ok('a shop order cannot be marked paid by hand', `refused (${attempt.status})`);
    else bad('a shop order cannot be marked paid by hand', 'our record could now disagree with Stripe');
  } else {
    ok('no pending shop order to test against', 'skipped');
  }

  /* ===================================================================
     5. PAYING IN THE ROOM
     =================================================================== */
  console.log('\nMONEY TAKEN IN THE ROOM IS RECORDABLE');

  if (raised[0]) {
    const marked = await staff('custom_charge_mark_paid', { p_order: raised[0], p_method: 'cash' });
    if (marked.status < 300) ok('a custom charge can be marked paid in person');
    else bad('a custom charge can be marked paid in person', JSON.stringify(marked.body).slice(0, 200));

    const twice = await staff('custom_charge_mark_paid', { p_order: raised[0], p_method: 'cash' });
    if (twice.status >= 400) ok('and cannot be marked paid twice', `refused (${twice.status})`);
    else bad('and cannot be marked paid twice', 'the takings would double-count');
  }

  /* ------------------------------------------------------------ cleanup -- */
  console.log('\nCLEANUP');
  const { Client } = require('pg');
  const ref = process.env.SUPABASE_PROJECT_REF;
  const dbpw = process.env.SUPABASE_DB_PASSWORD;

  if (!ref || !dbpw) {
    bad('test charges removed', 'no database credentials; rows are still on the orders screen');
  } else {
    const region = process.env.SUPABASE_REGION || 'us-east-1';
    const admin = new Client({
      connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(dbpw)}@aws-0-${region}.pooler.supabase.com:6543/postgres`
    });
    await admin.connect();
    await admin.query(
      `delete from shop_order where contact_email = 'charge-test@example.invalid'`);
    const { rows } = await admin.query(
      `select count(*)::int as n from shop_order where contact_email = 'charge-test@example.invalid'`);
    await admin.end();

    if (rows[0].n === 0) ok('test charges removed', 'and verified gone');
    else bad('test charges removed', `${rows[0].n} left on the orders screen`);
  }

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
