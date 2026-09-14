/**
 * analytics-test.cjs
 * No third-party tracking behind login. Proved, not promised.
 *
 * ===========================================================================
 * WHY THIS DESERVES ITS OWN SUITE
 * ===========================================================================
 * "No GA behind login" is the kind of rule that is true on the day it is
 * written and quietly stops being true the first time somebody moves a tag into
 * a shared layout to fix a reporting gap. Nothing breaks when it happens. No
 * page looks different. The only signal is a script on a page with client names
 * on it, which is exactly the thing the rule exists to prevent.
 *
 * So it is checked three ways, because each catches a different mistake:
 *
 *   1. WHO IMPORTS IT   — catches the tag being added to the console layout
 *   2. WHAT THE HTML SAYS — catches it arriving by some other route entirely
 *   3. WHAT THE POLICY ALLOWS — catches the CSP being loosened deployment-wide
 *
 * Run:  node scripts/analytics-test.cjs   (needs a local server for part 2)
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.SMOKE_BASE || 'http://localhost:3000';
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.MEDBAR_OWNER_EMAIL ?? 'themedbar.co@gmail.com';
const PW = process.env.MEDBAR_OWNER_PASSWORD;

let pass = 0, fail = 0;
const ok = (m, n) => { pass++; console.log(`  ✓ ${m}${n ? '  ' + n : ''}`); };
const bad = (m, e) => { fail++; console.log(`  ✗ ${m}`); if (e) console.log('      ' + String(e).slice(0, 240)); };

/** Anything that phones a third party. Not only Google. */
const TRACKERS = [
  'googletagmanager.com', 'google-analytics.com', 'gtag(',
  'connect.facebook.net', 'fbq(', 'hotjar', 'fullstory', 'clarity.ms',
  'segment.com', 'analytics.tiktok', 'snap.licdn', 'intercom', 'drift.com'
];

(async () => {
  console.log('\nANALYTICS — public pages only\n');

  /* =====================================================================
     1. ONLY THE STOREFRONT IMPORTS IT
     ===================================================================== */
  console.log('ONLY THE STOREFRONT IMPORTS THE TAG');

  const files = [];
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (/^(node_modules|\.next|\.git)$/.test(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) files.push(full);
    }
  };
  walk(path.join(ROOT, 'app'));
  walk(path.join(ROOT, 'components'));

  const ALLOWED_IMPORTERS = ['app/c/[slug]/layout.tsx'];

  const importers = files
    .map(f => path.relative(ROOT, f).split(path.sep).join('/'))
    .filter(rel => rel !== 'components/Analytics.tsx')
    .filter(rel => /from\s+['"][^'"]*components\/Analytics['"]/.test(
      fs.readFileSync(path.join(ROOT, rel), 'utf8')));

  const unexpected = importers.filter(f => !ALLOWED_IMPORTERS.includes(f));
  if (unexpected.length === 0) {
    ok('only the storefront layout renders analytics', importers.join(', ') || 'none');
  } else {
    bad('only the storefront layout renders analytics',
        `also imported by: ${unexpected.join(', ')}`);
  }

  // And nobody has pasted a raw snippet somewhere instead of importing it.
  const rawSnippet = files
    .map(f => path.relative(ROOT, f).split(path.sep).join('/'))
    .filter(rel => rel !== 'components/Analytics.tsx')
    .filter(rel => {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
      return TRACKERS.some(t => src.includes(t));
    });

  if (rawSnippet.length === 0) ok('no tracking snippet is pasted anywhere else');
  else bad('no tracking snippet is pasted anywhere else', rawSnippet.join(', '));

  /* =====================================================================
     2. THE POLICY ONLY ALLOWS IT ON THE STOREFRONT
     ===================================================================== */
  console.log('\nTHE CONTENT SECURITY POLICY DRAWS THE SAME LINE');

  const { default: nextConfig } = await import('../next.config.mjs');
  const rules = await nextConfig.headers();

  const cspOf = source => {
    const rule = rules.find(r => r.source === source);
    return rule?.headers.filter(h => h.key === 'Content-Security-Policy').pop()?.value ?? '';
  };

  const strict = cspOf('/:path*');
  const storefront = cspOf('/');

  const strictScript = (strict.match(/script-src[^;]*/) || [''])[0];
  if (!strictScript.includes('googletagmanager')) {
    ok('the catch-all policy admits no analytics script', 'console, portal, sign-in, gate');
  } else {
    bad('the catch-all policy admits no analytics script',
        'a third-party script is permitted on authenticated routes');
  }

  const sfScript = (storefront.match(/script-src[^;]*/) || [''])[0];
  if (sfScript.includes('googletagmanager')) {
    ok('the storefront policy admits it', 'public marketing pages only');
  } else {
    bad('the storefront policy admits it', 'the tag would be blocked and report nothing');
  }

  /* =====================================================================
     3. WHAT THE PAGES ACTUALLY SERVE
     ===================================================================== */
  console.log('\nWHAT THE HTML ACTUALLY CONTAINS');

  const reachable = await fetch(`${BASE}/admin`, { redirect: 'manual' })
    .then(() => true).catch(() => false);

  if (!reachable) {
    console.log(`  — skipped: no server at ${BASE}. Run scripts/serve-restart.cjs first.`);
  } else {
    // Public pages SHOULD carry it.
    const publicHtml = await fetch(`${BASE}/c/medbar-loveland`).then(r => r.text()).catch(() => '');
    if (publicHtml.includes('googletagmanager.com')) {
      ok('the public storefront carries the tag');
    } else {
      bad('the public storefront carries the tag', 'analytics will report nothing');
    }

    if (!PW) {
      console.log('  — skipped the authenticated pages: MEDBAR_OWNER_PASSWORD is not set.');
    } else {
      // Sign in the way a browser does, then read the pages that matter.
      const tokenRes = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PW })
      });
      const session = await tokenRes.json().catch(() => null);

      if (!tokenRes.ok || !session?.access_token) {
        bad('signed in to check the console', 'could not authenticate');
      } else {
        const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([^.]+)/)?.[1];
        const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;

        const PRIVATE = ['/console', '/console/clients', '/console/calendar', '/admin', '/portal'];
        let clean = true;

        for (const route of PRIVATE) {
          const html = await fetch(`${BASE}${route}`, { headers: { cookie } })
            .then(r => r.text()).catch(() => '');
          const found = TRACKERS.filter(t => html.includes(t));
          if (found.length) {
            bad(`no tracker on ${route}`, found.join(', '));
            clean = false;
          }
        }

        if (clean) ok(`no tracker on any of ${PRIVATE.length} authenticated routes`, PRIVATE.join(' '));
      }
    }
  }

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
