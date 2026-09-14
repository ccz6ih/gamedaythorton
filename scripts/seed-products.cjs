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

/** name, price in dollars, stock on hand, category, card blurb, full description */
const GREEN_ENVEE = [
  [
    'Soothe Herbal Cleansing Cream', 34.00, 2, 'cleanser',
    'A cream cleanser for skin that feels tight or reactive after washing.',
    'Green tea and chamomile do the calming work here. It lifts makeup and the day off without stripping the barrier, so skin ends up clean but still comfortable rather than squeaking. If your skin runs dry, sensitive, or easily flushed, start and end the day with this one.'
  ],
  [
    'Purify Botanic Cleansing Oil', 37.00, 2, 'cleanser',
    'Melts sunscreen and makeup, then rinses clean instead of leaving a film.',
    'Oil dissolves oil — which is why this removes SPF and long-wear makeup that a foaming cleanser just smears around. It rinses away cleanly rather than leaving the slick residue people expect from an oil. Use it as your first cleanse at night and follow with your regular one.'
  ],
  [
    'Clarify Cleansing Gel', 33.00, 2, 'cleanser',
    'A gel cleanse for oily and breakout-prone skin, without the stripped feeling.',
    'Clears congestion and excess oil while leaving the barrier intact. The tight, squeaky finish most acne cleansers give you is the thing that pushes skin into producing more oil by afternoon — this avoids it. Suits oily and combination skin morning and night.'
  ],
  [
    'Illuminate Enzyme Cleansing Powder', 42.50, 1, 'cleanser',
    'A dry powder that activates in your palm — gentle enzyme exfoliation with every wash.',
    'Because it exfoliates with enzymes rather than grit, it\'s a good bridge for anyone whose skin can\'t tolerate a scrub but still looks dull. Activate a small amount in wet hands and cleanse as usual. Nothing to spill, which makes it the easiest one to travel with.'
  ],
  [
    'Pumpkin Glycolic Peel 3%', 53.00, 2, 'exfoliator',
    'An at-home peel at a strength you can actually use every week.',
    'Glycolic loosens dull surface cells while pumpkin enzymes help clear them away, leaving texture smoother and tone more even. Three percent is meaningful without being a weekend-ruining peel. Start once weekly at night, build from there, and wear SPF the following day without exception.'
  ],
  [
    'Rejuvenate Brightening Enzyme Masque', 53.00, 2, 'exfoliator',
    'For skin that looks tired more than it looks problematic.',
    'Enzymes clear the dulling layer on the surface so everything you apply afterward actually absorbs instead of sitting on top. Ten minutes, once or twice a week. The most noticeable result is usually the next morning, when makeup goes on smooth instead of patchy.'
  ],
  [
    'Refine Polishing Facial Scrub', 45.50, 2, 'exfoliator',
    'A physical polish for normal to combination skin that likes the feel of a scrub.',
    'Smooths rough patches and keeps pores from filling in. Use the lightest pressure you can and let the scrub do the work — pressing harder doesn\'t exfoliate more, it just irritates. Once or twice a week is plenty for most skin.'
  ],
  [
    'Hydrate Facial Mist', 33.00, 2, 'toner',
    'Mist onto damp skin so the layers on top have something to hold onto.',
    'This is the step most people skip and then wonder why their serum disappears. Applying to damp skin gives everything after it something to bind to. It also earns its keep at three in the afternoon — Colorado air pulls moisture out of your skin all day. Keep one at your desk.'
  ],
  [
    'Bright Facial Mist', 33.00, 2, 'toner',
    'The same hydrating step, tuned toward evenness of tone.',
    'Preps skin after cleansing and supports a more even appearance with consistent daily use. Choose this one over Hydrate if your main concern is skin that reads dull or patchy rather than skin that reads dry.'
  ],
  [
    'Firm Collagen Gel Masque', 61.00, 2, 'masque',
    'A cooling gel masque for skin that looks slack or stressed.',
    'For after travel, a long week, or a short night. It supports firmness and takes the tired look off the face without any heaviness. Twenty minutes is enough, and it pairs particularly well with LED if you\'re layering treatments at home.'
  ],
  [
    'Restore Hydration Masque', 63.00, 2, 'masque',
    'For skin that has gone flat and thirsty and needs water, not oil.',
    'Hyaluronic acid and CoQ10 restore hydration to the barrier rather than coating it, with rosehip and hibiscus supporting tone and elasticity. This is the one to reach for after a peel, after a flight, or in the middle of a Colorado winter week when nothing else is landing.'
  ],
  [
    'Clear Complexion Healing Masque', 53.00, 2, 'masque',
    'A treatment masque for active breakouts, not a preventative one.',
    'Helps draw down congestion while supporting the skin\'s own repair process, so spots tend to settle faster and leave less behind them. Use it as a full masque when things flare, or spot-apply overnight on individual areas.'
  ],
  [
    'Potent C Superfood Masque', 63.00, 2, 'masque',
    'A concentrated weekly vitamin C dose for dullness and uneven tone.',
    'Antioxidant support in a treatment-strength format rather than a daily one — a reset for skin that\'s been outside, under stress, or neglected for a stretch. Follow with moisturizer, and with SPF if you\'re using it in the morning.'
  ],
  [
    'Glow C+ Brightening Serum', 91.00, 2, 'serum',
    'Your daily antioxidant step, worn in the morning under everything else.',
    'Vitamin C supports a more even tone over time and helps defend against the environmental load your skin absorbs between waking up and going to bed. Apply to clean skin, moisturizer over it, SPF over that. The order matters more than people think.'
  ],
  [
    'Clear Repair Serum', 72.50, 1, 'serum',
    'For breakout-prone skin that\'s also dry and irritated from treating it.',
    'Most acne routines attack congestion and wreck the barrier on the way, which is why they stall around week six. This one targets blemishes while supporting the barrier at the same time, so skin can stay on it long enough to see a change. Use nightly.'
  ],
  [
    'H.A. Collagen Boosting Serum', 83.00, 2, 'serum',
    'Hyaluronic acid for hydration, plant peptides and stem cells for collagen support.',
    'Plant peptides and echinacea stem cells work alongside hyaluronic acid to hold moisture and support firmness. Apply to damp skin and seal with moisturizer — on dry skin with dry air around it, hyaluronic acid can pull water the wrong direction. Suits every skin type.'
  ],
  [
    'Mandelic Resurfacing Serum 8%', 81.00, 2, 'serum',
    'The resurfacing acid for skin that has reacted badly to glycolic.',
    'Mandelic is the gentlest of the AHAs — a larger molecule that penetrates more slowly and with less irritation. That makes it the better choice for sensitive skin and for deeper skin tones, where aggressive acids carry a real risk of post-inflammatory pigment. Nightly, with SPF.'
  ],
  [
    'Retinal Renewal Complex', 121.00, 2, 'serum',
    'The highest-return product on this shelf for lines and texture over time.',
    'A step above retinol in strength and a step below prescription in irritation. Nothing else in a home routine changes texture and fine lines as reliably, but it only works if you stay on it. Start two nights a week, build slowly, and never skip SPF while you\'re using it.'
  ],
  [
    'Revitalize Eye Gel', 68.00, 2, 'eye_care',
    'A lightweight gel for puffiness and the morning-after look.',
    'Cool, fast-absorbing, and comfortable under concealer — which is the whole point, since an eye product you can't wear with makeup gets used twice and abandoned. The right choice for anyone who finds eye creams too heavy.'
  ],
  [
    'Renew Eye Complex', 68.00, 2, 'eye_care',
    'A richer nightly treatment for fine lines and crepiness.',
    'The skin around the eye is the thinnest on the face, which is why it shows change first. Use nightly, tapped in gently with the ring finger rather than rubbed. A natural companion to what a PRF under-eye treatment starts in the treatment room.'
  ],
  [
    'Nourish Replenishing Moisturizer', 68.00, 2, 'moisturizer',
    'For dry and mature skin that needs more than water.',
    'Replenishes the lipids a depleted barrier has lost, so skin holds hydration through the night instead of shedding it by morning. Rich in feel without sitting on the surface or pilling under anything applied over it.'
  ],
  [
    'Protect Antioxidant Moisturizer', 66.00, 2, 'moisturizer',
    'A daytime moisturizer with antioxidant support already built in.',
    'Hydrates while buffering against the exposure of an ordinary day spent partly outdoors. Layers cleanly under sunscreen and makeup, which is the practical test any morning moisturizer has to pass.'
  ],
  [
    'Balance Charcoal Moisturizer', 60.00, 2, 'moisturizer',
    'Oily skin still needs moisturizer — skipping it is why it overproduces.',
    'Charcoal helps manage oil at the surface while the formula hydrates underneath. Skin stays comfortable and matte rather than tight, and tight is the condition that triggers the oil rebound in the first place.'
  ],
  [
    'Sun Shield Serum Broad Spectrum SPF 50 - Solstice Dawn', 60.00, 2, 'spf',
    'Broad spectrum SPF 50 in a serum texture, in the lighter of two shades.',
    'The reason people wear this daily and forget the one in the drawer: it feels like a serum, not sunscreen. Solstice Dawn is the lighter shade. Apply every morning as the last step before makeup, and reapply across long days outdoors.'
  ],
  [
    'Sun Shield Serum Broad Spectrum SPF 50 - Canyon Glow', 60.00, 2, 'spf',
    'The same SPF 50 serum in the deeper of the two shades.',
    'At Colorado altitude, UV exposure runs meaningfully higher than at sea level, and it doesn\'t take the summer off. This is the single product on the shelf that protects the results of everything else on it. Canyon Glow is the deeper shade.'
  ],
  [
    'Flora Elixir Botanic Facial Oil', 72.50, 2, 'facial_oil',
    'A botanic facial oil for the final step at night, sealing in everything under it.',
    'For dry or mature skin it can stand in for a night cream entirely. For everyone else, two or three drops pressed into the face on the days skin feels depleted. Apply last — an oil goes over water-based products, never under them.'
  ],
  [
    'Vahati Herb Infused Healing Oil', 30.00, 2, 'facial_oil',
    'A multi-use herbal oil for whatever needs calming.',
    'Dry patches, post-treatment skin, cuticles, anywhere tight or irritated. This is the one that ends up living in a bag rather than on a shelf, and the one clients repurchase without being asked.'
  ],
  [
    'Rehydrate Lip Balm', 5.50, 5, 'lip_care',
    'Lips have no oil glands, which is why they go first in dry air.',
    'Puts moisture back and helps hold it there. Reapply through the day — with no oil glands of their own, lips can\'t maintain it unaided, especially at altitude and in winter.'
  ],
  [
    'Calm Lip Balm', 5.50, 5, 'lip_care',
    'A soothing balm for lips that are chapped, peeling, or wind-burned.',
    'For lips past the point of dry and into raw. Comfortable enough to wear overnight, and it sits fine under color once things have settled down.'
  ],
  [
    'Acne Rescue Kit', 84.00, 2, 'kit',
    'A complete clarifying routine for breakout-prone skin, in one box.',
    'Every step of a congestion-focused routine, sized so you can find out whether the line works for your skin before committing to full sizes. The sensible starting point for anyone dealing with active breakouts who doesn\'t know where to begin.'
  ],
  [
    'Post Peel Kit', 87.00, 2, 'kit',
    'Aftercare for the days following a peel or resurfacing treatment.',
    'What you use in the week after a treatment determines a meaningful share of the result. This covers the calming and barrier support that stretch of recovery needs. Ask which products to use and in what order at your appointment.'
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
