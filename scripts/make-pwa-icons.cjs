/**
 * make-pwa-icons.cjs — generate the installable-app icon set.
 *
 *   node scripts/make-pwa-icons.cjs
 *
 * A ONE-OFF GENERATOR, AND ITS OUTPUT IS COMMITTED. sharp arrives as a
 * transitive dependency of Next rather than something this project declares, so
 * a clean install elsewhere may not have it. Icons are assets, not build
 * output: they are generated once, checked in, and regenerated only when the
 * logo changes.
 *
 * WHY MASKABLE IS A SEPARATE FILE
 * Android crops an icon to whatever shape the launcher uses — circle, squircle,
 * rounded square. A `maskable` icon must therefore keep everything important
 * inside the middle 80%, and fill the corners with background rather than
 * transparency, or the crop eats the logo and the launcher shows a white blob.
 * A normal icon wants the opposite: tight to the edges, no dead margin. One
 * file cannot be both, which is why the spec has a purpose field.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'public', 'brand', 'medbar-logo-black.png');
const OUT = path.join(ROOT, 'public', 'icons');

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('\n  sharp is not installed. It normally arrives with Next.');
  console.error('  The committed icons in public/icons are still valid — this only');
  console.error('  needs to run when the logo changes.\n');
  process.exit(1);
}

/** The practice's paper colour, so a cropped corner is brand, not white. */
const PAPER = { r: 0xEF, g: 0xE7, b: 0xDA, alpha: 1 };

/**
 * The source logo is a 640px canvas with the lockup floating in the middle of a
 * lot of empty space. Insetting THAT by a further 40% for the maskable safe
 * zone left a mark too small to recognise at 192px — padding on top of padding.
 *
 * Trimming to the ink first means the percentages below describe the logo
 * rather than the whitespace around it, so the safe-zone maths does what it
 * says. Cached because both sizes and both purposes use it.
 */
let trimmed;
async function ink() {
  if (!trimmed) {
    trimmed = await sharp(SOURCE)
      .ensureAlpha()
      .trim({ threshold: 10 })
      .toBuffer();
  }
  return trimmed;
}

async function plain(size) {
  // Tight to the edges with a small breathing margin — this is the icon shown
  // where nothing will crop it.
  const inner = Math.round(size * 0.86);
  return sharp({
    create: { width: size, height: size, channels: 4, background: PAPER }
  })
    .composite([{
      input: await sharp(await ink()).resize(inner, inner, { fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
      gravity: 'centre'
    }])
    .png();
}

async function maskable(size) {
  // 60% of the canvas keeps the mark inside the safe circle whatever shape the
  // launcher crops to.
  const inner = Math.round(size * 0.6);
  return sharp({
    create: { width: size, height: size, channels: 4, background: PAPER }
  })
    .composite([{
      input: await sharp(await ink()).resize(inner, inner, { fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
      gravity: 'centre'
    }])
    .png();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const jobs = [
    ['icon-192.png', () => plain(192)],
    ['icon-512.png', () => plain(512)],
    ['maskable-192.png', () => maskable(192)],
    ['maskable-512.png', () => maskable(512)],
    // iOS ignores the manifest for the home-screen icon and reads this instead.
    // It also ignores transparency, which is why it gets the paper ground.
    ['apple-touch-icon.png', () => plain(180)]
  ];

  for (const [name, make] of jobs) {
    const buf = await (await make()).toBuffer();
    fs.writeFileSync(path.join(OUT, name), buf);
    console.log(`  ${name.padEnd(24)} ${(buf.length / 1024).toFixed(1)} KB`);
  }

  console.log(`\n  Written to public/icons — commit these.\n`);
})().catch(e => { console.error('  ' + e.message); process.exit(1); });
