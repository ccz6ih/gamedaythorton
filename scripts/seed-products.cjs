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

/** name, price in dollars, stock on hand, category, description, details */
const GREEN_ENVEE = [
  [
    'Acne Rescue Kit', 84.00, 2, 'kits',
    'Complete 4-step clarifying regimen formulated with organic botanicals, willow bark, and tea tree to calm breakouts, clear congested pores, and restore balance.',
    'Includes Clarify Cleansing Gel, Clear Complexion Healing Masque, Flora Elixir Botanic Oil Serum, and Clear Repair Serum. Specifically designed for oily, combination, and acne-prone skin types.'
  ],
  [
    'Clear Repair Serum', 72.50, 1, 'serums',
    'Lightweight clarifying serum with botanical willow bark, niacinamide, and prebiotic ferment to soothe active blemishes, refine pores, and promote even tone.',
    'Apply 2–3 drops morning and evening to clean skin before moisturizing. Helps reduce redness and decongest without stripping natural moisture.'
  ],
  [
    'Flora Elixir', 72.50, 0, 'serums',
    'Nutrient-rich botanic oil serum crafted with organic cold-pressed plant lipids and floral essences to fortify the barrier, replenish moisture, and impart a dewy glow.',
    'Warm 3–4 drops in palms and gently press into clean face, neck, and décolleté following water-based serums or mist.'
  ],
  [
    'Glow C+ Brightening Serum', 91.00, 0, 'serums',
    'High-potency antioxidant serum featuring stable Vitamin C (tetrahexyldecyl ascorbate), kakadu plum, and ferulic acid to brighten dull tone, fade hyperpigmentation, and boost collagen.',
    'Apply 3–4 drops each morning to clean skin. Follow with moisturizer and daily broad-spectrum SPF.'
  ],
  [
    'H.A. Collagen Boosting Serum', 83.00, 0, 'serums',
    'Multi-molecular hyaluronic acid serum with snow mushroom extract and botanical peptides to deeply hydrate, plump fine lines, and strengthen elasticity.',
    'Apply morning and night to slightly damp skin for optimal moisture binding. Excellent following peels or microneedling.'
  ],
  [
    'Hydrate Facial Mist', 33.00, 2, 'hydration',
    'Refreshing botanical toning mist infused with organic rosewater, aloe vera, and calming chamomile to balance pH and quench thirsty skin on contact.',
    'Spritz generously over face and neck after cleansing, post-treatment, or over makeup throughout the day as an instant hydration reset.'
  ],
  [
    'Illuminate Enzyme Cleansing Powder', 42.50, 1, 'exfoliants',
    'Water-activated micro-exfoliating powder combining papaya, pineapple enzymes, and rice bran to gently polish away dull surface cells for instant radiance.',
    'Dispense into wet hands, lather into a creamy foam, and massage gently over damp skin for 60 seconds before rinsing with lukewarm water.'
  ],
  [
    'Mandelic Resurfacing Serum 8%', 81.00, 0, 'serums',
    'Gentle AHA resurfacing treatment with 8% mandelic and lactic acids to smooth rough texture, clear congested pores, and brighten post-blemish discoloration.',
    'Ideal for sensitive, acne-prone, and reactive skin. Apply 3–4 drops in the evening 2–4 times weekly.'
  ],
  [
    'Post Peel Kit', 87.00, 0, 'kits',
    'Calming recovery system formulated with barrier-repair lipids and soothing botanicals to accelerate healing following chemical peels or clinical facials.',
    'Includes gentle botanical cleanser, soothing essence mist, restorative moisture balm, and antioxidant protection to support optimal barrier recovery.'
  ],
  [
    'Protect Antioxidant Moisturizer', 66.00, 0, 'hydration',
    'Daily protective cream rich in CoQ10, green tea, and plant ceramides to shield against environmental oxidative stress, soothe inflammation, and seal in hydration.',
    'Massage 1–2 pumps onto clean face and neck morning and evening. Perfect for normal, combination, and sensitive skin.'
  ],
  [
    'Pumpkin Glycolic Peel 3%', 53.00, 0, 'exfoliants',
    'Nutrient-rich enzyme peel with organic pumpkin puree, 3% glycolic acid, and raw honey to dissolve dead keratinized buildup and reveal glowing, luminous skin.',
    'Apply a thin layer to clean skin for 5–10 minutes depending on tolerance. Rinse thoroughly with cool water. Use 1–2 times weekly.'
  ],
  [
    'Purify Cleansing Oil', 37.00, 0, 'exfoliants',
    'Luxurious botanical oil cleanser with sunflower, jojoba, and lavender that melts away makeup, sunscreen, and daily sebum without stripping the skin.',
    'Massage 2–3 pumps onto dry skin, emulsify with warm water, and rinse clean. Follow with a water-based cleanser if double cleansing.'
  ],
  [
    'Refine Polishing Facial Scrub', 45.50, 0, 'exfoliants',
    'Gentle dual-action physical and enzymatic scrub with biodegradable micro-jojoba beads and fruit enzymes to refine texture without micro-tears.',
    'Gently massage onto damp skin in circular motions for 1–2 minutes, avoiding the eye area. Rinse thoroughly. Use 1–2 times per week.'
  ],
  [
    'Renew Eye Complex', 68.00, 0, 'hydration',
    'Targeted peptide eye cream with green coffee caffeine and marine botanical extracts to diminish dark circles, reduce under-eye puffiness, and firm delicate contours.',
    'Gently pat half a pump around the orbital bone morning and night using your ring finger.'
  ],
  [
    'Restore Hydration Masque', 63.00, 0, 'hydration',
    'Deeply replenishing gel-cream masque with hyaluronic acid, blue tansy, and aloe to soothe thirsty, sensitized, or post-treatment skin.',
    'Apply generously to face and neck. Leave on for 15–20 minutes, then rinse or leave on overnight as an intensive recovery treatment.'
  ],
  [
    'Retinal Renewal Complex', 121.00, 0, 'serums',
    'Advanced encapsulated retinaldehyde (0.05% Vitamin A) with bakuchiol to accelerate cellular renewal, refine lines, and clarify tone with superior tolerance.',
    'Apply 1–2 pumps in the evening to clean, dry skin 2–3 nights weekly, building to nightly use as tolerated. Always wear daily SPF.'
  ],
  [
    'Revitalize Eye Gel', 68.00, 0, 'hydration',
    'Cooling, depuffing eye gel infused with green tea, cucumber, and botanical peptides to revive tired eyes and reduce fluid retention.',
    'Dab lightly around eye area morning and night. Store in refrigerator for an enhanced cooling and depuffing sensation.'
  ],
  [
    'Vahati Herb Infused Healing Oil', 71.60, 0, 'hydration',
    'Sacred Ayurvedic multi-correctional face oil with cold-pressed moringa, ashwagandha, and calendula to calm reactivity, heal dry patches, and restore skin vitality.',
    'Warm 3–4 drops in palms and gently press into face, neck, and décolleté as the finishing step in your skincare ritual.'
  ]
];

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
  for (const [name, price, stock, category, desc, details] of GREEN_ENVEE) {
    await db.query(
      `insert into product
         (clinic_id, name, slug, brand, category, price_cents, stock_qty,
          description, details, online, active, sort_order, synthetic)
       values ($1,$2,$3,'Green Envee',$4,$5,$6,$7,$8,true,true,$9,false)
       on conflict (clinic_id, name) do update
         set price_cents = excluded.price_cents,
             stock_qty   = excluded.stock_qty,
             brand       = excluded.brand,
             category    = excluded.category,
             description = coalesce(excluded.description, product.description),
             details     = coalesce(excluded.details, product.details)`,
      [clinic.id, name, slugify(name), category,
       Math.round(price * 100), stock, desc, details, n]
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
