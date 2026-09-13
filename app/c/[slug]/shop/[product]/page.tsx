/**
 * app/c/[slug]/shop/[product]/page.tsx — one product.
 *
 * The page a grid cannot be. A product is chosen by looking at it and then
 * reading about it, and the shop grid can only do the first half — a card shows
 * one photograph and two lines of text, which is enough to recognise something
 * you already know and not enough to decide on something you do not.
 *
 * WHERE THE DESCRIPTION COMES FROM, AND WHY IT MIGHT BE MISSING
 *
 * Nothing on this page is written by the developer. The supplier publishes
 * compliant copy for its stockists and the practice can paste it in from the
 * console; until it does, the page says so plainly rather than filling the gap
 * with invented claims. Cosmetic copy is the specific place where a sentence
 * written quickly turns into a regulatory problem — "reduces the appearance of
 * fine lines" is marketing and "repairs the skin barrier" is a drug claim, and
 * the line between them is not obvious to somebody in a hurry.
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
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string; product: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, product: productSlug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) return { title: 'Not found' };

  const product = await getStorefrontProduct(clinic.id, productSlug);
  if (!product) return { title: 'Not found' };

  return {
    // Just the product. The layout's template appends the practice name, so
    // including it here produced "Hydrate Facial Mist · The Med Bar · The Med Bar".
    title: product.name,
    description: product.description ?? undefined,
    robots: clinic.live ? { index: true, follow: true } : { index: false, follow: false }
  };
}

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

  return (
    <>
      <div className="sf-wrap" style={{ paddingTop: 'var(--gd-6)' }}>
        <Link href={links.shop} className="sf-back">&larr; Shop</Link>
      </div>

      <section className="sf-section" style={{ paddingTop: 'var(--gd-5)' }}>
        <div className="sf-wrap sf-product">
          <ProductGallery images={product.images} name={product.name} />

          <div className="sf-product-detail">
            {product.brand && <div className="sf-eyebrow">{product.brand}</div>}
            <h1 className="sf-display-sm">{product.name}</h1>

            <div className="sf-product-price">{money(product.price_cents)}</div>

            {product.description ? (
              <p className="sf-product-desc">{product.description}</p>
            ) : (
              /* Honest rather than empty. A blank space reads as a broken page;
                 this reads as a shop that has not finished being stocked, which
                 is what it is. */
              <p className="sf-product-desc dim">
                We haven&rsquo;t written this one up yet. Ask us about it and
                we&rsquo;ll tell you exactly what it does and whether it suits
                your skin.
              </p>
            )}

            {product.details && (
              <div className="sf-product-details">
                <h2>Details</h2>
                <p>{product.details}</p>
              </div>
            )}

            <div className="sf-product-buy">
              {canBuy ? (
                <AddToCart
                  slug={slug}
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
              <Link href={links.cart} className="sf-btn ghost">View basket</Link>
            </div>

            <p className="sf-note-line">
              Shipped to you, or collect at the studio. Questions about whether
              something suits your skin are worth asking before you buy &mdash;{' '}
              <Link href={links.enquire}>get in touch</Link>.
            </p>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="sf-section sf-bordered">
          <div className="sf-wrap">
            <div className="sf-section-head"><h2>More like this</h2></div>
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
                  </div>
                  <div className="sf-card-foot">
                    <span className="sf-card-price">{money(r.price_cents)}</span>
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
