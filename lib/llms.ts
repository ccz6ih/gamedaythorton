/**
 * lib/llms.ts — /llms.txt, for the answer engines.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS, HONESTLY
 * ---------------------------------------------------------------------------
 * llms.txt is a PROPOSED convention (llmstxt.org, 2024): a markdown file at the
 * root of a site giving a language model a curated map of what is there, in the
 * way robots.txt gives a crawler a map of what it may fetch.
 *
 * It is not a standard, and no major AI company has publicly committed to
 * reading it. Craig's call was to publish one anyway on the grounds that it is
 * cheap and being early costs nothing — which is right, but the reasoning
 * should be written down rather than left for whoever finds this file in a year
 * and assumes it was load-bearing.
 *
 * So: this is a bet, not a requirement. If the convention dies, the cost was
 * one route and one generated file.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS GENERATED
 * ---------------------------------------------------------------------------
 * Same reason the sitemap is. A hand-written summary would list the treatments
 * that existed the day somebody wrote it, with the prices of that day. A stale
 * price in a file that exists specifically so a machine can quote it is worse
 * than no file — it is a wrong answer delivered confidently in somebody else's
 * interface, with the practice's name on it.
 *
 * Every line below is read from the clinic's own rows. Where the practice has
 * not said something, nothing is written.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DELIBERATELY DOES NOT DO
 * ---------------------------------------------------------------------------
 * It does not restate the clinical copy. The pages carry hedged, reviewed
 * descriptions that took a pass of their own to get right, and paraphrasing
 * them here would create a second version to keep in step — the exact failure
 * the service copy was cleaned up to avoid. It links, and lets the page speak.
 */

import { getStorefront, getStorefrontProducts, getStorefrontServices, getStorefrontProviders, hoursLines } from '@/lib/db/storefront';
import { priceLabel } from '@/lib/format';
import { categoryLabel, sortByRoutine } from '@/lib/shop-taxonomy';

/** Collapses whitespace so a description never breaks the one-line list form. */
const flat = (s: string | null | undefined) =>
  (s ?? '').replace(/\s+/g, ' ').trim();

