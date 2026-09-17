/**
 * pwa-test.cjs — the installable app, and the one thing about it that could hurt.
 *
 *   node scripts/pwa-test.cjs
 *
 * THE CHECK THAT MATTERS
 * A service worker cache is an unencrypted store on the device that outlives
 * sign-out. If /console ever became cacheable, a client list would be sitting
 * on the disk of a phone that gets left in a taxi, still there after she logged
 * out. Most of this file exists to assert that cannot happen — and to keep
 * asserting it after somebody adds a route in six months.
 *
 * The rest checks the boring things that make an install work at all, because
 * every one of them fails silently: a manifest behind the auth gate, an icon
 * that is the wrong size, a worker that was never registered.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let pass = 0;
const failures = [];
const ok = w => { pass++; console.log(`  ok    ${w}`); };
const bad = (w, d) => { failures.push(w); console.log(`  FAIL  ${w}\n        ${d}`); };

const read = p => {
  try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return null; }
};

console.log('\nPWA\n');

/* ------------------------------------------------------- the safety rule ---- */

const sw = read('public/sw.js');
if (!sw) {
  bad('public/sw.js exists', 'no service worker — nothing else here means anything');
} else {
  ok('public/sw.js exists');

  // The allowlist function is the whole control. It must not name a private area.
  const allow = (sw.match(/function isPublicAsset\(url\)\s*\{([\s\S]*?)\n\}/) ?? [])[1] ?? '';
  allow
    ? ok('the cache allowlist is a single named function')
    : bad('the cache allowlist is a single named function', 'isPublicAsset not found — cannot verify what is cacheable');

  for (const secret of ['/console', '/portal', '/api', '/admin']) {
    allow.includes(secret)
      ? bad(`the allowlist does not admit ${secret}`, 'authenticated content would be written to disk')
      : ok(`the allowlist does not admit ${secret}`);
  }

  // Only these three prefixes are public enough to keep.
  const prefixes = [...allow.matchAll(/startsWith\('([^']+)'\)/g)].map(m => m[1]);
  const allowed = ['/icons/', '/brand/', '/_next/static/'];
  const unexpected = prefixes.filter(p => !allowed.includes(p));
  unexpected.length === 0
    ? ok(`only ${allowed.join(', ')} are cacheable`)
    : bad('only static public prefixes are cacheable', `also admits: ${unexpected.join(', ')}`);

  // A non-GET request can change data and must never be served from a cache.
  /request\.method !== 'GET'/.test(sw)
    ? ok('non-GET requests are never intercepted')
    : bad('non-GET requests are never intercepted', 'a POST could be served from cache');

  /url\.origin !== self\.location\.origin/.test(sw)
    ? ok('cross-origin requests are left alone')
    : bad('cross-origin requests are left alone', 'third-party responses would be cached');

  // The navigation fallback may serve the offline page and nothing else.
  const nav = sw.slice(sw.indexOf("request.mode === 'navigate'"));
  const cachePuts = [...nav.matchAll(/\.put\(/g)].length;
  cachePuts === 0
    ? ok('a navigation is never written to the cache')
    : bad('a navigation is never written to the cache', `${cachePuts} cache write(s) in the navigation path`);

  // Precached assets must all be public too.
  const shell = (sw.match(/const SHELL_ASSETS = \[([\s\S]*?)\]/) ?? [])[1] ?? '';
  const shellPaths = [...shell.matchAll(/'([^']+)'/g)].map(m => m[1]);
  const privateShell = shellPaths.filter(p => /^\/(console|portal|api|admin)/.test(p));
  privateShell.length === 0
    ? ok(`every precached asset is public (${shellPaths.length} of them)`)
    : bad('every precached asset is public', privateShell.join(', '));
}

/* ------------------------------------------------------------- manifests ---- */

const rootManifest = read('app/manifest.ts');
const consoleManifest = read('app/console/manifest.webmanifest/route.ts');

rootManifest ? ok('the storefront manifest exists') : bad('the storefront manifest exists', 'app/manifest.ts missing');
consoleManifest ? ok('the console manifest exists') : bad('the console manifest exists', 'route missing');

if (rootManifest) {
  /clinicForHost/.test(rootManifest)
    ? ok('the storefront manifest is resolved per hostname')
    : bad('the storefront manifest is resolved per hostname', 'one tenant’s name would install for all of them');
  /start_url: '\/'/.test(rootManifest)
    ? ok('the storefront app opens on the storefront')
    : bad('the storefront app opens on the storefront', 'start_url is not /');
}

if (consoleManifest) {
  /start_url: '\/console\/today'/.test(consoleManifest)
    ? ok('the console app opens on Today')
    : bad('the console app opens on Today', 'start_url is not /console/today');
  /scope: '\/console'/.test(consoleManifest)
    ? ok('the console app is scoped to /console')
    : bad('the console app is scoped to /console', 'it would swallow storefront links');
}

/* ----------------------------------------------------------------- icons ---- */

const ICONS = [
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512],
  ['public/icons/maskable-192.png', 192],
  ['public/icons/maskable-512.png', 512],
  ['public/icons/apple-touch-icon.png', 180]
];

for (const [file, size] of ICONS) {
  try {
    const b = fs.readFileSync(path.join(ROOT, file));
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    (w === size && h === size)
      ? ok(`${path.basename(file)} is ${size}x${size}`)
      : bad(`${path.basename(file)} is ${size}x${size}`, `actually ${w}x${h}`);
  } catch {
    bad(`${path.basename(file)} exists`, 'missing — run node scripts/make-pwa-icons.cjs');
  }
}

/* ------------------------------------------------------------ reachable ---- */

const middleware = read('middleware.ts');
if (middleware) {
  const open = (middleware.match(/const ALWAYS_OPEN = \[([\s\S]*?)\n\];/) ?? [])[1] ?? '';
  for (const p of ['/manifest.webmanifest', '/console/manifest.webmanifest', '/sw.js', '/offline', '/icons']) {
    open.includes(`'${p}'`)
      ? ok(`${p} is not behind the passcode gate`)
      : bad(`${p} is not behind the passcode gate`, 'it would 307 and the install prompt would never appear');
  }
}

/* ----------------------------------------------------------- registered ---- */

const consoleLayout = read('app/console/layout.tsx');
const storefrontLayout = read('app/c/[slug]/layout.tsx');

consoleLayout && /<ServiceWorker\s*\/>/.test(consoleLayout)
  ? ok('the console registers the worker')
  : bad('the console registers the worker', 'the console cannot be installed');

storefrontLayout && /<ServiceWorker\s*\/>/.test(storefrontLayout)
  ? ok('the storefront registers the worker')
  : bad('the storefront registers the worker', 'a manifest alone will not offer an install');

consoleLayout && /manifest: '\/console\/manifest\.webmanifest'/.test(consoleLayout)
  ? ok('the console links its own manifest')
  : bad('the console links its own manifest', 'it would install as the storefront app');

read('app/offline/page.tsx')
  ? ok('the offline page exists')
  : bad('the offline page exists', 'a failed navigation would show the browser error page');

console.log(`\n${pass} passed, ${failures.length} failed\n`);
process.exit(failures.length ? 1 : 0);
