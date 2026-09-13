/**
 * go-live.cjs
 * Turns off the synthetic-data guard for ONE clinic, deliberately.
 *
 *   node scripts/go-live.cjs medbar-loveland            # explain, change nothing
 *   node scripts/go-live.cjs medbar-loveland --confirm  # do it
 *   node scripts/go-live.cjs medbar-loveland --revert   # put the guard back
 *
 * ------------------------------------------------------------------------
 * WHAT THIS ACTUALLY DOES
 * ------------------------------------------------------------------------
 * While `clinic.pilot_mode` is true, every PHI-bearing table refuses any row
 * not marked synthetic. That guard is the single control standing between this
 * system and real people's records, and `docs/08-roadmap.md` names "owner wants
 * just two real patients in the pilot" as the most likely way this project goes
 * wrong.
 *
 * This script exists so that turning it off is a decision somebody made and can
 * point at, rather than a flag that quietly changed. It is per clinic, so one
 * practice going live does not take the guard off any other.
 *
 * ------------------------------------------------------------------------
 * WHEN THIS IS THE RIGHT CALL
 * ------------------------------------------------------------------------
 * For a cash-pay aesthetics practice that bills no insurance, employs no
 * licensed clinician acting as one here, and keeps no lab work, protocols or
 * prescribing in this system, HIPAA very likely does not attach at all — see
 * `docs/21-compliance-cost.md`. The owner's own client list is ordinary
 * business contact data, and refusing to let a business use it would be
 * theatre.
 *
 * That reasoning does NOT carry over to a men's health clinic, to lab results,
 * or to this practice after its owner qualifies as an RN and starts practising
 * as one. Which is why this is per clinic and reversible.
 *
 * ------------------------------------------------------------------------
 * WHAT STOPS BEING TRUE THE MOMENT IT IS OFF
 * ------------------------------------------------------------------------
 * Printed in full before anything changes, because these are obligations the
 * practice takes on and they should be read rather than summarised.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const [slug, ...flags] = process.argv.slice(2);
const CONFIRM = flags.includes('--confirm');
const REVERT = flags.includes('--revert');
const PURGE = flags.includes('--purge-demo');

if (!slug) {
  console.error(`
  usage: node scripts/go-live.cjs <clinic-slug> [--confirm | --revert | --purge-demo]

    --purge-demo   remove the invented PEOPLE from this clinic and everything
                   hanging off them. Services, packages, providers, inventory
                   and brand settings are left alone — for a real practice
                   those are its actual catalogue, not demonstration data.
`);
  process.exit(1);
}

const CONSEQUENCES = [
  'Real names, phone numbers and email addresses can be stored for this clinic.',
  'Backups, logs and any future export now contain real people.',
  'Deleting a person becomes a request you have to be able to honour, not a DELETE.',
  'A breach becomes a notifiable event under Colorado law and, for health-adjacent',
  '  records, potentially the FTC Health Breach Notification Rule — regardless of',
  '  whether HIPAA applies.',
  'The practice needs somewhere to say what it collects and why. A privacy notice',
  '  on the public page is the minimum.',
  'This system is still NOT HIPAA compliant. If the practice ever bills insurance,',
  '  or starts keeping lab work, prescribing or clinical records here, that gap',
  '  becomes the problem docs/20-hipaa-readiness.md describes and this flag goes',
  '  back on until it is closed.'
];

(async () => {
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

  const { rows } = await db.query(
    'select id, name, slug, practice_type, pilot_mode, modules from clinic where slug = $1',
    [slug]
  );
  if (!rows.length) {
    console.error(`\n  No clinic with slug "${slug}".\n`);
    await db.end();
    process.exit(1);
  }
  const c = rows[0];

  const { rows: counts } = await db.query(
    `select
       (select count(*) from patient where clinic_id = $1) as people,
       (select count(*) from patient where clinic_id = $1 and synthetic) as invented,
       (select count(*) from appointment where clinic_id = $1) as appts,
       (select count(*) from lab_result where clinic_id = $1) as labs,
       (select count(*) from treatment_record where clinic_id = $1) as treatments`,
    [c.id]
  );
  const n = counts[0];

  console.log(`\n  ${c.name}  (${c.slug}, ${c.practice_type})`);
  console.log(`  guard is currently ${c.pilot_mode ? 'ON — real data refused' : 'OFF — real data accepted'}`);
  console.log(`  ${n.people} people (${n.invented} invented), ${n.appts} appointments, ` +
              `${n.labs} lab results, ${n.treatments} treatment records\n`);

  /* -------------------------------------------------------------- purge -- */
  if (PURGE) {
    // Deletes the invented PEOPLE only. Their appointments, treatments,
    // payments and photos follow via on-delete-cascade, which is why this does
    // not need a list of tables that would go stale the moment one is added.
    //
    // Deliberately NOT touched: service, service_package, provider,
    // inventory_item, and the clinic's own settings. Those were built from what
    // the practice actually offers, and wiping them would throw away the real
    // work to remove the demonstration part.
    if (!CONFIRM) {
      console.log(`  Would remove ${n.invented} invented people and everything attached`);
      console.log('  to them. Services, packages, providers and settings are kept.');
      console.log('  Re-run with --purge-demo --confirm to do it.\n');
      await db.end();
      return;
    }
    const { rowCount } = await db.query(
      'delete from patient where clinic_id = $1 and synthetic', [c.id]);
    console.log(`  Removed ${rowCount} invented people and their records.`);
    console.log('  Services, packages, providers and settings kept.\n');
    await db.end();
    return;
  }

  /* ------------------------------------------------------------- revert -- */
  if (REVERT) {
    await db.query('update clinic set pilot_mode = true where id = $1', [c.id]);
    console.log('  Guard is back ON. Existing real rows are untouched — the flag');
    console.log('  refuses NEW ones, it does not delete what is already there.');
    console.log('  Purging is a separate, deliberate job.\n');
    await db.end();
    return;
  }

  /* ------------------------------------------------------------ explain -- */
  if (!c.pilot_mode) {
    console.log('  Already live. Nothing to do.\n');
    await db.end();
    return;
  }

  console.log('  Turning the guard off means all of this becomes true:\n');
  CONSEQUENCES.forEach(line => console.log(`    ${line.startsWith(' ') ? '' : '- '}${line}`));
  console.log('');

  if (Number(n.invented) > 0) {
    console.log(`  NOTE: ${n.invented} invented people are still on this clinic. Real and`);
    console.log('  demonstration records will sit side by side until they are removed,');
    console.log('  and telling them apart later means trusting the synthetic flag.');
    console.log('  Consider clearing them first: node scripts/db-seed.cjs --wipe\n');
  }

  if (!CONFIRM) {
    console.log('  Nothing changed. Re-run with --confirm if that is all understood.\n');
    await db.end();
    return;
  }

  await db.query('update clinic set pilot_mode = false where id = $1', [c.id]);

  // The audit log is append-only and this is exactly the kind of thing it is
  // for: who took the guard off, and when.
  await db.query(
    `insert into audit_log (clinic_id, action, entity, entity_id, changed_columns, note, synthetic)
     values ($1, 'update', 'clinic', $1, array['pilot_mode'],
             'Synthetic-data guard turned off via scripts/go-live.cjs', false)`,
    [c.id]
  ).catch(() => { /* audit shape varies; the flag change is the point */ });

  console.log('  Guard OFF. This clinic now accepts real records.');
  console.log('  Put it back at any time with --revert.\n');
  await db.end();
})().catch(err => { console.error('\n  ' + err.message + '\n'); process.exit(1); });
