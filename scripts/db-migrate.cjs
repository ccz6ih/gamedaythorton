/**
 * db-migrate.cjs
 * Applies supabase/migrations/*.sql in filename order, once each, inside a
 * transaction per file, tracked in app.migration.
 *
 *   node scripts/db-migrate.cjs            apply anything pending
 *   node scripts/db-migrate.cjs --status   list applied / pending
 *   node scripts/db-migrate.cjs --reset    drop and rebuild (guarded, see below)
 *
 * THE RESET GUARD
 * --reset refuses to run if the database holds any patient row not marked
 * synthetic, or if any clinic has pilot_mode = false. Both mean real patient
 * data may be present, and a destructive reset would then be a data-loss
 * incident rather than a dev convenience. --force overrides, deliberately
 * awkwardly, and prints what it is about to destroy first.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const DIR = path.resolve(__dirname, '..', 'supabase', 'migrations');
const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const FORCE = args.includes('--force');
const STATUS = args.includes('--status');

function connect() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const pw = process.env.SUPABASE_DB_PASSWORD;
  if (!ref || !pw) {
    console.error('\n  Missing SUPABASE_PROJECT_REF / SUPABASE_DB_PASSWORD in .env.local');
    console.error('  Copy .env.example to .env.local and fill it in.\n');
    process.exit(1);
  }
  return new Client({
    host: process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`,
    port: Number(process.env.SUPABASE_DB_PORT || 5432),
    user: process.env.SUPABASE_DB_USER || 'postgres',
    password: pw,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
  });
}

async function ensureLedger(c) {
  await c.query('create schema if not exists app');
  await c.query(`
    create table if not exists app.migration (
      filename   text primary key,
      applied_at timestamptz not null default now(),
      sha        text not null
    )
  `);
}

function sha(text) {
  return require('crypto').createHash('sha256').update(text).digest('hex').slice(0, 12);
}

async function guardReset(c) {
  const tableExists = await c.query(`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'patient'
    ) as ok
  `);
  if (!tableExists.rows[0].ok) return { safe: true, note: 'no patient table yet' };

  const real = await c.query('select count(*)::int as n from public.patient where synthetic is not true');
  const live = await c.query('select count(*)::int as n from public.clinic where pilot_mode is false');

  if (real.rows[0].n > 0 || live.rows[0].n > 0) {
    return {
      safe: false,
      note: `${real.rows[0].n} patient row(s) not marked synthetic, ${live.rows[0].n} clinic(s) out of pilot mode`
    };
  }
  const counts = await c.query('select count(*)::int as n from public.patient');
  return { safe: true, note: `${counts.rows[0].n} synthetic patient row(s) will be destroyed` };
}

(async () => {
  const c = connect();
  await c.connect();

  try {
    if (RESET) {
      const guard = await guardReset(c);
      console.log(`\n  Reset check: ${guard.note}`);
      if (!guard.safe && !FORCE) {
        console.error('\n  REFUSING TO RESET.');
        console.error('  This database may hold real patient data. If that is genuinely not the');
        console.error('  case, re-run with --force. Read docs/09-compliance-register.md first.\n');
        process.exit(1);
      }
      if (!guard.safe && FORCE) {
        console.log('  --force given. Proceeding against the guard.');
      }
      console.log('  Dropping schema public and app.migration ledger...');
      await c.query('drop schema if exists public cascade');
      await c.query('create schema public');
      await c.query('grant usage on schema public to postgres, anon, authenticated, service_role');
      await c.query('grant all on schema public to postgres, service_role');
      await c.query('drop table if exists app.migration');
      // Enum types live in public and went with the cascade; nothing else to do.
    }

    await ensureLedger(c);

    const files = fs.readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();
    const applied = new Map(
      (await c.query('select filename, sha from app.migration')).rows.map(r => [r.filename, r.sha])
    );

    if (STATUS) {
      console.log('\n  MIGRATIONS');
      for (const f of files) {
        const body = fs.readFileSync(path.join(DIR, f), 'utf8');
        const mark = !applied.has(f) ? 'pending'
          : applied.get(f) === sha(body) ? 'applied'
          : 'APPLIED BUT FILE CHANGED';
        console.log(`  ${mark.padEnd(24)} ${f}`);
      }
      console.log('');
      await c.end();
      return;
    }

    let ran = 0;
    for (const f of files) {
      const body = fs.readFileSync(path.join(DIR, f), 'utf8');
      const digest = sha(body);

      if (applied.has(f)) {
        if (applied.get(f) !== digest) {
          console.log(`  ! ${f} already applied but the file has changed since.`);
          console.log('    Migrations are append-only. Add a new file rather than editing this one.');
        }
        continue;
      }

      process.stdout.write(`  applying ${f} ... `);
      try {
        await c.query('begin');
        await c.query(body);
        await c.query('insert into app.migration (filename, sha) values ($1, $2)', [f, digest]);
        await c.query('commit');
        console.log('ok');
        ran++;
      } catch (err) {
        await c.query('rollback');
        console.log('FAILED');
        console.error(`\n  ${f}: ${err.message}`);
        if (err.position && body) {
          const upto = body.slice(0, Number(err.position));
          const line = upto.split('\n').length;
          console.error(`  near line ${line}: ${body.split('\n')[line - 1].trim()}`);
        }
        console.error('');
        process.exit(1);
      }
    }

    console.log(ran ? `\n  ${ran} migration(s) applied.\n` : '\n  Already up to date.\n');
  } finally {
    await c.end().catch(() => {});
  }
})();
