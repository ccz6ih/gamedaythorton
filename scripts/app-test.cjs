/**
 * app-test.cjs
 * HTTP smoke test against a running server. Checks the things that protect this
 * deployment and the things that would make it a dead link.
 *
 * WHAT THIS PROVES
 *   - the pilot gate actually gates (no cookie, no access)
 *   - the middleware sends unauthenticated users to sign-in rather than rendering
 *     a page that would query for data
 *   - the security headers are present on real responses, not just in config
 *   - nothing is indexable
 *   - the Phase A prototype is served alongside the app
 *   - the Stripe webhook refuses unsigned requests
 *
 * WHAT THIS CANNOT PROVE
 *   Signed-in screens. Forging @supabase/ssr's session cookies is not worth the
 *   fragility, so RLS and data access are proven at the API level by
 *   scripts/auth-test.cjs instead. The signed-in UI still needs a human to click
 *   through it.
 *
 * Run:  node scripts/app-test.cjs [baseUrl] [passcode]
 *       (start the server first: npm run build && npm start)
 *
 * The passcode argument matters when testing a deployed environment: production
 * has its own PILOT_PASSCODE, which is deliberately not the local one. Without
 * it every gated check fails with a 307 to /gate — which is the gate working
 * correctly, but reads like six broken features.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const PASSCODE = process.argv[3] || process.env.PILOT_PASSCODE;

let pass = 0, fail = 0;
const ok = (m, n) => { pass++; console.log(`  ✓ ${m}${n ? '  ' + n : ''}`); };
const bad = (m, e) => { fail++; console.log(`  ✗ ${m}`); if (e) console.log('      ' + e); };

const gateCookie = () => (PASSCODE ? { cookie: `gd_pilot_gate=${PASSCODE}` } : {});

async function req(url, opts = {}) {
  return fetch(BASE + url, { redirect: 'manual', ...opts });
}

(async () => {
  console.log(`\nAPP SMOKE TEST  ${BASE}\n`);

  try {
    await fetch(BASE, { redirect: 'manual' });
  } catch {
    console.error(`  Cannot reach ${BASE}. Start the server first:\n    npm run build && npm start\n`);
    process.exit(1);
  }

  /* ------------------------------------------------------------- the gate -- */
  console.log('PILOT GATE');

  const noCookie = await req('/console');
  if ([302, 307, 308].includes(noCookie.status) && (noCookie.headers.get('location') || '').includes('/gate')) {
    ok('no passcode cookie is sent to the gate', `${noCookie.status} → /gate`);
  } else {
    bad('no passcode cookie is sent to the gate', `got ${noCookie.status} → ${noCookie.headers.get('location')}`);
  }

  const gatePage = await req('/gate');
  const gateHtml = await gatePage.text();
  if (gatePage.status === 200 && /passcode/i.test(gateHtml)) ok('the gate itself renders');
  else bad('the gate itself renders', `status ${gatePage.status}`);

  if (/not public yet/i.test(gateHtml)) ok('the gate explains why it exists');
  else bad('the gate explains why it exists');

  const withCookie = await req('/console', { headers: gateCookie() });
  const loc = withCookie.headers.get('location') || '';
  if ([302, 307, 308].includes(withCookie.status) && loc.includes('/sign-in')) {
    ok('past the gate but unauthenticated goes to sign-in', `${withCookie.status} → /sign-in`);
  } else {
    bad('past the gate but unauthenticated goes to sign-in', `got ${withCookie.status} → ${loc}`);
  }

  const badCode = await req('/console', { headers: { cookie: 'gd_pilot_gate=wrong' } });
  if ((badCode.headers.get('location') || '').includes('/gate')) ok('a wrong passcode does not pass');
  else bad('a wrong passcode does not pass', badCode.headers.get('location') || String(badCode.status));

  /* ------------------------------------------------------------ sign-in -- */
  console.log('\nSIGN-IN');

  const signIn = await req('/sign-in', { headers: gateCookie() });
  const signInHtml = await signIn.text();
  if (signIn.status === 200) ok('sign-in renders');
  else bad('sign-in renders', `status ${signIn.status}`);

  // Inverted deliberately. Listing every pilot account here showed one practice's
  // staff the other practice's account list, which leaks the tenant structure to
  // anyone who reaches the page. It is now behind PILOT_SHOW_ACCOUNTS.
  if (!/pilot\.invalid/.test(signInHtml)) {
    ok('the account list is NOT printed on sign-in', 'no tenant structure leaked');
  } else if (process.env.PILOT_SHOW_ACCOUNTS === 'true') {
    ok('account list shown, but only because PILOT_SHOW_ACCOUNTS is on');
  } else {
    bad('the account list is NOT printed on sign-in',
      'accounts are visible without PILOT_SHOW_ACCOUNTS being set');
  }

  if (!new RegExp(String(process.env.PILOT_DEMO_PASSWORD || '___nope___')).test(signInHtml)) {
    ok('the demo password is NOT in the page source');
  } else {
    bad('the demo password is NOT in the page source', 'it is being rendered to the browser');
  }

  /* ------------------------------------------------------------ headers -- */
  console.log('\nSECURITY HEADERS');

  const headerTarget = await req('/sign-in', { headers: gateCookie() });
  const checks = [
    ['x-robots-tag', /noindex/i, 'noindex'],
    ['referrer-policy', /no-referrer/i, 'no-referrer'],
    ['x-content-type-options', /nosniff/i, 'nosniff'],
    ['x-frame-options', /DENY/i, 'DENY'],
    ['content-security-policy', /default-src 'self'/, "default-src 'self'"],
    ['cache-control', /no-store/, 'no-store']
  ];
  for (const [header, pattern, label] of checks) {
    const value = headerTarget.headers.get(header) || '';
    if (pattern.test(value)) ok(`${header}`, label);
    else bad(`${header} (${label})`, value || 'absent');
  }

  const csp = headerTarget.headers.get('content-security-policy') || '';
  // The rule that matters most: nothing third-party may execute behind login.
  if (!/googletagmanager|google-analytics|facebook|hotjar|fullstory|segment/i.test(csp)) {
    ok('no analytics or session-replay origin is allowed', 'docs/06 rule 2');
  } else {
    bad('no analytics or session-replay origin is allowed', csp);
  }
  if (/frame-ancestors 'none'/.test(csp)) ok('the app cannot be framed');
  else bad("frame-ancestors 'none'");

  /* ------------------------------------------------------------- robots -- */
  console.log('\nDISCOVERABILITY');

  const robots = await req('/robots.txt');
  const robotsText = await robots.text();
  if (/Disallow:\s*\/\s*$/m.test(robotsText)) ok('robots.txt disallows everything');
  else bad('robots.txt disallows everything', robotsText.slice(0, 80));

  /* ---------------------------------------------------------- prototype -- */
  console.log('\nPHASE A PROTOTYPE');

  const proto = await req('/prototype/index.html', { headers: gateCookie() });
  if (proto.status === 200) {
    const html = await proto.text();
    if (/Pilot — synthetic data only/.test(html)) ok('prototype is served with its banner intact');
    else ok('prototype is served', 'banner text not found in shell (it renders client-side)');
  } else {
    bad('prototype is served at /prototype/index.html', `status ${proto.status}`);
  }

  const protoData = await req('/prototype/demo-data.js', { headers: gateCookie() });
  if (protoData.status === 200) {
    const len = (await protoData.text()).length;
    ok('prototype dataset is served', `${Math.round(len / 1024)} KB`);
  } else {
    bad('prototype dataset is served', `status ${protoData.status}`);
  }

  /* ------------------------------------------------------------ webhook -- */
  console.log('\nSTRIPE WEBHOOK');

  const unsigned = await req('/api/stripe/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...gateCookie() },
    body: JSON.stringify({ type: 'payment_intent.succeeded' })
  });
  if (unsigned.status === 400 || unsigned.status === 503) {
    const body = await unsigned.json().catch(() => ({}));
    ok('an unsigned webhook is refused', `${unsigned.status} ${body.error ?? ''}`);
  } else {
    bad('an unsigned webhook is refused', `status ${unsigned.status} — it should never be trusted`);
  }

  /* -------------------------------------------------------- storefront -- */
  // The public face of each practice. This is the only surface a prospective
  // client sees before they are a client, and the only one with no login in
  // front of it — so it gets checked for what it shows AND what it must not.
  console.log('\nSTOREFRONTS');

  const STOREFRONTS = [
    { slug: 'medbar-loveland',  neverShows: 'Gameday' },
    { slug: 'gameday-thornton', neverShows: 'Jeuveau' }
  ];

  for (const sf of STOREFRONTS) {
    for (const page of ['', '/services', '/packages', '/about', '/enquire']) {
      const res = await req(`/c/${sf.slug}${page}`, { headers: gateCookie() });
      if (res.status !== 200) { bad(`/c/${sf.slug}${page}`, `status ${res.status}`); continue; }
      const html = await res.text();
      const problems = [];
      if (/could not be found/i.test(html)) problems.push('404 content');
      if (/>undefined<|>NaN<|\[object Object\]/.test(html)) problems.push('placeholder rendered');
      if (new RegExp(sf.neverShows, 'i').test(html)) {
        problems.push(`leaked the other practice (${sf.neverShows})`);
      }
      if (problems.length) bad(`/c/${sf.slug}${page}`, problems.join(', '));
      else ok(`/c/${sf.slug}${page}`, `${Math.round(html.length / 1024)}kB`);
    }
  }

  const medbar = await req('/c/medbar-loveland/services', { headers: gateCookie() });
  if (medbar.status === 200) {
    const html = await medbar.text();
    // priceLabel() is the only thing allowed to render a price. If a "from"
    // service ever prints as a bare number the page is quoting a price the
    // practice does not honour, which is a complaint at the counter.
    if (/from \$/.test(html)) ok('"from" pricing survives to the public page');
    else bad('"from" pricing survives to the public page', 'a range was flattened to a number');
    if (/\/ unit/.test(html)) ok('per-unit pricing survives');
    else bad('per-unit pricing survives');
    if (/Complimentary/.test(html)) ok('free services say Complimentary, not $0');
    else bad('free services say Complimentary, not $0');
  }

  const spa = await req('/c/medbar-loveland', { headers: gateCookie() });
  const gd = await req('/c/gameday-thornton', { headers: gateCookie() });
  if (spa.status === 200 && gd.status === 200) {
    const spaHtml = await spa.text();
    const gdHtml = await gd.text();
    if (/data-surface="light"/.test(spaHtml) && /data-surface="dark"/.test(gdHtml)) {
      ok('each practice renders in its own skin', 'med spa light, mens health dark');
    } else bad('each practice renders in its own skin');

    // The page carries a real business name and real prices, so it must say
    // what it is or it can be mistaken for that business's live site.
    if (/Not the practice/i.test(spaHtml)) ok('the storefront says it is a preview');
    else bad('the storefront says it is a preview', 'it could be mistaken for the live site');

    if (!/Bettencourt/i.test(spaHtml)) ok('no client names on the public page');
    else bad('no client names on the public page', 'CLIENT DATA ON AN UNAUTHENTICATED PAGE');
  }

  const unknown = await req('/c/no-such-clinic', { headers: gateCookie() });
  if (unknown.status === 404) {
    ok('an unknown or unlisted practice is a 404', 'not a 403, which would confirm it exists');
  } else bad('an unknown or unlisted practice is a 404', `status ${unknown.status}`);

  const sfHead = await req('/c/medbar-loveland', { headers: gateCookie() });
  if (/noindex/i.test(sfHead.headers.get('x-robots-tag') || '')) {
    ok('the storefront is not indexable', 'it carries a real practice name');
  } else bad('the storefront is not indexable', 'it could appear in search beside their real site');

  // A marketing image referenced by a PUBLIC page has to load without a
  // session. It did not: middleware sent it to /sign-in and the headshot
  // rendered broken for exactly the people the storefront exists for — while
  // looking perfect to anyone testing it signed in. That is how it would have
  // shipped, so it gets a check that runs with no cookie at all.
  const headshot = await fetch(BASE + '/practitioners/jamie-salazar.jpg', { redirect: 'manual' });
  if (headshot.status === 200 && (headshot.headers.get('content-type') || '').startsWith('image/')) {
    ok('a practitioner photo loads with no session', `${Math.round(Number(headshot.headers.get('content-length') || 0) / 1024)}kB`);
  } else {
    bad('a practitioner photo loads with no session',
      `status ${headshot.status} — a public page cannot render a gated image`);
  }

  const portrait = await req('/c/medbar-loveland/about', { headers: gateCookie() });
  if (portrait.status === 200) {
    const html = await portrait.text();
    if (/jamie-salazar\.jpg/.test(html)) ok('the storefront actually references the photo');
    else bad('the storefront actually references the photo', 'it fell back to initials');
  }

  /* ------------------------------------------------------------- public -- */
  console.log('\nPUBLIC SURFACE');

  const about = await req('/about-pilot', { headers: gateCookie() });
  const aboutHtml = await about.text();
  if (about.status === 200 && /no HIPAA controls/i.test(aboutHtml)) {
    ok('the compliance explainer is reachable in one tap');
  } else {
    bad('the compliance explainer is reachable', `status ${about.status}`);
  }

  console.log('\n' + '─'.repeat(64));
  if (fail) { console.log(`${fail} of ${pass + fail} app checks FAILED\n`); process.exit(1); }
  console.log(`All ${pass} app checks passed.`);
  console.log('Signed-in screens are not covered here — click through those.\n');
})();
