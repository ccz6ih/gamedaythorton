/**
 * app/portal/page.tsx — the patient / client side
 *
 * Its job in month four is to show him month one.
 *
 * Ordering rule: the contrast against baseline comes before the current value,
 * always. A screen that leads with "your energy is 7" has already lost the
 * argument — hedonic adaptation is the churn mechanism, so restoring the contrast
 * is the product. docs/00-brief.md.
 *
 * For a med spa the same principle applies with different evidence: what has been
 * done, what is still prepaid, and the photo series.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentViewer, serverClient } from '@/lib/supabase/server';
import { getClinic, getPortalHome, thenVsNow, checkinAverage, hasModule } from '@/lib/db/queries';
import { Brand, vocab } from '@/components/Brand';
import { PilotBanner } from '@/components/PilotBanner';
import { dateLabel, timeLabel, money, num, signed, relative, titleCase, daysUntil } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function signOut() {
  'use server';
  const supabase = await serverClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}

export default async function PortalPage() {
  const viewer = await currentViewer();
  if (!viewer) redirect('/sign-in?next=/portal');
  if (viewer.kind !== 'patient') redirect('/console');

  const clinic = await getClinic();
  const home = await getPortalHome(viewer.patientId);
  const words = vocab(clinic);

  if (!home.patient) {
    return (
      <div className="p-shell">
        <div className="card"><p>We could not load your record. Please contact the clinic.</p></div>
      </div>
    );
  }

  const contrast = thenVsNow(home.checkins as Record<string, unknown>[]);
  const latestCheckin = home.checkins[home.checkins.length - 1] as Record<string, unknown> | undefined;
  const firstCheckin = home.checkins[0] as Record<string, unknown> | undefined;
  const openPackages = home.packages.filter(p => p.sessionsRemaining > 0);
  const latestPanel = home.labPanels[home.labPanels.length - 1] as Record<string, unknown> | undefined;

  return (
    <Brand clinic={clinic}>
      <PilotBanner pilotMode={process.env.PILOT_MODE !== 'false'} />
      <div className="shell" data-app="patient">
        <div className="main">
          <div className="p-shell">
            <div className="p-top">
              <span className="av" aria-hidden="true">
                {String(home.patient.first_name ?? '?').slice(0, 1)}
              </span>
              <div className="who">
                {clinic?.name}
                <b>{String(home.patient.first_name)}</b>
              </div>
              <div className="spacer" style={{ flex: 1 }} />
              <form action={signOut}>
                <button className="btn ghost sm" type="submit">Sign out</button>
              </form>
            </div>

            {/* Contrast first, always. */}
            {contrast && (
              <section className="contrast">
                <h2>Where you started → where you are</h2>
                <div className="cgrid">
                  {contrast.map(c => {
                    const cls = c.delta > 0 ? 'up' : c.delta < 0 ? 'down' : 'flat';
                    return (
                      <div className="cell" key={c.key}>
                        <div className="name">{c.label}</div>
                        <div className="vals">
                          <span className="then num">{c.then}</span>
                          <span className="arrow">→</span>
                          <span className={`now num ${cls}`}>{c.now}</span>
                        </div>
                        <div className={`delta ${cls}`}>{signed(c.delta, 0)} points</div>
                      </div>
                    );
                  })}
                </div>
                {firstCheckin && latestCheckin && (
                  <p className="dim" style={{ fontSize: '.8rem', marginTop: '1rem', lineHeight: 1.5 }}>
                    Overall {num(checkinAverage(firstCheckin), 1)} → {num(checkinAverage(latestCheckin), 1)} out of 10
                    since your first week.
                  </p>
                )}
              </section>
            )}

            {/* Med spa: what has been done, and what is still owed to you. */}
            {home.treatments.length > 0 && (
              <section className="card" style={{ marginTop: '1rem' }}>
                <div className="eyebrow">Your treatments</div>
                <div className="stack tight" style={{ marginTop: '.6rem' }}>
                  {home.treatments.map((t: Record<string, unknown>) => {
                    const service = t.service as { name?: string } | null;
                    return (
                      <div className="labcard" key={String(t.id)}>
                        <div className="row between">
                          <b>{service?.name ?? 'Treatment'}</b>
                          <span className="dim" style={{ fontSize: '.78rem' }}>
                            {relative(String(t.performed_at))}
                          </span>
                        </div>
                        {t.notes_patient_facing ? (
                          <div className="read">{String(t.notes_patient_facing)}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* A practice that has just moved systems has clients with no history
                here yet, and every one of them opens this page for the first
                time. An omitted section reads as a broken page; saying there is
                nothing yet reads as a new page. */}
            {openPackages.length === 0 && (
              <section className="card" style={{ marginTop: '1rem' }}>
                <div className="eyebrow">Prepaid</div>
                <p className="muted" style={{ fontSize: '.9rem', margin: 0 }}>
                  No prepaid sessions on your account. If you buy a package it
                  shows here, with how many sessions are left.
                </p>
              </section>
            )}

            {openPackages.length > 0 && (
              <section className="card accent" style={{ marginTop: '1rem' }}>
                <div className="eyebrow">Prepaid and waiting for you</div>
                {openPackages.map(pk => {
                  const days = daysUntil(pk.expires_on);
                  return (
                    <div key={pk.id} style={{ marginTop: '.5rem' }}>
                      <div style={{ fontWeight: 700 }}>{pk.package_name}</div>
                      <div className="muted" style={{ fontSize: '.86rem' }}>
                        {pk.sessionsRemaining} of {pk.sessions_total} sessions left
                        {pk.expires_on && days !== null && (
                          <> · use by {dateLabel(pk.expires_on, 'long')}</>
                        )}
                      </div>
                      {days !== null && days < 90 && (
                        <div className="note-band warn" style={{ marginTop: '.6rem' }}>
                          You have already paid for these. Worth booking them in before
                          {days > 0 ? ` the ${dateLabel(pk.expires_on, 'md')} deadline` : ' they expire'}.
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {/* Next visit. */}
            <div className="grid g2" style={{ marginTop: '1rem' }}>
              {home.nextAppointment ? (
                <div className="stat">
                  <div className="lab">Next visit</div>
                  <div className="stat-val" style={{ fontSize: 'var(--gd-step-1)' }}>
                    {dateLabel(String(home.nextAppointment.starts_at), 'dow')}
                  </div>
                  <div className="note">
                    {timeLabel(String(home.nextAppointment.starts_at), clinic?.timezone)} ·{' '}
                    {(home.nextAppointment.service as { name?: string } | null)?.name ?? 'Visit'}
                  </div>
                </div>
              ) : (
                <div className="stat">
                  <div className="lab">Next visit</div>
                  <div className="stat-val" style={{ fontSize: 'var(--gd-step-1)' }}>Not booked</div>
                  <div className="note">Nothing on the books yet</div>
                </div>
              )}

              {hasModule(clinic, 'protocols') && home.protocolItems.length > 0 && (
                <div className="stat">
                  <div className="lab">Current plan</div>
                  <div className="stat-val" style={{ fontSize: 'var(--gd-step-1)' }}>
                    {String(home.protocolItems[0]?.medication_name ?? '')}
                  </div>
                  <div className="note">
                    {num(Number(home.protocolItems[0]?.dose_amount))}
                    {String(home.protocolItems[0]?.dose_unit ?? '')} ·{' '}
                    {String(home.protocolItems[0]?.frequency ?? '')}
                  </div>
                </div>
              )}
            </div>

            {/* Labs, safety analytes first. */}
            {hasModule(clinic, 'labs') && latestPanel && (
              <section className="card" style={{ marginTop: '1rem' }}>
                <div className="eyebrow">Drawn {dateLabel(String(latestPanel.drawn_at), 'long')}</div>
                <h2 style={{ fontSize: 'var(--gd-step-1)', fontWeight: 700, marginBottom: '.3rem' }}>
                  Your numbers
                </h2>
                <p className="muted" style={{ fontSize: '.84rem', marginBottom: '1rem' }}>
                  The target range is what your clinic aims for. It is not the same as
                  the lab&rsquo;s own reference range, and the difference matters.
                </p>
                <div className="grid g2">
                  {home.labResults
                    .filter((r: Record<string, unknown>) => r.panel_id === latestPanel.id)
                    .map((r: Record<string, unknown>) => (
                      <div className="labcard" data-flag={String(r.flag)} key={String(r.id)}>
                        <div className="lname">
                          <span>{titleCase(String(r.analyte_key))}</span>
                          {(r.flag === 'critical' || r.flag === 'above_ref') && (
                            <span className="pill" data-tone="warn"><i className="dot" />watching</span>
                          )}
                        </div>
                        <div className="lval num">
                          {num(Number(r.value_numeric))}
                          <small>{String(r.unit ?? '')}</small>
                        </div>
                        <div className="read">
                          Your clinic aims for {num(Number(r.target_low))}–{num(Number(r.target_high))}{' '}
                          {String(r.unit ?? '')}.
                        </div>
                      </div>
                    ))}
                </div>
                <p className="dim" style={{ fontSize: '.76rem', marginTop: '1rem' }}>
                  Target ranges shown here are provisional pilot placeholders, not this
                  clinic&rsquo;s published values.
                </p>
              </section>
            )}

            {home.membership && (
              <section className="card" style={{ marginTop: '1rem' }}>
                <div className="eyebrow quiet">Membership</div>
                <dl className="kv" style={{ marginTop: '.5rem' }}>
                  <dt>Status</dt><dd>{titleCase(String(home.membership.status))}</dd>
                  <dt>Started</dt><dd>{dateLabel(String(home.membership.started_at), 'long')}</dd>
                  <dt>Monthly</dt><dd className="num">{money(Number(home.membership.mrr_cents))}</dd>
                </dl>
              </section>
            )}

            <section className="card" style={{ marginTop: '1rem' }}>
              <div className="eyebrow quiet">Privacy</div>
              <p className="muted" style={{ fontSize: '.86rem', lineHeight: 1.6 }}>
                Notifications from us never contain clinical detail. They say you have
                an update, and nothing else — so nobody glancing at your phone learns
                anything. Your card statement shows the practice name and nothing
                about what you were treated for.
              </p>
            </section>

            <p className="dim" style={{ fontSize: '.76rem', marginTop: '1rem', textAlign: 'center' }}>
              <Link href="/about-pilot" className="banner-link">Why this says &ldquo;pilot&rdquo;</Link>
            </p>
          </div>
        </div>
      </div>
    </Brand>
  );
}
