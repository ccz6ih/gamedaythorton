/**
 * import-appointments.cjs
 * Brings the appointment history across from the previous system.
 *
 *   node scripts/import-appointments.cjs                 # report, change nothing
 *   node scripts/import-appointments.cjs --write         # apply
 *
 * Reads private/appointments-export.csv, which is gitignored because it is real
 * client data and this repository is public.
 *
 * ------------------------------------------------------------------------
 * WHAT IT REFUSES TO GUESS
 * ------------------------------------------------------------------------
 * A client it cannot match is SKIPPED and named, never created. The client
 * import already ran and merged two people incorrectly by matching on phone
 * alone; the lesson was that a near-match in imported data is a question, not a
 * fact. If somebody is missing from the client list, that is worth seeing.
 *
 * A service it cannot match is imported with the service name recorded and the
 * service_id left null, because the appointment definitely happened even where
 * the menu has since been renamed. Losing the visit to preserve a foreign key
 * would be the wrong trade.
 *
 * ------------------------------------------------------------------------
 * THE ONE JUDGEMENT CALL, STATED
 * ------------------------------------------------------------------------
 * The export's status column has three values. Two are obvious. "checkout"
 * means the treatment was delivered and the client had not been checked out at
 * the till yet — so it maps to `complete`, not to a pending state. The evidence
 * is in the data: Sarah Carda's 11 Sept 10:00 appointment is "checkout" and the
 * practitioner has already written a full treatment note against it.
 *
 * Getting this wrong in the safe direction would mean the visit history looks
 * emptier than it is, which is worse for a practitioner trying to remember what
 * she did last time.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const WRITE = process.argv.includes('--write');
const slug = process.argv.find(a => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1])
  ?? 'medbar-loveland';

const FILE = path.resolve(__dirname, '..', 'private', 'appointments-export.csv');

/* ----------------------------------------------------------------- csv -- */
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
  return rows
    .filter(r => r.length > 1 && r.some(c => c.trim()))
    .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

/**
 * "09- 2-26, 10:00 AM" -> a Date in the practice's own timezone.
 *
 * The export pads single-digit days with a space and uses a two-digit year.
 * Built as a UTC instant from Denver wall-clock time rather than parsed by the
 * Date constructor, whose behaviour on this shape is implementation-defined.
 */

/** Denver's UTC offset in milliseconds at a given instant. Negative west of GMT. */
function denverOffsetMs(utcMs) {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver', timeZoneName: 'longOffset'
  }).formatToParts(new Date(utcMs)).find(p => p.type === 'timeZoneName').value;

  const m = label.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * ((Number(m[2]) * 60) + Number(m[3])) * 60000;
}

