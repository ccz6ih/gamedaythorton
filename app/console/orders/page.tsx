/**
 * app/console/orders/page.tsx — shop orders.
 *
 * WHAT THIS SCREEN IS FOR: knowing what to put in a box.
 *
 * It is not a sales report. The question a front desk actually has is "what has
 * been paid for that I have not sent yet", and that question has a short answer
 * which should be the first thing on the page. Everything else — the totals,
 * the history — is context underneath it.
 *
 * Orders that were never paid are shown separately and quietly. An abandoned
 * basket is not a task; it is only worth seeing so that a customer who rings up
 * saying "I tried to order and it did not work" can be found.
 */

import Link from 'next/link';
import { getClinic } from '@/lib/db/queries';
import { serverClient } from '@/lib/supabase/server';
import { money, dateLabel, titleCase } from '@/lib/format';
import { CollectButton } from '@/components/CollectButton';
import { ResendOrderButton } from '@/components/ResendOrderButton';
import { ShipButton } from '@/components/ShipButton';

export const dynamic = 'force-dynamic';

type OrderRow = {
  id: string;
  order_no: string;
  created_at: string;
  paid_at: string | null;
  status: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  note: string | null;
  /**
   * 'shop' is a basket of products. 'custom' is an invoice the practice raised
   * for something it did — a treatment, a top-up, a no-show fee. Both are
   * shop_order rows because both are a Stripe Checkout session we settle, and
   * that sharing is right. Confusing them on this screen was not.
   */
  kind: string | null;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  ship_name: string | null;
  ship_line1: string | null;
  ship_line2: string | null;
  ship_city: string | null;
  ship_state: string | null;
  ship_postal: string | null;
  failure_reason: string | null;
  shop_order_item: {
    id: string; name_snapshot: string; brand_snapshot: string | null;
    qty: number; unit_price_cents: number; line_total_cents: number;
  }[];
};

function addressLines(o: OrderRow): string[] {
  const parts = [
    o.ship_name,
    o.ship_line1,
    o.ship_line2,
    [o.ship_city, o.ship_state, o.ship_postal].filter(Boolean).join(' ')
  ].filter((p): p is string => !!p && p.trim() !== '');
  return parts;
}

