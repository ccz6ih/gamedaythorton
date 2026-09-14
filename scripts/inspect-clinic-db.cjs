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

  const { rows } = await db.query(`
    select id, name, slug, address_line1, address_line2, address_city, address_state, address_zip, address_note,
           phone_voice, phone_text, email, visit_facts, tagline, intro, booking_note
    from clinic
    where slug = 'medbar-loveland'
  `);

  console.log('Clinic medbar-loveland in DB:', JSON.stringify(rows[0], null, 2));
  await db.end();
}

main().catch(console.error);
