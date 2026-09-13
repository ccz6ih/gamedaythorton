/**
 * app/c/[slug]/shop/page.tsx — retail products.
 *
 * A grid here rather than the menu treatment used for services, and that is a
 * deliberate difference rather than an inconsistency. A service is chosen by
 * comparing price and duration down a column, so it wants a shared right edge.
 * A product is chosen by looking at it, so it wants room for an image.
 *
 * STOCK IS NO LONGER A GATE, and that reverses what this file used to do.
 *
 * The original showed an on-hand count and greyed out anything at zero. That is
 * right for a practice selling off its own shelf. It is wrong for this one: the
 * line is ordered from the supplier, who ships to the customer directly, so
 * thirteen of eighteen products showed "out of stock" while every one of them
 * was actually available to buy. The shop read as almost empty and the practice
 * looked like it had run out of everything.
 *
 * `clinic.track_stock` now decides. Off (the default): every active product is
 * buyable and no count is shown, because a number the shop does not enforce is
 * noise. On: the old behaviour, which is the honest one for held stock.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStorefront, getStorefrontProducts } from '@/lib/db/storefront';
import { shopTaxBps, shopTracksStock, checkoutAvailable } from '@/lib/db/shop';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { AddToCart } from '@/components/AddToCart';
import { money, titleCase } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Shop({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const [products, taxBps, tracksStock] = await Promise.all([
    getStorefrontProducts(clinic.id),
    shopTaxBps(clinic.id),
    shopTracksStock(clinic.id)
  ]);

  const links = storefrontLinks(await storefrontBase(slug));
  const canBuy = checkoutAvailable(taxBps);

  // Sold-out lines stay listed rather than disappearing. A shop that silently
  // drops them looks like a shop with four products, and the practice never
  // finds out that fourteen need reordering.
  const groups = new Map<string, typeof products>();
  for (const p of products) {
    if (!groups.has(p.category)) groups.set(p.category, []);
    groups.get(p.category)!.push(p);
  }

  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];
  const sellable = tracksStock ? products.filter(p => p.stock_qty > 0).length : products.length;

  return (
    <>
      <header className="sf-hero">
        <div className="sf-wrap">
          <div className="sf-eyebrow">{clinic.name}</div>
          <h1>Shop</h1>
          <p className="sf-tagline">
            {brands.length === 1
              ? `The ${brands[0]} line, the same products used in treatment.`
              : 'Products used in treatment, available to take home.'}
          </p>
          <div className="sf-hero-meta">
            <span><b>{products.length}</b> products</span>
            {tracksStock
              ? <span><b>{sellable}</b> in stock today</span>
              : <span>Shipped to you, or collect at the studio</span>}
          </div>
        </div>
      </header>

      <section className="sf-section">
        <div className="sf-wrap">
          {products.length === 0 && (
            <p className="sf-note">
              The shop is being set up. Products are available in person in the
              meantime.
            </p>
          )}

          {[...groups.entries()].map(([category, items]) => (
            <div className="sf-menu-group" key={category}>
              <div className="sf-menu-cat">
                <h2>{titleCase(category)}</h2>
                <span className="rule" aria-hidden="true" />
                <span className="count">{items.length}</span>
              </div>

              <div className="sf-grid">
                {items.map(p => {
                  const soldOut = tracksStock && p.stock_qty <= 0;
                  return (
                    <article className="sf-card" key={p.id}>
                      <div className="sf-card-img">
                        {p.image_path
                          ? <img src={p.image_path} alt={p.name} loading="lazy" />
                          : <span aria-hidden="true">{p.name.slice(0, 1)}</span>}
                      </div>

                      <div className="sf-card-body">
                        {p.brand && <div className="sf-card-brand">{p.brand}</div>}
                        {/* The name is the link to the product page. The whole
                            card is not, because the card also holds an Add to
                            basket button, and nesting a button inside a link
                            is both invalid and genuinely ambiguous to tap. */}
                        <h3>
                          {p.slug
                            ? <Link href={`${links.shop}/${p.slug}`}>{p.name}</Link>
                            : p.name}
                        </h3>
                        {p.description
                          ? <p className="sf-card-desc">{p.description}</p>
                          : (
                            // Not written for her. A skincare claim we cannot
                            // stand behind is worse than a gap she can fill.
                            <p className="sf-card-desc dim">
                              Description to be supplied by the practice.
                            </p>
                          )}
                      </div>

                      <div className="sf-card-foot">
                        <span className="sf-card-price">{money(p.price_cents)}</span>

                        {soldOut ? (
                          <span className="sf-chip">out of stock</span>
                        ) : canBuy ? (
                          <AddToCart
                            slug={slug}
                            product={{
                              productId: p.id,
                              name: p.name,
                              brand: p.brand,
                              priceCents: p.price_cents,
                              imagePath: p.image_path
                            }}
                          />
                        ) : (
                          <Link href={links.enquire} className="sf-chip accent">Enquire</Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}

          {products.length > 0 && !canBuy && (
            <p className="sf-note" style={{ marginTop: 'var(--gd-10)' }}>
              <b>Buying these.</b> Card payment is not switched on yet &mdash;
              products are bought in person at the moment.{' '}
              <Link href={links.enquire}>Ask about anything here</Link> and the
              practice will set it aside.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
