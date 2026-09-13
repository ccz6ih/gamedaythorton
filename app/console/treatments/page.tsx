/**
 * app/console/treatments/page.tsx
 *
 * The med spa's clinical record: what was done, to which areas, how much product,
 * from which lot. For injectables the lot linkage is a record-keeping requirement
 * rather than a nicety — if a manufacturer recalls a lot, this is the screen that
 * answers "who received it".
 */

import Link from 'next/link';
import { getClinic, getTreatments } from '@/lib/db/queries';
import { dateLabel, relative, num, titleCase } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function TreatmentsPage() {
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const treatments = await getTreatments();
  const adverse = treatments.filter(t => t.adverse_event);
  const followUps = treatments.filter(t => t.follow_up_due);
  const totalUnits = treatments.reduce((s, t) => s + Number(t.total_units ?? 0), 0);

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{clinic.name}</div>
          <h1>Treatment records</h1>
        </div>
        <div className="spacer" />
        <Link className="btn primary" href="/console/treatments/new">Record a treatment</Link>
      </header>

      <div className="view wide">
        <div className="grid g4">
          <div className="stat">
            <div className="lab">Treatments</div>
            <div className="stat-val">{treatments.length}</div>
          </div>
          <div className="stat">
            <div className="lab">Units administered</div>
            <div className="stat-val">{num(totalUnits, 0)}</div>
            <div className="note">Reconcilable against inventory lots</div>
          </div>
          <div className="stat" style={adverse.length ? { borderColor: 'var(--gd-critical)' } : undefined}>
            <div className="lab">Adverse events</div>
            <div className="stat-val">{adverse.length}</div>
            <div className="note">Recorded as findings, not buried in notes</div>
          </div>
          <div className="stat">
            <div className="lab">Follow-ups due</div>
            <div className="stat-val">{followUps.length}</div>
          </div>
        </div>

        {treatments.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="big" aria-hidden="true">✎</div>
              <h3>No treatments recorded yet</h3>
              <p>
                Once a visit is completed, the treatment record captures the areas
                treated, units used and the lot number — which is what makes a recall
                answerable and a series comparable.
              </p>
            </div>
          </div>
        ) : (
          <div className="stack">
            {treatments.map(t => {
              // Supabase infers an array for an embedded relation unless it can
              // prove the join is to-one, so these go through `unknown`.
              const who = t.patient as unknown as { id: string; first_name: string; last_name: string } | null;
              const service = t.service as unknown as { name: string; category: string } | null;
              const provider = t.provider as unknown as { name: string } | null;
              return (
                <section className={`card${t.adverse_event ? ' critical' : ''}`} key={String(t.id)}>
                  <div className="card-head">
                    <div>
                      <div className="eyebrow">
                        {dateLabel(String(t.performed_at), 'long')} · {relative(String(t.performed_at))}
                      </div>
                      <h2>
                        {who
                          ? <Link href={`/console/clients/${who.id}`}>{who.first_name} {who.last_name}</Link>
                          : 'Unknown'}
                        {' — '}{service?.name ?? 'Treatment'}
                      </h2>
                      <p>
                        {provider?.name ? `${provider.name}` : ''}
                        {t.total_units ? ` · ${num(Number(t.total_units), 0)} units total` : ''}
                      </p>
                    </div>
                    {t.adverse_event ? (
                      <span className="pill" data-tone="critical"><i className="dot" />adverse event</span>
                    ) : null}
                  </div>

                  {t.details.length > 0 && (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Area</th>
                            <th className="num">Units</th>
                            <th>Product</th>
                            <th>Technique / depth</th>
                            <th>Lot</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.details.map(d => (
                            <tr key={String(d.id)}>
                              <td><b>{String(d.area)}</b></td>
                              <td className="num">{d.units ? num(Number(d.units), 0) : '—'}</td>
                              <td className="dim">{String(d.product_name ?? '—')}</td>
                              <td className="dim">{String(d.technique ?? d.depth ?? '—')}</td>
                              <td className="dim mono" style={{ fontSize: '.74rem' }}>
                                {d.lot_id ? 'linked' : <span className="warnc">not recorded</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {t.adverse_event_note ? (
                    <div className="note-band critical" style={{ marginTop: '1rem' }}>
                      <b>Adverse event:</b> {String(t.adverse_event_note)}
                      {t.follow_up_due ? <> Follow-up due {dateLabel(String(t.follow_up_due), 'long')}.</> : null}
                    </div>
                  ) : null}

                  {t.notes_clinical ? (
                    <div className="note-band" style={{ marginTop: '.6rem' }}>
                      <b>Clinical note:</b> {String(t.notes_clinical)}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}

        <div className="card">
          <div className="eyebrow quiet">About the lot column</div>
          <p className="muted" style={{ fontSize: '.86rem', lineHeight: 1.6 }}>
            A row marked <b>not recorded</b> means the product was logged without a lot.
            That is the one field worth chasing: if a manufacturer recalls a batch, the
            lot linkage is what answers &ldquo;who received it&rdquo; without
            reconstructing it from memory.
          </p>
        </div>
      </div>
    </>
  );
}
