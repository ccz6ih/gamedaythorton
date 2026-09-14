/**
 * app/console/page.tsx — the Scoreboard
 *
 * Built for two minutes on a phone with coffee in hand. If the owner has to
 * navigate to find out whether the business is up or down, this screen has
 * failed. docs/03-owner-journey.md.
 *
 * Practice-type aware. A men's-health clinic leads with MRR and months retained;
 * a med spa leads with revenue, outstanding prepaid liability and rebooking rate,
 * because that is what actually governs its cash position.
 */

import Link from 'next/link';
import { getClinic, getScoreboard, getAttention, hasModule } from '@/lib/db/queries';
import { vocab } from '@/components/Brand';
import { money, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

function Stat({
  label, value, unit, note, delta, deltaTone, hero, provisional
}: {
  label: string; value: string | number; unit?: string; note?: string;
  delta?: string; deltaTone?: 'up' | 'down' | 'flat'; hero?: boolean; provisional?: boolean;
}) {
  return (
    <div className={`stat${hero ? ' hero' : ''}`}>
      <div className="lab">
        {label}
        {provisional && (
          <span className="pill" data-tone="warn" style={{ fontSize: '.58rem' }}>est</span>
        )}
      </div>
      <div className="stat-val">
        {value}
        {unit && <small> {unit}</small>}
      </div>
      {delta && <div className={`delta ${deltaTone ?? 'flat'}`}>{delta}</div>}
      {note && <div className="note">{note}</div>}
    </div>
  );
}

export default async function ScoreboardPage() {
  const clinic = await getClinic();
  if (!clinic) {
    return (
      <div className="view">
        <div className="card critical">
          <h2>No clinic is visible to this account</h2>
          <p className="muted">
            The signed-in user is not linked to a clinic. Run{' '}
            <span className="mono">node scripts/db-users.cjs</span> after seeding.
          </p>
        </div>
      </div>
    );
  }

  const [board, attention] = await Promise.all([getScoreboard(clinic), getAttention(clinic)]);
  const words = vocab(clinic);

  const revenueDelta = board.revenuePrev30Cents
    ? Math.round((board.revenue30Cents / board.revenuePrev30Cents) * 100)
    : null;

  const isMembership = hasModule(clinic, 'memberships') && board.activeMembers > 0;

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{words.console}</div>
          <h1>{words.dashboard}</h1>
        </div>
        <div className="spacer" />
        <Link className="btn" href="/console/today">Today</Link>
      </header>

      <div className="view">
        <div className="grid g4">
          <Stat
            label="Collected, last 30 days"
            value={money(board.revenue30Cents, { compact: true })}
            hero
            delta={revenueDelta !== null ? `${revenueDelta}% of the month before` : undefined}
            deltaTone={revenueDelta === null ? 'flat' : revenueDelta >= 100 ? 'up' : 'down'}
            note={`${board.failedPayments} declined payment${board.failedPayments === 1 ? '' : 's'}`}
          />

          {isMembership ? (
            <Stat
              label="Avg months retained"
              value={num(board.avgMonthsRetained, 1)}
              hero
              note="The number that actually governs a membership business"
            />
          ) : (
            <Stat
              label="Prepaid liability"
              value={money(board.packageLiabilityCents, { compact: true })}
              hero
              note="Money taken for sessions not yet delivered"
            />
          )}

          {isMembership ? (
            <Stat
              label="Active members"
              value={board.activeMembers}
              note={`${board.pausedMembers} paused · ${board.cancelledMembers} cancelled all-time`}
            />
          ) : (
            <Stat
              label="MRR"
              value={money(board.mrrCents, { compact: true })}
              note={board.activeMembers ? `${board.activeMembers} on a plan` : 'No recurring plans yet'}
              provisional
            />
          )}

          <Stat
            label="Today"
            value={board.todayCount}
            unit="visits"
            note={
              board.todayMissingIntake
                ? `${board.todayMissingIntake} without intake done`
                : 'All intakes complete'
            }
          />

          {/* What is coming, which the dashboard could not say before. A
              booking taken online for next Tuesday appeared nowhere until
              Tuesday — on a practice whose website exists so that bookings
              arrive unattended, that is the wrong thing to be silent about. */}
          <Stat
            label="Booked ahead"
            value={board.upcomingCount}
            unit={board.upcomingCount === 1 ? 'appointment' : 'appointments'}
            note={
              board.newBookings
                ? `${board.newBookings} came in today`
                : board.upcomingOnline
                  ? `${board.upcomingOnline} booked on the website`
                  : 'Nothing new since yesterday'
            }
          />
        </div>

        {attention.length > 0 && (
          <section className="card flush">
            <div className="card-head">
              <div>
                <div className="eyebrow">Needs you today</div>
                <h2>Top {Math.min(3, attention.length)} by consequence</h2>
                <p>
                  Ranked by what it costs to ignore, not by when it arrived.
                </p>
              </div>
            </div>
            <div className="list">
              {attention.slice(0, 3).map((item, i) => (
                <Link className="item" data-tone={item.tone} href={item.href} key={i}>
                  <span className="body">
                    <span className="ttl">{item.text}</span>
                    <span className="sub">{item.who}</span>
                  </span>
                  <span className="side">›</span>
                </Link>
              ))}
            </div>
            {attention.length > 3 && (
              <p className="metric-note" style={{ padding: '0 var(--gd-5) var(--gd-4)' }}>
                {attention.length - 3} more across the clinical and money queues.
              </p>
            )}
          </section>
        )}

        <div className="section-title">Open queues</div>
        <div className="grid g4">
          <Link className="stat" href="/console/today" style={{ cursor: 'pointer' }}>
            <div className="lab">Open tasks</div>
            <div className="stat-val">{board.openTasks}</div>
            {board.highPriorityTasks > 0 && (
              <div className="delta down">{board.highPriorityTasks} high priority</div>
            )}
          </Link>
          <Link className="stat" href="/console/clients" style={{ cursor: 'pointer' }}>
            <div className="lab">Unread messages</div>
            <div className="stat-val">{board.unreadMessages}</div>
          </Link>
          {hasModule(clinic, 'treatment_records') && (
            <div className="stat" style={board.adverseEvents ? { borderColor: 'var(--gd-critical)' } : undefined}>
              <div className="lab">Adverse events</div>
              <div className="stat-val">{board.adverseEvents}</div>
              <div className="note">Recorded, with follow-ups tracked</div>
            </div>
          )}
          {hasModule(clinic, 'packages') && (
            <div className="stat">
              <div className="lab">Prepaid liability</div>
              <div className="stat-val">{money(board.packageLiabilityCents, { compact: true })}</div>
              <div className="note">Must survive any platform migration</div>
            </div>
          )}
        </div>

        <p className="metric-note" style={{ marginTop: 'var(--gd-6)' }}>
          Every figure here is computed in one place and read as you, so no screen can
          see another practice&rsquo;s data. Values marked{' '}
          <span className="mono">est</span> are placeholder pricing.
        </p>
      </div>
    </>
  );
}
