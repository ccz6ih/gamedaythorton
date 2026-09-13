/**
 * link-product-images.cjs
 * Points each product at its picture.
 *
 *   node scripts/link-product-images.cjs               # report only, changes nothing
 *   node scripts/link-product-images.cjs --write       # apply
 *   node scripts/link-product-images.cjs --write other-clinic
 *
 * HOW TO USE IT
 *
 * Drop image files into public/products/ named after the product, in lower case
 * with hyphens instead of spaces:
 *
 *     public/products/renew-eye-complex.jpg
 *     public/products/glow-c-brightening-serum.webp
 *
 * Then run it. Matching is on the normalised name, so "Mandelic Resurfacing
 * Serum 8%" matches mandelic-resurfacing-serum-8.jpg — punctuation and case are
 * ignored, and any of jpg / jpeg / png / webp / avif work.
 *
 * WHY IT REPORTS BOTH DIRECTIONS
 *
 * A script that silently links what it can find leaves you believing the job is
 * done. The two failures that actually happen are a file whose name nobody can
 * match, and a product nobody supplied a file for — and only the first is
 * visible from the filesystem. So both lists are printed, every run, and the
 * default is to change nothing until you have read them.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const slug = args.find(a => !a.startsWith('--')) ?? 'medbar-loveland';

const DIR = path.resolve(__dirname, '..', 'public', 'products');
const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

/** Lower case, letters and digits only, single hyphens. Both sides use this. */
function key(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function connectionString() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const pw = process.env.SUPABASE_DB_PASSWORD;
  const region = process.env.SUPABASE_REGION || 'us-east-1';
  if (!ref || !pw) {
    console.error('  SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD must be set in .env.local');
    process.exit(1);
  }
  return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
}

async function main() {
  if (!fs.existsSync(DIR)) {
    fs.mkdirSync(DIR, { recursive: true });
    console.log(`  created ${path.relative(process.cwd(), DIR)} — drop product images in there.`);
  }

  const files = fs.readdirSync(DIR)
    .filter(f => EXT.has(path.extname(f).toLowerCase()))
    .filter(f => !f.startsWith('.'));

  const byKey = new Map();
  for (const f of files) {
    const k = key(path.basename(f, path.extname(f)));
    // First one wins, and a duplicate is reported rather than silently ignored.
    if (byKey.has(k)) {
      console.log(`  ! two files map to the same product: ${byKey.get(k)} and ${f}`);
      continue;
    }
    byKey.set(k, f);
  }

  const client = new Client({ connectionString: connectionString() });
  await client.connect();

  const { rows } = await client.query(
    `select p.id, p.name, p.image_path
       from product p join clinic c on c.id = p.clinic_id
      where c.slug = $1
      order by p.name`,
    [slug]
  );

  if (rows.length === 0) {
    console.log(`  no products found for ${slug}.`);
    await client.end();
    return;
  }

  const matched = [];
  const missing = [];
  const used = new Set();

  for (const product of rows) {
    const k = key(product.name);
    const file = byKey.get(k);
    if (file) {
      used.add(k);
      const url = `/products/${file}`;
      matched.push({ ...product, url, changed: product.image_path !== url });
    } else {
      missing.push(product);
    }
  }

  const orphans = [...byKey.entries()].filter(([k]) => !used.has(k)).map(([, f]) => f);

  /* ------------------------------------------------------------- report -- */
  console.log(`\n  ${slug}: ${rows.length} products, ${files.length} image file(s)\n`);

  const toChange = matched.filter(m => m.changed);
  if (toChange.length) {
    console.log(`  ${WRITE ? 'linking' : 'would link'} ${toChange.length}:`);
    for (const m of toChange) console.log(`    ${m.name}  ->  ${m.url}`);
  }

  const already = matched.length - toChange.length;
  if (already) console.log(`\n  ${already} already linked correctly.`);

  if (missing.length) {
    console.log(`\n  NO IMAGE SUPPLIED (${missing.length}) — expected filename in public/products/:`);
    for (const p of missing) console.log(`    ${key(p.name)}.jpg      ${p.name}`);
  }

  if (orphans.length) {
    console.log(`\n  FILES THAT MATCH NOTHING (${orphans.length}) — check the spelling:`);
    for (const f of orphans) console.log(`    ${f}`);
  }

  /* -------------------------------------------------------------- write -- */
  if (WRITE && toChange.length) {
    for (const m of toChange) {
      await client.query('update product set image_path = $1 where id = $2', [m.url, m.id]);
    }
    console.log(`\n  ${toChange.length} product(s) updated.`);
  } else if (toChange.length) {
    console.log('\n  Nothing written. Re-run with --write to apply.');
  }

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
