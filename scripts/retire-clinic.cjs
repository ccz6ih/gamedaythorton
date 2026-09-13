/**
 * retire-clinic.cjs
 * Takes a tenant out of service without destroying it.
 *
 *   node scripts/retire-clinic.cjs gameday-thornton              # explain, change nothing
 *   node scripts/retire-clinic.cjs gameday-thornton --confirm    # retire it
 *   node scripts/retire-clinic.cjs gameday-thornton --restore    # put it back
 *
 * ------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ------------------------------------------------------------------------
 * medbarco.com/c/gameday-thornton returned 200 on the live domain, serving a
 * second clinic's page complete with the notice "all client records shown
 * anywhere in this system are invented". Every tenant in the database is
 * reachable from every domain pointed at this deployment, because the rewrite
 * decides what the ROOT serves and does nothing about /c/<slug>.
 *
 * That is fine while both tenants are pilots and nobody has a real domain. It
 * stops being fine the moment one of them is a real business whose customers
 * can find the other one.
 *
 * ------------------------------------------------------------------------
 * WHY RETIRE AND NOT DELETE
 * ------------------------------------------------------------------------
 * Deleting the clinic row cascades through thirty-odd tables and takes the
 * multi-tenant test coverage with it. `npm run test:db` includes a deliberate
 * cross-tenant read attempt, and the storefront suite asserts that the clinic
 * list contains only opted-in practices — both need a second tenant to be
 * meaningful. Delete it and those checks pass vacuously, which is worse than
 * not having them: a tenant-isolation bug would then ship silently.
 *
 * So the second tenant stays in the database as synthetic data, and stops being
 * reachable by anyone. Everything this does is one UPDATE and is reversible
 * with --restore.
 *
 * If you genuinely want it gone, that is a separate, irreversible decision:
 *   delete from clinic where slug = 'gameday-thornton';
 * Do not add a --delete flag to this script. Making destruction one flag away
 * from a routine operation is how it happens by accident.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const args = process.argv.slice(2);
const slug = args.find(a => !a.startsWith('--'));
const CONFIRM = args.includes('--confirm');
const RESTORE = args.includes('--restore');
// Closing the accounts is a SEPARATE decision from hiding the public page.
const DISABLE_LOGINS = args.includes('--disable-logins');

if (!slug) {
  console.error('\n  Which clinic?  node scripts/retire-clinic.cjs <slug> [--confirm|--restore]\n');
  process.exit(1);
}

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
  const client = new Client({ connectionString: connectionString() });
  await client.connect();

  const { rows } = await client.query(
    `select c.id, c.slug, c.name, c.listed, c.active, c.site_live, c.pilot_mode,
            (select count(*) from staff_user s where s.clinic_id = c.id and s.active) as staff,
            (select count(*) from patient p where p.clinic_id = c.id) as clients
       from clinic c where c.slug = $1`,
    [slug]
  );

  const c = rows[0];
  if (!c) { console.error(`\n  No clinic with slug ${slug}.\n`); process.exit(1); }

  console.log(`\n  ${c.name}  (${c.slug})`);
  console.log(`    listed ${c.listed} · active ${c.active} · site_live ${c.site_live} · pilot_mode ${c.pilot_mode}`);
  console.log(`    ${c.staff} active staff account(s), ${c.clients} client record(s)\n`);

  if (RESTORE) {
    await client.query('update clinic set listed = true, active = true where id = $1', [c.id]);
    const back = await client.query(
      'update staff_user set active = true where clinic_id = $1 and not active returning name',
      [c.id]);
    console.log(`  Restored: listed and active again, ${back.rowCount} sign-in(s) re-enabled.\n`);
    await client.end();
    return;
  }

  if (!CONFIRM) {
    console.log('  WHAT --confirm WOULD DO');
    console.log('    clinic.listed  -> false   its /c/<slug> page stops resolving for the public');
    console.log('');
    console.log('  WHAT IT DELIBERATELY LEAVES ALONE');
    console.log('    clinic.active   stays true, and staff sign-ins keep working.');
    console.log('');
    console.log('    An earlier version of this script also cleared `active` and');
    console.log('    deactivated every staff row, and that was wrong in a way worth');
    console.log('    writing down: the stated reason for retiring rather than deleting');
    console.log('    was to keep the second tenant so the cross-tenant isolation tests');
    console.log('    stay meaningful. Deactivating its staff meant those tests could no');
    console.log('    longer sign in — so the coverage was lost anyway, while the row');
    console.log('    count made it look preserved. That is the worst of both.');
    console.log('');
    console.log('    The requirement was PUBLIC invisibility. `listed` is the flag that');
    console.log('    delivers it, and it is the only one this touches. Use');
    console.log('    --disable-logins if you also want the accounts closed.');
    console.log('');
    console.log('    clinic.pilot_mode is left ON, so its tables still refuse real rows.');
    console.log('');
    console.log('  Reversible with --restore.\n');
    console.log('  Nothing changed. Re-run with --confirm.\n');
    await client.end();
    return;
  }

  await client.query('begin');
  try {
    await client.query('update clinic set listed = false where id = $1', [c.id]);

    let staff = { rows: [] };
    if (DISABLE_LOGINS) {
      staff = await client.query(
        'update staff_user set active = false where clinic_id = $1 and active returning name, role',
        [c.id]
      );
    }
    await client.query('commit');

    console.log('  Retired.');
    console.log('    clinic unlisted — its public page stops resolving');
    if (DISABLE_LOGINS) {
      for (const s of staff.rows) console.log(`    sign-in disabled: ${s.name} (${s.role})`);
    } else {
      console.log('    staff sign-ins left working (use --disable-logins to close them)');
    }
    console.log('\n  Its /c/' + slug + ' page will 404 for the public on the next request.');
    console.log('  Nothing was deleted. --restore puts it back.\n');
  } catch (err) {
    await client.query('rollback');
    throw err;
  }

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
