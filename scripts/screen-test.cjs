/**
 * screen-test.cjs
 * Renders every AUTHENTICATED screen as a real signed-in user and checks what
 * came back.
 *
 * WHY THIS EXISTS
 * app-test.cjs covers the unauthenticated surface; auth-test.cjs proves RLS at
 * the API level. Neither renders the console or the portal, so a screen could
 * throw, 404, or leak another practice's data with every other test green. That
 * gap is how a client finds a string of 404s before we do.
 *
 * HOW IT SIGNS IN
 * It gets a real session from the Supabase token endpoint, then encodes it the way
 * @supabase/ssr does — a `base64-` prefixed JSON blob in `sb-<ref>-auth-token`,
 * chunked across numbered cookies when it exceeds the browser-safe size. No
 * browser required.
 *
 * Run:  node scripts/screen-test.cjs [baseUrl] [passcode]
 *       (server must be running)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const PASSCODE = process.argv[3] || process.env.PILOT_PASSCODE;
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PW = process.env.PILOT_DEMO_PASSWORD;
const REF = process.env.SUPABASE_PROJECT_REF;

let pass = 0, fail = 0;
const ok = (m, n) => { pass++; console.log(`  ✓ ${m}${n ? '  ' + n : ''}`); };
const bad = (m, e) => { fail++; console.log(`  ✗ ${m}`); if (e) console.log('      ' + String(e).slice(0, 220)); };

const CHUNK = 3180;   // @supabase/ssr's threshold

async function sessionCookies(email) {
  const res = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW })
  });
  const session = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${session.error_description || session.msg || 'sign-in failed'}`);

  const encoded = 'base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64');
  const name = `sb-${REF}-auth-token`;

  const jar = [];
  if (encoded.length <= CHUNK) {
    jar.push(`${name}=${encoded}`);
  } else {
    for (let i = 0, n = 0; i < encoded.length; i += CHUNK, n++) {
      jar.push(`${name}.${n}=${encoded.slice(i, i + CHUNK)}`);
    }
  }
  if (PASSCODE) jar.push(`gd_pilot_gate=${PASSCODE}`);
  return jar.join('; ');
}

async function get(cookie, route) {
  const res = await fetch(BASE + route, { headers: { cookie }, redirect: 'manual' });
  const body = res.status === 200 ? await res.text() : '';
  return { status: res.status, location: res.headers.get('location'), body };
}

const fs = require('fs');

/**
 * Does a page file exist on disk for this route?
 *
 * A 404 for a route whose file exists means the running server is serving a stale
 * build, not that the screen is broken. That distinction matters: chasing a
 * "broken screen" that is really a stale `npm start` wastes real time, and it once
 * cost me a round trip here.
 */
