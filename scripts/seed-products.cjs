/**
 * seed-products.cjs
 * Loads The Med Bar's retail line.
 *
 *   node scripts/seed-products.cjs medbar-loveland
 *
 * Names, brand and prices are transcribed from the practice's own inventory
 * screen. Stock counts are transcribed too, and they are mostly zero — which is
 * real: the shop should show what is genuinely in stock rather than inventing
 * availability, and "out of stock" on the public page is information the
 * practice can act on.
 *
 * NO DESCRIPTIONS ARE INVENTED. The previous system stores none for these, and
 * writing product copy for a skincare line we have not read the label of would
 * put claims on her page that neither of us can stand behind. Each one is
 * flagged for her to fill in, the same way the service menu handles it.
 *
 * Idempotent: matched on (clinic, name), so re-running updates prices rather
 * than duplicating the catalogue.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const slug = process.argv[2] ?? 'medbar-loveland';

/** name, price in dollars, stock on hand. Brand is the same for all of these. */
const GREEN_ENVEE = [
  ['Acne Rescue Kit', 84.00, 2],
  ['Clear Repair Serum', 72.50, 1],
  ['Flora Elixir', 72.50, 0],
  ['Glow C+ Brightening Serum', 91.00, 0],
  ['H.A. Collagen Boosting Serum', 83.00, 0],
  ['Hydrate Facial Mist', 33.00, 2],
  ['Illuminate Enzyme Cleansing Powder', 42.50, 1],
  ['Mandelic Resurfacing Serum 8%', 81.00, 0],
  ['Post Peel Kit', 87.00, 0],
  ['Protect Antioxidant Moisturizer', 66.00, 0],
  ['Pumpkin Glycolic Peel 3%', 53.00, 0],
  ['Purify Cleansing Oil', 37.00, 0],
  ['Refine Polishing Facial Scrub', 45.50, 0],
  ['Renew Eye Complex', 68.00, 0],
  ['Restore Hydration Masque', 63.00, 0],
  ['Retinal Renewal Complex', 121.00, 0],
  ['Revitalize Eye Gel', 68.00, 0],
  ['Vahati Herb Infused Healing Oil', 71.60, 0]
];

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A rough grouping so the shop is browsable. Nothing clinical is claimed. */
function categorise(name) {
  if (/kit/i.test(name)) return 'kits';
  if (/serum|complex|elixir/i.test(name)) return 'serums';
  if (/peel|scrub|powder|cleansing/i.test(name)) return 'exfoliants';
  if (/moisturizer|masque|mist|oil|gel/i.test(name)) return 'hydration';
  return 'skincare';
}

(async () => {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const db = new Client({
    host: process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`,
    port: Number(process.env.SUPABASE_DB_PORT || 5432),
    user: process.env.SUPABASE_DB_USER || 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();

  const { rows } = await db.query('select id, name from clinic where slug = $1', [slug]);
  if (!rows.length) { console.error(`\n  No clinic "${slug}".\n`); process.exit(1); }
  const clinic = rows[0];

  let n = 0;
  for (const [name, price, stock] of GREEN_ENVEE) {
    await db.query(
      `insert into product
         (clinic_id, name, slug, brand, category, price_cents, stock_qty,
          online, active, sort_order, synthetic)
       values ($1,$2,$3,'Green Envee',$4,$5,$6,true,true,$7,false)
       on conflict (clinic_id, name) do update
         set price_cents = excluded.price_cents,
             stock_qty   = excluded.stock_qty,
             brand       = excluded.brand,
             category    = excluded.category`,
      [clinic.id, name, slugify(name), categorise(name),
       Math.round(price * 100), stock, n]
    );
    n++;
  }

  const { rows: [counts] } = await db.query(
    `select count(*) total,
            count(*) filter (where stock_qty > 0) in_stock,
            count(*) filter (where description is null) no_copy
       from product where clinic_id = $1`, [clinic.id]);

  console.log(`\n  ${clinic.name}`);
  console.log(`  ${n} products loaded (${counts.in_stock} of ${counts.total} in stock).`);
  console.log(`  ${counts.no_copy} have no description — flagged for the practice, not invented.`);
  console.log(`  One product on her inventory screen was cut off in the source and is`);
  console.log(`  missing here. Worth checking the count against her own list.\n`);

  await db.end();
})().catch(err => { console.error('\n  ' + err.message + '\n'); process.exit(1); });
