/**
 * db-connect-test.cjs
 * Works out which Postgres connection string actually reaches this Supabase
 * project from this machine, and prints the one that worked.
 *
 * Why this exists: Supabase's direct host (db.<ref>.supabase.co) is IPv6-only
 * for projects created after early 2024, so it silently fails from plenty of
 * Windows networks. The pooler hostname varies by region and provisioning era.
 * Guessing wrong looks identical to a bad password, which wastes an hour.
 *
 * Run:  node scripts/db-connect-test.cjs
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const REF = process.env.SUPABASE_PROJECT_REF;
const PW = process.env.SUPABASE_DB_PASSWORD;
const REGION = process.env.SUPABASE_REGION || 'ca-central-1';

if (!REF || !PW) {
  console.error('\nMissing SUPABASE_PROJECT_REF or SUPABASE_DB_PASSWORD in .env.local\n');
  process.exit(1);
}

// Password goes in the config object, never interpolated into a URL — an
// unescaped "!" or "@" in a connection string is another failure that looks
// like a bad password.
const candidates = [
  { label: 'direct (IPv6 likely)', host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres' },
  { label: 'pooler session aws-0', host: `aws-0-${REGION}.pooler.supabase.com`, port: 5432, user: `postgres.${REF}` },
  { label: 'pooler session aws-1', host: `aws-1-${REGION}.pooler.supabase.com`, port: 5432, user: `postgres.${REF}` },
  { label: 'pooler txn aws-0', host: `aws-0-${REGION}.pooler.supabase.com`, port: 6543, user: `postgres.${REF}` },
  { label: 'pooler txn aws-1', host: `aws-1-${REGION}.pooler.supabase.com`, port: 6543, user: `postgres.${REF}` }
];

(async () => {
  for (const c of candidates) {
    const client = new Client({
      host: c.host, port: c.port, user: c.user, password: PW,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
      statement_timeout: 8000
    });
    process.stdout.write(`  ${c.label.padEnd(24)} ${c.host}:${c.port} ... `);
    try {
      await client.connect();
      const r = await client.query('select current_user, version()');
      await client.end();
      console.log('OK');
      console.log(`\n  Use this:\n    host ${c.host}\n    port ${c.port}\n    user ${c.user}`);
      console.log(`    ${r.rows[0].version.split(' ').slice(0, 2).join(' ')}\n`);
      process.exit(0);
    } catch (err) {
      console.log(String(err.message).slice(0, 60));
      try { await client.end(); } catch {}
    }
  }
  console.log('\n  No direct Postgres route from this machine.');
  console.log('  Migrations will be applied through the Supabase MCP instead.\n');
  process.exit(2);
})();
