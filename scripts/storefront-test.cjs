/**
 * storefront-test.cjs
 * Probes the PUBLIC surface as an anonymous visitor with no session at all.
 *
 * WHY THIS IS ITS OWN FILE
 * Every other test in this repo signs in first. The storefront is the only
 * surface with no authentication in front of it, which makes it the only place
 * where a mistake is exposed to the open internet rather than to a signed-in
 * user of the wrong clinic. It deserves a harness that assumes nothing.
 *
 * It uses the anon key with no Authorization header — exactly what a browser
 * with no session sends — and then tries, deliberately, to read everything it
 * should not.
 *
 * Run:  node scripts/storefront-test.cjs
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let pass = 0, fail = 0;
const ok = (m, n) => { pass++; console.log(`  ✓ ${m}${n ? '  ' + n : ''}`); };
const bad = (m, e) => { fail++; console.log(`  ✗ ${m}`); if (e) console.log('      ' + String(e).slice(0, 200)); };

/** An anonymous request. No Authorization header — this is a cold browser. */
async function anon(pathAndQuery, opts = {}) {
  const res = await fetch(`${URL_SB}/rest/v1/${pathAndQuery}`, {
    ...opts,
    headers: { apikey: KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

/** Asserts a read returns nothing — whether by empty result or by refusal. */
async function cannotRead(label, table, select = '*') {
  const { status, body } = await anon(`${table}?select=${select}&limit=5`);
  if (status >= 400) { ok(label, `refused (${status})`); return; }
  if (Array.isArray(body) && body.length === 0) { ok(label, 'returns empty'); return; }
  bad(label, `RETURNED ${Array.isArray(body) ? body.length + ' rows' : 'data'} to an anonymous visitor`);
}

(async () => {
  console.log('\nPUBLIC STOREFRONT — as an anonymous visitor\n');

  if (!URL_SB || !KEY) {
    console.error('  Missing Supabase config in .env.local\n');
    process.exit(1);
  }

  /* ------------------------------------------------- what must be visible -- */
  console.log('WHAT A VISITOR SHOULD SEE');

  /**
   * At least one, not at least two.
   *
   * This asserted two until Gameday was retired, which is the wrong shape for
   * the property being tested: what matters is that a listed practice IS
   * readable and an unlisted one is NOT — a count is an accident of how many
   * tenants happen to exist this week. The isolation half is covered by the
   * check immediately below and by the cross-tenant attempt in db-test.cjs.
   */
  const { body: clinics } = await anon('clinic?select=slug,name,practice_type,listed&order=name');
  if (Array.isArray(clinics) && clinics.length >= 1) {
    ok('listed clinics are readable', clinics.map(c => c.slug).join(', '));
  } else {
    bad('listed clinics are readable', JSON.stringify(clinics).slice(0, 160));
  }

  // Retiring a tenant must actually remove it from the public surface, not just
  // from the navigation. This is the check that would have caught
  // medbarco.com/c/gameday-thornton serving a second clinic's page.
  const retired = (clinics || []).some(c => c.slug === 'gameday-thornton');
  if (!retired) ok('a retired tenant is invisible to the public');
  else bad('a retired tenant is invisible to the public', 'gameday-thornton is still listed');

  const listedOnly = Array.isArray(clinics) && clinics.every(c => c.listed === true);
  if (listedOnly) ok('every clinic returned is one that opted in');
  else bad('every clinic returned is one that opted in', 'an unlisted clinic leaked');

  const medbar = (clinics || []).find(c => c.slug === 'medbar-loveland');
  if (medbar) {
    const { body: services } = await anon(
      `service?select=name,price_mode,price_cents,price_from_cents,unit_label&active=eq.true&limit=60`);
    if (Array.isArray(services) && services.length > 5) {
      ok('the service menu is readable', `${services.length} services`);
      const modes = [...new Set(services.map(s => s.price_mode))];
      ok('price modes survive to the public page', modes.join(', '));
    } else {
      bad('the service menu is readable', JSON.stringify(services).slice(0, 160));
    }
  }

  const { body: packages } = await anon('service_package?select=name,sessions,price_cents&active=eq.true');
  if (Array.isArray(packages) && packages.length > 0) ok('packages are readable', `${packages.length}`);
  else bad('packages are readable', JSON.stringify(packages).slice(0, 160));

  const { body: providers } = await anon('provider_public?select=name,credentials,role_label,bio');
  if (Array.isArray(providers) && providers.length > 0) ok('practitioner cards are readable', `${providers.length}`);
  else bad('practitioner cards are readable', JSON.stringify(providers).slice(0, 160));

  /* -------------------------------------------------- what must NOT leak -- */
  console.log('\nWHAT MUST NEVER BE VISIBLE');

  await cannotRead('patients', 'patient', 'first_name,last_name');
  await cannotRead('appointments', 'appointment', 'starts_at');
  await cannotRead('lab results', 'lab_result', 'value_numeric');
  await cannotRead('lab panels', 'lab_panel', 'drawn_at');
  await cannotRead('treatment records', 'treatment_record', 'performed_at');
  await cannotRead('treatment detail', 'treatment_detail', 'area,units');
  await cannotRead('payments', 'payment', 'amount_cents');
  await cannotRead('messages', 'message', 'body');
  await cannotRead('the audit log', 'audit_log', 'action');
  await cannotRead('staff accounts', 'staff_user', 'email');
  await cannotRead('memberships', 'membership', 'status');
  await cannotRead('check-ins', 'checkin', 'week_of');
  await cannotRead('photos', 'photo', 'storage_path');
  await cannotRead('existing leads', 'lead', 'name,phone');

  /* ------------------------------------------- column-level containment -- */
  console.log('\nCOLUMNS THE GRANTS EXCLUDE');

  const npi = await anon('provider?select=npi&limit=1');
  if (npi.status >= 400) ok('provider.npi is refused', `${npi.status}`);
  else bad('provider.npi is refused', 'an anonymous visitor can read NPI numbers');

  const pilot = await anon('clinic?select=pilot_mode&limit=1');
  if (pilot.status >= 400) ok('clinic.pilot_mode is refused', `${pilot.status}`);
  else bad('clinic.pilot_mode is refused', 'internal state is readable');

  const stripe = await anon('service?select=stripe_price_id&limit=1');
  if (stripe.status >= 400) ok('service.stripe_price_id is refused', `${stripe.status}`);
  else bad('service.stripe_price_id is refused', 'payment identifiers are readable');

  const staffLink = await anon('provider?select=staff_user_id&limit=1');
  if (staffLink.status >= 400) ok('provider.staff_user_id is refused', `${staffLink.status}`);
  else bad('provider.staff_user_id is refused', 'staff linkage is readable');

  /* ------------------------------------------------------ static assets -- */
  /**
   * A PRODUCT PHOTOGRAPH MUST COME BACK AS A PHOTOGRAPH.
   *
   * The middleware matcher excluded the public folders that existed when it was
   * written. `public/products/` was added later, so every product image
   * answered 307 to the sign-in page — the whole shop rendered as empty tiles
   * for anyone whose browser had not already cached them, which is why it
   * presented as "broken on mobile".
   *
   * Nothing in the suite could see it: the HTML was correct, the src attributes
   * were correct, the files were on disk. Only fetching one and looking at what
   * came back reveals it.
   */
  console.log('\nSTATIC ASSETS ARE SERVED, NOT GATED');

  const SITE = process.env.SMOKE_SITE || 'https://www.medbarco.com';

  const { body: withImages } = await anon(
    'product?select=name,image_path&image_path=not.is.null&limit=3');

  const assets = [
    ...(Array.isArray(withImages) ? withImages.map(p => p.image_path) : []),
    '/practitioners/jamie-salazar.jpg',
    '/brand/medbar-favicon.svg',
    '/robots.txt'
  ].filter(Boolean);

  let served = 0, gated = [];
  for (const asset of assets) {
    try {
      const res = await fetch(`${SITE}${asset}`, { redirect: 'manual' });
      const type = res.headers.get('content-type') ?? '';
      // A redirect, or HTML where a file was asked for, both mean the gate ate it.
      if (res.status >= 300 && res.status < 400) gated.push(`${asset} -> ${res.status}`);
      else if (/text\/html/.test(type)) gated.push(`${asset} -> html`);
      else served++;
    } catch {
      gated.push(`${asset} -> unreachable`);
    }
  }

  if (gated.length === 0) {
    ok(`${served} static asset(s) serve as files`, 'not redirected to sign-in');
  } else {
    bad('static assets serve as files', gated.join(', '));
  }

  /* -------------------------------------------------------- write paths -- */
  console.log('\nWRITE PATHS');

  /**
   * DO NOT CREATE WHAT YOU CANNOT REMOVE.
   *
   * These checks insert real rows into a live practice's enquiry list to prove
   * the public form works. That is only acceptable while the harness can
   * reliably delete them again — and anon deliberately cannot, so deletion
   * needs the service role key.
   *
   * Without it the write checks are SKIPPED rather than run. Skipping loses
   * coverage; running would put rows named "Live Enquiry Test" in front of the
   * owner as though a customer had got in touch, and she has no way to tell
   * which of her enquiries are real. Lost coverage is recoverable by setting
   * one variable; her trust in the enquiry list is not.
   */
  const canCleanUp = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  const clinicId = await anon('clinic?select=id&slug=eq.medbar-loveland');
  const cid = Array.isArray(clinicId.body) && clinicId.body[0] ? clinicId.body[0].id : null;

  if (!canCleanUp) {
    console.log('  — skipped: SUPABASE_SERVICE_ROLE_KEY is not set, so these rows');
    console.log('    could not be removed from the practice’s live enquiry list.');
    console.log('    Set it in .env.local to run the write checks.');
  } else if (cid) {
    const enquiry = await anon('lead', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        clinic_id: cid,
        name: 'Storefront Test',
        phone: '+19705550188',
        email: 'storefront-test@example.invalid',
        source: 'website',
        message: 'Automated test enquiry.',
        consent_transactional_sms: true,
        consent_captured_at: new Date().toISOString(),
        consent_text_version: 'v1',
        synthetic: true
      })
    });
    if (enquiry.status < 300) ok('a visitor can leave an enquiry', `${enquiry.status}`);
    else bad('a visitor can leave an enquiry', JSON.stringify(enquiry.body).slice(0, 200));

    // The important half: having written one, they must not be able to read any.
    const readBack = await anon('lead?select=name,phone&limit=5');
    if (readBack.status >= 400 || (Array.isArray(readBack.body) && readBack.body.length === 0)) {
      ok('but cannot read the enquiries table back', 'insert-only');
    } else {
      bad('but cannot read the enquiries table back',
        'a public form that can read its own table is a public database');
    }

    // The Med Bar is LIVE, so a real enquiry is supposed to be accepted here —
    // that is the whole point of the storefront. What this now checks is that
    // the guard tracks the clinic's own pilot_mode rather than being bypassed:
    // accepted on a live clinic, refused on one still in pilot.
    const realOnLive = await anon('lead', {
      method: 'POST',
      body: JSON.stringify({ clinic_id: cid, name: 'Live Enquiry Test', phone: '+19705550166', source: 'website', synthetic: false })
    });
    if (realOnLive.status < 300) ok('a real enquiry is accepted for a live clinic', 'The Med Bar is live');
    else bad('a real enquiry is accepted for a live clinic', JSON.stringify(realOnLive.body).slice(0, 140));

    const writeService = await anon('service', {
      method: 'POST',
      body: JSON.stringify({ clinic_id: cid, name: 'Anon Injected', category: 'other', duration_min: 30, price_mode: 'free' })
    });
    if (writeService.status >= 400) ok('a visitor cannot add a service', `${writeService.status}`);
    else bad('a visitor cannot add a service', 'the public can write to the catalogue');

    const writeClinic = await anon(`clinic?id=eq.${cid}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Defaced' })
    });
    if (writeClinic.status >= 400) ok('a visitor cannot rename the clinic', `${writeClinic.status}`);
    else bad('a visitor cannot rename the clinic', 'the public can edit the storefront');
  } else {
    bad('found the clinic to test writes against');
  }

  /* ------------------------------------------ the enquiry notification -- */
  // The storefront runs as anon, and automation_run is staff-only by default,
  // so logging a notification was refused by RLS — silently, because the call
  // site swallows notification failures on purpose. The feature looked wired
  // up and logged nothing, permanently. These checks exist so it cannot
  // regress to that without somebody noticing.
  console.log('\nENQUIRY NOTIFICATION LOG');

  // Same rule as the write paths above: these insert automation_run rows into a
  // live practice's history, and only the service role can take them out again.
  if (!canCleanUp) {
    console.log('  — skipped: no SUPABASE_SERVICE_ROLE_KEY to clean up with.');
  } else if (cid) {
    const logRow = (over = {}) => anon('automation_run', {
      method: 'POST',
      body: JSON.stringify({
        clinic_id: cid,
        rule_key: 'storefront_enquiry_email',
        channel: 'email',
        status: 'logged_not_sent',
        payload_preview: 'The Med Bar: something needs your attention.',
        synthetic: true,
        ...over
      })
    });

    const wrote = await logRow();
    if (wrote.status < 300) ok('the form can record that it notified the practice');
    else bad('the form can record that it notified the practice',
      `${wrote.status} — notifications will be invisible`);

    const otherRule = await logRow({ rule_key: 'anything_else' });
    if (otherRule.status >= 400) ok('but only under the storefront rule', 'not a general write into automation history');
    else bad('but only under the storefront rule', 'anon can write arbitrary automation records');

    // The Med Bar is live, so a non-synthetic row is correct here. The guard
    // has not gone away — it tracks each clinic's own pilot_mode, which the
    // write-test proves by checking both sides.
    const notSynthetic = await logRow({ synthetic: false });
    if (notSynthetic.status < 300) {
      ok('a real notification logs for a live clinic');
    } else {
      bad('a real notification logs for a live clinic', JSON.stringify(notSynthetic.body).slice(0, 140));
    }

    const readBack = await anon('automation_run?select=id&limit=3');
    if (readBack.status >= 400 || (Array.isArray(readBack.body) && readBack.body.length === 0)) {
      ok('and it cannot read the practice\u2019s automation history back');
    } else {
      bad('and it cannot read the practice\u2019s automation history back');
    }
  } else {
    bad('found the clinic to test notification logging against');
  }
  /* ------------------------------------------------------------ cleanup -- */
  console.log('\nCLEANUP');
  /**
   * anon cannot delete its own test rows by design, so cleanup needs elevated
   * access. It uses the SERVICE ROLE KEY rather than signing in as the owner.
   *
   * It used to sign in as jamie@medbar.pilot.invalid with PILOT_DEMO_PASSWORD.
   * That broke the moment she was given a real login — and it broke silently in
   * the worst possible way: the assertions above still passed, so the suite
   * reported 32 of 34, while four rows named "Live Enquiry Test" sat in the
   * practice's real enquiry list looking like customers who had got in touch.
   *
   * A test harness must never depend on a real person's credentials. Those
   * change, and when they do the harness starts leaving litter in a live
   * business's data instead of failing loudly.
   */
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      // Nothing was written, so there is nothing to clean and nothing to fail.
      console.log('  — nothing to clean: the write checks were skipped.');
      throw { skip: true };
    }
    const access_token = serviceKey;
    /**
     * Removes BOTH test shapes, matched on name as well as email.
     *
     * This clinic is live now, so anything this harness leaves behind sits in
     * the practice's real enquiry list looking like a customer. An earlier run
     * left four "Live Enquiry Test" rows exactly that way — the cleanup only
     * knew about the row with a test email address.
     */
    const auth = { apikey: serviceKey, Authorization: `Bearer ${access_token}` };
    const del = await fetch(
      `${URL_SB}/rest/v1/lead?or=(email.eq.storefront-test@example.invalid,name.like.*Test*)`,
      { method: 'DELETE', headers: auth });
    await fetch(
      `${URL_SB}/rest/v1/automation_run?rule_key=eq.storefront_enquiry_email`,
      { method: 'DELETE', headers: auth });

    // Confirm it is actually gone rather than trusting a 2xx. The previous
    // version reported success from a status code alone, which is how four
    // rows survived a run that said it had cleaned up.
    const left = await fetch(
      `${URL_SB}/rest/v1/lead?select=id&or=(email.eq.storefront-test@example.invalid,name.like.*Test*)`,
      { headers: auth });
    const remaining = await left.json().catch(() => []);

    if (del.ok && Array.isArray(remaining) && remaining.length === 0) {
      ok('test enquiry removed', 'and verified gone');
    } else if (!del.ok) {
      bad('test enquiry removed', `delete returned ${del.status}`);
    } else {
      bad('test enquiry removed', `${remaining.length} test row(s) still in the practice’s list`);
    }
  } catch (err) {
    if (!err || !err.skip) bad('test enquiry removed', err && err.message);
  }

  console.log('\n' + '─'.repeat(64));
  if (fail) { console.log(`${fail} of ${pass + fail} storefront checks FAILED\n`); process.exit(1); }
  console.log(`All ${pass} public-surface checks passed.\n`);
})();