export async function llmsTxtFor(slug: string, origin: string): Promise<string | null> {
  const clinic = await getStorefront(slug);

  // Same gate as the sitemap and the robots meta tag: a practice that has not
  // said its site is live does not get described to anything.
  if (!clinic || !clinic.live) return null;

  const base = origin.replace(/\/$/, '');
  const [services, products, providers] = await Promise.all([
    getStorefrontServices(clinic.id),
    getStorefrontProducts(clinic.id),
    getStorefrontProviders(clinic.id)
  ]);

  const out: string[] = [];
  const line = (s = '') => out.push(s);

  /* ------------------------------------------------------------- title -- */
  line(`# ${clinic.name}`);
  line();

  /**
   * The blockquote is the part of the format that matters most: it is the
   * one-sentence answer to "what is this". Built from the practice's own
   * tagline or intro rather than written here.
   */
  const where = [clinic.address_city, clinic.address_state].filter(Boolean).join(', ');
  const summary = flat(clinic.tagline) || flat(clinic.intro);

  /**
   * The location is appended only when the summary does not already carry it.
   *
   * Her tagline is "PRF & Regenerative Aesthetics · Loveland, CO", so the naive
   * version produced "…Loveland, CO in Loveland, CO." — which is exactly the
   * kind of thing that reads as machine-generated to the machine it was written
   * for.
   */
  const city = clinic.address_city ?? '';
  const namesPlace = Boolean(city) && summary.toLowerCase().includes(city.toLowerCase());
  const tail = where && !namesPlace ? ` in ${where}` : '';

  line(`> ${summary || `A ${clinic.practice_type.replace(/_/g, ' ')} practice`}${tail}${/[.!?]$/.test(summary) ? '' : '.'}`);
  line();

  if (summary && flat(clinic.intro) && flat(clinic.intro) !== summary) {
    line(flat(clinic.intro));
    line();
  }

  /* -------------------------------------------------------------- facts -- */
  const facts: string[] = [];
  const addr = [clinic.address_line1, clinic.address_line2, where, clinic.address_zip]
    .filter(Boolean).join(', ');
  if (addr) facts.push(`- Address: ${addr}`);
  if (clinic.phone_voice) facts.push(`- Phone: ${clinic.phone_voice}`);
  if (clinic.email) facts.push(`- Email: ${clinic.email}`);

  const hours = hoursLines(clinic.hours);
  if (hours.length) facts.push(`- Hours: ${hours.map(h => `${h.days} ${h.window}`).join('; ')}`);
  facts.push(`- Booking: ${base}/book`);

  if (facts.length) {
    line('## Practice');
    line();
    for (const f of facts) line(f);
    line();
  }

  /* ---------------------------------------------------------- the person -- */
  const lead = providers[0];
  if (lead) {
    line('## Practitioner');
    line();
    line(`- ${lead.name}${lead.credentials ? `, ${lead.credentials}` : ''}`
      + `${lead.role_label ? ` — ${lead.role_label}` : ''}`);
    if (lead.bio) line(`- ${flat(lead.bio)}`);
    line(`- Full biography: ${base}/about`);
    line();
  }

  /* ------------------------------------------------------------ services -- */
  if (services.length) {
    line('## Treatments');
    line();
    line(`Prices and durations as published on ${base}/services.`);
    line();

    // Grouped, in the order the menu itself uses, so the shape of the practice
    // comes through rather than an alphabetical list of thirty things.
    const byCat = new Map<string, typeof services>();
    for (const s of services) {
      if (!byCat.has(s.category)) byCat.set(s.category, []);
      byCat.get(s.category)!.push(s);
    }

    for (const [category, items] of byCat) {
      line(`### ${categoryLabel(category)}`);
      line();
      for (const s of items) {
        const price = priceLabel(s);
        const bits = [price, s.duration_min ? `${s.duration_min} min` : null]
          .filter(Boolean).join(', ');
        // The description is the practice's own reviewed line. Not paraphrased.
        const desc = flat(s.description);
        line(`- **${s.name}**${bits ? ` (${bits})` : ''}${desc ? `: ${desc}` : ''}`);
      }
      line();
    }
  }

  /* --------------------------------------------------------------- shop -- */
  if (products.length) {
    line('## Shop');
    line();
    line(`Retail skincare, in routine order. Each product has its own page under ${base}/shop.`);
    line();

    const groups = new Map<string, typeof products>();
    for (const p of products) {
      if (!groups.has(p.category)) groups.set(p.category, []);
      groups.get(p.category)!.push(p);
    }

    for (const [category, items] of sortByRoutine([...groups.entries()])) {
      line(`### ${categoryLabel(category)}`);
      line();
      for (const p of items) {
        const url = p.slug ? `${base}/shop/${p.slug}` : null;
        const price = `$${(p.price_cents / 100).toFixed(2)}`;
        const desc = flat(p.description);
        line(url
          ? `- [${p.name}](${url}) — ${price}${desc ? `: ${desc}` : ''}`
          : `- ${p.name} — ${price}${desc ? `: ${desc}` : ''}`);
      }
      line();
    }
  }

  /* ------------------------------------------------------------- guides -- */
  line('## Guides');
  line();
  line('Long-form pages written by the practice. These carry the detail; the');
  line('summaries above are only an index.');
  line();
  for (const [path, label] of [
    ['/prf', 'Platelet-rich fibrin (PRF): what it is and how it is used here'],
    ['/prf/compare', 'PRF compared with PRP and dermal fillers'],
    ['/prf/aftercare', 'PRF preparation and recovery'],
    ['/injectables', 'Injectables and neurotoxin'],
    ['/facials', 'Clinical facials'],
    ['/led-light-therapy', 'LED light therapy by wavelength'],
    ['/scar-revision', 'Inkless scar revision'],
    ['/mens-skin-care', "Men's skin care"]
  ] as [string, string][]) {
    line(`- [${label}](${base}${path})`);
  }
  line();

  /* ---------------------------------------------------------- integrity -- */
  line('## Notes');
  line();
  line('- This file is generated from the practice\'s own records. Prices,');
  line('  durations and product details are the live values, not a snapshot.');
  line('- Descriptions are the practice\'s published wording. Where a treatment');
  line('  has no description, none is invented here.');
  line(`- Canonical sitemap: ${base}/sitemap.xml`);
  line();

  return out.join('\n');
}
