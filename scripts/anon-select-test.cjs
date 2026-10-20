/**
 * anon-select-test.cjs
 * Every column a public page asks for must be a column anon may read.
 *
 *   node scripts/anon-select-test.cjs
 *
 * ===========================================================================
 * THE BUG CLASS THIS EXISTS FOR, WHICH HAS NOW SHIPPED SIX TIMES
 * ===========================================================================
 * Supabase enforces two independent limits: RLS decides which ROWS you see,
 * and GRANTs decide which COLUMNS. They fail differently and only one of them
 * is obvious.
 *
 * A row denial returns an empty list. A COLUMN denial returns 42501 and fails
 * the whole select — including the columns you were allowed. So asking for one
 * ungranted column alongside nine granted ones returns nothing at all, and the
 * call site, which checks `if (!row)`, blames the identifier it looked up.
 *
 * The sixth instance took the live shop down and nobody noticed for weeks:
 *
 *     .select('name, stripe_account_id')
 *
 * `stripe_account_id` is the one clinic column deliberately withheld from
 * anon. Every checkout therefore read null, and every customer who reached
 * the payment step was told "No such practice." — a message naming the one
 * thing that was definitely fine. 21 orders, 0 ever paid.
 *
 * Reviewing selects by eye does not catch this, because the code looks
 * correct and the grant lives in another system entirely. So: read the
 * selects out of the source, read the grants out of the database, compare.
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY to read information_schema.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const ROOT = path.resolve(__dirname, '..');
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Files whose supabase client is the ANON one. A select in the console runs
 * as an authenticated staff user and has quite different grants, so mixing
 * them in would produce noise and train people to ignore this.
 */
const ANON_FILES = [
  'lib/db/storefront.ts',
  'lib/db/shop.ts',
  'app/c/[slug]/cart/actions.ts',
  'app/c/[slug]/book/actions.ts',
  'app/c/[slug]/quiz/result/page.tsx',
  'app/confirm/[token]/page.tsx',
  'app/intake/[token]/page.tsx'
];

/**
 * Pull `.from('x')` … `.select('a, b, c')` pairs out of a file.
 *
 * Deliberately simple: it only understands string literals, which is all this
 * codebase uses, and it skips a select built from a variable rather than
 * guessing at it. A pattern it cannot read is reported rather than passed, so
 * the gap is visible instead of silent.
 */
function selectsIn(src) {
  const found = [];
  const re = /\.from\(\s*'([a-z_]+)'\s*\)([\s\S]{0,400}?)\.select\(\s*([^)]*?)\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const table = m[1];
    const raw = m[3];

    // Concatenated string literals: 'a, b, ' + 'c, d'
    const parts = [...raw.matchAll(/'([^']*)'|`([^`]*)`/g)].map(x => x[1] ?? x[2]);
    if (!parts.length) { found.push({ table, unreadable: raw.slice(0, 60) }); continue; }

    const joined = parts.join('');
    // Embedded resource syntax — patient:patient_id ( first_name ) — is a join
    // and its columns belong to the other table. Out of scope here.
    if (/\(/.test(joined)) { found.push({ table, embedded: true }); continue; }

    const cols = joined.split(',').map(c => c.trim()).filter(Boolean);
    found.push({ table, cols });
  }
  return found;
}

(async () => {
  console.log('\nANON SELECTS — every column asked for is a column granted\n');

  if (!URL_SB || !SERVICE) {
    console.log('  — skipped: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.');
    console.log('    This check needs the database. Set them in .env.local.\n');
    process.exit(0);
  }

  const res = await fetch(`${URL_SB}/rest/v1/rpc/exec_sql`, { method: 'POST' }).catch(() => null);
  void res;

  // information_schema is not exposed over PostgREST, so go through a function
  // if one exists; otherwise fall back to asking the user to run the SQL.
  let grants;
  try {
    const r = await fetch(`${URL_SB}/rest/v1/anon_grants`, {
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` }
    });
    if (r.ok) grants = await r.json();
  } catch { /* falls through */ }

  if (!grants) {
    console.log('  — skipped: no `anon_grants` view to read column grants from.');
    console.log('    Create it with:\n');
    console.log(`    create or replace view public.anon_grants as
      select table_name, column_name from information_schema.column_privileges
       where table_schema='public' and grantee='anon' and privilege_type='SELECT';\n`);
    process.exit(0);
  }

  const allowed = new Map();
  for (const g of grants) {
    if (!allowed.has(g.table_name)) allowed.set(g.table_name, new Set());
    allowed.get(g.table_name).add(g.column_name);
  }

  let fails = 0, checked = 0, skipped = 0;

  for (const rel of ANON_FILES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');

    for (const s of selectsIn(src)) {
      if (s.embedded) { skipped++; continue; }
      if (s.unreadable) {
        skipped++;
        console.log(`  ?  ${rel}  ${s.table}: select built dynamically, not checked`);
        continue;
      }
      const ok = allowed.get(s.table);
      if (!ok) {
        // No grants at all means anon cannot read the table by any column.
        // That is fine if the code goes through an RPC, and fatal if it does
        // not — which is exactly what this cannot tell from here, so it says so.
        console.log(`  ?  ${rel}  ${s.table}: anon has no column grants (RPC-only table?)`);
        skipped++;
        continue;
      }
      for (const col of s.cols) {
        if (col === '*') continue;
        checked++;
        if (!ok.has(col)) {
          fails++;
          console.log(`  ✗  ${rel}`);
          console.log(`       ${s.table}.${col} is NOT granted to anon.`);
          console.log(`       PostgREST fails the ENTIRE select with 42501, so this`);
          console.log(`       reads as "no such row" at the call site.`);
        }
      }
    }
  }

  console.log(
    `\n  ${checked} column(s) checked, ${skipped} select(s) skipped, ${fails} ungranted.\n`
  );
  process.exit(fails ? 1 : 0);
})();
