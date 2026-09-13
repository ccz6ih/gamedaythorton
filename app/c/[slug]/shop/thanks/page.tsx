/**
 * app/c/[slug]/shop/thanks/page.tsx — where Stripe sends the customer back.
 *
 * WHAT THIS PAGE DELIBERATELY DOES NOT DO
 *
 * It does not mark the order paid. It does not read the order at all. A return
 * URL is a navigation the customer's browser performs, which means it can be
 * opened by hand, opened twice, or never opened — somebody who closes the tab
 * on Stripe's confirmation screen has still paid. Treating arrival here as
 * proof of payment would mean an order could be marked paid by typing a URL.
 *
 * The webhook is the only thing that settles an order, because it is the only
 * thing carrying a signature from Stripe.
 *
 * So this page says what is honestly known: the payment was submitted, the
 * order number to quote, and that a receipt follows. The order number comes
 * from the URL and is displayed, never trusted — worst case someone sees a
 * number that is not theirs, alongside no other detail about it.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { ClearCart } from '@/components/ClearCart';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Order Confirmed' };

export default async function Thanks({
  params, searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const q = await searchParams;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const links = storefrontLinks(await storefrontBase(slug));

  // Display only, and sanitised to the shape our own order numbers take so the
  // page cannot be used to render arbitrary text back to a visitor.
  const raw = typeof q.order === 'string' ? q.order : '';
  const orderNo = /^\d{6}-\d{4}$/.test(raw) ? raw : null;

  return (
    <>
      <ClearCart slug={slug} />

      <section className="sf-section sf-centre" style={{ paddingBlock: 'clamp(5rem, 12vw, 9rem)' }}>
        <div className="sf-wrap">
          <h1 className="sf-display-sm">Thank you &mdash; that&rsquo;s gone through.</h1>

          <p className="sf-lede centre">
            {orderNo
              ? <>Your order is <b>{orderNo}</b>. A receipt is on its way to the email address you used at checkout.</>
              : <>A receipt is on its way to the email address you used at checkout.</>}
          </p>

          <p className="sf-note-line centre">
            {clinic.name} will be in touch to confirm delivery or collection.
            {clinic.phone_voice && <> Questions? Call {clinic.phone_voice}.</>}
          </p>

          <div className="sf-actions centre">
            <Link href={links.shop} className="sf-btn ghost">Back to the shop</Link>
            <Link href={links.home} className="sf-btn ghost">Home</Link>
          </div>
        </div>
      </section>
    </>
  );
}
