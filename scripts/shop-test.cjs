/**
 * shop-test.cjs
 * The money path, probed as a hostile stranger with the anon key.
 *
 * WHY THIS EXISTS SEPARATELY FROM storefront-test.cjs
 *
 * That file proves a visitor cannot READ what they should not. This one proves
 * a visitor cannot WRITE what they should not — which is a different and worse
 * class of mistake, because a read leak exposes data while a write hole lets a
 * stranger set their own prices, settle their own orders, or move somebody
 * else's stock.
 *
 * Every check here is an attempt to do something forbidden, and passes only
 * when the database refuses. A test that merely confirms the happy path would
 * have passed against every version of this code, including the broken ones.
 *
 * Run:  node scripts/shop-test.cjs
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ROOT = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
const ok = (m, n) => { pass++; console.log(`  ✓ ${m}${n ? '  ' + n : ''}`); };
const bad = (m, e) => { fail++; console.log(`  ✗ ${m}`); if (e) console.log('      ' + String(e).slice(0, 260)); };

async function anon(pathAndQuery, opts = {}) {
  const res = await fetch(`${URL_SB}/rest/v1/${pathAndQuery}`, {
    ...opts,
    headers: { apikey: KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

const rpc = (fn, args) => anon(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

/** Passes only when the call is refused. An unexpected success is the failure. */
async function refused(label, promise, expectFragment) {
  const { status, body } = await promise;
  const message = JSON.stringify(body ?? '');

  if (status < 400) {
    bad(label, `ALLOWED (${status}) — ${message.slice(0, 200)}`);
    return null;
  }
  if (expectFragment && !message.toLowerCase().includes(expectFragment.toLowerCase())) {
    bad(label, `refused, but for the wrong reason: ${message.slice(0, 200)}`);
    return null;
  }
  ok(label, `refused (${status})`);
  return body;
}

async function cannotRead(label, table) {
  const { status, body } = await anon(`${table}?select=*&limit=5`);
  if (status >= 400) { ok(label, `refused (${status})`); return; }
  if (Array.isArray(body) && body.length === 0) { ok(label, 'returns empty'); return; }
  bad(label, `RETURNED ${Array.isArray(body) ? body.length + ' rows' : 'data'} to a stranger`);
}

