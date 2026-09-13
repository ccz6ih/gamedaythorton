/**
 * shop-config.cjs
 * Switches online checkout on for a practice.
 *
 *   node scripts/shop-config.cjs                      # show current settings
 *   node scripts/shop-config.cjs --tax 6.7            # set the sales tax rate
 *   node scripts/shop-config.cjs --tax 6.7 --track    # ...and track stock levels
 *   node scripts/shop-config.cjs --tax 0              # close checkout again
 *
 * THE TAX RATE IS THE SWITCH.
 *
 * Until it is set, app.shop_order_create refuses every order and the shop page
 * says products are bought in person. That is deliberate rather than awkward: a
 * shop that sells without collecting the tax the practice owes does not fail —
 * it succeeds, quietly, and the shortfall comes out of the practice's own
 * pocket months later when someone reconciles.
 *
 * Nobody writing this code knows the correct rate, and a plausible-looking
 * default would be collected from real customers. The practice does know it,
 * because it charges it at the counter every day. So it is asked for once, here.
 *
 * For Colorado the number wanted is the COMBINED rate at the practice's own
 * address — state plus county plus city plus any special districts — which is
 * the single percentage already programmed into the card terminal.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const args = process.argv.slice(2);
const slug = args.find(a => !a.startsWith('--') && !/^[\d.]+$/.test(a)) ?? 'medbar-loveland';

function flagValue(name) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1] ?? null;
}

const taxArg = flagValue('tax');
const track = args.includes('--track');
const untrack = args.includes('--no-track');

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
  const client = new Client({ connectionString: connectionString() });
  await client.connect();

  if (taxArg !== null) {
    const percent = Number(taxArg);
    if (!Number.isFinite(percent) || percent < 0 || percent > 20) {
      console.error(`  --tax wants a percentage, like 6.7 — got ${JSON.stringify(taxArg)}`);
      process.exit(1);
    }
    // Percent to basis points. 6.7% -> 670.
    const bps = Math.round(percent * 100);
    await client.query('update clinic set sales_tax_bps = $1 where slug = $2', [bps, slug]);
    console.log(`  sales tax set to ${percent}% (${bps} bps)`);
  }

  if (track || untrack) {
    await client.query('update clinic set track_stock = $1 where slug = $2', [track, slug]);
    console.log(`  stock tracking ${track ? 'ON — sold-out products become unbuyable' : 'OFF — everything is buyable'}`);
  }

  const { rows } = await client.query(
    `select c.slug, c.name, c.sales_tax_bps, c.track_stock, c.site_live, c.pilot_mode,
            c.stripe_account_id is not null as has_stripe_account,
            (select count(*) from product p where p.clinic_id = c.id and p.active) as products,
            (select count(*) from product p where p.clinic_id = c.id and p.image_path is not null) as with_images,
            (select count(*) from shop_order o where o.clinic_id = c.id and o.status in ('paid','collected')) as paid_orders
       from clinic c where c.slug = $1`,
    [slug]
  );

  const c = rows[0];
  if (!c) { console.error(`  no clinic with slug ${slug}`); process.exit(1); }

  const tick = v => (v ? '✓' : '✗');

  console.log(`\n  ${c.name} (${c.slug})\n`);
  console.log(`    ${tick(c.sales_tax_bps > 0)} sales tax        ${(c.sales_tax_bps / 100).toFixed(2)}%${c.sales_tax_bps === 0 ? '   <- checkout is CLOSED until this is set' : ''}`);
  console.log(`    ${tick(true)} stock tracking   ${c.track_stock ? 'on' : 'off (everything buyable)'}`);
  console.log(`    ${tick(c.site_live)} site live`);
  console.log(`    ${tick(!c.pilot_mode)} out of pilot     ${c.pilot_mode ? 'pilot_mode is ON — no real payments' : ''}`);
  console.log(`    ${tick(c.has_stripe_account)} stripe account recorded`);
  console.log(`    ${tick(c.products > 0)} products         ${c.products} active, ${c.with_images} with images`);
  console.log(`      paid orders      ${c.paid_orders}`);

  // The two things this script cannot see, because they live in the hosting
  // environment rather than the database. Stated so the checklist is complete.
  console.log('\n  Not visible from here — check in Vercel:');
  console.log(`    STRIPE_SECRET_KEY      ${process.env.STRIPE_SECRET_KEY ? 'set locally' : 'NOT set locally'}`);
  console.log(`    STRIPE_WEBHOOK_SECRET  ${process.env.STRIPE_WEBHOOK_SECRET ? 'set locally' : 'NOT set locally'}`);
  console.log(`    PILOT_MODE             ${process.env.PILOT_MODE ?? '(unset — treated as true)'}`);
  console.log('');

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
