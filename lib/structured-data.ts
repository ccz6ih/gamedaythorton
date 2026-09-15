/**
 * lib/structured-data.ts
 * What the pages already say, said again in a form a machine can read.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS, RATHER THAN MORE SITEMAPS
 * ---------------------------------------------------------------------------
 * A sitemap answers one question — which URLs exist — and this site has 48 of
 * them against a 50,000-per-file limit, so splitting it or adding an index
 * would buy nothing at all.
 *
 * The gap was never discovery. Every product page carried a price, a brand, an
 * image and a description as rendered text and emitted none of it as data, so
 * an answer engine asked "how much is the Renew Eye Complex at The Med Bar"
 * had to parse prose and hope. Thirty treatments with prices and durations were
 * in the same position.
 *
 * ---------------------------------------------------------------------------
 * THE RULE, WHICH IS THE SAME RULE AS THE COPY
 * ---------------------------------------------------------------------------
 * Every field here is read from the clinic's own database row. Nothing is
 * inferred, defaulted to something plausible, or filled in because the schema
 * has a slot for it.
 *
 * That matters more in structured data than in prose, because this is the
 * version a machine quotes back without a human reading it first. An invented
 * `availability` or a guessed `sku` becomes a confident answer in somebody
 * else's interface. Where the practice has not said, the property is omitted —
 * an absent field is honest, a wrong one is not.
 */

import type { StorefrontProduct, StorefrontService, StorefrontProvider } from '@/lib/db/storefront';

type Json = Record<string, unknown>;

/** Drops keys whose value is null/undefined/empty, recursively. */
function compact<T extends Json>(obj: T): T {
  const out: Json = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

const money = (cents: number) => (cents / 100).toFixed(2);

/**
 * A product, as an Offer.
 *
 * `availability` is the one property here that could be a lie, so it follows
 * the same switch the shop UI follows. When the practice does not track stock
 * — the supplier ships direct, so nothing on the shelf is the constraint —
 * everything active is genuinely in stock. When it does track, the count
 * decides. Neither branch guesses.
 */
export function productJsonLd(
  p: StorefrontProduct,
  opts: { url: string; images: string[]; tracksStock: boolean; currency?: string }
): Json {
  const inStock = opts.tracksStock ? p.stock_qty > 0 : true;

  return compact({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description ?? p.details ?? undefined,
    image: opts.images,
    brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
    category: p.category.replace(/_/g, ' '),
    // The practice's own identifier. Not an invented GTIN — it has none, and a
    // made-up one would collide with a real product somewhere.
    sku: p.slug ?? undefined,
    offers: compact({
      '@type': 'Offer',
      url: opts.url,
      price: money(p.price_cents),
      priceCurrency: opts.currency ?? 'USD',
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: { '@type': 'MedicalBusiness', name: 'The Med Bar' }
    })
  });
}

/**
 * A treatment, as a Service with an Offer.
 *
 * Priced services get a price. Quoted and from-priced ones get what they
 * actually are — a lower bound, or nothing — because "PRF from $450" published
 * as a flat $450 is the page quoting a number it does not stand behind, which
 * is the exact failure the service copy was cleaned up to avoid.
 */
export function serviceJsonLd(
  s: StorefrontService,
  opts: { url: string; providerName: string; area?: string; currency?: string }
): Json {
  const currency = opts.currency ?? 'USD';

  let offer: Json | undefined;
  if ((s.price_mode === 'flat' || s.price_mode === 'free') && s.price_cents !== null) {
    /**
     * `free` is a price, not a missing one.
     *
     * The complimentary consultation was falling through to "no offer", which
     * reads as "price unknown" — the opposite of what it is, and the one price
     * on the menu most worth a stranger knowing.
     */
    offer = compact({
      '@type': 'Offer',
      url: opts.url,
      price: money(s.price_cents),
      priceCurrency: currency,
      availability: 'https://schema.org/InStock'
    });
  } else if (s.price_mode === 'per_unit' && s.price_from_cents !== null) {
    /**
     * Per-unit pricing, said as per-unit.
     *
     * Neurotoxin is quoted per unit, and flattening that to a $14 minimum
     * would publish "Jeuveau from $14" — technically the lower bound, and
     * wildly misleading about what a treatment costs. UnitPriceSpecification
     * carries the unit with the number.
     */
    offer = compact({
      '@type': 'Offer',
      url: opts.url,
      priceCurrency: currency,
      priceSpecification: compact({
        '@type': 'UnitPriceSpecification',
        price: money(s.price_from_cents),
        priceCurrency: currency,
        unitText: s.unit_label ?? 'unit'
      })
    });
  } else if (s.price_from_cents !== null) {
    // A range with no upper bound: schema.org's way of saying "from".
    offer = compact({
      '@type': 'Offer',
      url: opts.url,
      priceCurrency: currency,
      priceSpecification: {
        '@type': 'PriceSpecification',
        minPrice: money(s.price_from_cents),
        priceCurrency: currency
      }
    });
  }
  // price_mode 'quoted' deliberately produces no offer at all.

  return compact({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.name,
    description: s.description ?? undefined,
    serviceType: s.category.replace(/_/g, ' '),
    provider: { '@type': 'MedicalBusiness', name: opts.providerName },
    areaServed: opts.area ? { '@type': 'City', name: opts.area } : undefined,
    offers: offer
  });
}

/**
 * The practitioner.
 *
 * This is what lets an answer engine connect "Jamie Salazar" to the practice
 * rather than treating the name as a string on a page. Her credentials are on
 * the About page as text; here they are a field.
 *
 * `bio` is used and `story` is not: the story is eight chapters of narrative
 * written for a reader, and pasting it into a description property is how a
 * search result ends up quoting the middle of a paragraph about her
 * grandmother.
 */
export function providerJsonLd(
  p: StorefrontProvider,
  opts: { url: string; practiceName: string; imageUrl?: string | null }
): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.name,
    // The letters after her name, as separate assertions rather than one blob.
    honorificSuffix: p.credentials ?? undefined,
    jobTitle: p.role_label ?? undefined,
    description: p.bio ?? undefined,
    image: opts.imageUrl && /^(\/|https?:)/.test(opts.imageUrl) ? opts.imageUrl : undefined,
    worksFor: { '@type': 'MedicalBusiness', name: opts.practiceName },
    url: opts.url
  });
}

/** Renders a block as the props for a <script type="application/ld+json">. */
export function ldScript(data: Json | Json[]) {
  return { __html: JSON.stringify(data) };
}
