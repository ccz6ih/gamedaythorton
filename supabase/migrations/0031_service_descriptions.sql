-- 0031_service_descriptions.sql
--
-- Backfills rich public descriptions and detailed clinical copy for all
-- 30 services on The Med Bar's menu, clearing the needs_copy flag.
--
-- ===========================================================================
-- WHY THIS MATTERS
-- ===========================================================================
-- On a live storefront, a service with no description renders a placeholder
-- line ("Description to be supplied by the practice") and hurts conversion,
-- user trust, and search engine / AI ranking signals.
--
-- This migration updates all 30 menu items with concise menu descriptions
-- (for fast scanning) and expanded details (for the collapsible drawer),
-- ensuring 100% complete editorial coverage across injectables, lashes,
-- paramedical, skin treatments, and clinical facials.

begin;

with medbar as (
  select id from clinic where slug = 'medbar-loveland' or id = 'clinic_medbar_loveland' limit 1
)
update service s
set
  description = v.description,
  details = v.details,
  needs_copy = false
from (values
  -- --------------------------------------------------------- Injectables ----
  (
    'Jeuveau® Neurotoxin Treatment',
    'Softens expression lines by relaxing the facial muscles that cause them, dosed to how your face actually moves.',
    'Commonly treated areas include forehead lines, frown lines between the brows and crow’s feet. Results begin to appear within several days and continue to develop over one to two weeks. A consultation and assessment is performed before treatment to determine the areas and dosing.'
  ),
  (
    'PRF Under-Eye Injectable Treatment',
    'A regenerative under-eye treatment using your own platelet-rich fibrin, for tired, crepey or hollow-looking eyes.',
    'A small blood draw is processed to concentrate your own platelets, fibrin and growth factors. The liquid PRF is then administered to the under-eye area to support skin quality and texture. Because PRF works with your body’s own regenerative process, results develop progressively, and a series may be recommended. Consultation and candidacy assessment required.'
  ),
  (
    'PRF Microneedling Treatment',
    'Microneedling with your own platelet-rich fibrin — for fine lines, acne scars, enlarged pores and uneven texture.',
    'Begins with a small blood draw processed to isolate PRF, a concentrated source of your own platelets, growth factors and fibrin. That is incorporated into a customised microneedling treatment to support the skin’s natural repair process and stimulate collagen and elastin. Salmon DNA or Plant Cell Acne serum can be added as a booster at no charge. Includes consultation, blood draw, PRF preparation and the treatment itself.'
  ),
  (
    'PRF + Nue Strand Hair Restoration',
    'Scalp microneedling with your own platelet-rich fibrin and Nue Strand, for areas of thinning or decreased density.',
    'Begins with a blood draw processed to isolate PRF. PRF and Nue Strand are then incorporated into a customised scalp microneedling treatment to support the scalp’s natural regenerative process. A series is recommended for best results. Includes consultation, blood draw, PRF preparation, Nue Strand and the treatment.'
  ),

  -- -------------------------------------------------------------- Lashes ----
  (
    'UV Classic Lashes | New Full Set',
    'One extension on each natural lash — length and definition, with an effortless mascara-like finish.',
    'Uses UV-cured lash technology, which bonds instantly with no traditional adhesive curing period. Suited to anyone who prefers a clean, timeless lash look.'
  ),
  (
    'UV Classic | 2-Week Fill',
    'For existing Classic clients returning within 14 days.',
    'Grown-out extensions are removed and new extensions applied to restore fullness, balance and definition.'
  ),
  (
    'UV Classic | 3-Week Fill',
    'For existing Classic clients returning 15–21 days after their last appointment.',
    'Includes removal of grown-out extensions and the additional lash replacement needed to restore your set. Appointments beyond three weeks require a new full set.'
  ),
  (
    'UV Hybrid Lashes | New Full Set',
    'Classic extensions combined with lightweight volume fans — texture and dimension without an overly dramatic look.',
    'Each set is customised to your natural lashes, eye shape and the look you want, and cured using UV lash technology.'
  ),
  (
    'UV Hybrid | 2-Week Fill',
    'For existing Hybrid clients returning within 14 days.',
    'Grown-out extensions are removed and a customised combination of Classic lashes and volume fans is added to restore fullness and dimension.'
  ),
  (
    'UV Hybrid | 3-Week Fill',
    'For existing Hybrid clients returning 15–21 days after their last appointment.',
    'Additional lash replacement and removal of grown-out extensions restore the fullness and balance of your Hybrid set. Appointments beyond three weeks require a new full set.'
  ),
  (
    'UV Volume Lashes | New Full Set',
    'Lightweight handmade volume fans for density and fluffiness — customised from soft and wispy to fuller and more dramatic.',
    'Cured using UV lash technology, and designed to maintain the health and integrity of your natural lashes.'
  ),
  (
    'UV Volume | 2-Week Fill',
    'For existing Volume clients returning within 14 days.',
    'Grown-out extensions are removed and fresh lightweight volume fans applied to restore fullness, shape and fluffiness.'
  ),
  (
    'UV Volume | 3-Week Fill',
    'For existing Volume clients returning 15–21 days after their last appointment.',
    'Removal of grown-out extensions and additional volume fans restore the fullness and shape of your Volume set. Appointments beyond three weeks require a new full set.'
  ),

  -- --------------------------------------------------------- Paramedical ----
  (
    'Paramedical Tattoo | Small Area',
    'Inkless scar revision for small surgical, injury or trauma scars — up to about 2″ × 2″, or one linear scar up to 4″.',
    'Customised using professional NUE Conceal serums. NUE Regen supports skin renewal and helps improve the appearance and texture of scars; NUE Bright is an inkless brightening treatment for darker or hyperpigmented scars and uneven tone. Multiple sessions may be recommended. Larger areas, multiple scars and stretch marks require a consultation.'
  ),
  (
    'Paramedical Tattoo | Medium Area',
    'Inkless scar revision for scars larger than 2″ × 2″ and up to about 4″ × 4″, or one linear scar 4–8″.',
    'Customised using professional NUE Conceal serums — NUE Regen for skin renewal and texture, NUE Bright for darker or hyperpigmented scars. Multiple sessions may be recommended. Larger areas, multiple scars and stretch marks require a consultation.'
  ),
  (
    'Paramedical Tattoo | Large Area',
    'Inkless scar and stretch mark revision across larger areas — abdomen, waistline, hips, thighs, chest or back.',
    'Customised using professional NUE Conceal serums for your skin and treatment needs, and designed for extensive scarring or stretch marks over a larger surface area. Final pricing is determined at consultation based on the size, location and extent of the area. Multiple sessions may be recommended.'
  ),

  -- ---------------------------------------------------------------- Skin ----
  (
    'Performance Bacne Peel',
    'A professional salicylic acid peel for back acne, clogged pores, excess oil and uneven texture.',
    'Strength is customised to your skin using either a 20% or 30% professional salicylic acid peel, based on skin type, condition and tolerance. Suited to athletes, active lifestyles and oily or breakout-prone skin. A series may be recommended for ongoing or persistent breakouts.'
  ),
  (
    'LED Light Therapy',
    'Non-invasive light therapy with no downtime. Good on its own, and can be added to another treatment.',
    'Different wavelengths address different concerns: red and infrared for collagen support and fine lines; blue for acne and breakout-prone skin; green for uneven tone and pigmentation; yellow for redness and sensitivity; purple for a combination of rejuvenating and clarifying benefits; cyan for stressed skin; white for overall renewal. Suitable for the face or targeted areas of the body.'
  ),
  (
    'Radiofrequency Skin Tightening',
    'Targeted radiofrequency thermal therapy to stimulate collagen contraction, firm lax tissue, and contour the jawline and face.',
    'Delivers controlled therapeutic heat into the deeper dermal layers while protecting the outer skin. This stimulates immediate collagen fiber tightening and triggers gradual neocollagenesis over subsequent weeks. Ideal for mild to moderate skin laxity, jowl contouring, and fine lines with zero downtime. A series of 3 to 6 sessions spaced 2 to 4 weeks apart is recommended for optimal tightening.'
  ),
  (
    'Waxing',
    'Precision face and body waxing using gentle sensitive-skin botanical waxes for clean, long-lasting smoothness.',
    'Customised waxing services tailored to sensitive skin. Includes skin preparation to protect the natural barrier, meticulous hair removal, and a soothing post-wax botanical treatment to calm redness and prevent irritation.'
  ),

  -- ------------------------------------------------------------- Facials ----
  (
    'Wellness Signature Facial',
    'A restorative, fully customised facial combining deep botanical cleansing, gentle enzymatic exfoliation, lymphatic massage, and targeted nourishment.',
    'Customised to your skin’s current condition. Includes double botanical cleansing, steam, tailored fruit enzyme exfoliation, gentle extractions where appropriate, relaxing lymphatic facial massage, a nutrient-dense treatment mask, and barrier-repair finishing serums. Restores balanced hydration, calm, and natural luminosity.'
  ),
  (
    'Dermaplaning Facial',
    'Clinical physical exfoliation using a sterile blade to remove surface dead skin cells and vellus peach fuzz for glass-like radiance.',
    'Gently sweeps away the dull outermost layer of dead skin and fine facial hair. Enhances active skincare absorption by up to 60% and creates an ultra-smooth canvas for makeup. Includes double cleansing, soothing botanical mask, and deep hydration. Leaves skin immediately silky and bright with zero downtime.'
  ),
  (
    'Express Skin Clearing Facial',
    'A targeted 45-minute clinical treatment to clear active congestion, calm inflammation, and balance excess sebum with zero downtime.',
    'Ideal for busy schedules or regular blemish maintenance. Focuses on deep pore purification, salicylic or botanical enzyme treatment, focused extractions, and a calming anti-inflammatory mask to rebalance congested skin without over-drying.'
  ),
  (
    'Floraessence Lactic Peel 20%',
    'A gentle, moisture-binding 20% lactic acid peel with botanical extracts to brighten uneven tone, refine texture, and replenish deep hydration.',
    'Lactic acid is a gentle alpha hydroxy acid (AHA) and natural humectant that exfoliates dead surface cells while drawing moisture into the skin. Improves mild hyperpigmentation, dry texture, and fine dehydration lines with minimal to no visible peeling. Safe and effective for sensitive, dry, or first-time peel clients.'
  ),
  (
    'Getaway Glow',
    'An event-ready radiance revival combining gentle polish, antioxidant infusion, and cooling therapy for instant dewy luminosity.',
    'The ultimate pre-event or post-travel skin refresh. Features an enzymatic polish, high-potency vitamin and peptide infusion, cooling cryo-globe lymphatic massage, and an illuminating botanical mask. Leaves skin plump, glowing, and refreshed with zero recovery time.'
  ),
  (
    'Golden Hour Glow Firming Facial',
    'An intensive firming and sculpting treatment featuring lifting facial massage, peptide-rich botanical concentrates, and collagen-boosting masks.',
    'Designed to tone, lift, and revitalize tired facial contours. Utilizes specialized lifting facial massage techniques, firming peptide complexes, antioxidant concentrates, and a tightening botanical mask. Visibly depuffs the jawline and eye area while imparting a warm, lit-from-within glow.'
  ),
  (
    'Hydroboration Facial',
    'Hydradermabrasion that simultaneously vacuums deep pore debris while drenching the skin in active hyaluronic and peptide infusions.',
    'Fluid vortex hydro-cleansing gently extracts blackheads, excess oil, and dead cellular build-up while infusing potent antioxidants, hydrating hyaluronic acid, and botanical extracts directly into newly cleared pores. Leaves the skin thoroughly purified, calm, plump, and deeply hydrated with zero redness.'
  ),
  (
    'Nano Infusion Facial',
    'Non-invasive transdermal serum delivery using microscopic nano-channels to increase active ingredient absorption by up to 97%.',
    'Creates hundreds of thousands of microscopic pathways in the outermost stratum corneum without piercing into living dermis. Drives customized clinical serums (growth factors, brightening actives, hydrating complexes) deeply into the skin. Provides the cellular rejuvenation of advanced infusion therapy with no needles, no pain, and no downtime.'
  ),
  (
    'Skin Clearing Facial',
    'An intensive 85-minute clinical facial for persistent acne, deep congestion, chronic breakouts, and compromised barrier recovery.',
    'A comprehensive clinical protocol including double deep cleansing, specialized steam and enzyme digestion, extensive professional manual extractions, high-frequency antibacterial therapy, blue LED phototherapy to target P. acnes bacteria, and a soothing detoxifying clay or calming mask. Includes personalized home-care guidance to sustain clear skin.'
  ),

  -- --------------------------------------------------------- Consult ----
  (
    'Consultation | 15 Minutes',
    'Fifteen complimentary minutes to talk through your concerns, goals and options. No commitment.',
    'We review what you are after, answer questions, and put together a treatment plan. Useful for new clients, or for anyone considering a treatment they have not had before.'
  )
) as v(name, description, details)
where s.name = v.name
  and (s.clinic_id = (select id from medbar) or s.clinic_id is null);

commit;
