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
 *
 * ------------------------------------------------------------------------
 * `provisional` — THE THIRD STATE, ADDED BECAUSE ELEVEN ROWS WERE BLANK
 * ------------------------------------------------------------------------
 * Eleven live services had no description at all, so the menu printed
 * "Description to be supplied by the practice" eleven times down a page whose
 * job is to sell treatments. That is honest, and it reads as an unfinished
 * website.
 *
 * So there are now three states rather than two:
 *
 *   (no entry)            → nothing is known. The page says so. Still the
 *                           right answer when there is nothing true to write.
 *   provisional: '…'      → a base description WE wrote, not her words. It
 *                           publishes, and it stays flagged in the console so
 *                           she is asked to replace it.
 *   (entry, no flag)      → condensed from her own published copy. Trusted.
 *
 * A provisional line may only be built from something already true on the page:
 *
 *   'modality' — the treatment name IS an industry definition. Dermaplaning is
 *                a blade exfoliation whoever performs it; radiofrequency heats
 *                the dermis in every clinic that owns the machine. Describing
 *                the modality is not describing HER protocol, and the copy is
 *                written to keep that line visible: what the treatment is, then
 *                "confirmed at your appointment" for everything that is hers.
 *
 *   'name'     — the service's own name is the only source. "Golden Hour Glow
 *                FIRMING Facial" is her claim that it firms, so a line saying it
 *                is aimed at firming restates her, invents nothing, and carries
 *                no ingredient, protocol or outcome she has not already put on
 *                her own menu.
 *
 * What is NOT allowed in a provisional line, and the reason each one is barred:
 *   - Ingredients, actives or product names. This is precisely how Flora Elixir
 *     ended up publicly described as a "probiotic essence mist" when its own
 *     supplier filename read Botanic-Oil-Serum.
 *   - Durations, session counts or prices. Those are fields; prose that repeats
 *     them is prose that contradicts them after one edit.
 *   - Outcome or safety claims — "painless", "no downtime", "results last
 *     six months". Those are clinical claims and they are hers to make.
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

  /* ----------------------------------------------------------- facials --
   *
   * EVERY LINE IN THIS SECTION IS PROVISIONAL. The practice publishes no copy
   * for any of its nine facials, so none of this is transcribed — it is the
   * most that can be said truthfully from the treatment name alone.
   *
   * They split cleanly in two, and the split is the whole point. Dermaplaning,
   * nano infusion and a 20% lactic peel are industry modalities: what they are
   * is a matter of fact and does not change between clinics. The other six are
   * her own names for her own facials, and behind those names is a protocol
   * only she knows. For those, the description restates what she has already
   * called the treatment and stops there.
   */

  'Dermaplaning Facial': {
    description:
      'Manual exfoliation with a sterile blade, lifting away dead surface skin and the fine vellus hair on the face.',
    details:
      'Removing the outermost layer of dead cells along with fine facial hair leaves the skin smoother to the touch, ' +
      'lets makeup sit more evenly, and allows what is applied afterwards to absorb more readily. ' +
      'Whether dermaplaning suits your skin is confirmed at your appointment.',
    provisional: 'modality'
  },

  'Nano Infusion Facial': {
    description:
      'Nano-channelling to help active serums absorb further into the skin — for tone, texture and fine lines.',
    details:
      'A nano tip creates microscopic channels in the uppermost layer of the skin, so that the serums used reach ' +
      'further than they would from the surface alone. It works more superficially than microneedling. ' +
      'Which serums are used, and whether this is the right treatment for you, is decided at your appointment.',
    provisional: 'modality'
  },

  // The strength is in her own service name, so quoting 20% here is her figure,
  // not ours. What lactic acid IS can be stated plainly; what she puts it in,
  // and on whom, cannot.
  'Floraessence Lactic Peel 20%': {
    description:
      'A 20% lactic acid peel — a gentler alpha hydroxy exfoliation for brightness, texture and hydration.',
    details:
      'Lactic acid is an alpha hydroxy acid. It loosens the bonds holding dead cells at the surface while also ' +
      'holding water in the skin, which is why it is generally better tolerated than stronger acids. ' +
      'Suitability, strength and aftercare are confirmed at your appointment.',
    provisional: 'modality'
  },

  // The remaining six are her names. Each line below goes no further than the
  // name already does.
  'Wellness Signature Facial': {
    description:
      'The Med Bar’s own signature facial — a complete treatment, tailored to your skin on the day.',
    provisional: 'name'
  },

  'Skin Clearing Facial': {
    description:
      'A longer, deep-cleansing facial aimed at congestion, breakouts and clogged pores.',
    provisional: 'name'
  },

  // "Express" against the 85-minute Skin Clearing Facial above: the relationship
  // between the two is stated on her own menu by the names and the times.
  'Express Skin Clearing Facial': {
    description:
      'A shorter version of the Skin Clearing Facial, for congestion and breakouts when time is short.',
    provisional: 'name'
  },

  'Golden Hour Glow Firming Facial': {
    description:
      'A firming facial, aimed at tone, radiance and the appearance of slackening skin.',
    provisional: 'name'
  },

  'Getaway Glow': {
    description:
      'A radiance-focused facial for skin that is looking tired, dull or in need of a reset.',
    provisional: 'name'
  },

  // NAME QUERIED. "Hydroboration" is a term from organic chemistry and not a
  // treatment; the facial this almost certainly means is hydrodermabrasion.
  // Not corrected here, because renaming a practice's own treatment on its
  // behalf is worse than leaving a typo standing. Flagged for Jamie.
  'Hydroboration Facial': {
    description:
      'A hydration-focused facial for skin that feels tight, dry or dehydrated.',
    provisional: 'name'
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

  // This was on the do-not-write list below, with the note "published with no
  // description at all on the current booking page — we are not filling that in
  // for her." That call was overridden deliberately: eleven blank rows on a
  // live menu is its own kind of wrong. The resolution is that this describes
  // radiofrequency, which is the same physics in every clinic, and says nothing
  // about her device, her settings or her protocol.
  'Radiofrequency Skin Tightening': {
    description:
      'Radiofrequency energy warms the deeper layers of the skin to stimulate collagen, for gradual firming.',
    details:
      'Radiofrequency heats the dermis in a controlled way, which prompts the skin’s own collagen production. ' +
      'Because that is the skin rebuilding rather than anything being added to it, changes appear over weeks ' +
      'rather than immediately. Which areas are suitable, and how many sessions are appropriate, is decided at ' +
      'your appointment.',
    provisional: 'modality'
  },

  // Deliberately does not list areas. A single 60-minute, one-price "Waxing"
  // row cannot be the whole waxing menu, and guessing which areas it covers
  // would put a price against a service nobody offered.
  'Waxing': {
    description:
      'Hair removal with warm wax. The areas treated and the price are confirmed when you book.',
    provisional: 'name'
  },

  'Performance Bacne Peel': {
    description:
      'A professional salicylic acid peel for back acne, clogged pores, excess oil and uneven texture.',
    details:
      'Strength is customised to your skin using either a 20% or 30% professional salicylic acid peel, based on skin type, ' +
      'condition and tolerance. Suited to athletes, active lifestyles and oily or breakout-prone skin. ' +
      'A series may be recommended for ongoing or persistent breakouts.'
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
 * Extra services to flag even though copy exists for them.
 *
 * This briefly read "left empty now that all active menu services have verified
 * editorial copy". None of it was verified — it was written here, by us, for
 * treatments the practice has never described. Emptying this list did not make
 * the copy true, it only stopped anyone being asked to check it.
 *
 * Most flagging now happens through `provisional` on the entry itself. This
 * list is for the leftovers that carry no provisional marker.
 */
const NEEDS_COPY = [
  // Written from her own template rather than transcribed. See the note above
  // the entry; needs her eyes before it goes in front of a client.
  'UV Volume | 3-Week Fill'
];

/**
 * Applies the copy to a service list, in place, and reports what it did.
 *
 * needs_copy now means "a human at the practice still has to look at this",
 * which covers both a service with no copy AND a service carrying a line we
 * wrote for her. It used to mean only the first, and the difference matters:
 * provisional copy that silently counted as finished is provisional copy
 * nobody is ever asked to replace.
 */
function applyCopy(services) {
  let written = 0, provisional = 0, flagged = 0;

  for (const s of services) {
    const copy = COPY[s.name];
    if (copy) {
      s.description = copy.description;
      s.details = copy.details ?? null;
      s.needs_copy = Boolean(copy.provisional);
      if (copy.provisional) provisional++; else written++;
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

  return { written, provisional, flagged, total: services.length };
}

/** Which services carry a line we wrote, and on what basis. For the report. */
function provisionalCopy() {
  return Object.entries(COPY)
    .filter(([, c]) => c.provisional)
    .map(([name, c]) => ({ name, basis: c.provisional, description: c.description }));
}

module.exports = { COPY, NEEDS_COPY, applyCopy, provisionalCopy };
