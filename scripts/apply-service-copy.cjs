/**
 * apply-service-copy.cjs
 * Pushes the service menu copy in medbar-copy.cjs to a LIVE clinic.
 *
 *   node scripts/apply-service-copy.cjs               # report only
 *   node scripts/apply-service-copy.cjs --write       # apply
 *   node scripts/apply-service-copy.cjs --write other-clinic
 *
 * ------------------------------------------------------------------------
 * WHY THIS EXISTS RATHER THAN RE-SEEDING
 * ------------------------------------------------------------------------
 * medbar-copy.cjs reaches the database through generate-medbar-fixtures.cjs and
 * then db-seed.cjs. That path is fine for an empty database and unusable now:
 * the practice is live, the service rows carry real Stripe price ids and real
 * appointment history hanging off them, and re-seeding to fix a sentence would
 * be a gun pointed at all of it.
 *
 * So this touches three columns — description, details, needs_copy — matched on
 * the service NAME, and nothing else. It cannot create a service, cannot delete
 * one, and cannot change a price.
 *
 * ------------------------------------------------------------------------
 * IT WILL NOT OVERWRITE THE PRACTICE'S OWN WORDS
 * ------------------------------------------------------------------------
 * The point of this run is to fill in blanks. If Jamie has since written her own
 * description for a service, that is the authored copy and ours is the guess —
 * so a row whose description differs from what the module expects is REPORTED
 * and skipped, not silently replaced. Pass --force to overwrite deliberately.
 *
 * That rule is what stops this script from being the thing that quietly deletes
 * a practitioner's own writing the next time somebody runs it.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');
const { COPY, NEEDS_COPY, provisionalCopy } = require('./medbar-copy.cjs');

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const FORCE = args.includes('--force');
const slug = args.find(a => !a.startsWith('--')) ?? 'medbar-loveland';

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

const norm = v => (v ?? '').trim();

async function main() {
  const client = new Client({ connectionString: connectionString() });
  await client.connect();

  const { rows } = await client.query(
    `select s.id, s.name, s.category, s.description, s.details, s.needs_copy
       from service s join clinic c on c.id = s.clinic_id
      where c.slug = $1
      order by s.category, s.name`,
    [slug]
  );

  if (rows.length === 0) {
    console.log(`  no services found for ${slug}.`);
    await client.end();
    return;
  }

  const toWrite = [];
  const conflicts = [];
  const untouched = [];
  const noEntry = [];

  for (const s of rows) {
    const copy = COPY[s.name];
    if (!copy) { noEntry.push(s); continue; }

    const wantDesc = copy.description;
    const wantDetails = copy.details ?? null;
    const wantFlag = Boolean(copy.provisional) || NEEDS_COPY.includes(s.name);

    const haveDesc = norm(s.description);

    // Somebody has written their own line here. Ours does not win.
    if (haveDesc && haveDesc !== norm(wantDesc) && !FORCE) {
      conflicts.push({ ...s, wantDesc });
      continue;
    }

    const changed =
      haveDesc !== norm(wantDesc)
      || norm(s.details) !== norm(wantDetails)
      || s.needs_copy !== wantFlag;

    if (!changed) { untouched.push(s); continue; }

    toWrite.push({
      id: s.id, name: s.name, category: s.category,
      description: wantDesc, details: wantDetails, needs_copy: wantFlag,
      basis: copy.provisional ?? 'practice',
      wasBlank: !haveDesc
    });
  }

  /* ------------------------------------------------------------- report -- */
  console.log(`\n  ${slug}: ${rows.length} services\n`);

  if (toWrite.length) {
    console.log(`  ${WRITE ? 'WRITING' : 'WOULD WRITE'} ${toWrite.length}:`);
    let cat = '';
    for (const t of toWrite) {
      if (t.category !== cat) { cat = t.category; console.log(`\n    == ${cat} ==`); }
      const tag = t.basis === 'practice' ? '' : `  [${t.basis}, stays flagged for review]`;
      console.log(`    ${t.wasBlank ? 'was blank' : 'updated  '}  ${t.name}${tag}`);
      console.log(`        "${t.description}"`);
    }
    console.log('');
  }

  if (conflicts.length) {
    console.log(`\n  SKIPPED — the practice has written its own copy (${conflicts.length}):`);
    for (const c of conflicts) {
      console.log(`    ${c.name}`);
      console.log(`        theirs: "${norm(c.description).slice(0, 90)}"`);
      console.log(`        ours:   "${norm(c.wantDesc).slice(0, 90)}"`);
    }
    console.log('\n    Left alone. Pass --force only if you mean to replace their words.');
  }

  if (noEntry.length) {
    console.log(`\n  NO COPY WRITTEN FOR THESE (${noEntry.length}) — the page says so:`);
    for (const s of noEntry) console.log(`    ${s.name}`);
  }

  if (untouched.length) console.log(`\n  ${untouched.length} already correct.`);

  /* -------------------------------------------------------------- write -- */
  if (WRITE && toWrite.length) {
    for (const t of toWrite) {
      await client.query(
        'update service set description = $1, details = $2, needs_copy = $3, updated_at = now() where id = $4',
        [t.description, t.details, t.needs_copy, t.id]
      );
    }
    console.log(`\n  ${toWrite.length} service(s) updated.`);
  } else if (toWrite.length) {
    console.log('  Nothing written. Re-run with --write to apply.');
  }

  /* --------------------------------------------------- what needs Jamie -- */
  const prov = provisionalCopy();
  if (prov.length) {
    console.log(`\n  ${prov.length} of these are OUR words, not hers, and stay flagged`);
    console.log('  in the console until she replaces them:');
    for (const p of prov) console.log(`    [${p.basis}] ${p.name}`);
    console.log('\n  "modality" = a factual description of the treatment type.');
    console.log('  "name"     = restates what she already calls it, nothing more.\n');
  }

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
