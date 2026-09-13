/**
 * notes-test.cjs
 * Proves treatment notes cannot be rewritten.
 *
 * The append-only guarantee is the entire reason to trust a treatment note, and
 * it is enforced in two independent places — a revoked privilege and a trigger.
 * Two enforcers are worth having and worth checking, because "we revoked
 * UPDATE" is exactly the kind of claim that stays in a comment after somebody
 * adds a policy that grants it back.
 *
 * Every check here signs in as a real staff member through the real API and
 * TRIES to do the forbidden thing. Passing means the database said no.
 *
 * Run:  node scripts/notes-test.cjs
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

function api(token) {
  return async (pathAndQuery, opts = {}) => {
    const res = await fetch(`${URL_SB}/rest/v1/${pathAndQuery}`, {
      ...opts,
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(opts.headers || {})
      }
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  };
}

(async () => {
  console.log('\nTREATMENT NOTES — append only\n');

  if (!URL_SB || !KEY) { console.error('  Missing Supabase config.\n'); process.exit(1); }
  if (!PW) {
    console.log('  SKIPPED: MEDBAR_OWNER_PASSWORD is not set in .env.local.\n');
    process.exit(0);
  }

  const db = api(await signIn());
  ok('signed in');

  // A client of this practice to hang the test note on.
  const { body: patients } = await db('patient?select=id,clinic_id&limit=1');
  if (!Array.isArray(patients) || !patients.length) {
    bad('found a client to test against');
    process.exit(1);
  }
  const { id: patientId, clinic_id: clinicId } = patients[0];

  let noteId = null;
  let amendmentId = null;

  try {
    /* ------------------------------------------------------------ write -- */
    const created = await db('client_note', {
      method: 'POST',
      body: JSON.stringify({
        clinic_id: clinicId,
        patient_id: patientId,
        author_name: 'Append-Only Test',
        subjective: 'Original text, written once.',
        kind: 'soap',
        synthetic: true
      })
    });

    if (created.status < 300 && Array.isArray(created.body) && created.body[0]) {
      noteId = created.body[0].id;
      ok('a note can be written');
    } else {
      bad('a note can be written', JSON.stringify(created.body).slice(0, 200));
      process.exit(1);
    }

    /* ----------------------------------------------------- cannot change -- */
    const updated = await db(`client_note?id=eq.${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ subjective: 'Quietly rewritten.' })
    });

    if (updated.status >= 400) {
      ok('the note CANNOT be updated', `refused (${updated.status})`);
    } else {
      bad('the note CANNOT be updated',
          'a treatment note was rewritten — the append-only guarantee is gone');
    }

    // And confirm the text really is untouched, rather than trusting the code.
    const { body: after } = await db(`client_note?id=eq.${noteId}&select=subjective`);
    if (Array.isArray(after) && after[0]?.subjective === 'Original text, written once.') {
      ok('and the original text is intact');
    } else {
      bad('and the original text is intact', JSON.stringify(after).slice(0, 200));
    }

    /* ----------------------------------------------------- cannot delete -- */
    const deleted = await db(`client_note?id=eq.${noteId}`, { method: 'DELETE' });
    if (deleted.status >= 400) {
      ok('the note CANNOT be deleted', `refused (${deleted.status})`);
    } else {
      bad('the note CANNOT be deleted', 'a treatment note was destroyed');
    }

    const { body: still } = await db(`client_note?id=eq.${noteId}&select=id`);
    if (Array.isArray(still) && still.length === 1) ok('and it is still there');
    else bad('and it is still there', 'the note is gone');

    /* -------------------------------------------------- amendments work -- */
    const amended = await db('client_note', {
      method: 'POST',
      body: JSON.stringify({
        clinic_id: clinicId,
        patient_id: patientId,
        author_name: 'Append-Only Test',
        kind: 'amendment',
        amends_id: noteId,
        body: 'Correction added later. Both are visible.',
        synthetic: true
      })
    });

    if (amended.status < 300 && Array.isArray(amended.body) && amended.body[0]) {
      amendmentId = amended.body[0].id;
      ok('a correction CAN be added as an amendment');
    } else {
      bad('a correction CAN be added as an amendment', JSON.stringify(amended.body).slice(0, 200));
    }

    /* ------------------------------------------------- shape is enforced -- */
    // An amendment with nothing to amend, and a normal note claiming to be one:
    // both are incoherent and the check constraint should refuse both.
    const orphan = await db('client_note', {
      method: 'POST',
      body: JSON.stringify({
        clinic_id: clinicId, patient_id: patientId, author_name: 'Append-Only Test',
        kind: 'amendment', body: 'amends nothing', synthetic: true
      })
    });
    if (orphan.status >= 400) ok('an amendment with no parent is refused', `refused (${orphan.status})`);
    else bad('an amendment with no parent is refused', 'orphan amendment accepted');

    const empty = await db('client_note', {
      method: 'POST',
      body: JSON.stringify({
        clinic_id: clinicId, patient_id: patientId, author_name: 'Append-Only Test',
        kind: 'soap', synthetic: true
      })
    });
    if (empty.status >= 400) ok('an entirely empty note is refused', `refused (${empty.status})`);
    else bad('an entirely empty note is refused', 'a note with no content was accepted');

    /* ------------------------------------------- photos are not public -- */
    const anonRead = await fetch(`${URL_SB}/rest/v1/client_note?select=id&limit=1`, {
      headers: { apikey: KEY }
    });
    if (anonRead.status >= 400 || (await anonRead.json().catch(() => [])).length === 0) {
      ok('an anonymous visitor cannot read notes');
    } else {
      bad('an anonymous visitor cannot read notes', 'treatment notes are world-readable');
    }

  } finally {
    /* ---------------------------------------------------------- cleanup -- */
    /**
     * These rows cannot be deleted through the API — that is the whole point of
     * the suite — so cleanup goes in through the break-glass path in migration
     * 0020, as an administrator on a direct connection.
     *
     * That it needs the break-glass path at all is the argument FOR having one.
     * The first version of this trigger refused every role including the owner,
     * and the immediate consequence was two rows named "Append-Only Test"
     * permanently attached to a real client's chart with no way to remove them.
     * A test that cannot clean up after itself on a live database is not a test
     * anybody will keep running.
     */
    console.log('\nCLEANUP');

    const { Client } = require('pg');
    const ref = process.env.SUPABASE_PROJECT_REF;
    const dbpw = process.env.SUPABASE_DB_PASSWORD;

    if (!ref || !dbpw) {
      bad('test notes removed',
          'SUPABASE_PROJECT_REF / SUPABASE_DB_PASSWORD are not set, so the rows ' +
          "this run created are still on a client's chart. Set them and re-run.");
    } else {
      const region = process.env.SUPABASE_REGION || 'us-east-1';
      const admin = new Client({
        connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(dbpw)}@aws-0-${region}.pooler.supabase.com:6543/postgres`
      });
      await admin.connect();

      // Amendments first: amends_id is ON DELETE RESTRICT, so a parent cannot
      // go while a correction still points at it.
      await admin.query(
        `delete from client_note where author_name = 'Append-Only Test' and amends_id is not null`);
      await admin.query(
        `delete from client_note where author_name = 'Append-Only Test'`);

      const { rows } = await admin.query(
        `select count(*)::int as n from client_note where author_name = 'Append-Only Test'`);
      await admin.end();

      if (rows[0].n === 0) ok('test notes removed', 'via the break-glass path, and verified gone');
      else bad('test notes removed', `${rows[0].n} left on a real chart`);
    }
  }

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