(async () => {
  console.log('\nSHOP — the money path, as a hostile anonymous visitor\n');

  if (!URL_SB || !KEY) {
    console.error('  Missing Supabase config in .env.local\n');
    process.exit(1);
  }

  /* =====================================================================
     1. THE ORDER TABLES ARE NOT READABLE OR WRITABLE DIRECTLY
     ===================================================================== */
  console.log('THE ORDER TABLES ARE CLOSED');

  await cannotRead('shop_order is not readable by anon', 'shop_order');
  await cannotRead('shop_order_item is not readable by anon', 'shop_order_item');

  await refused(
    'anon cannot INSERT an order directly',
    anon('shop_order', {
      method: 'POST',
      body: JSON.stringify({
        clinic_id: '00000000-0000-0000-0000-000000000000',
        order_no: 'HACK-0001', contact_name: 'x', contact_email: 'x@example.com',
        subtotal_cents: 1, total_cents: 1
      })
    })
  );

  await refused(
    'anon cannot UPDATE an order to paid',
    anon('shop_order?status=eq.pending', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'paid' })
    })
  );

  /* =====================================================================
     2. SETTLEMENT IS NOT REACHABLE WITHOUT THE SERVICE ROLE
     ===================================================================== */
  console.log('\nSETTLEMENT IS OUT OF REACH');

  await refused(
    'anon cannot call shop_order_mark_paid',
    rpc('shop_order_mark_paid', {
      p_session: 'cs_test_forged', p_intent: 'pi_forged', p_amount: 1
    })
  );

  await refused(
    'anon cannot call shop_order_mark_failed',
    rpc('shop_order_mark_failed', { p_session: 'cs_test_forged', p_status: 'failed' })
  );

  await refused(
    'anon cannot call shop_order_collect',
    rpc('shop_order_collect', { p_order: '00000000-0000-0000-0000-000000000000' })
  );

  /* =====================================================================
     3. THE ORDER FUNCTION REFUSES BAD INPUT
     ===================================================================== */
  console.log('\nTHE ORDER FUNCTION REFUSES BAD INPUT');

  const contact = { p_name: 'Test Person', p_email: 'shop-test@example.com' };

  await refused(
    'an unknown practice is refused',
    rpc('shop_order_create', {
      p_clinic_slug: 'no-such-practice', p_items: [{ product_id: '00000000-0000-0000-0000-000000000000', qty: 1 }],
      ...contact
    }),
    'No such practice'
  );

  await refused(
    'an empty basket is refused',
    rpc('shop_order_create', { p_clinic_slug: 'medbar-loveland', p_items: [], ...contact }),
    'No items'
  );

  await refused(
    'a bad email is refused',
    rpc('shop_order_create', {
      p_clinic_slug: 'medbar-loveland',
      p_items: [{ product_id: '00000000-0000-0000-0000-000000000000', qty: 1 }],
      p_name: 'Test Person', p_email: 'not-an-email'
    }),
    'email'
  );

  /* =====================================================================
     4. THE CENTRAL PROPERTY: A PRICE CANNOT BE SUPPLIED
     ===================================================================== */
  console.log('\nPRICES COME FROM THE DATABASE, NOT THE BASKET');

  // Read a real product the way the shop does, then try to buy it for a dollar.
  const { body: products } = await anon(
    'product?select=id,name,price_cents&clinic_id=not.is.null&limit=1&order=price_cents.desc'
  );
  const product = Array.isArray(products) ? products[0] : null;

  if (!product) {
    bad('could not read a product to test against');
  } else {
    // Every extra key a hopeful attacker might try. The function's signature
    // does not accept them, so PostgREST refuses the call outright — which is
    // the strongest possible form of "you cannot set a price".
    const { status, body } = await rpc('shop_order_create', {
      p_clinic_slug: 'medbar-loveland',
      p_items: [{ product_id: product.id, qty: 1, price_cents: 1, unit_price_cents: 1 }],
      ...contact
    });

    const message = JSON.stringify(body ?? '');

    if (status >= 400) {
      // Refused for some other reason (tax not configured is the common one).
      // Either way no order was created at a forged price.
      ok('a forged price does not produce an order', `refused (${status})`);
    } else if (body && typeof body === 'object') {
      // It went through — so check the database ignored the forged numbers.
      const total = Number(body.total_cents ?? 0);
      const sub = Number(body.subtotal_cents ?? 0);
      if (sub === product.price_cents) {
        ok('the database priced the basket itself', `$${(sub / 100).toFixed(2)} not $0.01`);
      } else {
        bad('the database priced the basket itself',
            `subtotal ${sub} did not match product price ${product.price_cents}`);
      }
      if (total >= sub) ok('total is at least the subtotal');
      else bad('total is at least the subtotal', `${total} < ${sub}`);
    } else {
      bad('a forged price does not produce an order', message.slice(0, 200));
    }
  }

  /* =====================================================================
     4b. THE HAPPY PATH ACTUALLY WORKS
     =====================================================================
     Every other check in this file ends in a deliberate refusal, and for a
     while that was the entire suite. It was green while app.shop_order_create
     was broken on its success path — `p_email::citext` could not resolve under
     `search_path = ''`, so the first real customer would have seen checkout
     fail with "type citext does not exist".

     Nothing caught it because no test ever reached the insert: the refusals all
     raise earlier, and the one check that would have gone through was blocked
     by the practice having no sales tax rate set.

     A suite of refusals proves the guards and says nothing about whether the
     thing works. So this one places a real order end to end. It sets a tax rate
     to get past the not-configured guard and puts the original back afterwards,
     in a finally, so an interrupted run cannot leave the shop misconfigured. */
  console.log('\nAN ORDER CAN ACTUALLY BE PLACED');

  const { Client } = require('pg');
  const ref = process.env.SUPABASE_PROJECT_REF;
  const dbpw = process.env.SUPABASE_DB_PASSWORD;

  if (!ref || !dbpw || !product) {
    console.log('  — skipped: no database credentials to set a tax rate with.');
  } else {
    const region = process.env.SUPABASE_REGION || 'us-east-1';
    const admin = new Client({
      connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(dbpw)}@aws-0-${region}.pooler.supabase.com:6543/postgres`
    });
    await admin.connect();

    const { rows: before } = await admin.query(
      `select sales_tax_bps from clinic where slug = 'medbar-loveland'`);
    const original = before[0]?.sales_tax_bps ?? 0;

    try {
      await admin.query(
        `update clinic set sales_tax_bps = 670 where slug = 'medbar-loveland'`);

      const placed = await rpc('shop_order_create', {
        p_clinic_slug: 'medbar-loveland',
        p_items: [{ product_id: product.id, qty: 2 }],
        p_name: 'Storefront Happy Path',
        p_email: 'shop-happy@example.invalid'
      });

      if (placed.status >= 400) {
        bad('an order goes all the way through', JSON.stringify(placed.body).slice(0, 220));
      } else {
        const o = placed.body;
        const expectSub = product.price_cents * 2;
        const expectTax = Math.round((expectSub * 670) / 10000);

        if (o.subtotal_cents === expectSub) ok('the database priced it', `${o.subtotal_cents} cents`);
        else bad('the database priced it', `expected ${expectSub}, got ${o.subtotal_cents}`);

        if (o.tax_cents === expectTax) ok('tax is computed from the practice rate', `${o.tax_cents} cents at 6.70%`);
        else bad('tax is computed from the practice rate', `expected ${expectTax}, got ${o.tax_cents}`);

        if (o.total_cents === expectSub + expectTax) ok('the total adds up');
        else bad('the total adds up', `${o.subtotal_cents} + ${o.tax_cents} != ${o.total_cents}`);

        if (o.order_no && /^\d{6}-\d{4}$/.test(o.order_no)) ok('it gets an order number', o.order_no);
        else bad('it gets an order number', String(o.order_no));

        // And the session can be attached, which is the other half of checkout.
        const attached = await rpc('shop_order_attach_session', {
          p_order: o.order_id, p_session: 'cs_test_happy_path'
        });
        if (attached.status < 300) ok('a payment session can be attached');
        else bad('a payment session can be attached', JSON.stringify(attached.body).slice(0, 160));
      }
    } finally {
      await admin.query(
        `update clinic set sales_tax_bps = $1 where slug = 'medbar-loveland'`, [original]);
      await admin.query(
        `delete from shop_order where contact_email = 'shop-happy@example.invalid'`);

      const { rows: after } = await admin.query(
        `select sales_tax_bps from clinic where slug = 'medbar-loveland'`);
      if (after[0]?.sales_tax_bps === original) ok('the tax rate was put back', `${original} bps`);
      else bad('the tax rate was put back', `left at ${after[0]?.sales_tax_bps}, should be ${original}`);

      await admin.end();
    }
  }

  /* =====================================================================
     5. THE SERVICE-ROLE CLIENT HAS EXACTLY ONE IMPORTER
     ===================================================================== */
  console.log('\nTHE SERVICE-ROLE CLIENT IS CONTAINED');

  // The enforcement referred to in lib/supabase/service.ts. If someone imports
  // it into a page, this fails — which is the whole point of writing it down
  // as a test rather than as a comment.
  const ALLOWED = ['app/api/stripe/webhook/route.ts'];

  function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.(ts|tsx|cjs|mjs|js)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  const importers = walk(ROOT)
    .filter(f => !f.includes(`${path.sep}scripts${path.sep}`))
    .filter(f => !f.endsWith(path.join('lib', 'supabase', 'service.ts')))
    .filter(f => /from\s+['"][^'"]*supabase\/service['"]/.test(fs.readFileSync(f, 'utf8')))
    .map(f => path.relative(ROOT, f).split(path.sep).join('/'));

  const unexpected = importers.filter(f => !ALLOWED.includes(f));

  if (unexpected.length === 0) {
    ok('only the Stripe webhook imports the service-role client',
       importers.length ? importers.join(', ') : 'no importers yet');
  } else {
    bad('only the Stripe webhook imports the service-role client',
        `also imported by: ${unexpected.join(', ')}`);
  }

  /* =====================================================================
     6. LINKS FOLLOW THE DOMAIN
     ===================================================================== */
  console.log('\nLINKS FOLLOW THE DOMAIN THE VISITOR IS ON');

  const { STOREFRONT_DOMAINS, STOREFRONT_PATHS, isStorefrontPath } =
    await import('../storefront-domains.mjs');

  // The bug this replaced: a visitor on medbarco.com clicking Services landed
  // on medbarco.com/c/medbar-loveland/services.
  const owner = STOREFRONT_DOMAINS['medbarco.com'];
  if (owner === 'medbar-loveland') ok('medbarco.com maps to her practice');
  else bad('medbarco.com maps to her practice', String(owner));

  for (const p of ['/cart', '/shop/thanks']) {
    if (STOREFRONT_PATHS.includes(p)) ok(`${p} is a public storefront path`);
    else bad(`${p} is a public storefront path`, 'missing — it would meet the passcode gate');
    if (isStorefrontPath(p)) ok(`${p} passes isStorefrontPath`);
    else bad(`${p} passes isStorefrontPath`);
  }

  // Every path the nav can produce must be one the rewrite knows about, or the
  // link works on the shared deployment and 404s on her own domain.
  const navPaths = ['/', '/services', '/shop', '/packages', '/about', '/enquire', '/cart'];
  const unrewritten = navPaths.filter(p => !STOREFRONT_PATHS.includes(p));
  if (unrewritten.length === 0) ok('every nav link has a rewrite on her domain');
  else bad('every nav link has a rewrite on her domain', `missing: ${unrewritten.join(', ')}`);

  // The gate must never stand in front of the webhook.
  const middleware = fs.readFileSync(path.join(ROOT, 'middleware.ts'), 'utf8');
  if (/'\/api\/stripe\/webhook'/.test(middleware)) ok('the Stripe webhook is not behind the passcode gate');
  else bad('the Stripe webhook is not behind the passcode gate', 'Stripe cannot enter a passcode');

  /**
   * EVERY REWRITE MUST PRESERVE ITS PATH.
   *
   * The wildcard rule read `/shop/:path*` -> `/c/<slug>/:path*`, which drops
   * the segment: /shop/renew-eye-complex went to /c/<slug>/renew-eye-complex
   * and 404'd. It was wrong from the day it was written and nothing noticed,
   * because no /shop sub-path existed yet — /shop/thanks is an exact entry and
   * matched the rule above it. A wildcard with nothing under it is untested by
   * definition, which is exactly when a check like this earns its place.
   */
  const { default: nextConfig } = await import('../next.config.mjs');
  const { beforeFiles } = await nextConfig.rewrites();

  const broken = beforeFiles.filter(r => {
    const source = r.source.replace(/\/:path\*$/, '');
    const dest = r.destination.replace(/\/:path\*$/, '');
    const wildcard = r.source.endsWith('/:path*');
    // The destination must end with the source path, under the /c/<slug> prefix.
    const expectedTail = source === '/' ? '' : source;
    return wildcard
      ? !dest.endsWith(expectedTail)
      : !r.destination.endsWith(expectedTail);
  });

  if (broken.length === 0) {
    ok(`all ${beforeFiles.length} rewrites keep their path`);
  } else {
    bad('all rewrites keep their path',
        broken.map(r => `${r.source} -> ${r.destination}`).join(' · '));
  }

  // And every storefront path a visitor can reach has a rule for her domain.
  const hostRules = beforeFiles.filter(r =>
    r.has?.some(h => h.type === 'host' && h.value === 'medbarco.com'));
  const covered = new Set(hostRules.map(r => r.source));
  const wanted = ['/', '/services', '/shop', '/cart', '/enquire', '/shop/:path*'];
  const gaps = wanted.filter(p => !covered.has(p));

  if (gaps.length === 0) ok('every storefront path is rewritten on her domain');
  else bad('every storefront path is rewritten on her domain', `missing: ${gaps.join(', ')}`);

  /* =====================================================================
     7. THE SHOP DOES NOT LEAK MARGIN
     ===================================================================== */
  console.log('\nTHE SHOP DOES NOT LEAK WHAT IT COST');

  const { body: costProbe } = await anon('product?select=cost_cents&limit=1');
  if (Array.isArray(costProbe) && costProbe.length && costProbe[0].cost_cents !== undefined) {
    bad('cost_cents is not readable by anon', 'margin is visible to customers');
  } else {
    ok('cost_cents is not readable by anon');
  }

  const { body: acctProbe } = await anon('clinic?select=stripe_account_id&limit=1');
  if (Array.isArray(acctProbe) && acctProbe.length && acctProbe[0].stripe_account_id !== undefined) {
    bad('stripe_account_id is not readable by anon');
  } else {
    ok('stripe_account_id is not readable by anon');
  }

  const { body: taxProbe } = await anon('clinic?select=sales_tax_bps,track_stock&slug=eq.medbar-loveland');
  if (Array.isArray(taxProbe) && taxProbe.length && taxProbe[0].sales_tax_bps !== undefined) {
    ok('sales_tax_bps IS readable — the shop must show a total', `${taxProbe[0].sales_tax_bps} bps`);
  } else {
    bad('sales_tax_bps IS readable', 'the basket cannot compute a total without it');
  }

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
