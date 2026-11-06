/**
 * app/console/payments/page.tsx
 *
 * Note what every descriptor says, and what none of them say. The processor gets
 * an amount, an opaque reference and a neutral descriptor — never a service or
 * therapy name. A card statement is read by whoever opens the post.
 */

import Link from 'next/link';
import { getClinic, getPayments } from '@/lib/db/queries';
import { money, dateLabel, titleCase } from '@/lib/format';
import { stripeMode } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const clinic = await getClinic();
  const mode = stripeMode();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const payments = await getPayments();

  const collected = payments
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amountCents, 0);
  const failed = payments.filter(p => p.status === 'failed');

  const last30 = payments
    .filter(p => p.status === 'succeeded'
      && (Date.now() - new Date(p.at).getTime()) / 864e5 < 35)
    .reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{clinic.name}</div>
          <h1>Payments</h1>
        </div>
        <div className="spacer" />
        {/*
          Was a hard-coded "Stripe test mode" pill with no condition on it, so
          it said test mode while the practice was taking real money. On the
          one screen about money, a badge that is always wrong trains the
          reader to ignore it — including on the day it is right.

          Live is the normal state and gets no badge. Something to say only
          when something is off.
        */}
        {mode === 'test' && (
          <span className="pill" data-tone="warn"><i className="dot" />Stripe test mode</span>
        )}
        {mode === 'unconfigured' && (
          <span className="pill" data-tone="critical"><i className="dot" />Stripe not configured</span>
        )}
      </header>

      <div className="view wide">
        <div className="grid g4">
          <div className="stat hero">
            <div className="lab">Collected, last 30 days</div>
            <div className="stat-val">{money(last30, { compact: true })}</div>
          </div>
          <div className="stat">
            <div className="lab">Collected, all time</div>
            <div className="stat-val">{money(collected, { compact: true })}</div>
          </div>
          <div className="stat" style={failed.length ? { borderColor: 'var(--gd-below)' } : undefined}>
            <div className="lab">Declined</div>
            <div className="stat-val">{failed.length}</div>
            {failed.length > 0 && <div className="note">Involuntary churn if nobody calls</div>}
          </div>
          {/*
            Refunds are not shown rather than shown as zero.

            The figure came from payment.refunded_cents, and the money this
            practice actually takes does not pass through that table — so the
            tile could only ever have read $0, which on a money screen is a
            claim rather than an absence. A refund issued in Stripe today
            would not move it.

            It comes back when charge.refunded is handled, which is listed in
            the webhook and deliberately not implemented yet.
          */}
        </div>

        {failed.length > 0 && (
          <section className="card warn flush">
            <div className="card-head">
              <div>
                <div className="eyebrow">Needs a phone call</div>
                <h2>Declined payments</h2>
                <p>
                  A member who churns because a card expired did not choose to leave.
                  That is the cheapest retention win available.
                </p>
              </div>
            </div>
            <div className="list">
              {failed.map(p => (
                <div className="item" data-tone="warn" key={p.id}>
                  <span className="body">
                    <span className="ttl">{p.who} — {money(p.amountCents)}</span>
                    <span className="sub">{dateLabel(p.at, 'long')}</span>
                  </span>
                  {p.patientId && (
                    <span className="side">
                      <Link className="btn sm" href={`/console/clients/${p.patientId}`}>Open</Link>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card flush">
          <div className="card-head">
            <div>
              <h2>All payments</h2>
              <p>Newest first.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th className="num">Amount</th>
                  <th>Where from</th>
                  <th>Reference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="num">{dateLabel(p.at)}</td>
                    <td>
                      {p.patientId
                        ? <Link href={`/console/clients/${p.patientId}`}>{p.who}</Link>
                        : p.who}
                    </td>
                    <td className="num"><b>{money(p.amountCents)}</b></td>
                    {/*
                      Where it came from, rather than a payment "type" only the
                      clinical rows ever carried. Reading this screen, the
                      question is whether it was the shop, an invoice she
                      raised, or a visit — and until now two of those three
                      could not appear here at all.
                    */}
                    <td className="dim">
                      {p.source === 'shop' ? 'Shop' : p.source === 'invoice' ? 'Invoice' : 'Visit'}
                    </td>
                    <td className="dim mono" style={{ fontSize: '.74rem' }}>{p.reference ?? '—'}</td>
                    <td>
                      <span
                        className="pill"
                        data-tone={p.status === 'succeeded' ? 'ok' : p.status === 'failed' ? 'critical' : 'warn'}
                      >
                        <i className="dot" />{titleCase(p.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="card">
          <div className="eyebrow quiet">What the processor knows</div>
          <p className="muted" style={{ fontSize: '.86rem', lineHeight: 1.6 }}>
            Every descriptor above carries the practice name and nothing else. No
            service name, no therapy name, no reason for the visit — and the database
            rejects a descriptor or a metadata field that contains one, so it is not
            something anyone has to remember.
          </p>
        </div>
      </div>
    </>
  );
}
