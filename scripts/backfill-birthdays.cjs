/**
 * backfill-birthdays.cjs
 * Recovers the birthday month and day from the previous system's export.
 *
 *   node scripts/backfill-birthdays.cjs           # report, change nothing
 *   node scripts/backfill-birthdays.cjs --write   # apply
 *
 * ------------------------------------------------------------------------
 * WHY THE YEAR IS THROWN AWAY
 * ------------------------------------------------------------------------
 * The export's column is headed "Date of Birth" and is not one. Every value
 * carries the CURRENT year, and four of the eight are in the future — Kim
 * Sanchez's reads 2026-10-23 and Robbie Morris's 2026-11-14. Nobody was born
 * next month. It is the NEXT BIRTHDAY, which is a useful thing for a booking
 * system to display and a completely different thing from a date of birth.
 *
 * Importing it as `dob` would have put eight wrong dates of birth into a
 * medical-adjacent record, where a wrong one is worse than a missing one: an
 * absent field prompts somebody to ask, a wrong field is believed. So the
 * original import left dob empty and kept the month and day as a note.
 *
 * A note cannot be sorted or filtered, so "whose birthday is this month" was
 * unanswerable. This moves it to patient.birth_month / birth_day — real
 * columns, no year, honest about what is actually known.
 *
 * The year stays unknown until somebody asks the client. That is the correct
 * state, and a greeting has never needed it.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const WRITE = process.argv.includes('--write');
const slug = 'medbar-loveland';
const FILE = path.resolve(__dirname, '..', 'private', 'clients-export.csv');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map(h => h.trim());
  return rows.filter(r => r.length > 1 && r.some(c => c.trim()))
    .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const key = v => String(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function connectionString() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const pw = process.env.SUPABASE_DB_PASSWORD;
  const region = process.env.SUPABASE_REGION || 'us-east-1';
  if (!ref || !pw) {
    console.error('  SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD must be set in .env.local');
    process.exit(1);
  }
  return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
}

async function main() {
  const rows = parseCsv(fs.readFileSync(FILE, 'utf8'));
  const client = new Client({ connectionString: connectionString() });
  await client.connect();

  const { rows: clinics } = await client.query('select id from clinic where slug = $1', [slug]);
  const clinicId = clinics[0].id;

  const { rows: patients } = await client.query(
    `select id, first_name, last_name, email, phone, birth_month, birth_day
       from patient where clinic_id = $1`, [clinicId]);

  /**
   * Names map to a LIST, not to one record.
   *
   * There are two Carlos Hernandezes in this practice — different phones,
   * different emails, different birthdays. A Map keyed by name keeps only the
   * last one, so both export rows would have resolved to the same person and
   * the second would have silently overwritten the first: one client left with
   * no birthday and one carrying somebody else's.
   *
   * This is the same failure the client import already made once, matching on
   * phone alone and merging two people. A name is not an identity.
   */
  const byName = new Map();
  const byEmail = new Map();
  const byPhone = new Map();

  const digits = v => String(v ?? '').replace(/\D/g, '').slice(-10);

  for (const p of patients) {
    const n = key(`${p.first_name} ${p.last_name}`);
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(p);

    if (p.email) byEmail.set(String(p.email).toLowerCase(), p);
    const d = digits(p.phone);
    if (d.length === 10) {
      if (!byPhone.has(d)) byPhone.set(d, []);
      byPhone.get(d).push(p);
    }
  }

  /** Email, then phone, then an unambiguous name. Anything else is a question. */
  function resolve(row) {
    if (row.Email) {
      const hit = byEmail.get(row.Email.toLowerCase());
      if (hit) return { person: hit, how: 'email' };
    }

    const phone = byPhone.get(digits(row.Phone));
    if (phone && phone.length === 1) return { person: phone[0], how: 'phone' };

    const named = byName.get(key(row.Name)) ?? [];
    if (named.length === 1) return { person: named[0], how: 'name' };
    if (named.length > 1) {
      return { person: null, why: `${named.length} clients share this name and nothing else matches` };
    }
    return { person: null, why: 'no matching client record' };
  }

  const planned = [];
  const unmatched = [];

  for (const r of rows) {
    const raw = r['Date of Birth'];
    if (!raw) continue;

    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) { unmatched.push({ who: r.Name, why: `unreadable value "${raw}"` }); continue; }

    const month = Number(m[2]);
    const day = Number(m[3]);

    const { person, how, why } = resolve(r);
    if (!person) { unmatched.push({ who: r.Name, why }); continue; }

    planned.push({
      id: person.id,
      who: `${person.first_name} ${person.last_name}`,
      how,
      month, day,
      label: `${MONTHS[month - 1]} ${day}`,
      already: person.birth_month === month && person.birth_day === day
    });
  }

  console.log(`\n  ${rows.length} row(s) in the export · ${planned.length} with a birthday\n`);
  for (const p of planned) {
    console.log(`    ${p.who.padEnd(22)} ${p.label.padEnd(14)} matched on ${p.how}${p.already ? '   (already set)' : ''}`);
  }

  if (unmatched.length) {
    console.log(`\n  NOT APPLIED (${unmatched.length}):`);
    for (const u of unmatched) console.log(`    ${u.who} — ${u.why}`);
  }

  const todo = planned.filter(p => !p.already);

  if (!WRITE) {
    console.log(`\n  ${todo.length} to write. Nothing changed. Re-run with --write.\n`);
    await client.end();
    return;
  }

  for (const p of todo) {
    await client.query(
      'update patient set birth_month = $1, birth_day = $2 where id = $3',
      [p.month, p.day, p.id]);
  }

  // The note that stood in for this is now redundant, and leaving it means the
  // same fact in two places that can disagree.
  const cleaned = await client.query(
    `update patient
        set notes_internal = nullif(btrim(regexp_replace(
              notes_internal, 'Birthday[^.]*\\.?', '', 'gi')), '')
      where clinic_id = $1 and notes_internal ~* 'birthday'
      returning id`,
    [clinicId]);

  console.log(`\n  ${todo.length} birthday(s) written.`);
  console.log(`  ${cleaned.rowCount} note(s) tidied — the fact now lives in one place.\n`);

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
