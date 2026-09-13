/**
 * app/c/[slug]/cart/page.tsx — the basket.
 *
 * A thin server shell around a client component, because the basket itself only
 * exists in the visitor's browser. What the server contributes is the three
 * things the browser cannot know: the practice's tax rate, whether card payment
 * is switched on at all, and where the links point on this domain.
 */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { CartClient } from '@/components/CartClient';
import { shopTaxBps, checkoutAvailable } from '@/lib/db/shop';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Basket' };

export default async function CartPage({
  params, searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const q = await searchParams;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const base = await storefrontBase(slug);
  const links = storefrontLinks(base);
  const taxBps = await shopTaxBps(clinic.id);

  return (
    <>
      <header className="sf-hero">
        <div className="sf-wrap">
          <div className="sf-eyebrow">{clinic.name}</div>
          <h1>Your basket</h1>
        </div>
      </header>

      <section className="sf-section">
        <div className="sf-wrap">
          <CartClient
            slug={slug}
            base={base}
            taxBps={taxBps}
            shopHref={links.shop}
            enquireHref={links.enquire}
            practiceName={clinic.name}
            checkoutReady={checkoutAvailable(taxBps)}
            cancelled={q.cancelled === '1'}
          />
        </div>
      </section>
    </>
  );
}
