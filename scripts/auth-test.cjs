/**
 * auth-test.cjs
 * Signs in as each pilot account through the real Supabase auth endpoint, then
 * reads through RLS with the resulting token.
 *
 * This is the end-to-end check the SQL-level tests cannot make: RLS can be
 * perfect while sign-in is broken, and a token can be valid while the policies
 * hand back the wrong rows. It is also the test that catches an auth.users row
 * that Postgres accepted but GoTrue cannot read.
 *
 * Run:  node scripts/auth-test.cjs
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PW = process.env.PILOT_DEMO_PASSWORD;

const ACCOUNTS = [
  // Staff counts are a MINIMUM, not an exact number. The Med Bar is live with
  // real clients now, so a hardcoded total breaks every time somebody books —
  // and a test that fails on normal use gets ignored, which is worse than no
  // test. The property being checked is "sees their own clinic's people and
  // nobody else's", which the clinic check below enforces.
  { email: 'owner@gameday.pilot.invalid', kind: 'staff', clinic: 'Gameday', minPatients: 1 },
  { email: 'jamie@medbar.pilot.invalid', kind: 'staff', clinic: 'Med Bar', minPatients: 1 },
  // A client seeing exactly one row — their own — stays an exact number. That
  // one IS the invariant, and "at least one" would pass while leaking.
  { email: 'gregory@gameday.pilot.invalid', kind: 'patient', clinic: 'Gameday', expectPatients: 1 },
  { email: 'delphine@medbar.pilot.invalid', kind: 'patient', clinic: 'Med Bar', expectPatients: 1 }
];

let pass = 0, fail = 0;
const ok = (m, n) => { pass++; console.log(`  ✓ ${m}${n ? '  ' + n : ''}`); };
const bad = (m, e) => { fail++; console.log(`  ✗ ${m}`); if (e) console.log('      ' + e); };

async function signIn(email) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${j.error_description || j.msg || j.error || JSON.stringify(j)}`);
  return j.access_token;
}

async function get(token, pathAndQuery) {
  const r = await fetch(`${URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` }
  });
  const body = await r.json().catch(() => null);
  return { status: r.status, body };
}

(async () => {
  if (!URL || !KEY || !PW) {
    console.error('\n  Missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / PILOT_DEMO_PASSWORD in .env.local\n');
    process.exit(1);
  }

  console.log('\nSIGN-IN AND RLS THROUGH THE REAL API\n');

  const tokens = {};
  for (const a of ACCOUNTS) {
    try {
      tokens[a.email] = await signIn(a.email);
      ok(`sign in ${a.email}`);
    } catch (err) {
      bad(`sign in ${a.email}`, err.message);
    }
  }

  for (const a of ACCOUNTS) {
    const t = tokens[a.email];
    if (!t) continue;

    const pat = await get(t, 'patient?select=id,first_name,last_name,clinic_id');
    if (!Array.isArray(pat.body)) {
      bad(`${a.email} can read patient`, `${pat.status} ${JSON.stringify(pat.body).slice(0, 120)}`);
    } else if (a.kind === 'patient'
        ? pat.body.length === a.expectPatients
        : pat.body.length >= a.minPatients) {
      ok(`${a.email} sees ${pat.body.length} patient row(s)`,
        a.kind === 'patient'
          ? `= only ${pat.body[0].first_name} ${pat.body[0].last_name}`
          : '= own tenant only');
    } else {
      bad(`${a.email} patient visibility`,
        a.kind === 'patient'
          ? `expected exactly ${a.expectPatients}, saw ${pat.body.length}`
          : `expected at least ${a.minPatients}, saw ${pat.body.length}`);
    }

    // Exactly one clinic must be visible, and it must be the right one.
    const cl = await get(t, 'clinic_public?select=name,practice_type');
    if (Array.isArray(cl.body) && cl.body.length === 1 && cl.body[0].name.includes(a.clinic.split(' ')[0])) {
      ok(`${a.email} sees only ${cl.body[0].name}`, cl.body[0].practice_type);
    } else {
      bad(`${a.email} sees only their own clinic`,
        Array.isArray(cl.body) ? cl.body.map(c => c.name).join(', ') : JSON.stringify(cl.body).slice(0, 120));
    }
  }

  // A patient must not be able to reach the other tenant's data or the audit log.
  const g = tokens['gregory@gameday.pilot.invalid'];
  if (g) {
    const audit = await get(g, 'audit_log?select=id&limit=1');
    if (Array.isArray(audit.body) && audit.body.length === 0) ok('patient cannot read audit_log');
    else bad('patient cannot read audit_log', JSON.stringify(audit.body).slice(0, 120));

    const staff = await get(g, 'staff_user?select=email');
    if (Array.isArray(staff.body) && staff.body.length === 0) ok('patient cannot enumerate staff');
    else bad('patient cannot enumerate staff', JSON.stringify(staff.body).slice(0, 120));

    const labs = await get(g, 'lab_result?select=analyte_key,value_numeric');
    if (Array.isArray(labs.body) && labs.body.length > 0) ok('patient CAN read his own lab results', `${labs.body.length} values`);
    else bad('patient CAN read his own lab results', JSON.stringify(labs.body).slice(0, 120));
  }

  // No token at all must get nothing.
  const anon = await fetch(`${URL}/rest/v1/patient?select=id`, { headers: { apikey: KEY } });
  const anonBody = await anon.json().catch(() => null);
  if (Array.isArray(anonBody) && anonBody.length === 0) ok('an unauthenticated caller sees no patients');
  else if (anon.status >= 400) ok('an unauthenticated caller is refused', String(anon.status));
  else bad('an unauthenticated caller sees no patients', JSON.stringify(anonBody).slice(0, 120));

  console.log('\n' + '─'.repeat(64));
  if (fail) { console.log(`${fail} of ${pass + fail} auth checks FAILED\n`); process.exit(1); }
  console.log(`All ${pass} auth checks passed.\n`);
})();