function pageExistsOnDisk(route) {
  const base = path.resolve(__dirname, '..', 'app', route.replace(/^\//, ''));
  if (fs.existsSync(path.join(base, 'page.tsx'))) return true;
  // A dynamic segment may cover it: /console/services/new -> services/[id]/page.tsx
  const parts = route.replace(/^\//, '').split('/');
  for (let i = parts.length - 1; i > 0; i--) {
    const candidate = path.resolve(
      __dirname, '..', 'app', ...parts.slice(0, i), '[id]', 'page.tsx');
    if (fs.existsSync(candidate)) return true;
  }
  return false;
}

/** A screen is healthy if it 200s and shows no error or placeholder rubbish. */
function inspect(name, res, expect) {
  if (res.status !== 200) {
    if (res.status === 404 && pageExistsOnDisk(name)) {
      bad(name, 'STALE SERVER — this page exists on disk but the running build ' +
        'does not have it. Rebuild and restart: npm run build && npm start');
    } else {
      bad(name, `status ${res.status}${res.location ? ' → ' + res.location : ''}`);
    }
    return;
  }
  const leaks = [];
  if (/This page could not be found|could not be found/i.test(res.body)) leaks.push('404 content');
  if (/Application error|Internal Server Error|Unhandled Runtime/i.test(res.body)) leaks.push('runtime error');
  if (/>undefined</.test(res.body)) leaks.push('rendered "undefined"');
  if (/>NaN</.test(res.body)) leaks.push('rendered "NaN"');
  if (/\[object Object\]/.test(res.body)) leaks.push('rendered [object Object]');
  if (leaks.length) { bad(name, leaks.join(', ')); return; }

  if (expect) {
    const missing = expect.filter(text => !res.body.includes(text));
    if (missing.length) { bad(name, `missing expected content: ${missing.join(' | ')}`); return; }
  }
  ok(name, `${Math.round(res.body.length / 1024)}kB`);
}

const CONSOLE_ROUTES = [
  '/console', '/console/today', '/console/book', '/console/clients', '/console/labs',
  '/console/safety', '/console/treatments', '/console/packages', '/console/payments',
  '/console/services', '/console/storefront', '/console/brand', '/console/settings',
  // The editors. A form that 500s is worse than a missing feature, because the
  // person trusts it and types real work into it.
  '/console/clients/new', '/console/services/new', '/console/treatments/new'
];

(async () => {
  if (!URL_SB || !KEY || !PW || !REF) {
    console.error('\n  Missing Supabase config or PILOT_DEMO_PASSWORD in .env.local\n');
    process.exit(1);
  }

  console.log(`\nAUTHENTICATED SCREENS  ${BASE}\n`);

  /* ------------------------------------------------------------- med spa -- */
  console.log('THE MED BAR (med_spa) — jamie@medbar.pilot.invalid');
  let jamie;
  try {
    jamie = await sessionCookies('jamie@medbar.pilot.invalid');
    ok('signed in');
  } catch (err) { bad('signed in', err.message); }

  if (jamie) {
    for (const route of CONSOLE_ROUTES) {
      const res = await get(jamie, route);
      // A med spa has no labs module, so those screens exist but should be
      // absent from her rail. They still must not error if reached directly.
      inspect(route, res);
    }

    const home = await get(jamie, '/console');
    if (home.status === 200) {
      if (home.body.includes('The Med Bar')) ok('scoreboard shows her practice');
      else bad('scoreboard shows her practice');

      if (!home.body.includes('Gameday')) ok('no sign of the other practice anywhere on her screen');
      else bad('no sign of the other practice', 'found "Gameday" in her console');

      // A med spa must not be shown lab-entry navigation.
      const railHasLabs = /href="\/console\/labs"/.test(home.body);
      if (!railHasLabs) ok('lab entry is not in her navigation', 'module off for med_spa');
      else bad('lab entry is not in her navigation', 'a med spa should not see it');

      const railHasPackages = /href="\/console\/packages"/.test(home.body);
      if (railHasPackages) ok('packages IS in her navigation');
      else bad('packages IS in her navigation');

      if (/client/i.test(home.body) && !/\bpatients\b/i.test(home.body)) {
        ok('uses "clients", not "patients"');
      } else {
        bad('uses "clients", not "patients"', 'wrong noun for a med spa');
      }
    }

    const clients = await get(jamie, '/console/clients');
    if (clients.status === 200) {
      if (clients.body.includes('Bettencourt')) ok('her roster renders real names');
      else bad('her roster renders real names');
    }

    const treatments = await get(jamie, '/console/treatments');
    if (treatments.status === 200) {
      if (/Glabella|Jeuveau|infraorbital/i.test(treatments.body)) {
        ok('treatment records show areas and product');
      } else bad('treatment records show areas and product');
      if (/adverse/i.test(treatments.body)) ok('the adverse event surfaces');
      else bad('the adverse event surfaces');
    }

    const packages = await get(jamie, '/console/packages');
    if (packages.status === 200) {
      if (/PRF/i.test(packages.body)) ok('prepaid ledger lists her real packages');
      else bad('prepaid ledger lists her real packages');
      if (/liability/i.test(packages.body)) ok('prepaid liability is stated');
      else bad('prepaid liability is stated');
    }

    const services = await get(jamie, '/console/services');
    if (services.status === 200) {
      if (services.body.includes('Jeuveau')) ok('her real service catalogue renders');
      else bad('her real service catalogue renders');
      if (/from \$800|\/ unit|\/unit/i.test(services.body)) {
        ok('from-pricing and per-unit pricing render honestly');
      } else bad('from-pricing and per-unit pricing render honestly');
    }

    const portal = await get(jamie, '/portal');
    if ([302, 307, 308].includes(portal.status) && (portal.location || '').includes('/console')) {
      ok('staff cannot reach the client portal', 'redirected to console');
    } else bad('staff cannot reach the client portal', `status ${portal.status}`);
  }

  /* -------------------------------------------------------- men's health -- */
  console.log('\nGAMEDAY THORNTON (mens_health) — owner@gameday.pilot.invalid');
  let ray;
  try {
    ray = await sessionCookies('owner@gameday.pilot.invalid');
    ok('signed in');
  } catch (err) { bad('signed in', err.message); }

  if (ray) {
    for (const route of CONSOLE_ROUTES) {
      inspect(route, await get(ray, route));
    }

    const home = await get(ray, '/console');
    if (home.status === 200) {
      if (home.body.includes('Gameday')) ok('scoreboard shows his practice');
      else bad('scoreboard shows his practice');
      if (!home.body.includes('Med Bar')) ok('no sign of the other practice');
      else bad('no sign of the other practice');
      if (/href="\/console\/labs"/.test(home.body)) ok('lab entry IS in his navigation');
      else bad('lab entry IS in his navigation');
      if (!/href="\/console\/packages"/.test(home.body)) ok('packages is not in his navigation');
      else bad('packages is not in his navigation');
    }

    const labs = await get(ray, '/console/labs');
    if (labs.status === 200) {
      if (/Hematocrit|Total Testosterone/i.test(labs.body)) ok('lab grid lists the analytes');
      else bad('lab grid lists the analytes');
      if (/provisional/i.test(labs.body)) ok('lab grid says the ranges are provisional');
      else bad('lab grid says the ranges are provisional');
    }

    const safety = await get(ray, '/console/safety');
    if (safety.status === 200) {
      if (/Hematocrit|Psa/i.test(safety.body)) ok('safety queue surfaces flagged values');
      else bad('safety queue surfaces flagged values');
    }

    const chart = await get(ray, '/console/clients');
    const idMatch = chart.body.match(/\/console\/clients\/([0-9a-f-]{36})/);
    if (idMatch) {
      const detail = await get(ray, `/console/clients/${idMatch[1]}`);
      inspect(`/console/clients/${idMatch[1].slice(0, 8)}…`, detail);
    } else {
      bad('found a client id to open');
    }
  }

  /* -------------------------------------------------------------- portal -- */
  console.log('\nCLIENT PORTAL');
  let delphine;
  try {
    delphine = await sessionCookies('delphine@medbar.pilot.invalid');
    ok('signed in as a client');
  } catch (err) { bad('signed in as a client', err.message); }

  if (delphine) {
    const portal = await get(delphine, '/portal');
    inspect('/portal', portal);
    if (portal.status === 200) {
      if (portal.body.includes('Delphine')) ok('portal greets her by name');
      else bad('portal greets her by name');
      if (/PRF/i.test(portal.body)) ok('shows her prepaid sessions');
      else bad('shows her prepaid sessions');
      if (!/Achterberg|Wexford|Nkemelu/.test(portal.body)) {
        ok('no other client appears on her screen');
      } else bad('no other client appears on her screen', 'LEAK');
    }

    const console_ = await get(delphine, '/console');
    if ([302, 307, 308].includes(console_.status) && (console_.location || '').includes('/portal')) {
      ok('a client cannot reach the staff console', 'redirected to portal');
    } else bad('a client cannot reach the staff console', `status ${console_.status}`);
  }

  /* ----------------------------------------------------------- sign-in UI -- */
  console.log('\nSIGN-IN SURFACE');
  const signIn = await fetch(`${BASE}/sign-in`, {
    headers: { cookie: PASSCODE ? `gd_pilot_gate=${PASSCODE}` : '' }
  });
  const signInBody = await signIn.text();
  if (!/pilot\.invalid/.test(signInBody)) {
    ok('the account list is NOT printed on the sign-in page');
  } else {
    bad('the account list is NOT printed on the sign-in page',
      'it exposes the tenant structure to anyone who reaches the page');
  }

  console.log('\n' + '─'.repeat(64));
  if (fail) { console.log(`${fail} of ${pass + fail} screen checks FAILED\n`); process.exit(1); }
  console.log(`All ${pass} authenticated screen checks passed.\n`);
})();
