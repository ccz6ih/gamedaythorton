/**
 * app/console/packages/page.tsx
 *
 * The prepaid ledger. This is the screen a med spa has no equivalent of in a
 * generic booking tool, and it matters more than it looks: every unused session
 * is money already taken for work not yet done. It is a liability on the
 * practice's books, it has to be honoured through any platform migration, and an
 * expiry date nobody surfaces is how a client discovers they lost $800.
 */

import Link from 'next/link';
import { getClinic, getPackageLedger } from '@/lib/db/queries';
import { money, dateLabel, daysUntil, titleCase } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PackagesPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const ledger = await getPackageLedger();

  const open = ledger.filter(p => p.sessionsRemaining > 0);
  const liability = open.reduce((sum, p) => sum + p.liabilityCents, 0);
  const expiringSoon = open.filter(p => {
    const days = daysUntil(p.expires_on);
    return days !== null && days <= 90;
  });
  const sold = ledger.reduce((sum, p) => sum + Number(p.price_paid_cents), 0);

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{clinic.name}</div>
          <h1>Prepaid packages</h1>
        </div>
        <div className="spacer" />
        <span className="pill">{open.length} open</span>
        <Link className="btn primary" href="/console/packages/new">Sell package</Link>
      </header>

      <div className="view wide">
        {params.saved && <div className="note-band" style={{ marginBottom: 'var(--gd-5)' }}>Package sale recorded.</div>}
        {params.error && <div className="note-band critical" style={{ marginBottom: 'var(--gd-5)' }}>{params.error}</div>}
        <div className="grid g4">
          <div className="stat hero">
            <div className="lab">Outstanding liability</div>
            <div className="stat-val">{money(liability, { compact: true })}</div>
            <div className="note">Paid for, not yet delivered</div>
          </div>
          <div className="stat">
            <div className="lab">Sold, all time</div>
            <div className="stat-val">{money(sold, { compact: true })}</div>
          </div>
          <div className="stat" style={expiringSoon.length ? { borderColor: 'var(--gd-below)' } : undefined}>
            <div className="lab">Expiring within 90 days</div>
            <div className="stat-val">{expiringSoon.length}</div>
            {expiringSoon.length > 0 && <div className="note">Reach out before they lapse</div>}
          </div>
          <div className="stat">
            <div className="lab">Fully redeemed</div>
            <div className="stat-val">{ledger.length - open.length}</div>
          </div>
        </div>

        {expiringSoon.length > 0 && (
          <section className="card warn flush">
            <div className="card-head">
              <div>
                <div className="eyebrow">Act on these</div>
                <h2>Sessions about to expire</h2>
                <p>
                  These clients have already paid. Booking them in is good service and
                  good business at the same time.
                </p>
              </div>
            </div>
            <div className="list">
              {expiringSoon.map(p => {
                const who = p.patient as { id: string; first_name: string; last_name: string } | null;
                const days = daysUntil(p.expires_on);
                return (
                  <div className="item" data-tone={days !== null && days <= 60 ? 'critical' : 'warn'} key={p.id}>
                    <span className="body">
                      <span className="ttl">
                        {who ? `${who.first_name} ${who.last_name}` : 'Unknown'} — {p.package_name}
                      </span>
                      <span className="sub">
                        {p.sessionsRemaining} of {p.sessions_total} unused ·{' '}
                        {money(p.liabilityCents)} owed · expires {dateLabel(p.expires_on, 'long')}
                        {days !== null && ` (${days} days)`}
                      </span>
                    </span>
                    {who && (
                      <span className="side">
                        <Link className="btn sm primary" href={`/console/clients/${who.id}`}>Open</Link>
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
              <h2>Every package sold</h2>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Package</th>
                  <th className="num">Used</th>
                  <th className="num">Left</th>
                  <th className="num">Paid</th>
                  <th className="num">Owed</th>
                  <th>Expires</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map(p => {
                  const who = p.patient as { id: string; first_name: string; last_name: string } | null;
                  const days = daysUntil(p.expires_on);
                  return (
                    <tr key={p.id}>
                      <td>
                        {who
                          ? <Link href={`/console/clients/${who.id}`}>{who.first_name} {who.last_name}</Link>
                          : <span className="dim">—</span>}
                      </td>
                      <td><b>{p.package_name}</b></td>
                      <td className="num">{p.sessionsUsed}</td>
                      <td className="num"><b>{p.sessionsRemaining}</b></td>
                      <td className="num">{money(Number(p.price_paid_cents))}</td>
                      <td className="num">{p.liabilityCents ? money(p.liabilityCents) : '—'}</td>
                      <td className={`num${days !== null && days <= 90 ? ' warnc' : ''}`}>
                        {p.expires_on ? dateLabel(p.expires_on, 'md') : <span className="dim">none</span>}
                      </td>
                      <td>
                        <span
                          className="pill"
                          data-tone={p.sessionsRemaining === 0 ? 'ok' : 'accent'}
                        >
                          <i className="dot" />
                          {p.sessionsRemaining === 0 ? 'complete' : titleCase(String(p.status))}
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
          <div className="eyebrow quiet">Why this is computed, not stored</div>
          <p className="muted" style={{ fontSize: '.86rem', lineHeight: 1.6 }}>
            Sessions remaining is derived from redemptions every time rather than kept
            in a counter. A counter drifts, and a drifted counter here means either
            giving treatments away or refusing one somebody paid for. The database also
            refuses to redeem more sessions than were sold.
          </p>
        </div>
      </div>
    </>
  );
}
