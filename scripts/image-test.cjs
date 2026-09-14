/**
 * image-test.cjs
 * Every product image the shop will ask for must actually be servable.
 *
 *   node scripts/image-test.cjs                # the live clinic
 *   node scripts/image-test.cjs other-clinic
 *
 * ------------------------------------------------------------------------
 * WHY THIS EXISTS SEPARATELY FROM storefront-test.cjs
 * ------------------------------------------------------------------------
 * storefront-test.cjs fetches real images over HTTP and is the stronger check
 * — it is what proved the middleware was redirecting every product photograph
 * to the sign-in page. But it can only run against a deployment, which means it
 * finds a broken image AFTER a customer could have seen it.
 *
 * This one runs against the working tree in a second with no network, so the
 * same class of fault is caught before the commit that ships it.
 *
 * ------------------------------------------------------------------------
 * THE THREE WAYS AN IMAGE PATH GOES WRONG
 * ------------------------------------------------------------------------
 * 1. The file is not there. A row points at a name nobody dropped in, or
 *    somebody tidied up public/products/ and took a referenced file with them.
 *
 * 2. The file IS there but the path cannot survive a URL. This is the one that
 *    actually happened and it is the reason for this script. A browser saving
 *    the same asset twice writes `Nourish-...-White (1).webp`; that name went
 *    into the database verbatim, and a space in a URL path either has to be
 *    percent-encoded at every single use or the image 404s. One tile on the
 *    live shop was empty for days. The fix was to rename the file, not to
 *    encode the path, because encoding has to be remembered forever and a
 *    filename only has to be right once.
 *
 * 3. The path is not root-relative, so it resolves against whatever directory
 *    the visitor happens to be in — fine on /shop, broken on /shop/some-product.
 *
 * A missing image is not a crash. It is a letter tile where a jar of
 * moisturiser should be, on the page whose entire job is to make somebody want
 * the jar. It fails loudly here so it never gets that far.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const slug = process.argv.slice(2).find(a => !a.startsWith('--')) ?? 'medbar-loveland';
const PUBLIC = path.resolve(__dirname, '..', 'public');

let pass = 0;
const failures = [];

function check(ok, label, detail) {
  if (ok) { pass++; return; }
  failures.push({ label, detail });
}

function connectionString() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const pw = process.env.SUPABASE_DB_PASSWORD;
  const region = process.env.SUPABASE_REGION || 'us-east-1';
  if (!ref || !pw) {
    console.log('\n  SKIPPED: SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD are not set.');
    console.log('  This check reads the product table, so it needs database access.\n');
    process.exit(0);
  }
  return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
}

async function main() {
  const client = new Client({ connectionString: connectionString() });
  await client.connect();

  /**
   * Both places a path can live, in one list.
   *
   * product.image_path is the lead shot the grid reads without a join;
   * product_image.path is the rest of the gallery. An earlier version of this
   * checked only the first and would have passed while every secondary image on
   * every product page was broken.
   */
  const { rows } = await client.query(
    `select p.name, p.image_path as url, 'product.image_path' as source
       from product p join clinic c on c.id = p.clinic_id
      where c.slug = $1 and p.image_path is not null
      union all
     select p.name, i.path as url, 'product_image.path' as source
       from product_image i
       join product p on p.id = i.product_id
       join clinic c on c.id = i.clinic_id
      where c.slug = $1
      order by name`,
    [slug]
  );

  console.log(`\n  ${slug}: checking ${rows.length} image path(s)\n`);

  for (const r of rows) {
    const where = `${r.name} (${r.source})`;

    check(r.url.startsWith('/'), 'PATH IS ROOT-RELATIVE',
      `${where}: "${r.url}" does not start with / — it will resolve against the current directory`);

    // The one that shipped broken. Kept as its own named assertion rather than
    // folded into the encoding check below, because the remedy is different:
    // rename the file, do not encode the path.
    check(!/[ ()]/.test(r.url), 'NO SPACES OR PARENTHESES IN PATH',
      `${where}: "${r.url}" — rename the file on disk, do not percent-encode the path`);

    check(r.url === encodeURI(r.url), 'PATH NEEDS NO ENCODING',
      `${where}: "${r.url}" would have to be percent-encoded at every use`);

    let onDisk = null;
    try { onDisk = path.join(PUBLIC, decodeURI(r.url)); } catch { /* malformed escape */ }
    check(onDisk !== null && fs.existsSync(onDisk), 'FILE EXISTS IN public/',
      `${where}: "${r.url}" names no file under public/`);
  }

  /**
   * Unreferenced files are reported, not failed.
   *
   * public/products/ legitimately holds more than the shop lists — products the
   * practice keeps in the room but has not put online. But a " (1)" copy sitting
   * there is a trap: the next run of link-product-images could pick it, and it
   * is how the broken path got into the database in the first place.
   */
  const files = fs.existsSync(path.join(PUBLIC, 'products'))
    ? fs.readdirSync(path.join(PUBLIC, 'products')).filter(f => !f.startsWith('.'))
    : [];
  const dupes = files.filter(f => / \(\d+\)\./.test(f));
  check(dupes.length === 0, 'NO DUPLICATE-DOWNLOAD FILES IN public/products/',
    `these will be picked up by a future run and cannot survive a URL:\n        ${dupes.join('\n        ')}`);

  /* ------------------------------------------------------------- report -- */
  if (failures.length) {
    console.log(`  ${failures.length} FAILED:\n`);
    for (const f of failures) {
      console.log(`    ${f.label}`);
      console.log(`      ${f.detail}\n`);
    }
  }

  console.log(`  ${pass} passed, ${failures.length} failed.\n`);

  await client.end();
  process.exit(failures.length ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
