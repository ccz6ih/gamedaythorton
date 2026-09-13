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

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const payments = await getPayments();

  const collected = payments
    .filter((p: Record<string, unknown>) => p.status === 'succeeded')
    .reduce((sum: number, p: Record<string, unknown>) => sum + Number(p.amount_cents), 0);
  const failed = payments.filter((p: Record<string, unknown>) => p.status === 'failed');
  const refunded = payments.reduce(
    (sum: number, p: Record<string, unknown>) => sum + Number(p.refunded_cents ?? 0), 0);

  const last30 = payments.filter((p: Record<string, unknown>) => {
    const days = (Date.now() - new Date(String(p.created_at)).getTime()) / 864e5;
    return days < 35 && p.status === 'succeeded';
  }).reduce((sum: number, p: Record<string, unknown>) => sum + Number(p.amount_cents), 0);

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{clinic.name}</div>
          <h1>Payments</h1>
        </div>
        <div className="spacer" />
        <span className="pill" data-tone="warn"><i className="dot" />Stripe test mode</span>
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
          <div className="stat">
            <div className="lab">Refunded</div>
            <div className="stat-val">{money(refunded, { compact: true })}</div>
          </div>
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
              {failed.map((p: Record<string, unknown>) => {
                const who = p.patient as { id: string; first_name: string; last_name: string } | null;
                return (
                  <div className="item" data-tone="warn" key={String(p.id)}>
                    <span className="body">
                      <span className="ttl">
                        {who ? `${who.first_name} ${who.last_name}` : 'Unknown'} —{' '}
                        {money(Number(p.amount_cents))}
                      </span>
                      <span className="sub">
                        {dateLabel(String(p.created_at), 'long')}
                        {p.failure_message ? ` · ${String(p.failure_message)}` : ''}
                      </span>
                    </span>
                    {who && (
                      <span className="side">
                        <Link className="btn sm" href={`/console/clients/${who.id}`}>Open</Link>
                      </span>
                    )}
                  </div>
                );
              })}
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
                  <th>Type</th>
                  <th>Statement descriptor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: Record<string, unknown>) => {
                  const who = p.patient as { id: string; first_name: string; last_name: string } | null;
                  const status = String(p.status);
                  return (
                    <tr key={String(p.id)}>
                      <td className="num">{dateLabel(String(p.created_at))}</td>
                      <td>
                        {who
                          ? <Link href={`/console/clients/${who.id}`}>{who.first_name} {who.last_name}</Link>
                          : <span className="dim">—</span>}
                      </td>
                      <td className="num"><b>{money(Number(p.amount_cents))}</b></td>
                      <td className="dim">{titleCase(String(p.type))}</td>
                      <td className="dim mono" style={{ fontSize: '.74rem' }}>{String(p.descriptor ?? '—')}</td>
                      <td>
                        <span
                          className="pill"
                          data-tone={status === 'succeeded' ? 'ok' : status === 'failed' ? 'critical' : 'warn'}
                        >
                          <i className="dot" />{titleCase(status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
