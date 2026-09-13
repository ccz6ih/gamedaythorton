/**
 * import-clients.cjs
 * Brings a real client list in from a GlossGenius CSV export.
 *
 *   node scripts/import-clients.cjs private/clients-export.csv <clinic-slug>
 *   node scripts/import-clients.cjs private/clients-export.csv medbar-loveland --apply
 *
 * DRY RUN BY DEFAULT. Without --apply it reads, validates and reports, and
 * writes nothing. A client list is the one import you cannot undo by hand.
 *
 * ------------------------------------------------------------------------
 * THIS WRITES REAL PEOPLE
 * ------------------------------------------------------------------------
 * Every other script in this repo works on invented data. This one does not,
 * and the clinic must have pilot_mode off before it will run — the database
 * refuses non-synthetic rows while that flag is on, and this script does not
 * turn it off for you. Use scripts/go-live.cjs, which makes that its own
 * deliberate step with its own record.
 *
 * The source file belongs in private/, which is gitignored. This repository is
 * public.
 *
 * ------------------------------------------------------------------------
 * WHAT THE EXPORT GETS WRONG, AND WHAT THIS DOES ABOUT IT
 * ------------------------------------------------------------------------
 * 1. "Date of Birth" is not a date of birth. Every value in the sample carried
 *    the CURRENT year — four of them in the future. It is the next birthday,
 *    not the birth date. Importing it as a DOB would record every one of these
 *    people as an infant, and a wrong date of birth on a health record is worse
 *    than none. The month and day are kept as a note; the DOB column is left
 *    empty for the practice to fill in.
 *
 * 2. Duplicates are reported, never merged. Two "Carlos Hernandez" rows with
 *    different numbers may be two people. Two rows sharing a phone may be a
 *    couple, or one person entered twice. A script cannot tell, and guessing
 *    wrong merges two clients' histories.
 *
 * 3. Single-word names are kept as a first name with no surname, rather than
 *    being split or padded. "Tracy" is what the practice knows.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const [file, slug, ...flags] = process.argv.slice(2);
const APPLY = flags.includes('--apply');

if (!file || !slug) {
  console.error(`
  usage: node scripts/import-clients.cjs <csv> <clinic-slug> [--apply]

    csv           a GlossGenius client export. Put it in private/
    clinic-slug   e.g. medbar-loveland
    --apply       actually write. Without it this is a dry run.
`);
  process.exit(1);
}

/* ------------------------------------------------------------------ parse -- */

function parseCsv(text) {
  const rows = [];
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  const header = splitLine(lines[0]).map(h => h.trim().toLowerCase());

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = splitLine(line);
    const row = {};
    header.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    rows.push(row);
  }
  return rows;
}

