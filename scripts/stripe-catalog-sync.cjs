/**
 * Give each retail product ONE stable Stripe Product, so Stripe's reporting can
 * group repeat sales instead of recording every order as a new product.
 *
 * Dry-run by default:
 *   node scripts/stripe-catalog-sync.cjs medbar-loveland
 *
 * Write to Stripe and store the ids:
 *   node scripts/stripe-catalog-sync.cjs medbar-loveland --write
 *
 * Live writes require an additional explicit confirmation:
 *   node scripts/stripe-catalog-sync.cjs medbar-loveland --write --confirm-live
 *
 * ===========================================================================
 * PRODUCTS, NOT PRICES
 * ===========================================================================
 * An earlier version of this script created Stripe Prices and rotated them
 * whenever price_cents changed. That was the wrong shape. A Stripe Price holds
 * an AMOUNT, so storing one makes Stripe a second copy of every price that has
 * to agree with this database forever — and lib/stripe.ts already refuses that
 * exact trade for sales tax, in those words.
 *
 * It also bought nothing, because checkout never read those price ids. It
 * builds every line with an inline `unit_amount` taken from the database at the
 * moment of sale, and it still does. Nothing here can change what a customer is
 * charged.
 *
 * A Stripe Product holds a NAME. It carries no money and cannot drift into
 * charging the wrong number. That is the whole of what Stripe needs to group a
 * report.
 *
 * ===========================================================================
 * RETAIL ONLY — AND NOT BECAUSE WE HAVE NOT GOT TO SERVICES
 * ===========================================================================
 * Service names ARE the banned terms. `botox`, `filler`, `microneedling` and
 * `neurotoxin` are all in BANNED_TERMS in lib/phi, and rule 4 of CLAUDE.md is
 * no PHI into Stripe, line items included. A clinical catalogue sitting in a
 * payment processor is the thing this avoids, not a feature it lacks.
 *
 * Services are also unsyncable on their own terms: `quoted`, `from` and
 * `per_unit` pricing has no single amount a catalogue entry could hold.
 *
 * ===========================================================================
 * THE SECRET KEY
 * ===========================================================================
 * Read from .env.local into this process and never printed. The only thing
 * this script will ever say about it is whether it is a test or a live key.
 * It is not written to the database, not passed to another process, and not
 * included in any output.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const args = process.argv.slice(2);
const slug = args.find(a => !a.startsWith('--')) ?? 'medbar-loveland';
const write = args.includes('--write');
const confirmLive = args.includes('--confirm-live');

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local.\n' +
      '  If .env.local begins "# Created by Vercel CLI", `vercel env pull` has overwritten\n' +
      '  it and wrote blanks for every variable marked Sensitive. Restore them from the\n' +
      '  Vercel dashboard.'
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The name a customer sees on the receipt. */
function displayName(product) {
  return product.brand ? `${product.brand} — ${product.name}` : product.name;
}

