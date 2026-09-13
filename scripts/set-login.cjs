/**
 * set-login.cjs
 * Gives a real person a real sign-in, replacing the seeded pilot account.
 *
 *   node scripts/set-login.cjs medbar-loveland themedbar.co@gmail.com
 *   node scripts/set-login.cjs medbar-loveland themedbar.co@gmail.com --password 'something long'
 *
 * With no --password, a strong one is generated and printed once. Give it to
 * her over something that is not email, and have her change it at first
 * sign-in.
 *
 * ------------------------------------------------------------------------
 * WHAT THIS REPLACES AND WHY IT MATTERS
 * ------------------------------------------------------------------------
 * db-users.cjs seeds accounts at `.pilot.invalid` addresses — deliberately
 * undeliverable, so a demo could never send mail to a real inbox by accident.
 * That is right for a demo and wrong for a business: an address nobody can
 * receive at means no password reset, no receipt, no notification. The owner
 * would be locked out the first time she cleared a cookie.
 *
 * This rewrites the address on the EXISTING auth user rather than creating a
 * new one. The staff_user row, its role, and everything in the database that
 * points at it by id all keep working — where a new account would leave her
 * signed in as a stranger with no practice attached.
 *
 * ------------------------------------------------------------------------
 * THE PASSWORD IS PRINTED ONCE AND NOT STORED
 * ------------------------------------------------------------------------
 * Not written to .env.local, not committed, not logged anywhere. If it is lost,
 * run this again — resetting is cheap and keeping a copy is the expensive
 * mistake. This repository is public.
 */

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith('--'));
const slug = positional[0];
const email = positional[1];

function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1] ?? null;
}

if (!slug || !email) {
  console.error('\n  node scripts/set-login.cjs <clinic-slug> <email> [--password "..."] [--role owner]\n');
  process.exit(1);
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`\n  "${email}" does not look like an email address.\n`);
  process.exit(1);
}

const role = flag('role') ?? 'owner';

/**
 * Four words plus digits. Long enough to be strong, shaped so it can be read
 * down a phone without "was that an el or a one" — which is how a generated
 * password actually gets delivered to somebody who is not a developer.
 */
function makePassword() {
  const words = [
    'amber', 'basin', 'cedar', 'dune', 'ember', 'fern', 'grove', 'harbor',
    'ivory', 'juniper', 'kite', 'lantern', 'meadow', 'north', 'opal', 'pine',
    'quarry', 'river', 'summit', 'thistle', 'umber', 'vale', 'willow', 'zephyr'
  ];
  const pick = () => words[crypto.randomInt(0, words.length)];
  const n = crypto.randomInt(10, 100);
  return `${pick()}-${pick()}-${pick()}-${n}`;
}

const password = flag('password') ?? makePassword();
const generated = !flag('password');

if (password.length < 12) {
  console.error('\n  Use at least 12 characters. This gates a live business system.\n');
  process.exit(1);
}

async function main() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const client = new Client({
    host: `db.${ref}.supabase.co`, port: 5432, user: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD, database: 'postgres',
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000
  });
  await client.connect();

  // The staff row to attach to: this clinic's owner, or the named role.
  const { rows } = await client.query(
    `select s.id, s.name, s.role, s.auth_user_id, u.email as current_email, c.name as clinic
       from staff_user s
       join clinic c on c.id = s.clinic_id
       left join auth.users u on u.id = s.auth_user_id
      where c.slug = $1 and s.role = $2 and s.active
      order by s.created_at
      limit 1`,
    [slug, role]
  );

  const staff = rows[0];
  if (!staff) {
    console.error(`\n  No active ${role} found for ${slug}.\n`);
    process.exit(1);
  }
  if (!staff.auth_user_id) {
    console.error(`\n  ${staff.name} has no sign-in account yet. Run: node scripts/db-users.cjs\n`);
    process.exit(1);
  }

  // Refuse to hand this clinic's login to an address already used elsewhere.
  const clash = await client.query(
    'select id from auth.users where email = $1 and id <> $2', [email, staff.auth_user_id]);
  if (clash.rowCount) {
    console.error(`\n  ${email} is already attached to a different account. Resolve that first.\n`);
    process.exit(1);
  }

  await client.query(
    `update auth.users
        set email = $1,
            encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')),
            email_confirmed_at = coalesce(email_confirmed_at, now()),
            updated_at = now()
      where id = $3`,
    [email, password, staff.auth_user_id]
  );

  // Where enquiry and order notifications go. Set alongside the login because
  // the two being different addresses is a surprise nobody wants later.
  await client.query(
    `update clinic set lead_email = coalesce(lead_email, $1), email = coalesce(email, $1)
      where slug = $2`,
    [email, slug]
  );

  console.log(`\n  ${staff.clinic} — ${staff.name} (${staff.role})\n`);
  console.log(`    sign-in email   ${email}`);
  console.log(`    was             ${staff.current_email ?? '(none)'}`);
  if (generated) {
    console.log(`    password        ${password}`);
    console.log('\n    Printed once and not stored anywhere. Send it over something');
    console.log('    other than email, and have her change it after first sign-in.');
  } else {
    console.log('    password        (the one you supplied)');
  }
  console.log(`\n    Sign in at      https://www.medbarco.com/sign-in`);
  console.log(`    Enquiries go to ${email}\n`);

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