/** Handles quoted cells containing commas, which real exports do contain. */
function splitLine(line) {
  const out = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function splitName(full) {
  const parts = full.replace(/\s+/g, ' ').trim().split(' ');
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

/** Digits only, then formatted the way the app stores numbers. */
function normalisePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits ? `+${digits}` : null;
}

/* ------------------------------------------------------------------- run -- */

(async () => {
  const raw = fs.readFileSync(path.resolve(file), 'utf8');
  const rows = parseCsv(raw);

  const people = [];
  const notes = { futureDob: [], noEmail: [], noSurname: [], banned: [] };

  for (const r of rows) {
    const name = r.name || r['client name'] || '';
    if (!name.trim()) continue;

    const { first, last } = splitName(name);
    if (!last) notes.noSurname.push(name);

    const email = (r.email || '').trim().toLowerCase() || null;
    if (!email) notes.noEmail.push(name);

    const dobRaw = (r['date of birth'] || r.dob || '').trim();
    let birthdayNote = null;
    if (dobRaw) {
      const d = new Date(dobRaw + 'T00:00:00Z');
      if (!isNaN(d.getTime())) {
        birthdayNote = `Birthday ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
        notes.futureDob.push(`${name} → ${dobRaw}`);
      }
    }

    if ((r.banned || '').trim()) notes.banned.push(name);

    people.push({
      first_name: first,
      last_name: last,
      email,
      phone: normalisePhone(r.phone),
      // The export's year is wrong on every row, so the column stays empty and
      // the part that IS real is kept where a person can see and confirm it.
      dob: null,
      notes_internal: [
        birthdayNote,
        'Imported from the previous booking system.'
      ].filter(Boolean).join(' · ')
    });
  }

  /* --------------------------------------------------------- duplicates -- */
  const byPhone = new Map();
  const byName = new Map();
  for (const p of people) {
    if (p.phone) {
      if (!byPhone.has(p.phone)) byPhone.set(p.phone, []);
      byPhone.get(p.phone).push(`${p.first_name} ${p.last_name}`.trim());
    }
    const key = `${p.first_name} ${p.last_name}`.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(p.phone ?? 'no phone');
  }
  const dupPhone = [...byPhone.entries()].filter(([, n]) => n.length > 1);
  const dupName = [...byName.entries()].filter(([, v]) => v.length > 1);

  /* -------------------------------------------------------------- report -- */
  console.log(`\nCLIENT IMPORT${APPLY ? '' : ' — DRY RUN, nothing will be written'}\n`);
  console.log(`  source   ${file}`);
  console.log(`  clinic   ${slug}`);
  console.log(`  people   ${people.length}\n`);

  if (notes.futureDob.length) {
    console.log(`  ${notes.futureDob.length} rows carried a "Date of Birth" that is not one —`);
    console.log(`  the export writes the NEXT BIRTHDAY, with the current year:`);
    notes.futureDob.slice(0, 4).forEach(n => console.log(`      ${n}`));
    if (notes.futureDob.length > 4) console.log(`      …and ${notes.futureDob.length - 4} more`);
    console.log(`  Date of birth is left EMPTY. The month and day are kept as a note.\n`);
  }

  if (dupName.length) {
    console.log(`  ${dupName.length} duplicate name(s) — NOT merged, because a script cannot`);
    console.log(`  tell two people apart from one person entered twice:`);
    dupName.forEach(([n, phones]) => console.log(`      ${n} (${phones.join(', ')})`));
    console.log('');
  }

  if (dupPhone.length) {
    console.log(`  ${dupPhone.length} shared phone number(s) — could be a couple, or a duplicate:`);
    dupPhone.forEach(([p, names]) => console.log(`      ${p}: ${names.join(' + ')}`));
    console.log('');
  }

  if (notes.noEmail.length) console.log(`  ${notes.noEmail.length} with no email address.`);
  if (notes.noSurname.length) console.log(`  ${notes.noSurname.length} with no surname: ${notes.noSurname.join(', ')}`);
  if (notes.banned.length) console.log(`  ${notes.banned.length} marked banned in the export: ${notes.banned.join(', ')}`);
  console.log('');

  if (!APPLY) {
    console.log('  Nothing written. Re-run with --apply when the above reads right.\n');
    return;
  }

  /* -------------------------------------------------------------- write -- */
  const ref = process.env.SUPABASE_PROJECT_REF;
  const db = new Client({
    host: process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`,
    port: Number(process.env.SUPABASE_DB_PORT || 5432),
    user: process.env.SUPABASE_DB_USER || 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();

  const { rows: clinics } = await db.query(
    'select id, name, pilot_mode from clinic where slug = $1', [slug]);
  if (!clinics.length) {
    console.error(`  No clinic with slug "${slug}".\n`);
    process.exit(1);
  }
  const clinic = clinics[0];

  if (clinic.pilot_mode) {
    console.error(`
  ${clinic.name} still has pilot_mode ON, so the database will refuse every one
  of these rows — they are real people and the guard exists to stop exactly
  this happening by accident.

  Turning it off is a deliberate step with consequences. Run:

      node scripts/go-live.cjs ${slug}

  and read what it tells you before confirming.
`);
    await db.end();
    process.exit(1);
  }

  let inserted = 0, skipped = 0;
  const skippedWho = [];

  for (const p of people) {
    /**
     * Re-running must not duplicate anyone, but matching on phone ALONE merges
     * two different people who share a number — which this very export contains
     * twice. An earlier version did exactly that and silently dropped Sandy
     * Juarez and Tracy, while the report above promised nothing was merged.
     *
     * So: an email match is identity, since addresses are personal. A phone
     * match only counts when the name matches too. Anything else goes in as its
     * own record and shows up in the duplicates list for a person to resolve.
     */
    const { rows: existing } = await db.query(
      `select id from patient
        where clinic_id = $1
          and (
            (email is not null and $3 <> '' and lower(email) = lower($3))
            or (
              phone is not null and phone = $2
              and lower(first_name) = lower($4) and lower(last_name) = lower($5)
            )
          )
        limit 1`,
      [clinic.id, p.phone, p.email ?? '', p.first_name, p.last_name]
    );

    if (existing.length) {
      skipped++;
      skippedWho.push(`${p.first_name} ${p.last_name}`.trim());
      continue;
    }

    await db.query(
      `insert into patient
         (clinic_id, first_name, last_name, email, phone, dob,
          notes_internal, status, acquisition_source, synthetic)
       values ($1,$2,$3,$4,$5,$6,$7,'active','import',false)`,
      [clinic.id, p.first_name, p.last_name, p.email, p.phone, p.dob, p.notes_internal]
    );
    inserted++;
  }

  console.log(`  ${inserted} imported, ${skipped} already present.`);
  if (skippedWho.length) console.log(`  already there: ${skippedWho.join(', ')}`);
  console.log('');
  await db.end();
})().catch(err => { console.error('\n  ' + err.message + '\n'); process.exit(1); });