async function allStripeProducts(stripe, requestOptions) {
  const products = [];
  for await (const product of stripe.products.list({ limit: 100, active: true }, requestOptions)) {
    products.push(product);
  }
  return products;
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set. Nothing was changed.');
  if (write && process.env.PILOT_MODE !== 'false') {
    throw new Error('Refusing catalog writes while PILOT_MODE is on. Set PILOT_MODE=false deliberately.');
  }
  if (write && !key.startsWith('sk_test_') && !confirmLive) {
    throw new Error('Live catalog writes require --confirm-live. No Stripe data was changed.');
  }

  const db = database();
  const { data: clinic, error: clinicError } = await db
    .from('clinic')
    .select('id, slug, name, stripe_account_id, pilot_mode')
    .eq('slug', slug)
    .maybeSingle();
  if (clinicError) throw new Error(clinicError.message);
  if (!clinic) throw new Error(`No clinic with slug ${slug}.`);
  if (write && clinic.pilot_mode) throw new Error(`${slug} is still in clinic pilot mode.`);

  const { data: products, error: productsError } = await db
    .from('product')
    .select('id, name, brand, description, price_cents, stripe_product_id')
    .eq('clinic_id', clinic.id)
    .eq('active', true)
    .order('sort_order')
    .order('name');
  if (productsError) throw new Error(productsError.message);
  if (products.length === 0) throw new Error(`No active retail products found for ${slug}.`);

  const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia', maxNetworkRetries: 2 });
  const requestOptions = {};
  if (process.env.STRIPE_CONNECT === 'true') {
    if (!clinic.stripe_account_id) throw new Error('STRIPE_CONNECT=true but the clinic has no Stripe account id.');
    requestOptions.stripeAccount = clinic.stripe_account_id;
  }

  const mode = key.startsWith('sk_test_') ? 'test' : 'live';
  console.log(`\nStripe product sync: ${clinic.name} (${slug})`);
  console.log(`  account mode: ${mode}`);
  console.log(`  operation: ${write ? 'WRITE' : 'DRY RUN'}`);
  console.log(`  active retail products: ${products.length}`);
  console.log('  clinical services/packages: excluded — their names are PHI\n');

  const remoteProducts = await allStripeProducts(stripe, requestOptions);

  // Matched on OUR id in metadata, never on the name. A renamed product is the
  // same product; two products may legitimately share a name across brands.
  const byCatalogId = new Map(
    remoteProducts
      .filter(p => p.metadata?.kind === 'retail_product' && p.metadata?.clinic_id === clinic.id)
      .map(p => [p.metadata.catalog_id, p])
  );

  let created = 0;
  let renamed = 0;
  let repaired = 0;
  let unchanged = 0;

  for (const product of products) {
    const wanted = displayName(product);
    const metadata = {
      kind: 'retail_product',
      clinic_id: clinic.id,
      catalog_id: String(product.id)
    };

    // The stored pointer first, then a metadata match, then nothing.
    let remote = null;
    if (product.stripe_product_id) {
      try {
        const found = await stripe.products.retrieve(product.stripe_product_id, requestOptions);
        if (!found.deleted) remote = found;
      } catch (error) {
        console.log(`  ${wanted}: stored product could not be read (${error.message})`);
      }
    }
    if (!remote) remote = byCatalogId.get(String(product.id)) ?? null;

    if (!remote) {
      console.log(`  CREATE   ${wanted}`);
      if (write) {
        const made = await stripe.products.create(
          { name: wanted, description: product.description || undefined, metadata },
          requestOptions
        );
        const { error } = await db.from('product')
          .update({ stripe_product_id: made.id })
          .eq('id', product.id).eq('clinic_id', clinic.id);
        if (error) throw new Error(error.message);
        console.log(`           stored ${made.id}`);
      }
      created++;
      continue;
    }

    // The database pointer is missing but Stripe already has the object. This
    // is the state the previous run leaves behind if it died between the two
    // writes, and it must not create a duplicate.
    if (!product.stripe_product_id) {
      console.log(`  REPAIR   ${wanted} -> ${remote.id} (database pointer)`);
      if (write) {
        const { error } = await db.from('product')
          .update({ stripe_product_id: remote.id })
          .eq('id', product.id).eq('clinic_id', clinic.id);
        if (error) throw new Error(error.message);
      }
      repaired++;
      continue;
    }

    if (remote.name !== wanted) {
      console.log(`  RENAME   ${remote.name} -> ${wanted}`);
      if (write) await stripe.products.update(remote.id, { name: wanted }, requestOptions);
      renamed++;
      continue;
    }

    console.log(`  OK       ${wanted}`);
    unchanged++;
  }

  console.log(`\nSummary: ${unchanged} unchanged, ${created} created, ${repaired} repaired, ${renamed} renamed.`);
  console.log('No Stripe Price objects were created. Prices stay in this database only.');
  if (!write) console.log('\nDry run only. Re-run with --write after reviewing the plan.');
}

main().catch(error => {
  console.error(`\nStripe product sync stopped: ${error.message}`);
  process.exit(1);
});
