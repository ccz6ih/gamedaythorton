const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

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

  const { rows: products } = await db.query(`
    select p.id, p.name, p.image_path, array_agg(pi.path order by pi.sort_order) as extra_images
    from product p
    left join product_image pi on pi.product_id = p.id
    group by p.id, p.name, p.image_path
    order by p.name
  `);

  console.log(`Products and their images in database:`);
  for (const p of products) {
    console.log(`- ${p.name}:`);
    console.log(`    lead: ${p.image_path}`);
    console.log(`    extras: ${JSON.stringify(p.extra_images)}`);
  }

  await db.end();
}

main().catch(console.error);
