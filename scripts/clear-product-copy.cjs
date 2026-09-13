/**
 * clear-product-copy.cjs
 * Takes unverified product copy back off the live shop.
 *
 *   node scripts/clear-product-copy.cjs            # show what is published
 *   node scripts/clear-product-copy.cjs --clear    # blank descriptions and details
 *
 * ------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ------------------------------------------------------------------------
 * Eighteen product descriptions were generated and written to the live
 * database. They read well and they contain specific, checkable claims about a
 * real supplier's formulations — named ingredients, and in one case the
 * contents of a kit.
 *
 * If those came from Green Envee's own stockist copy, they are exactly right
 * and this script should never be run.
 *
 * If they were written from the product names, some of them are wrong, and the
 * ingredient claims are the part that matters: "willow bark" is a salicylate
 * and "tea tree" is a common contact allergen. Someone who avoids either will
 * read a description and make a decision with it. A wrong ingredient list is
 * not a typo — it is the one kind of error on a skincare page that can reach a
 * person's skin.
 *
 * Blanking them is not a loss. The shop falls back to honest copy — the product
 * page says the practice has not written it up yet and invites the question —
 * and /console/products makes filling all eighteen in a twenty-minute job once
 * the supplier's text is to hand.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const CLEAR = process.argv.includes('--clear');
// argv[0] is node and argv[1] is this file; only what comes after is an argument.
const slug = process.argv.slice(2).find(a => !a.startsWith('--')) ?? 'medbar-loveland';

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

/** Words that make a sentence checkable against a label rather than a matter of taste. */
const INGREDIENT_HINTS = [
  'willow bark', 'tea tree', 'niacinamide', 'ferulic', 'kakadu', 'hyaluronic',
  'snow mushroom', 'peptide', 'retinal', 'retinol', 'glycolic', 'mandelic',
  'salicylic', 'vitamin c', 'aloe', 'rosewater', 'chamomile', 'probiotic',
  'includes '
];

async function main() {
  const client = new Client({ connectionString: connectionString() });
  await client.connect();

  const { rows } = await client.query(
    `select p.id, p.name, p.description, p.details
       from product p join clinic c on c.id = p.clinic_id
      where c.slug = $1 and (p.description is not null or p.details is not null)
      order by p.name`,
    [slug]
  );

  if (rows.length === 0) {
    console.log(`\n  No published product copy for ${slug}.\n`);
    await client.end();
    return;
  }

  const flagged = rows.filter(r => {
    const text = `${r.description ?? ''} ${r.details ?? ''}`.toLowerCase();
    return INGREDIENT_HINTS.some(h => text.includes(h));
  });

  console.log(`\n  ${slug}: ${rows.length} product(s) with published copy\n`);
  console.log(`  ${flagged.length} of them name an ingredient or a kit's contents —`);
  console.log('  claims a customer can check against the label, and act on:\n');

  for (const r of flagged) {
    const text = `${r.description ?? ''} ${r.details ?? ''}`.toLowerCase();
    const found = INGREDIENT_HINTS.filter(h => text.includes(h));
    console.log(`    ${r.name.padEnd(34)} ${found.join(', ')}`);
  }

  if (!CLEAR) {
    console.log('\n  If this text came from Green Envee, it is correct and you are done.');
    console.log('  If it was written from the product names, run again with --clear.\n');
    await client.end();
    return;
  }

  const res = await client.query(
    `update product p
        set description = null, details = null
       from clinic c
      where c.id = p.clinic_id and c.slug = $1
        and (p.description is not null or p.details is not null)`,
    [slug]
  );

  console.log(`\n  Cleared copy on ${res.rowCount} product(s).`);
  console.log('  The shop now says the practice has not written them up yet,');
  console.log('  which is true. Fill them in at /console/products.\n');

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
