/**
 * app/c/[slug]/shop/[product]/page.tsx — Luxury Editorial Product Experience
 *
 * Designed with the conversion-optimized, clinical luxury feel of modern
 * botanical brands (Hims/Hers, Aesop, Augustinus Bader).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getStorefront, getStorefrontProduct, getRelatedProducts
} from '@/lib/db/storefront';
import { shopTaxBps, checkoutAvailable } from '@/lib/db/shop';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { AddToCart } from '@/components/AddToCart';
import { ProductGallery } from '@/components/ProductGallery';
import { money, titleCase } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string; product: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, product: productSlug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) return { title: 'Not found' };

  const product = await getStorefrontProduct(clinic.id, productSlug);
  if (!product) return { title: 'Not found' };

  return {
    title: `${product.name} · Botanical Skincare`,
    description: product.description ?? product.details ?? undefined,
    robots: clinic.live ? { index: true, follow: true } : { index: false, follow: false }
  };
}

const STEP_MAP: Record<string, string> = {
  cleanser: 'Step 01 · Cleanse',
  exfoliator: 'Step 02 · Exfoliate',
  toner: 'Step 03 · Tone & Prep',
  masque: 'Step 04 · Treatment Masque',
  serum: 'Step 05 · Target Serum',
  eye_care: 'Step 06 · Eye Care',
  moisturizer: 'Step 07 · Moisturize & Seal',
  spf: 'Step 08 · Daily Defense SPF',
  facial_oil: 'Botanical Facial Oil',
  lip_care: 'Lip Barrier Care',
  kit: 'Complete Skincare Kit'
};

const HOW_TO_USE: Record<string, { when: string; how: string; proTip: string }> = {
  cleanser: {
    when: 'Morning and evening as your first foundational step.',
    how: 'Dispense 1–2 pumps onto damp skin. Gently massage in upward circular motions for 60 seconds, then rinse with lukewarm water and pat dry with a clean towel.',
    proTip: 'For heavy makeup or water-resistant SPF, perform a double-cleanse using an oil-based cleanser first.'
  },
  exfoliator: {
    when: '1–2 times weekly in the evening after cleansing.',
    how: 'Apply a smooth, even layer to clean, damp skin. Work gently with light fingertips without pressing. Allow active enzymes to sit for recommended time, then rinse thoroughly.',
    proTip: 'Never scrub aggressively. Chemical and enzymatic exfoliants do the work on a cellular level without physical friction.'
  },
  toner: {
    when: 'Immediately following cleansing, morning and evening.',
    how: 'Mist generously over face and neck while skin is still slightly damp, or press gently with clean palms.',
    proTip: 'Apply your hyaluronic acid serum directly over damp mist to maximize moisture binding and plumping.'
  },
  masque: {
    when: '1–2 times weekly as an intensive treatment boost.',
    how: 'Smooth an opaque layer over clean face and neck. Relax for 15–20 minutes before rinsing with warm water or leaving on overnight if indicated.',
    proTip: 'Pair with home LED light therapy or after a warm bath when pores are relaxed for optimal penetration.'
  },
  serum: {
    when: 'Daily morning and/or evening before heavier creams.',
    how: 'Dispense 3–4 drops onto fingertips and gently press into face, neck, and décolleté until fully absorbed.',
    proTip: 'Layer from thinnest to thickest consistency, allowing 30 seconds for active absorption between steps.'
  },
  eye_care: {
    when: 'Morning and evening around the delicate orbital bone.',
    how: 'Dab half a pea-sized amount using your ring finger along the orbital bone, tapping gently from outer corner inward.',
    proTip: 'Avoid pulling or rubbing the delicate under-eye skin. Store in refrigerator for instant depuffing benefits.'
  },
  moisturizer: {
    when: 'Morning and evening to lock in hydration.',
    how: 'Warm 1–2 pumps between palms and massage smoothly over face and neck in upward lifting strokes.',
    proTip: 'Seal your serum while the skin is still slightly dewy to create a resilient protective lipid barrier.'
  },
  spf: {
    when: 'Every morning as the final essential step before makeup or outdoor exposure.',
    how: 'Apply a nickel-sized amount evenly across face, ears, and neck 15 minutes before sun exposure. Reapply every 2 hours if outdoors.',
    proTip: 'At Colorado altitude, UV index runs significantly higher year-round. Daily SPF is the single most important step to protect your clinical treatment results.'
  },
  facial_oil: {
    when: 'Evening as the final sealing step, or anytime skin feels depleted.',
    how: 'Warm 2–3 drops in palms and press gently over moisturizer to lock in moisture and impart a radiant glow.',
    proTip: 'Oils always go on top of water-based hydration, never underneath, acting as an occlusive shield.'
  }
};

export default async function ProductPage({ params }: Props) {
  const { slug, product: productSlug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const product = await getStorefrontProduct(clinic.id, productSlug);
  if (!product) notFound();

  const [taxBps, related] = await Promise.all([
    shopTaxBps(clinic.id),
    getRelatedProducts(clinic.id, product.category, product.id)
  ]);

  const links = storefrontLinks(await storefrontBase(slug));
  const canBuy = checkoutAvailable(taxBps);

  const stepLabel = STEP_MAP[product.category] ?? 'Green Envee Botanicals';
  const usageGuide = HOW_TO_USE[product.category] ?? {
    when: 'Daily as part of your customized skincare ritual.',
    how: 'Apply to clean skin in gentle, upward motions until absorbed.',
    proTip: 'Consistency is the key to cellular transformation. Use daily for cumulative clinical results.'
  };

  const isSerumOrPeel = /serum|exfoliat|peel/i.test(product.category);
  const isCleanser = /cleanse|toner/i.test(product.category);

  return (
    <>
      <div className="sf-wrap" style={{ paddingTop: 'var(--gd-6)' }}>
        <nav className="sf-back" aria-label="Breadcrumbs">
          <Link href={links.shop} className="sf-back">&larr; Back to Shop</Link>
          <span style={{ opacity: 0.4 }}>/</span>
          <span style={{ color: 'var(--gd-text-dim)' }}>{titleCase(product.category)}</span>
        </nav>
      </div>

      <section className="sf-section" style={{ paddingTop: 'var(--gd-5)' }}>
        <div className="sf-wrap sf-product">
          {/* Interactive Product Gallery */}
          <ProductGallery images={product.images} name={product.name} />

          {/* Product Buy Box & Overview */}
          <div className="sf-product-detail">
            <div className="sf-product-routine-tag">
              <span>{stepLabel}</span>
            </div>

            <h1 className="sf-display-sm">{product.name}</h1>

            <div className="sf-product-price-row">
              <span className="sf-product-price">{money(product.price_cents)}</span>
              <span className="sf-product-stock-badge">
                <span className="dot" aria-hidden="true" />
                In stock · Ready to dispatch
              </span>
            </div>

            {/* Short compelling card hook / description */}
            <p className="sf-product-desc">
              {product.description ?? product.details ?? 'Clean, organic botanical formulation crafted for high-potency cellular support.'}
            </p>

            {/* Full Quantity Selector & Add to Bag Box */}
            <div className="sf-product-buy">
              {canBuy ? (
                <AddToCart
                  slug={slug}
                  showQuantity={true}
                  product={{
                    productId: product.id,
                    name: product.name,
                    brand: product.brand,
                    priceCents: product.price_cents,
                    imagePath: product.image_path
                  }}
                />
              ) : (
                <Link href={links.enquire} className="sf-btn primary">Ask about this</Link>
              )}
            </div>

            {/* Studio Clean Standards & Guarantee Bar */}
            <div className="sf-product-perks">
              <div className="sf-perk-item">
                <span className="sf-perk-icon">🌿</span>
                <span>100% Clean Organic Botanicals</span>
              </div>
              <div className="sf-perk-item">
                <span className="sf-perk-icon">🧪</span>
                <span>Cold-Pressed Active Nutrients</span>
              </div>
              <div className="sf-perk-item">
                <span className="sf-perk-icon">🚫</span>
                <span>Paraben, Sulfate &amp; Toxin Free</span>
              </div>
              <div className="sf-perk-item">
                <span className="sf-perk-icon">📍</span>
                <span>Loveland Studio Pickup Available</span>
              </div>
            </div>

            {/* Accordion Panels (Formulation, How to Use, Clean Standard) */}
            <div className="sf-product-accordions">
              <details className="sf-accordion" open>
                <summary>
                  <span>✦ The Formulation &amp; Benefits</span>
                  <span className="sf-accordion-arrow" aria-hidden="true" />
                </summary>
                <div className="sf-accordion-body">
                  <p>{product.details ?? product.description ?? 'Formulated with cold-pressed plant actives to nourish and protect the skin barrier.'}</p>
                </div>
              </details>

              <details className="sf-accordion">
                <summary>
                  <span>✦ How to Use in Your Daily Ritual</span>
                  <span className="sf-accordion-arrow" aria-hidden="true" />
                </summary>
                <div className="sf-accordion-body">
                  <p><b>When to apply:</b> {usageGuide.when}</p>
                  <p><b>How to apply:</b> {usageGuide.how}</p>
                  <p><b>Practitioner Pro-Tip:</b> {usageGuide.proTip}</p>
                </div>
              </details>

              <details className="sf-accordion">
                <summary>
                  <span>✦ Clean Ingredients &amp; Clinical Safety</span>
                  <span className="sf-accordion-arrow" aria-hidden="true" />
                </summary>
                <div className="sf-accordion-body">
                  <p>
                    Every Green Envee formula is crafted in small batches using non-toxic, sustainable ingredients.
                    Free of parabens, phthalates, artificial dyes, and synthetic perfumes. Leaping Bunny certified cruelty-free.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Pillars Clinical Benefit Section (Hims-Style) */}
      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <div className="sf-eyebrow">The Clinical Difference</div>
            <h2>An essential that goes beyond the basics</h2>
            <p>
              Professional-grade botanical skincare designed to protect your barrier,
              maximize active nutrient absorption, and maintain in-studio treatment results.
            </p>
          </div>

          <div className="sf-pillars-grid">
            <div className="sf-pillar-card">
              <span className="sf-pillar-num">01</span>
              <h3>{isCleanser ? 'Gentle Yet High-Performance' : isSerumOrPeel ? 'Targeted Active Delivery' : 'Deep Barrier Replenishment'}</h3>
              <p>
                {isCleanser
                  ? 'Cleanses deeply without disrupting the acid mantle, preventing the rebound oil production caused by harsh foaming cleansers.'
                  : isSerumOrPeel
                  ? 'Micro-molecular botanical extracts penetrate deep into epidermis layers to target texture, fine lines, and dullness at the root.'
                  : 'Restores essential lipids and ceramides lost through altitude and dry Colorado climate, locking in moisture all day.'}
              </p>
            </div>

            <div className="sf-pillar-card">
              <span className="sf-pillar-num">02</span>
              <h3>{isCleanser ? 'Balanced Acid Mantle' : isSerumOrPeel ? 'Bio-Available Antioxidants' : 'Non-Comedogenic Hydration'}</h3>
              <p>
                {isCleanser
                  ? 'Formulated at skin-identical pH (~5.0–5.5) so delicate capillaries and barrier lipids stay calm, supple, and soothed.'
                  : isSerumOrPeel
                  ? 'Packed with stable, non-oxidizing plant antioxidants that shield against daily UV stress, environmental pollution, and digital blue light.'
                  : 'Delivers profound moisture without greasy weight, absorbing seamlessly under daytime sunscreen and evening night oils.'}
              </p>
            </div>

            <div className="sf-pillar-card">
              <span className="sf-pillar-num">03</span>
              <h3>Regenerative Treatment Synergy</h3>
              <p>
                Formulated to work in synergy with in-studio PRF, microneedling, and peel treatments,
                extending your clinical results between appointments.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Complete The Ritual / Related Products */}
      {related.length > 0 && (
        <section className="sf-section sf-bordered">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <div className="sf-eyebrow">Complementary Steps</div>
              <h2>Complete your daily ritual</h2>
              <p>Pair with these companion formulas to complete your morning and evening skincare ritual.</p>
            </div>

            <div className="sf-grid">
              {related.map(r => (
                <Link className="sf-card" key={r.id} href={`${links.shop}/${r.slug}`}>
                  <div className="sf-card-img">
                    {r.image_path
                      ? <img src={r.image_path} alt={r.name} loading="lazy" />
                      : <span aria-hidden="true">{r.name.slice(0, 1)}</span>}
                  </div>
                  <div className="sf-card-body">
                    {r.brand && <div className="sf-card-brand">{r.brand}</div>}
                    <h3>{r.name}</h3>
                    {r.description && <p className="sf-card-desc">{r.description}</p>}
                  </div>
                  <div className="sf-card-foot">
                    <span className="sf-card-price">{money(r.price_cents)}</span>
                    <span className="sf-chip">View &rarr;</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