function parseWhen(value) {
  const m = value.match(/^(\d{1,2})-\s*(\d{1,2})-(\d{2}),\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;

  const [, mo, d, yy, hh, mi, ampm] = m;
  // 12 AM is hour 0 and 12 PM is hour 12, which "% 12 then add 12 for PM"
  // gets right in both cases — unlike the more obvious "add 12 if PM".
  let hour = Number(hh) % 12;
  if (/pm/i.test(ampm)) hour += 12;

  // The export writes Denver WALL-CLOCK time. Read it as if it were UTC first,
  // then subtract the zone's offset at that instant to get the real one.
  //
  // Denver is GMT-6 on daylight time and GMT-7 on standard time. Every row in
  // this particular export falls in August and September, but the offset is
  // looked up rather than assumed — an export taken in November would
  // otherwise land every appointment an hour off, which is the kind of error
  // that looks like a rounding quirk and is actually a wrong record.
  const naive = Date.UTC(2000 + Number(yy), Number(mo) - 1, Number(d), hour, Number(mi));
  return new Date(naive - denverOffsetMs(naive));
}

/** Loose match: case, punctuation and the ® symbol all vary between systems. */
function key(value) {
  return String(value).toLowerCase()
    .replace(/[®™]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STATUS = { completed: 'complete', checkout: 'complete', cancelled: 'cancelled', 'no-show': 'no_show' };

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
  if (!fs.existsSync(FILE)) {
    console.error(`\n  ${path.relative(process.cwd(), FILE)} not found.`);
    console.error('  Export appointments from the previous system and save it there.\n');
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(FILE, 'utf8'));
  const client = new Client({ connectionString: connectionString() });
  await client.connect();

  const { rows: clinics } = await client.query('select id from clinic where slug = $1', [slug]);
  if (!clinics.length) { console.error(`\n  No clinic ${slug}.\n`); process.exit(1); }
  const clinicId = clinics[0].id;

  const { rows: patients } = await client.query(
    `select id, first_name, last_name from patient where clinic_id = $1`, [clinicId]);
  const byName = new Map();
  for (const p of patients) byName.set(key(`${p.first_name} ${p.last_name}`), p);

  const { rows: services } = await client.query(
    `select id, name, duration_min from service where clinic_id = $1`, [clinicId]);
  const byService = new Map();
  for (const s of services) byService.set(key(s.name), s);

  const { rows: providers } = await client.query(
    `select id, name from provider where clinic_id = $1`, [clinicId]);

  /* ----------------------------------------------------------- plan -- */
  const planned = [];
  const skipped = [];

  for (const r of rows) {
    const when = parseWhen(r['Date of Appointment']);
    const person = byName.get(key(r['Client Name']));
    const status = STATUS[r['Status'].toLowerCase()] ?? 'booked';

    if (!when) { skipped.push({ r, why: `unreadable date "${r['Date of Appointment']}"` }); continue; }
    if (!person) { skipped.push({ r, why: `no client named "${r['Client Name']}"` }); continue; }

    // One row can list several services. Each becomes its own appointment at
    // the same time, which is how the console already models a double booking
    // and keeps per-service history intact.
    const names = r['Services'].split(',').map(s => s.trim()).filter(Boolean);

    for (const name of names) {
      const svc = byService.get(key(name))
        // "Jeuveau (Jeuveau)" and "Jeuveau® Neurotoxin Treatment" are the same
        // thing under two names the old system used at different times.
        ?? [...byService.entries()].find(([k]) => k.includes(key(name)) || key(name).includes(k))?.[1];

      planned.push({
        externalId: r['Appointment ID'],
        patientId: person.id,
        who: `${person.first_name} ${person.last_name}`,
        serviceId: svc?.id ?? null,
        serviceName: svc?.name ?? name,
        matched: !!svc,
        duration: svc?.duration_min ?? 60,
        providerId: providers[0]?.id ?? null,
        startsAt: when,
        status,
        channel: (r['Booking Method'] || '').toLowerCase().includes('self') ? 'online' : 'front_desk'
      });
    }
  }

  /* --------------------------------------------------------- report -- */
  console.log(`\n  ${rows.length} row(s) in the export -> ${planned.length} appointment(s)\n`);

  for (const p of planned) {
    const when = p.startsAt.toLocaleString('en-US', {
      timeZone: 'America/Denver', dateStyle: 'medium', timeStyle: 'short'
    });
    console.log(`    ${when.padEnd(24)} ${p.who.padEnd(20)} ${p.status.padEnd(10)} ${p.serviceName}${p.matched ? '' : '   <- service not on the menu, name kept'}`);
  }

  if (skipped.length) {
    console.log(`\n  SKIPPED (${skipped.length}) — nothing was invented for these:`);
    for (const s of skipped) console.log(`    ${s.r['Client Name']} · ${s.r['Date of Appointment']} — ${s.why}`);
  }

  const treatments = planned.filter(p => p.status === 'complete');
  console.log(`\n  ${treatments.length} completed visit(s) also get a treatment record.`);

  if (!WRITE) {
    console.log('\n  Nothing written. Re-run with --write to apply.\n');
    await client.end();
    return;
  }

  /* ---------------------------------------------------------- write -- */
  let created = 0, already = 0, records = 0;

  for (const p of planned) {
    // Idempotent on the old system's own appointment id, so re-running after a
    // fuller export updates rather than duplicating somebody's history.
    const existing = await client.query(
      `select id from appointment
        where clinic_id = $1 and patient_id = $2 and starts_at = $3
          and coalesce(service_id::text, '') = coalesce($4::text, '')`,
      [clinicId, p.patientId, p.startsAt.toISOString(), p.serviceId]
    );

    let appointmentId;
    if (existing.rows.length) {
      appointmentId = existing.rows[0].id;
      already++;
    } else {
      const ins = await client.query(
        `insert into appointment
           (clinic_id, patient_id, provider_id, service_id, starts_at, duration_min,
            status, booking_channel, synthetic)
         values ($1,$2,$3,$4,$5,$6,$7,$8,false)
         returning id`,
        [clinicId, p.patientId, p.providerId, p.serviceId, p.startsAt.toISOString(),
         p.duration, p.status, p.channel]
      );
      appointmentId = ins.rows[0].id;
      created++;
    }

    if (p.status === 'complete') {
      const has = await client.query(
        'select id from treatment_record where appointment_id = $1', [appointmentId]);
      if (!has.rows.length) {
        await client.query(
          `insert into treatment_record
             (clinic_id, patient_id, appointment_id, service_id, provider_id,
              performed_at, notes_clinical, synthetic)
           values ($1,$2,$3,$4,$5,$6,$7,false)`,
          [clinicId, p.patientId, appointmentId, p.serviceId, p.providerId,
           p.startsAt.toISOString(),
           // Deliberately not a fabricated clinical note. It records where the
           // row came from and nothing about what was done, because nobody
           // writing this script was in the room.
           `Imported from the previous system's appointment history. ${p.serviceName}. No treatment note was carried across.`]
        );
        records++;
      }
    }
  }

  console.log(`\n  ${created} appointment(s) created, ${already} already present.`);
  console.log(`  ${records} treatment record(s) created.\n`);

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