export default async function OrdersPage() {
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const supabase = await serverClient();

  /**
   * A LIVE PRACTICE MUST NOT BE SHOWN TEST DATA — including ours.
   *
   * This screen had no synthetic filter, which the dashboard and the Payments
   * screen both have, and the omission was not theoretical. Twenty-two probe
   * baskets from the broken-checkout investigation sat in "Never paid" under
   * a line promising they were kept so a customer who rings up can be found.
   * They were addressed to shop-test@example.com and probe@example.invalid.
   * Nobody is going to ring up.
   *
   * Worse, they were indistinguishable from the real thing, so the one row in
   * that list that IS worth finding would have been buried in twenty-two that
   * are not.
   *
   * The rule is the same one getPayments and getScoreboard use, deliberately
   * so: once a practice is live, synthetic rows are hidden; a pilot tenant
   * keeps seeing them, because for Gameday they are the only data there is
   * and filtering would empty the screen. `pilot_mode` is read directly
   * because clinic_public omits it on purpose.
   */
  const { data: flags } = await supabase
    .from('clinic').select('pilot_mode').eq('id', clinic.id).maybeSingle();
  const live = flags?.pilot_mode === false;
  const realOnly: Record<string, unknown> = live ? { synthetic: false } : {};

  const { data } = await supabase
    .from('shop_order')
    .select(
      'id, order_no, created_at, paid_at, status, contact_name, contact_email, ' +
      'contact_phone, note, kind, subtotal_cents, tax_cents, total_cents, ' +
      'ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_postal, ' +
      'failure_reason, shop_order_item(id, name_snapshot, brand_snapshot, qty, ' +
      'unit_price_cents, line_total_cents)'
    )
    .match(realOnly)
    .order('created_at', { ascending: false })
    .limit(200);

  const all = (data as unknown as OrderRow[]) ?? [];

  /**
   * AN INVOICE IS NOT A PARCEL.
   *
   * This page's whole premise is "what has been paid for that I have not sent
   * yet" — and an invoice the practice raised for a treatment it already
   * performed has nothing to send. It arrived here because invoices and shop
   * baskets share the shop_order table, and this screen never read `kind`.
   *
   * The effect on the live console: a $149.38 invoice for a treatment done in
   * the room sat in "To send", offering Collect and Post buttons, with a
   * "1 to send" badge in the masthead that could not be cleared by doing
   * anything correct. The only way to make it go away was to mark a treatment
   * as having been put in a box.
   *
   * So the queue, and every figure above it, is shop baskets only. Invoices
   * are still listed — they are orders and somebody will look for one by
   * number — but in their own section, where no figure claims they are
   * awaiting dispatch.
   */
  const orders = all.filter(o => o.kind !== 'custom');
  const invoices = all.filter(o => o.kind === 'custom');

  const toSend = orders.filter(o => o.status === 'paid');
  const done = orders.filter(o => o.status === 'collected');
  /**
   * Baskets still genuinely in the air — not everything that is merely unpaid.
   *
   * This was "not paid and not collected", which swept up anything written
   * off as well. Seven dead rows from one broken afternoon sat on the list
   * looking like customers who might still ring up.
   *
   * `expired` is the written-off state: a link that lapsed, or an attempt
   * somebody voided on purpose. Those rows stay in the database with a
   * failure_reason saying what happened — they are a record, and deleting
   * them would be tidying away the evidence — but they are not a queue, and
   * a queue is what this list is.
   */
  const unpaid = orders.filter(
    o => o.status !== 'paid' && o.status !== 'collected' && o.status !== 'expired'
  );
  const writtenOff = orders.filter(o => o.status === 'expired').length;

  const paidTotal = [...toSend, ...done].reduce((s, o) => s + o.total_cents, 0);
  const last30 = [...toSend, ...done]
    .filter(o => o.paid_at && (Date.now() - new Date(o.paid_at).getTime()) / 864e5 < 30)
    .reduce((s, o) => s + o.total_cents, 0);

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{clinic.name}</div>
          <h1>Shop orders</h1>
        </div>
        <div className="spacer" />
        {toSend.length > 0 && (
          <span className="pill" data-tone="warn">
            <i className="dot" />{toSend.length} to send
          </span>
        )}
      </header>

      <div className="view wide">
        <div className="grid g4">
          <div className="stat hero">
            <div className="lab">Waiting to be sent</div>
            <div className="stat-val">{toSend.length}</div>
          </div>
          {/* "Shop", not "Paid" — invoices are money too, and they are
              counted on the Payments screen rather than here. A tile called
              "Paid" on a page that now deliberately excludes half of what was
              paid would be the same kind of wrong this page just stopped
              being. The shop has only ever existed inside this system, so
              "all time" is honest about the shop in a way it is not about
              the practice. */}
          <div className="stat">
            <div className="lab">Shop, last 30 days</div>
            <div className="stat-val">{money(last30, { compact: true })}</div>
          </div>
          <div className="stat">
            <div className="lab">Shop, all time</div>
            <div className="stat-val">{money(paidTotal, { compact: true })}</div>
            <div className="note">Invoices are on Payments</div>
          </div>
          <div className="stat">
            <div className="lab">Never paid</div>
            <div className="stat-val">{unpaid.length}</div>
            {/* Said, not hidden. Rows written off are still in the database
                and still findable; they are simply not a queue. Reporting the
                count means nothing disappears quietly. */}
            {writtenOff > 0 && (
              <div className="note">{writtenOff} written off, not shown</div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------- to send -- */}
        <section style={{ marginTop: 'var(--gd-8)' }}>
          <h2>To send</h2>

          {toSend.length === 0 ? (
            <p className="muted">
              Nothing waiting. Paid orders appear here the moment Stripe confirms
              the payment.
            </p>
          ) : toSend.map(o => (
            <article className="card" key={o.id} style={{ marginBottom: 'var(--gd-5)' }}>
              <header className="card-head">
                <div>
                  <b>{o.order_no}</b>
                  <span className="muted"> · {o.contact_name}</span>
                </div>
                <div className="spacer" />
                <b>{money(o.total_cents)}</b>
              </header>

              <div className="card-body">
                <ul className="plain">
                  {o.shop_order_item.map(i => (
                    <li key={i.id}>
                      <b>{i.qty}&times;</b>{' '}
                      {i.brand_snapshot ? `${i.brand_snapshot} — ` : ''}{i.name_snapshot}
                      <span className="muted"> · {money(i.line_total_cents)}</span>
                    </li>
                  ))}
                </ul>

                <div className="grid g2" style={{ marginTop: 'var(--gd-4)' }}>
                  <div>
                    <div className="lab">Send to</div>
                    {addressLines(o).length ? (
                      <address>
                        {addressLines(o).map(line => <span key={line}>{line}<br /></span>)}
                      </address>
                    ) : (
                      <p className="muted">
                        No address was given &mdash; collecting in person, or ask
                        when you confirm.
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="lab">Contact</div>
                    <p>
                      <a href={`mailto:${o.contact_email}`}>{o.contact_email}</a>
                      {o.contact_phone && <><br /><a href={`tel:${o.contact_phone}`}>{o.contact_phone}</a></>}
                    </p>
                    <div className="lab" style={{ marginTop: 'var(--gd-3)' }}>Paid</div>
                    <p>{dateLabel(o.paid_at, 'long')}</p>
                  </div>
                </div>

                {o.note && (
                  <p style={{ marginTop: 'var(--gd-4)' }}>
                    <span className="lab">They said</span><br />{o.note}
                  </p>
                )}
              </div>

              <footer className="card-foot">
                {/* Recorded with who and when, because "did that go out?" is the
                    question this screen exists to answer. */}
                {/*
                  Two different completions, because they are two different
                  events. "Collected" is somebody walking out with it;
                  "posted" has a carrier and a reference attached and sends
                  the customer a message saying so. A shop that only has the
                  first one files every parcel as collected, which is how
                  this screen behaved until now.
                */}
                <CollectButton orderId={o.id} orderNo={o.order_no} />
                <ShipButton orderId={o.id} orderNo={o.order_no} />
                {/* Next to it rather than hidden, because "they say they never
                    got it" arrives on the phone while this screen is open. */}
                <ResendOrderButton orderId={o.id} orderNo={o.order_no} />
              </footer>
            </article>
          ))}
        </section>

        {/* ---------------------------------------------------------- sent -- */}
        {done.length > 0 && (
          <section style={{ marginTop: 'var(--gd-8)' }}>
            <h2>Sent &amp; collected</h2>
            <div className="table-scroll">
              <table className="table">
              <thead>
                <tr><th>Order</th><th>Customer</th><th>Items</th><th className="num">Total</th><th>Paid</th></tr>
              </thead>
              <tbody>
                {done.map(o => (
                  <tr key={o.id}>
                    <td>{o.order_no}</td>
                    <td>{o.contact_name}</td>
                    <td>{o.shop_order_item.reduce((s, i) => s + i.qty, 0)}</td>
                    <td className="num">{money(o.total_cents)}</td>
                    <td>{dateLabel(o.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
        )}

        {/* -------------------------------------------------------- unpaid -- */}
        {unpaid.length > 0 && (
          <section style={{ marginTop: 'var(--gd-8)' }}>
            <h2>Never paid</h2>
            <p className="muted">
              Baskets that reached the payment page and stopped there. Nothing was
              charged. Kept only so somebody who rings up can be found.
            </p>
            <div className="table-scroll">
              <table className="table">
              <thead>
                <tr><th>Order</th><th>Customer</th><th className="num">Would have been</th><th>Status</th><th>Started</th></tr>
              </thead>
              <tbody>
                {unpaid.map(o => (
                  <tr key={o.id}>
                    <td>{o.order_no}</td>
                    <td>{o.contact_name}<br /><span className="muted">{o.contact_email}</span></td>
                    <td className="num">{money(o.total_cents)}</td>
                    <td>
                      {titleCase(o.status)}
                      {o.failure_reason && <><br /><span className="muted">{o.failure_reason}</span></>}
                    </td>
                    <td>{dateLabel(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
        )}

        {/* ------------------------------------------------------ invoices -- */}
        {/*
          Listed, but not as a queue and not as dispatch.

          Somebody will come looking for one of these by number — "she says
          she paid, what happened to 261021-0094" — and a screen that simply
          dropped them would answer that question with silence. What it must
          not do is imply there is anything to post.
        */}
        {invoices.length > 0 && (
          <section style={{ marginTop: 'var(--gd-8)' }}>
            <h2>Invoices raised</h2>
            <p className="muted">
              Charges for things done in the room, not products to send. Nothing
              here needs posting. The money itself is on{' '}
              <Link href="/console/payments">Payments</Link>.
            </p>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th><th>Client</th>
                    <th className="num">Amount</th><th>Status</th><th>Raised</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(o => (
                    <tr key={o.id}>
                      <td>{o.order_no}</td>
                      <td>{o.contact_name}</td>
                      <td className="num">{money(o.total_cents)}</td>
                      <td>
                        {o.status === 'paid'
                          ? <span className="pill" data-tone="ok"><i className="dot" />Paid</span>
                          : <>{titleCase(o.status)}
                              {o.failure_reason && (
                                <><br /><span className="muted">{o.failure_reason}</span></>
                              )}
                            </>}
                      </td>
                      <td>{dateLabel(o.paid_at ?? o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
