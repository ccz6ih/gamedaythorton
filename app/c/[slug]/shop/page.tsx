/**
 * app/c/[slug]/shop/page.tsx — retail products.
 *
 * A grid here rather than the menu treatment used for services, and that is a
 * deliberate difference rather than an inconsistency. A service is chosen by
 * comparing price and duration down a column, so it wants a shared right edge.
 * A product is chosen by looking at it, so it wants room for an image.
 *
 * STOCK IS SHOWN, NOT HIDDEN. Most of this catalogue is currently at zero, and
 * the honest thing is to say so: a shop that quietly drops everything out of
 * stock looks like a shop with four products, and the practice never finds out
 * that fourteen lines need reordering.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStorefront, getStorefrontProducts } from '@/lib/db/storefront';
import { money, titleCase } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Shop({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const products = await getStorefrontProducts(clinic.id);

  const groups = new Map<string, typeof products>();
  for (const p of products) {
    if (!groups.has(p.category)) groups.set(p.category, []);
    groups.get(p.category)!.push(p);
  }

  const inStock = products.filter(p => p.stock_qty > 0);
  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];

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
            <span><b>{inStock.length}</b> in stock today</span>
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
                {items.map(p => (
                  <article className="sf-card" key={p.id}>
                    <div className="sf-card-img">
                      {p.image_path
                        ? <img src={p.image_path} alt="" loading="lazy" />
                        : <span aria-hidden="true">{p.name.slice(0, 1)}</span>}
                    </div>

                    <div className="sf-card-body">
                      {p.brand && <div className="sf-card-brand">{p.brand}</div>}
                      <h3>{p.name}</h3>
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
                      {p.stock_qty > 0
                        ? <span className="sf-chip accent">{p.stock_qty} in stock</span>
                        : <span className="sf-chip">out of stock</span>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}

          {products.length > 0 && (
            <p className="sf-note" style={{ marginTop: 'var(--gd-10)' }}>
              <b>Buying these.</b> Online checkout is not switched on yet —
              products are bought in person at the moment.{' '}
              <Link href={`/c/${slug}/enquire`}>Ask about anything here</Link> and
              the practice will set it aside.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
