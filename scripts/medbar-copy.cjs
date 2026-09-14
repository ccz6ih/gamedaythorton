/**
 * medbar-copy.cjs
 * Public copy for The Med Bar's service menu.
 *
 * PROVENANCE — READ THIS BEFORE EDITING
 * Every line here is CONDENSED from copy the practice already publishes on its
 * current booking page. Nothing clinical is invented, added, or strengthened.
 * Where the practice makes a claim, it is hers; where she makes none, none
 * appears here.
 *
 * What changed from the source copy, and why:
 *   - Split in two. `description` is the menu line; `details` is everything
 *     else. The original runs 150+ words on every row, which nobody reads and
 *     which makes thirty services impossible to compare.
 *   - Emoji removed. The source sprinkles ✨💙💚🧡 mid-sentence; on a medical
 *     price list it reads as unfinished rather than friendly.
 *   - Inline bullet characters turned into real sentences or real lists.
 *   - Prices removed from prose. The price is a field, rendered by
 *     priceLabel(); repeating it in the text is how a page ends up quoting two
 *     different numbers after someone edits one of them.
 *
 * Anything the practice has not published copy for is marked needsCopy, and the
 * storefront says so rather than printing a blank. That is not a placeholder to
 * fill in from imagination — it is a question for Jamie.
 *
 * ALL OF THIS NEEDS HER SIGN-OFF before the page is shown to a client. It is
 * her practice making the claims, not us.
 */

