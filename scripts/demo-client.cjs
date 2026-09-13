/**
 * demo-client.cjs
 * Creates (or repairs) the one invented client used to demonstrate the portal.
 *
 *   node scripts/demo-client.cjs medbar-loveland
 *
 * WHY THIS EXISTS
 * Purging the demonstration people from a clinic that has gone live also removes
 * the client behind the portal login, and the portal then bounces to sign-in —
 * which looks like a broken feature rather than a missing row.
 *
 * The alternative is worse: pointing a shared demo login at one of the real
 * imported clients would hand anybody with the demo password a real person's
 * record. So the demo client is invented, named so nobody mistakes it for a
 * customer, and marked synthetic even though the clinic no longer requires it.
 *
 * That synthetic flag is doing real work now. On a live clinic it is the only
 * thing separating "this is a demonstration record" from "this is a client",
 * which is exactly why go-live.cjs warns about the two sitting side by side.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const slug = process.argv[2];
const LOGIN = process.argv[3] ?? 'delphine@medbar.pilot.invalid';

if (!slug) {
  console.error('\n  usage: node scripts/demo-client.cjs <clinic-slug> [login-email]\n');
  process.exit(1);
}

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

  const { rows: clinics } = await db.query('select id, name from clinic where slug = $1', [slug]);
  if (!clinics.length) { console.error(`\n  No clinic "${slug}".\n`); process.exit(1); }
  const clinic = clinics[0];

  const { rows: users } = await db.query(
    'select id from auth.users where email = $1', [LOGIN]);
  if (!users.length) {
    console.error(`\n  No auth user ${LOGIN}. Run scripts/db-users.cjs first.\n`);
    process.exit(1);
  }
  const authId = users[0].id;

  const { rows: existing } = await db.query(
    'select id, first_name, last_name from patient where auth_user_id = $1 and clinic_id = $2',
    [authId, clinic.id]
  );

  if (existing.length) {
    console.log(`\n  Already linked: ${existing[0].first_name} ${existing[0].last_name}\n`);
    await db.end();
    return;
  }

  const { rows: created } = await db.query(
    `insert into patient
       (clinic_id, first_name, last_name, email, phone, status,
        acquisition_source, notes_internal, auth_user_id, synthetic)
     values ($1, 'Demo', 'Client', $2, '+19705550100', 'active', 'other',
             'Invented record for demonstrating the client portal. Not a customer.',
             $3, true)
     returning id, first_name, last_name`,
    [clinic.id, LOGIN, authId]
  );

  console.log(`\n  Created ${created[0].first_name} ${created[0].last_name} on ${clinic.name},`);
  console.log(`  linked to ${LOGIN}, marked synthetic.\n`);
  await db.end();
})().catch(err => { console.error('\n  ' + err.message + '\n'); process.exit(1); });
