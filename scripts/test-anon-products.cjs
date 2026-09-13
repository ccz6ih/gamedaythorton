const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testFetch() {
  const supabase = createClient(URL_SB, ANON_KEY);
  const { data: clinic } = await supabase
    .from('clinic')
    .select('id, name')
    .eq('slug', 'medbar-loveland')
    .maybeSingle();

  console.log('Clinic:', clinic);
  if (!clinic) return;

  const [{ data: products, error: pErr }, { data: extraImages, error: imgErr }] = await Promise.all([
    supabase
      .from('product')
      .select('id, name, slug, brand, category, description, details, price_cents, stock_qty, image_path')
      .eq('clinic_id', clinic.id)
      .eq('active', true)
      .eq('online', true)
      .order('sort_order')
      .order('name'),
    supabase
      .from('product_image')
      .select('product_id, path, sort_order')
      .eq('clinic_id', clinic.id)
      .order('sort_order')
  ]);

  console.log('product query error:', pErr);
  console.log('product_image query error:', imgErr);
  console.log(`extraImages count:`, extraImages?.length);

  const secondaryByProduct = new Map();
  for (const img of extraImages ?? []) {
    const pId = String(img.product_id);
    if (!secondaryByProduct.has(pId)) {
      secondaryByProduct.set(pId, String(img.path));
    }
  }

  const mapped = (products ?? []).map(p => ({
    name: p.name,
    image_path: p.image_path,
    secondary_image_path: secondaryByProduct.get(p.id) ?? null
  }));

  console.log('Sample mapped products:');
  for (const p of mapped.slice(0, 5)) {
    console.log(`- ${p.name}:`);
    console.log(`    lead: ${p.image_path}`);
    console.log(`    secondary: ${p.secondary_image_path}`);
  }
}

testFetch().catch(console.error);