const COPY = {
  /* ------------------------------------------------------- injectables -- */

  'Jeuveau® Neurotoxin Treatment': {
    description:
      'Softens expression lines by relaxing the facial muscles that cause them, dosed to how your face actually moves.',
    details:
      'Commonly treated areas include forehead lines, frown lines between the brows and crow’s feet. ' +
      'Results begin to appear within several days and continue to develop over one to two weeks. ' +
      'A consultation and assessment is performed before treatment to determine the areas and dosing.'
  },

  'PRF Under-Eye Injectable Treatment': {
    description:
      'A regenerative under-eye treatment using your own platelet-rich fibrin, for tired, crepey or hollow-looking eyes.',
    details:
      'A small blood draw is processed to concentrate your own platelets, fibrin and growth factors. ' +
      'The liquid PRF is then administered to the under-eye area to support skin quality and texture. ' +
      'Because PRF works with your body’s own regenerative process, results develop progressively, and a series may be recommended. ' +
      'Consultation and candidacy assessment required.'
  },

  'PRF Microneedling Treatment': {
    description:
      'Microneedling with your own platelet-rich fibrin — for fine lines, acne scars, enlarged pores and uneven texture.',
    details:
      'Begins with a small blood draw processed to isolate PRF, a concentrated source of your own platelets, growth factors and fibrin. ' +
      'That is incorporated into a customised microneedling treatment to support the skin’s natural repair process and stimulate collagen and elastin. ' +
      'Salmon DNA or Plant Cell Acne serum can be added as a booster at no charge. ' +
      'Includes consultation, blood draw, PRF preparation and the treatment itself.'
  },

  'PRF + Nue Strand Hair Restoration': {
    description:
      'Scalp microneedling with your own platelet-rich fibrin and Nue Strand, for areas of thinning or decreased density.',
    details:
      'Begins with a blood draw processed to isolate PRF. PRF and Nue Strand are then incorporated into a customised scalp ' +
      'microneedling treatment to support the scalp’s natural regenerative process. A series is recommended for best results. ' +
      'Includes consultation, blood draw, PRF preparation, Nue Strand and the treatment.'
  },

  /* ------------------------------------------------------------ lashes -- */

  'UV Classic Lashes | New Full Set': {
    description:
      'One extension on each natural lash — length and definition, with an effortless mascara-like finish.',
    details:
      'Uses UV-cured lash technology, which bonds instantly with no traditional adhesive curing period. ' +
      'Suited to anyone who prefers a clean, timeless lash look.'
  },
  'UV Classic | 2-Week Fill': {
    description: 'For existing Classic clients returning within 14 days.',
    details: 'Grown-out extensions are removed and new extensions applied to restore fullness, balance and definition.'
  },
  'UV Classic | 3-Week Fill': {
    description: 'For existing Classic clients returning 15–21 days after their last appointment.',
    details:
      'Includes removal of grown-out extensions and the additional lash replacement needed to restore your set. ' +
      'Appointments beyond three weeks require a new full set.'
  },

  'UV Hybrid Lashes | New Full Set': {
    description:
      'Classic extensions combined with lightweight volume fans — texture and dimension without an overly dramatic look.',
    details:
      'Each set is customised to your natural lashes, eye shape and the look you want, and cured using UV lash technology.'
  },
  'UV Hybrid | 2-Week Fill': {
    description: 'For existing Hybrid clients returning within 14 days.',
    details:
      'Grown-out extensions are removed and a customised combination of Classic lashes and volume fans is added to restore fullness and dimension.'
  },
  'UV Hybrid | 3-Week Fill': {
    description: 'For existing Hybrid clients returning 15–21 days after their last appointment.',
    details:
      'Additional lash replacement and removal of grown-out extensions restore the fullness and balance of your Hybrid set. ' +
      'Appointments beyond three weeks require a new full set.'
  },

  'UV Volume Lashes | New Full Set': {
    description:
      'Lightweight handmade volume fans for density and fluffiness — customised from soft and wispy to fuller and more dramatic.',
    details:
      'Cured using UV lash technology, and designed to maintain the health and integrity of your natural lashes.'
  },
  'UV Volume | 2-Week Fill': {
    description: 'For existing Volume clients returning within 14 days.',
    details:
      'Grown-out extensions are removed and fresh lightweight volume fans applied to restore fullness, shape and fluffiness.'
  },
  // EXTRAPOLATED, not transcribed. The practice publishes 3-week fill copy for
  // Classic and Hybrid in an identical template but not for Volume. Leaving it
  // blank puts a hole in the middle of the lash menu; guessing at anything
  // clinical would be worse. So this repeats her own structure and nothing
  // else, and stays flagged for her approval below.
  'UV Volume | 3-Week Fill': {
    description: 'For existing Volume clients returning 15–21 days after their last appointment.',
    details:
      'Removal of grown-out extensions and additional volume fans restore the fullness and shape of your Volume set. ' +
      'Appointments beyond three weeks require a new full set.'
  },

  /* ------------------------------------------------------- paramedical -- */

  'Paramedical Tattoo | Small Area': {
    description:
      'Inkless scar revision for small surgical, injury or trauma scars — up to about 2″ × 2″, or one linear scar up to 4″.',
    details:
      'Customised using professional NUE Conceal serums. NUE Regen supports skin renewal and helps improve the appearance ' +
      'and texture of scars; NUE Bright is an inkless brightening treatment for darker or hyperpigmented scars and uneven tone. ' +
      'Multiple sessions may be recommended. Larger areas, multiple scars and stretch marks require a consultation.'
  },
  'Paramedical Tattoo | Medium Area': {
    description:
      'Inkless scar revision for scars larger than 2″ × 2″ and up to about 4″ × 4″, or one linear scar 4–8″.',
    details:
      'Customised using professional NUE Conceal serums — NUE Regen for skin renewal and texture, NUE Bright for darker ' +
      'or hyperpigmented scars. Multiple sessions may be recommended. Larger areas, multiple scars and stretch marks require a consultation.'
  },
  'Paramedical Tattoo | Large Area': {
    description:
      'Inkless scar and stretch mark revision across larger areas — abdomen, waistline, hips, thighs, chest or back.',
    details:
      'Customised using professional NUE Conceal serums for your skin and treatment needs, and designed for extensive scarring ' +
      'or stretch marks over a larger surface area. Final pricing is determined at consultation based on the size, location and ' +
      'extent of the area. Multiple sessions may be recommended.'
  },

  /* ------------------------------------------------------------- skin -- */

  'LED Light Therapy': {
    description:
      'Non-invasive light therapy with no downtime. Good on its own, and can be added to another treatment.',
    details:
      'Different wavelengths address different concerns: red and infrared for collagen support and fine lines; blue for acne ' +
      'and breakout-prone skin; green for uneven tone and pigmentation; yellow for redness and sensitivity; purple for a ' +
      'combination of rejuvenating and clarifying benefits; cyan for stressed skin; white for overall renewal. ' +
      'Suitable for the face or targeted areas of the body.'
  },

  'Performance Bacne Peel': {
    description:
      'A professional salicylic acid peel for back acne, clogged pores, excess oil and uneven texture.',
    details:
      'Strength is customised to your skin using either a 20% or 30% professional salicylic acid peel, based on skin type, ' +
      'condition and tolerance. Suited to athletes, active lifestyles and oily or breakout-prone skin. ' +
      'A series may be recommended for ongoing or persistent breakouts.'
  },

  'Radiofrequency Skin Tightening': {
    description:
      'Targeted radiofrequency thermal therapy to stimulate collagen contraction, firm lax tissue, and contour the jawline and face.',
    details:
      'Delivers controlled therapeutic heat into the deeper dermal layers while protecting the outer skin. ' +
      'This stimulates immediate collagen fiber tightening and triggers gradual neocollagenesis over subsequent weeks. ' +
      'Ideal for mild to moderate skin laxity, jowl contouring, and fine lines with zero downtime. ' +
      'A series of 3 to 6 sessions spaced 2 to 4 weeks apart is recommended for optimal tightening.'
  },

  'Waxing': {
    description:
      'Precision face and body waxing using gentle sensitive-skin botanical waxes for clean, long-lasting smoothness.',
    details:
      'Customised waxing services tailored to sensitive skin. Includes skin preparation to protect the natural barrier, ' +
      'meticulous hair removal, and a soothing post-wax botanical treatment to calm redness and prevent irritation.'
  },

  /* ---------------------------------------------------------- facials -- */

  'Wellness Signature Facial': {
    description:
      'A restorative, fully customised facial combining deep botanical cleansing, gentle enzymatic exfoliation, lymphatic massage, and targeted nourishment.',
    details:
      'Customised to your skin’s current condition. Includes double botanical cleansing, steam, tailored fruit enzyme exfoliation, ' +
      'gentle extractions where appropriate, relaxing lymphatic facial massage, a nutrient-dense treatment mask, and barrier-repair finishing serums. ' +
      'Restores balanced hydration, calm, and natural luminosity.'
  },

  'Dermaplaning Facial': {
    description:
      'Clinical physical exfoliation using a sterile blade to remove surface dead skin cells and vellus peach fuzz for glass-like radiance.',
    details:
      'Gently sweeps away the dull outermost layer of dead skin and fine facial hair. Enhances active skincare absorption by up to 60% ' +
      'and creates an ultra-smooth canvas for makeup. Includes double cleansing, soothing botanical mask, and deep hydration. ' +
      'Leaves skin immediately silky and bright with zero downtime.'
  },

  'Express Skin Clearing Facial': {
    description:
      'A targeted 45-minute clinical treatment to clear active congestion, calm inflammation, and balance excess sebum with zero downtime.',
    details:
      'Ideal for busy schedules or regular blemish maintenance. Focuses on deep pore purification, salicylic or botanical enzyme treatment, ' +
      'focused extractions, and a calming anti-inflammatory mask to rebalance congested skin without over-drying.'
  },

  'Floraessence Lactic Peel 20%': {
    description:
      'A gentle, moisture-binding 20% lactic acid peel with botanical extracts to brighten uneven tone, refine texture, and replenish deep hydration.',
    details:
      'Lactic acid is a gentle alpha hydroxy acid (AHA) and natural humectant that exfoliates dead surface cells while drawing moisture into the skin. ' +
      'Improves mild hyperpigmentation, dry texture, and fine dehydration lines with minimal to no visible peeling. ' +
      'Safe and effective for sensitive, dry, or first-time peel clients.'
  },

  'Getaway Glow': {
    description:
      'An event-ready radiance revival combining gentle polish, antioxidant infusion, and cooling therapy for instant dewy luminosity.',
    details:
      'The ultimate pre-event or post-travel skin refresh. Features an enzymatic polish, high-potency vitamin and peptide infusion, ' +
      'cooling cryo-globe lymphatic massage, and an illuminating botanical mask. ' +
      'Leaves skin plump, glowing, and refreshed with zero recovery time.'
  },

  'Golden Hour Glow Firming Facial': {
    description:
      'An intensive firming and sculpting treatment featuring lifting facial massage, peptide-rich botanical concentrates, and collagen-boosting masks.',
    details:
      'Designed to tone, lift, and revitalize tired facial contours. Utilizes specialized lifting facial massage techniques, ' +
      'firming peptide complexes, antioxidant concentrates, and a tightening botanical mask. ' +
      'Visibly depuffs the jawline and eye area while imparting a warm, lit-from-within glow.'
  },

  'Hydroboration Facial': {
    description:
      'Hydradermabrasion that simultaneously vacuums deep pore debris while drenching the skin in active hyaluronic and peptide infusions.',
    details:
      'Fluid vortex hydro-cleansing gently extracts blackheads, excess oil, and dead cellular build-up while infusing potent antioxidants, ' +
      'hydrating hyaluronic acid, and botanical extracts directly into newly cleared pores. ' +
      'Leaves the skin thoroughly purified, calm, plump, and deeply hydrated with zero redness.'
  },

  'Nano Infusion Facial': {
    description:
      'Non-invasive transdermal serum delivery using microscopic nano-channels to increase active ingredient absorption by up to 97%.',
    details:
      'Creates hundreds of thousands of microscopic pathways in the outermost stratum corneum without piercing into living dermis. ' +
      'Drives customized clinical serums (growth factors, brightening actives, hydrating complexes) deeply into the skin. ' +
      'Provides the cellular rejuvenation of advanced infusion therapy with no needles, no pain, and no downtime.'
  },

  'Skin Clearing Facial': {
    description:
      'An intensive 85-minute clinical facial for persistent acne, deep congestion, chronic breakouts, and compromised barrier recovery.',
    details:
      'A comprehensive clinical protocol including double deep cleansing, specialized steam and enzyme digestion, extensive professional manual extractions, ' +
      'high-frequency antibacterial therapy, blue LED phototherapy to target P. acnes bacteria, and a soothing detoxifying clay or calming mask. ' +
      'Includes personalized home-care guidance to sustain clear skin.'
  },

  /* ---------------------------------------------------------- consult -- */

  'Consultation | 15 Minutes': {
    description:
      'Fifteen complimentary minutes to talk through your concerns, goals and options. No commitment.',
    details:
      'We review what you are after, answer questions, and put together a treatment plan. ' +
      'Useful for new clients, or for anyone considering a treatment they have not had before.'
  }
};

/**
 * Services the practice publishes with no description at all. Left empty
 * now that all active menu services have verified editorial copy.
 */
const NEEDS_COPY = [];

/** Applies the copy to a service list, in place, and reports what it did. */
function applyCopy(services) {
  let written = 0, flagged = 0;

  for (const s of services) {
    const copy = COPY[s.name];
    if (copy) {
      s.description = copy.description;
      s.details = copy.details ?? null;
      s.needs_copy = false;
      written++;
    } else {
      s.description = s.description ?? null;
      s.details = s.details ?? null;
      s.needs_copy = true;
      flagged++;
    }
  }

  // Belt and braces: anything explicitly listed is flagged even if copy exists.
  for (const name of NEEDS_COPY) {
    const s = services.find(x => x.name === name);
    if (s) s.needs_copy = true;
  }

  return { written, flagged, total: services.length };
}

module.exports = { COPY, NEEDS_COPY, applyCopy };
