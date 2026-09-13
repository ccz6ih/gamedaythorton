const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const MANUAL_EXTRAS = {
  'Glow C+ Brightening Serum': '/products/GlowCSerum-3705_2.webp',
  'H.A. Collagen Boosting Serum': '/products/HACollagen-3607_3.webp',
  'Pumpkin Glycolic Peel 3%': '/products/PumpkinGlycolicPeel3_-3403_46.webp',
  'Purify Cleansing Oil': '/products/Purity-Botanic-Cleansing-Oil.webp'
};

async function main() {
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

  for (const [name, extraPath] of Object.entries(MANUAL_EXTRAS)) {
    const { rows } = await db.query('select id, clinic_id from product where name = $1', [name]);
    if (!rows.length) continue;
    const { id, clinic_id } = rows[0];

    await db.query(
      `insert into product_image (clinic_id, product_id, path, sort_order)
       values ($1, $2, $3, 1)
       on conflict (product_id, path) do nothing`,
      [clinic_id, id, extraPath]
    );
    console.log(`Linked extra image for ${name} -> ${extraPath}`);
  }

  await db.end();
}

main().catch(console.error);
