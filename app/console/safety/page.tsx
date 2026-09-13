/**
 * app/console/safety/page.tsx
 * The clinically important queue.
 *
 * Every threshold behind this screen is a PROVISIONAL placeholder and the banner
 * says so. A provider who spots an assumed safety threshold presented as fact
 * loses confidence in the entire system, and they are right to.
 * docs/11-discovery-questions.md §3.
 */

import Link from 'next/link';
import { getClinic, getSafetyQueue, hasModule } from '@/lib/db/queries';
import { dateLabel, relative } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SafetyPage() {
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const rows = await getSafetyQueue(clinic);
  const critical = rows.filter(r => r.tone === 'critical');

  // Group by person: a provider thinks about a patient, not about a finding.
  const byPatient = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    (acc[r.patientId] ??= []).push(r);
    return acc;
  }, {});

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">Clinical</div>
          <h1>Safety queue</h1>
        </div>
        <div className="spacer" />
        {critical.length > 0 && (
          <span className="pill" data-tone="critical"><i className="dot" />{critical.length} need review now</span>
        )}
      </header>

      <div className="view wide">
        <div className="note-band warn">
          <b>Every threshold here is a provisional placeholder.</b>{' '}
          {hasModule(clinic, 'labs')
            ? 'Hematocrit ceiling 52%, PSA velocity 0.75 ng/mL/yr, estradiol against the lab reference range. '
            : ''}
          Get this practice&rsquo;s real numbers before production — do not ship our
          assumptions.
        </div>

        <div className="grid g3" style={{ marginTop: 'var(--gd-5)' }}>
          <div className="stat" style={critical.length ? { borderColor: 'var(--gd-critical)' } : undefined}>
            <div className="lab">Need review now</div>
            <div className="stat-val">{critical.length}</div>
          </div>
          <div className="stat">
            <div className="lab">Watching</div>
            <div className="stat-val">{rows.length - critical.length}</div>
          </div>
          <div className="stat">
            <div className="lab">People affected</div>
            <div className="stat-val">{Object.keys(byPatient).length}</div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="big" aria-hidden="true">✓</div>
              <h3>Nothing flagged</h3>
              <p>
                {hasModule(clinic, 'labs')
                  ? 'Out-of-range labs, PSA velocity, adverse events and unread check-in notes all surface here automatically — nobody has to go looking.'
                  : 'Adverse events and unread client notes surface here automatically — nobody has to go looking.'}
              </p>
            </div>
          </div>
        ) : (
          Object.entries(byPatient).map(([patientId, findings]) => {
            const worst = findings.some(f => f.tone === 'critical') ? 'critical' : 'warn';
            return (
              <section className={`card ${worst === 'critical' ? 'critical' : 'warn'} flush`} key={patientId}>
                <div className="card-head">
                  <div>
                    <div className="eyebrow">
                      {worst === 'critical' ? 'Needs review now' : 'Watching'}
                    </div>
                    <h2>
                      <Link href={`/console/clients/${patientId}`}>{findings[0]!.patientName}</Link>
                    </h2>
                    <p>{findings.length} finding{findings.length === 1 ? '' : 's'}</p>
                  </div>
                  <Link className="btn sm" href={`/console/clients/${patientId}`}>Open chart</Link>
                </div>
                <div className="list">
                  {findings.map((f, i) => (
                    <div className="item" data-tone={f.tone} key={i}>
                      <span className="body">
                        <span className="ttl">{f.what}</span>
                        {f.detail ? <span className="sub">{f.detail}</span> : null}
                      </span>
                      {f.when && (
                        <span className="side">
                          {dateLabel(f.when, 'md')}
                          <br />
                          <span className="dim" style={{ fontSize: '.72rem' }}>{relative(f.when)}</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}

        <div className="card">
          <div className="eyebrow quiet">Why this exists</div>
          <p className="muted" style={{ fontSize: '.86rem', lineHeight: 1.6 }}>
            A clinic that volunteers what it is watching for reads as more competent
            than one that only shows good news. This queue is also the argument for
            surfacing the same trends to the patient: monitoring nobody sees is
            indistinguishable from monitoring nobody does.
          </p>
        </div>
      </div>
    </>
  );
}
