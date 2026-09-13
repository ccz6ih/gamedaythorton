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

  const { body: clinics } = await anon('clinic?select=slug,name,practice_type,listed&order=name');
  if (Array.isArray(clinics) && clinics.length >= 2) {
    ok('listed clinics are readable', clinics.map(c => c.slug).join(', '));
  } else {
    bad('listed clinics are readable', JSON.stringify(clinics).slice(0, 160));
  }

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

  /* -------------------------------------------------------- write paths -- */
  console.log('\nWRITE PATHS');

  const clinicId = await anon('clinic?select=id&slug=eq.medbar-loveland');
  const cid = Array.isArray(clinicId.body) && clinicId.body[0] ? clinicId.body[0].id : null;

  if (cid) {
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

    const notSynthetic = await anon('lead', {
      method: 'POST',
      body: JSON.stringify({ clinic_id: cid, name: 'Real Person', synthetic: false })
    });
    if (notSynthetic.status >= 400) ok('an enquiry not marked synthetic is refused', 'pilot guard holds on the public form');
    else bad('an enquiry not marked synthetic is refused', 'REAL DATA CAN ENTER VIA THE PUBLIC FORM');

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

  /* ------------------------------------------------------------ cleanup -- */
  console.log('\nCLEANUP');
  // anon cannot delete its own test rows by design, so this needs the staff path.
  try {
    const pw = process.env.PILOT_DEMO_PASSWORD;
    const tokenRes = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'jamie@medbar.pilot.invalid', password: pw })
    });
    const { access_token } = await tokenRes.json();
    const del = await fetch(
      `${URL_SB}/rest/v1/lead?email=eq.storefront-test@example.invalid`,
      { method: 'DELETE', headers: { apikey: KEY, Authorization: `Bearer ${access_token}` } });
    if (del.ok) ok('test enquiry removed', 'via the staff path, since anon cannot delete');
    else bad('test enquiry removed', `${del.status}`);
  } catch (err) {
    bad('test enquiry removed', err.message);
  }

  console.log('\n' + '─'.repeat(64));
  if (fail) { console.log(`${fail} of ${pass + fail} storefront checks FAILED\n`); process.exit(1); }
  console.log(`All ${pass} public-surface checks passed.\n`);
})();
