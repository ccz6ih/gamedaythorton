/**
 * copy-prototype.cjs
 * Copies prototype/ into public/prototype/ so the Phase A prototype is served
 * alongside the production app at /prototype/index.html.
 *
 * Why not just move it: the prototype is the design reference, its CSS is
 * imported directly by app/layout.tsx (one copy of the design system), and its
 * docs reference prototype/ throughout. Copying at build time keeps one source of
 * truth and one deployment.
 *
 * public/prototype is gitignored — it is build output, not source.
 *
 * Runs automatically as part of `npm run build`.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'prototype');
const DEST = path.join(ROOT, 'public', 'prototype');

// Never copy anything that could hold an uploaded image. The prototype keeps
// media in the browser; if a stray uploads/ directory exists locally it must not
// be published.
const SKIP = new Set(['uploads', 'node_modules', '.DS_Store']);

let files = 0;

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else { fs.copyFileSync(src, dst); files++; }
  }
}

if (!fs.existsSync(SRC)) {
  console.error('  prototype/ is missing. Nothing to copy.');
  process.exit(1);
}

if (!fs.existsSync(path.join(SRC, 'demo-data.js'))) {
  console.error('\n  prototype/demo-data.js is missing.');
  console.error('  Run: node scripts/generate-fixtures.cjs\n');
  process.exit(1);
}

fs.rmSync(DEST, { recursive: true, force: true });
copyDir(SRC, DEST);

console.log(`  prototype → public/prototype  (${files} files)`);
