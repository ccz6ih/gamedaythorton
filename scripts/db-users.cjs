/**
 * db-users.cjs
 * Creates sign-in accounts for the seeded tenants and links them to their
 * staff_user / patient rows.
 *
 * WHY PASSWORDS AND NOT MAGIC LINKS
 * Magic links are the production design (docs/04 P03) and they stay the
 * production design. But a pilot has to be usable by one person on a clinic
 * iPad without waiting on an inbox, so these accounts exist alongside it. They
 * are created with the same bcrypt hashing GoTrue uses, so they are ordinary
 * Supabase accounts, not a bypass.
 *
 * THESE ARE PILOT ACCOUNTS AND MUST NOT SURVIVE PHASE C.
 * Shared credentials are explicitly on the deferred list (docs/09 C10). Before a
 * real patient exists: delete these, require per-user accounts, and turn on MFA
 * for staff.
 *
 * Run:  node scripts/db-users.cjs
 *       node scripts/db-users.cjs --delete
 */

const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const DELETE = process.argv.includes('--delete');
const PASSWORD = process.env.PILOT_DEMO_PASSWORD;

if (!PASSWORD && !DELETE) {
  console.error('\n  PILOT_DEMO_PASSWORD is not set in .env.local.');
  console.error('  Pick one, put it there, and do not reuse a password you use elsewhere.\n');
  process.exit(1);
}
if (PASSWORD && PASSWORD.length < 12 && !DELETE) {
  console.error(`\n  PILOT_DEMO_PASSWORD is ${PASSWORD.length} characters.`);
  console.error('  Use at least 12. This gates a URL that is reachable from the internet.\n');
  process.exit(1);
}

// Accounts to provision: [email, kind, fixture key, label]
const ACCOUNTS = [
  ['owner@gameday.pilot.invalid',    'staff',   'stf_owner',        'Gameday · owner'],
  ['provider@gameday.pilot.invalid', 'staff',   'stf_prov_01',      'Gameday · provider'],
  ['desk@gameday.pilot.invalid',     'staff',   'stf_front',        'Gameday · front desk'],
  ['jamie@medbar.pilot.invalid',     'staff',   'mb_stf_owner',     'Med Bar · owner'],
  ['gregory@gameday.pilot.invalid',  'patient', 'p_04_doubter',     'Gameday · patient (month 4, plateaued)'],
  ['delphine@medbar.pilot.invalid',  'patient', 'mb_03_series_mid', 'Med Bar · client (series 1 of 3)']
];

// Same UUIDv5 derivation as db-seed.cjs, so fixture keys resolve identically.
const crypto = require('crypto');
const NS = '6f1c2b84-9a3d-4f7e-8b21-5c0e7d4a1f93';
function U(name) {
  const hash = crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from(NS.replace(/-/g, ''), 'hex'), Buffer.from(String(name), 'utf8')]))
    .digest();
  const b = Buffer.from(hash.slice(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

(async () => {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const c = new Client({
    host: `db.${ref}.supabase.co`, port: 5432, user: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD, database: 'postgres',
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000
  });
  await c.connect();

  try {
    if (DELETE) {
      const r = await c.query(
        `delete from auth.users where email = any($1) returning email`,
        [ACCOUNTS.map(a => a[0])]);
      console.log(`\n  Deleted ${r.rowCount} pilot account(s).\n`);
      return;
    }

    console.log('\n  Provisioning pilot accounts\n');

    for (const [email, kind, key, label] of ACCOUNTS) {
      const authId = U('auth_' + email);
      const targetId = U(key);

      // Confirm the row it is meant to attach to exists before creating a login
      // that would dangle.
      const target = await c.query(
        kind === 'staff'
          ? 'select id, name, clinic_id from staff_user where id = $1'
          : 'select id, first_name || \' \' || last_name as name, clinic_id from patient where id = $1',
        [targetId]);

      if (!target.rowCount) {
        console.log(`  ✗ ${email.padEnd(34)} no ${kind} row for "${key}" — run db-seed first`);
        continue;
      }

      // The four token columns are nullable with no default, but GoTrue scans
      // them into Go strings rather than pointers. Leaving them NULL makes every
      // sign-in fail with "Database error querying schema" — which looks like a
      // wrong password and is not. They must be empty strings, not NULL.
      await c.query(`
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          confirmation_token, recovery_token, email_change, email_change_token_new,
          raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
        ) values (
          '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated',
          $2, extensions.crypt($3, extensions.gen_salt('bf')),
          now(), now(), now(),
          '', '', '', '',
          '{"provider":"email","providers":["email"]}'::jsonb, $4::jsonb, false, false
        )
        on conflict (id) do update set
          encrypted_password = extensions.crypt($3, extensions.gen_salt('bf')),
          email_confirmed_at = now(),
          confirmation_token = '',
          recovery_token = '',
          email_change = '',
          email_change_token_new = '',
          updated_at = now()
      `, [authId, email, PASSWORD, JSON.stringify({ label, kind })]);

      // GoTrue needs an identity row for the email provider or password sign-in
      // reports "invalid credentials" with a correct password.
      await c.query(`
        insert into auth.identities (
          provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        ) values ($1, $2, $3::jsonb, 'email', null, now(), now())
        on conflict (provider, provider_id) do update set identity_data = $3::jsonb
      `, [email, authId, JSON.stringify({ sub: authId, email, email_verified: true })]);

      if (kind === 'staff') {
        await c.query('update staff_user set auth_user_id = $1 where id = $2', [authId, targetId]);
      } else {
        await c.query('update patient set auth_user_id = $1 where id = $2', [authId, targetId]);
      }

      console.log(`  ✓ ${email.padEnd(34)} ${label}  → ${target.rows[0].name}`);
    }

    console.log('\n  Password for all of them is PILOT_DEMO_PASSWORD from .env.local.');
    console.log('  These are pilot accounts. Delete them before Phase C:');
    console.log('    node scripts/db-users.cjs --delete\n');
  } catch (err) {
    console.error('\n  Failed:', err.message, '\n');
    process.exit(1);
  } finally {
    await c.end().catch(() => {});
  }
})();
