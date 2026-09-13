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

import { getClinic } from '@/lib/db/queries';
import { serverClient } from '@/lib/supabase/server';
import { money, dateLabel, titleCase } from '@/lib/format';
import { CollectButton } from '@/components/CollectButton';

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
  const { data } = await supabase
    .from('shop_order')
    .select(
      'id, order_no, created_at, paid_at, status, contact_name, contact_email, ' +
      'contact_phone, note, subtotal_cents, tax_cents, total_cents, ' +
      'ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_postal, ' +
      'failure_reason, shop_order_item(id, name_snapshot, brand_snapshot, qty, ' +
      'unit_price_cents, line_total_cents)'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const orders = (data as unknown as OrderRow[]) ?? [];

  const toSend = orders.filter(o => o.status === 'paid');
  const done = orders.filter(o => o.status === 'collected');
  const unpaid = orders.filter(o => o.status !== 'paid' && o.status !== 'collected');

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
          <div className="stat">
            <div className="lab">Paid, last 30 days</div>
            <div className="stat-val">{money(last30, { compact: true })}</div>
          </div>
          <div className="stat">
            <div className="lab">Paid, all time</div>
            <div className="stat-val">{money(paidTotal, { compact: true })}</div>
          </div>
          <div className="stat">
            <div className="lab">Never paid</div>
            <div className="stat-val">{unpaid.length}</div>
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
                <CollectButton orderId={o.id} orderNo={o.order_no} />
              </footer>
            </article>
          ))}
        </section>

        {/* ---------------------------------------------------------- sent -- */}
        {done.length > 0 && (
          <section style={{ marginTop: 'var(--gd-8)' }}>
            <h2>Sent &amp; collected</h2>
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
          </section>
        )}
      </div>
    </>
  );
}
