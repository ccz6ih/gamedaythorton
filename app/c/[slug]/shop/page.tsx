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
import type { Metadata } from 'next';
import { getStorefront, getStorefrontProducts } from '@/lib/db/storefront';
import { shopTaxBps, shopTracksStock, checkoutAvailable } from '@/lib/db/shop';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { AddToCart } from '@/components/AddToCart';
import { ProductFinder, type FinderConcern } from '@/components/ProductFinder';
import { CONCERNS, matchConcern, sortByRoutine, categoryLabel } from '@/lib/shop-taxonomy';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Botanical Skincare Shop · Green Envee',
  description: 'Shop organic, cold-pressed Green Envee skincare used in our clinical treatments. Clean serums, masks, and barrier-repair formulas shipped or available for studio pickup in Loveland, CO.'
};

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

  /**
   * Routine order, not insertion order.
   *
   * The categories used to come out however the rows arrived, which put masques
   * above cleansers and SPF somewhere in the middle. Ordered by the routine,
   * the page can be read top to bottom as a sequence somebody could follow
   * rather than as an inventory. lib/shop-taxonomy.ts holds the order, and the
   * product pages read their step labels from the same place.
   */
  const orderedGroups = sortByRoutine([...groups.entries()]);

  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];
  const sellable = tracksStock ? products.filter(p => p.stock_qty > 0).length : products.length;

  /**
   * The finder's answers, worked out here rather than in the browser.
   *
   * Matching needs every product's description and details; doing it on the
   * client would mean shipping all of that as JSON on a page already loading
   * thirty-one photographs, and would put the logic that decides what to
   * recommend where anyone could edit it. Four per concern — enough to choose
   * between, few enough to read, and the component says when it has trimmed.
   */
  const finderConcerns: FinderConcern[] = CONCERNS.map(c => {
    const matched = matchConcern(c, products);
    return {
      key: c.key,
      label: c.label,
      blurb: c.blurb,
      total: matched.length,
      products: matched.slice(0, 4).map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        priceCents: p.price_cents,
        imagePath: p.image_path,
        description: p.description
      }))
    };
  // A concern nothing answers is not offered. Better to show seven honest
  // buttons than eight where one leads to an apology.
  }).filter(c => c.products.length > 0);

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

          {/* The same rail the treatment menu uses, for the same reason: a
              shelf of thirty-one jars with no visible structure is one long
              scroll, and the categories were the one thing telling you where
              you were. They were on the page already — as headings a third of
              the way down, where you only find them by scrolling past them. */}
          {orderedGroups.length > 1 && (
            <nav className="sf-jump" aria-label="Jump to a category">
              {orderedGroups.map(([category, items]) => (
                <a key={category} href={`#cat-${category}`} className="sf-jump-link">
                  {categoryLabel(category)}
                  <span className="n">{items.length}</span>
                </a>
              ))}
            </nav>
          )}
        </div>
      </header>

      {finderConcerns.length > 0 && (
        <section className="sf-section sf-bordered">
          <div className="sf-wrap">
            <ProductFinder
              concerns={finderConcerns}
              shopHref={links.shop}
              enquireHref={links.enquire}
            />
          </div>
        </section>
      )}

      <section className="sf-section">
        <div className="sf-wrap">
          {products.length === 0 && (
            <p className="sf-note">
              The shop is being set up. Products are available in person in the
              meantime.
            </p>
          )}

          {orderedGroups.map(([category, items]) => (
            <div className="sf-menu-group" id={`cat-${category}`} key={category}>
              <div className="sf-menu-cat">
                <h2>{categoryLabel(category)}</h2>
                <span className="rule" aria-hidden="true" />
                <span className="count">{items.length}</span>
              </div>

              <div className="sf-grid">
                {items.map(p => {
                  const soldOut = tracksStock && p.stock_qty <= 0;
                  const hasSecondary = Boolean(p.secondary_image_path);
                  return (
                    <article className="sf-card" key={p.id}>
                      <div className={`sf-card-img${hasSecondary ? ' has-hover-img' : ''}`}>
                        {p.image_path ? (
                          <>
                            <img className="sf-card-img-primary" src={p.image_path} alt={p.name} loading="lazy" />
                            {p.secondary_image_path && (
                              <img className="sf-card-img-hover" src={p.secondary_image_path} alt={`${p.name} alternate view`} loading="lazy" />
                            )}
                          </>
                        ) : (
                          <span aria-hidden="true">{p.name.slice(0, 1)}</span>
                        )}
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
