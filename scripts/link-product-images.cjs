/**
 * link-product-images.cjs
 * Points each product at its picture.
 *
 *   node scripts/link-product-images.cjs               # report only, changes nothing
 *   node scripts/link-product-images.cjs --write       # apply
 *   node scripts/link-product-images.cjs --write other-clinic
 *
 * Drop image files into public/products/ and run it. Names do NOT have to match
 * a convention — see below.
 *
 * ------------------------------------------------------------------------
 * WHY THIS MATCHES ON WORDS RATHER THAN FILENAMES
 * ------------------------------------------------------------------------
 * The first version required files named `renew-eye-complex.jpg`. That is a
 * fine rule and nobody will ever follow it, because the files arrive from the
 * supplier's asset pack already called
 * `Protect-Antioxidant-Moisturizer-Retail-White.webp` and
 * `ProtectAntioxidantMoisturizer-3311_19.webp`. Asking somebody to rename
 * forty-five files by hand to satisfy a script is the script's problem, not
 * theirs.
 *
 * So it scores on shared words instead: split both the product name and the
 * filename into words — including through camelCase, which the supplier uses on
 * half of them — and match on overlap.
 *
 * ------------------------------------------------------------------------
 * IT SHOWS ITS WORKING, AND IT WILL NOT GUESS
 * ------------------------------------------------------------------------
 * Fuzzy matching that silently picks the closest thing is how a jar of
 * moisturiser ends up illustrated with somebody else's serum on a live shop.
 * So every match prints its score and the filename it chose, anything below the
 * confidence floor is reported as unmatched rather than applied, and the
 * default is still to change nothing until a human has read the list.
 *
 * Both directions are printed every run: products with no photo, and photos
 * that matched no product. The second list is genuinely useful here — it is
 * mostly products the practice stocks in the room but has not put in the shop.
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

/** Below this share of the product's words, it is a guess and gets reported. */
const FLOOR = 0.75;

/**
 * "ProtectAntioxidantMoisturizer-3311_19" -> [protect, antioxidant, moisturizer]
 *
 * camelCase is split first, because the supplier writes half its filenames that
 * way and without it every one of those is a single unmatchable token. Digits,
 * and the words that appear on every file in a pack, are dropped — "retail" and
 * "white" describe the photograph rather than the product and would otherwise
 * let two unrelated items share two words.
 */
const NOISE = new Set([
  'retail', 'white', 'shadow', 'png', 'webp', 'jpg', 'copy', 'final', 'o',
  'the', 'and', 'with', 'a'
]);

function words(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(w => w && !NOISE.has(w) && !/^\d+$/.test(w) && !/^[0-9a-f]{8,}$/.test(w));
}

/**
 * How well a file matches a product, 0..1.
 *
 * Measured against the PRODUCT's words, not the file's: a filename carrying
 * extra words it got from the supplier should not be penalised, but a product
 * whose words are missing from the file is not that product.
 */
