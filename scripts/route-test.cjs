/**
 * route-test.cjs
 * Every navigation link must point at a page that exists.
 *
 * WHY THIS EXISTS
 * The console rail was built from a list of intended screens, several of which had
 * not been written. Signing in and clicking the nav produced a string of 404s —
 * which in a clinical product does not read as "not built yet", it reads as broken
 * software, and it is the first impression a practitioner gets.
 *
 * A dead link in navigation is a bug, not a wrong turn by the user. This makes it
 * a build failure instead of something discovered by a client.
 *
 * Run:  node scripts/route-test.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');

let pass = 0;
const problems = [];

/* ---------------------------------------------------- what routes exist ---- */

function routesFrom(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    // Route groups (parentheses) do not appear in the URL.
    const segment = /^\(.*\)$/.test(entry.name) ? '' : `/${entry.name}`;
    const child = path.join(dir, entry.name);
    if (fs.existsSync(path.join(child, 'page.tsx')) || fs.existsSync(path.join(child, 'route.ts'))) {
      out.push(prefix + segment);
    }
    out.push(...routesFrom(child, prefix + segment));
  }
  return out;
}

const existing = new Set(['/', ...routesFrom(APP)]);

/** Does a literal href resolve to a route, allowing for [id] segments? */
function resolves(href) {
  const clean = href.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
  if (existing.has(clean)) return true;

  // Match against dynamic segments: /console/clients/abc -> /console/clients/[id]
  const parts = clean.split('/');
  for (const route of existing) {
    const rp = route.split('/');
    if (rp.length !== parts.length) continue;
    if (rp.every((seg, i) => seg === parts[i] || /^\[.+\]$/.test(seg))) return true;
  }

  // Static files under public/ are legitimate link targets.
  if (fs.existsSync(path.join(ROOT, 'public', clean))) return true;
  return false;
}

/* ------------------------------------------------ collect every link ---- */

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

const sources = [...walk(APP), ...walk(path.join(ROOT, 'components'))];

console.log('\nROUTE INTEGRITY\n');
console.log(`  ${existing.size} routes found under app/`);

const seen = new Map();   // href -> [files]

for (const file of sources) {
  const body = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');

  // href="/..." and href={`/...`} with no interpolation, plus data-to="..."
  const patterns = [
    /href="(\/[^"{}]*)"/g,
    /href={`(\/[^`${}]*)`}/g,
    /data-to="(\/[^"{}]*)"/g
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(body)) !== null) {
      const href = m[1];
      if (/^https?:/.test(href)) continue;
      if (!seen.has(href)) seen.set(href, []);
      seen.get(href).push(rel);
    }
  }
}

for (const [href, files] of [...seen].sort()) {
  if (resolves(href)) {
    pass++;
  } else {
    problems.push(`${href}  ←  ${[...new Set(files)].join(', ')}`);
  }
}

console.log(`  ${seen.size} distinct internal links checked`);

/* --------------------------------------- the rail specifically ---- */
// The rail is the thing a user actually clicks through, so call it out by name.

const layout = path.join(APP, 'console', 'layout.tsx');
if (fs.existsSync(layout)) {
  const body = fs.readFileSync(layout, 'utf8');
  const railLinks = [...body.matchAll(/href:\s*'(\/[^']+)'/g)].map(m => m[1]);
  const dead = railLinks.filter(h => !resolves(h));
  if (dead.length) {
    problems.push(...dead.map(h => `${h}  ←  console rail (a user will click this)`));
  } else {
    console.log(`  ${railLinks.length} console rail links all resolve`);
    pass++;
  }
}

/* ------------------------------------------------------------- result ---- */

console.log('\n' + '─'.repeat(64));
if (problems.length) {
  console.log(`${problems.length} DEAD LINK(S):\n`);
  problems.forEach(p => console.log('  ✗ ' + p));
  console.log('\nEither build the page or remove the link. A nav link that 404s is a bug.\n');
  process.exit(1);
}
console.log(`All ${pass} link checks passed. No dead navigation.\n`);
