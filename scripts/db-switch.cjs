/**
 * db-switch.cjs
 * Points .env.local at a different Supabase project, then verifies it.
 *
 *   node scripts/db-switch.cjs <project-ref> <db-password> [anon-key]
 *
 * Written for the ca-central-1 → us-east-1 move, but it is the general tool:
 * every value that identifies a project lives in one file, and editing four of
 * them by hand is how you end up with the app talking to one database and the
 * scripts talking to another. That failure is quiet — migrations apply to the
 * wrong project and everything looks fine until data goes missing.
 *
 * It keeps a timestamped backup of .env.local, because the one thing worse than
 * pointing at the wrong project is pointing at nothing and having lost the
 * values that worked.
 */

const fs = require('fs');
const path = require('path');

const ENV = path.resolve(__dirname, '..', '.env.local');

const [ref, password, anonKey] = process.argv.slice(2);

if (!ref || !password) {
  console.error(`
  usage: node scripts/db-switch.cjs <project-ref> <db-password> [anon-key]

    project-ref   the 20-character ref, e.g. zpqoxubaoyhomfmclrqh
    db-password   set it in Supabase: Settings -> Database -> Reset password
    anon-key      optional; leave it off to keep the current one
`);
  process.exit(1);
}

if (!/^[a-z]{20}$/.test(ref)) {
  console.error(`\n  "${ref}" does not look like a project ref (20 lowercase letters).\n`);
  process.exit(1);
}

if (!fs.existsSync(ENV)) {
  console.error(`\n  No .env.local at ${ENV}\n`);
  process.exit(1);
}

const before = fs.readFileSync(ENV, 'utf8');
const backup = `${ENV}.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
fs.writeFileSync(backup, before);

/** Replaces a KEY=value line, or appends it when the key is absent. */
function setVar(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  return re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
}

let after = before;
after = setVar(after, 'SUPABASE_PROJECT_REF', ref);
after = setVar(after, 'SUPABASE_DB_PASSWORD', password);
after = setVar(after, 'NEXT_PUBLIC_SUPABASE_URL', `https://${ref}.supabase.co`);
if (anonKey) after = setVar(after, 'NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey);

// The direct host is derived from the ref, so a stale override would silently
// keep pointing at the old project — the exact failure this script exists to
// prevent.
after = after.replace(/^SUPABASE_DB_HOST=.*$/m, `SUPABASE_DB_HOST=db.${ref}.supabase.co`);

fs.writeFileSync(ENV, after);

console.log(`
  .env.local now points at ${ref}
  backup: ${path.basename(backup)}

  Next:
    node scripts/db-connect-test.cjs     confirm the password works
    npm run db:migrate                  apply all 11 migrations
    npm run db:seed                     both synthetic tenants
    node scripts/db-users.cjs           pilot sign-in accounts
    npm run test:db && npm run test:auth

  Then set these in Vercel (Production AND Preview) and redeploy:
    NEXT_PUBLIC_SUPABASE_URL        https://${ref}.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY   ${anonKey ?? '<unchanged>'}

  Delete the old project only after the live site is verified against this one.
`);