function score(productWords, fileWords) {
  if (productWords.length === 0) return 0;
  const inFile = new Set(fileWords);
  // Singular/plural and mask/masque are the same word for this purpose.
  const has = w => inFile.has(w)
    || inFile.has(w.replace(/s$/, ''))
    || inFile.has(w + 's')
    || (w === 'masque' && inFile.has('mask'))
    || (w === 'mask' && inFile.has('masque'));
  return productWords.filter(has).length / productWords.length;
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

  /**
   * Browser-duplicate downloads are dropped.
   *
   * Saving the same asset twice gives `Hydrate-Facial-Mist.webp` and
   * `Hydrate-Facial-Mist (1).webp` — byte-identical, and both would score 100%
   * and end up on the product page as the same photograph shown twice. The
   * original is kept and the " (1)" copy skipped when the original is present.
   */
  const all = fs.readdirSync(DIR)
    .filter(f => EXT.has(path.extname(f).toLowerCase()) && !f.startsWith('.'));

  const present = new Set(all);
  const files = all
    .filter(f => {
      const original = f.replace(/ \(\d+\)(?=\.[^.]+$)/, '');
      return original === f || !present.has(original);
    })
    .map(f => ({ file: f, words: words(path.basename(f, path.extname(f))) }));

  const dupes = all.length - files.length;
  if (dupes) console.log(`\n  ${dupes} duplicate download(s) ignored.`);

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
  const weak = [];
  const claimed = new Set();

  for (const product of rows) {
    const pw = words(product.name);

    const ranked = files
      .map(f => ({ ...f, s: score(pw, f.words) }))
      .sort((a, b) =>
        b.s - a.s
        // On a tie, prefer the plain product shot over the lifestyle alternate.
        || (/retail[-_ ]?white/i.test(a.file) ? -1 : 1)
        // Then the shorter name, which is the less-embellished file.
        || a.file.length - b.file.length);

    const best = ranked[0];
    if (!best || best.s === 0) continue;

    if (best.s < FLOOR) { weak.push({ id: product.id, name: product.name, file: best.file, score: best.s }); continue; }

    /**
     * EVERY confident match, not just the winner.
     *
     * The supplier ships two or more shots of each product — a plain one on
     * white and an alternate. Keeping only the best scorer threw the rest away
     * and left the product page with a single image, which is the difference
     * between a shop and a list.
     *
     * The first stays product.image_path, because the grid reads one image and
     * should not join to find it. The remainder become product_image rows.
     */
    const all = ranked.filter(f => f.s >= FLOOR);

    matched.push({
      id: product.id,
      name: product.name,
      file: best.file,
      score: best.s,
      url: `/products/${best.file}`,
      changed: product.image_path !== `/products/${best.file}`,
      extras: all.slice(1).map(f => ({ file: f.file, url: `/products/${f.file}`, score: f.s }))
    });

    for (const f of all) claimed.add(f.file);
  }

  /* ------------------------------------------------------------- report -- */
  console.log(`\n  ${slug}: ${rows.length} products, ${files.length} image file(s)\n`);

  const extraCount = matched.reduce((n, m) => n + m.extras.length, 0);

  if (matched.length) {
    console.log(`  ${WRITE ? 'LINKING' : 'WOULD LINK'} ${matched.length} product(s), ${extraCount} extra image(s):`);
    for (const m of matched) {
      console.log(`    ${(m.score * 100).toFixed(0).padStart(3)}%  ${m.name.padEnd(34)} ${m.file}${m.changed ? '' : '   (unchanged)'}`);
      for (const e of m.extras) {
        console.log(`          ${(e.score * 100).toFixed(0).padStart(3)}%  ${''.padEnd(34)} + ${e.file}`);
      }
    }
  }

  const noPhoto = rows.filter(p => !matched.some(m => m.id === p.id));
  if (noPhoto.length) {
    console.log(`\n  NO PHOTO (${noPhoto.length}) — these stay as a letter tile:`);
    for (const p of noPhoto) {
      const near = weak.find(w => w.id === p.id);
      console.log(`    ${p.name.padEnd(34)}${near ? `  closest was ${(near.score * 100).toFixed(0)}% ${near.file}` : ''}`);
    }
  }

  const orphans = files.filter(f => !claimed.has(f.file)).map(f => f.file);
  if (orphans.length) {
    console.log(`\n  PHOTOS MATCHING NO PRODUCT (${orphans.length}):`);
    for (const f of orphans) console.log(`    ${f}`);
    console.log('\n  Mostly products the practice stocks but has not listed in the shop.');
    console.log('  Adding them is a console job, not a script one.');
  }

  /* -------------------------------------------------------------- write -- */
  if (WRITE && matched.length) {
    const { rows: clinicRow } = await client.query(
      'select id from clinic where slug = $1', [slug]);
    const clinicId = clinicRow[0].id;

    let extras = 0;
    for (const m of matched) {
      if (m.changed) {
        await client.query('update product set image_path = $1 where id = $2', [m.url, m.id]);
      }

      // Idempotent on (product, path), so re-running after dropping more files
      // in adds the new ones and leaves the rest alone.
      for (const [i, e] of m.extras.entries()) {
        const res = await client.query(
          `insert into product_image (clinic_id, product_id, path, alt, sort_order)
           values ($1, $2, $3, $4, $5)
           on conflict (product_id, path) do nothing`,
          [clinicId, m.id, e.url, m.name, i + 1]
        );
        extras += res.rowCount;
      }
    }
    console.log(`\n  ${matched.filter(m => m.changed).length} lead image(s) set, ${extras} extra image(s) added.\n`);
  } else if (matched.length) {
    console.log('\n  Nothing written. Re-run with --write to apply.\n');
  } else {
    console.log('\n  Nothing to change.\n');
  }

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
