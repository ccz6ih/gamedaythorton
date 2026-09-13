/**
 * app/console/clients/[id]/page.tsx — the chart
 *
 * The screen a provider opens before walking into the room. One timeline, so the
 * question "what happened to this person" is answered without clicking.
 *
 * Practice-type aware: labs, protocol and check-ins for a men's-health clinic;
 * treatment records with areas, units and lot numbers, plus prepaid balances, for
 * a med spa.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClinic, getChart, hasModule } from '@/lib/db/queries';
import { vocab } from '@/components/Brand';
import { dateLabel, relative, money, num, titleCase, phone, initials, daysUntil } from '@/lib/format';
import { serverClient } from '@/lib/supabase/server';
import { signedPhotoUrls } from '@/lib/client-media';
import { ClientNotes, type NoteRow } from '@/components/ClientNotes';
import { ClientPhoto } from '@/components/ClientPhoto';

export const dynamic = 'force-dynamic';

type TimelineEvent = {
  at: string;
  kind: 'visit' | 'lab' | 'dose' | 'flag' | 'treatment' | 'money';
  what: string;
  detail?: string | null;
};

export default async function ChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clinic = await getClinic();
  const chart = await getChart(id);

  // RLS returns nothing rather than refusing, so an out-of-tenant id looks
  // identical to a nonexistent one — which is the correct behaviour: a 403 would
  // confirm the record exists somewhere.
  if (!clinic || !chart.patient) notFound();

  const p = chart.patient as Record<string, string | null>;
  const words = vocab(clinic);
  const name = `${p.first_name} ${p.last_name}`;

  /* ------------------------------------------------------------ timeline -- */
  const events: TimelineEvent[] = [];

  chart.appointments.forEach((a: Record<string, unknown>) => {
    const service = a.service as { name?: string } | null;
    events.push({
      at: String(a.starts_at),
      kind: a.status === 'no_show' ? 'flag' : 'visit',
      what: `${service?.name ?? 'Visit'}${a.status === 'no_show' ? ' — no-show' : ''}`,
      detail: titleCase(String(a.status))
    });
  });

  chart.treatments.forEach((t: Record<string, unknown>) => {
    const details = chart.treatmentDetails.filter(
      (d: Record<string, unknown>) => d.treatment_record_id === t.id
    );
    const areas = details
      .map((d: Record<string, unknown>) =>
        d.units ? `${d.area} ${d.units}u` : String(d.area))
      .join(', ');
    events.push({
      at: String(t.performed_at),
      kind: t.adverse_event ? 'flag' : 'treatment',
      what: t.adverse_event ? 'Treatment — adverse event recorded' : 'Treatment',
      detail: [areas, t.adverse_event_note, t.notes_clinical].filter(Boolean).join(' · ')
    });
  });

  chart.labPanels.forEach((panel: Record<string, unknown>) => {
    const values = chart.labResults.filter(
      (r: Record<string, unknown>) => r.panel_id === panel.id
    );
    const flagged = values.filter((r: Record<string, unknown>) =>
      r.flag === 'critical' || r.flag === 'above_ref' || r.flag === 'below_ref');
    events.push({
      at: String(panel.drawn_at),
      kind: flagged.length ? 'flag' : 'lab',
      what: `Lab panel — ${values.length} values`,
      detail: [panel.note, flagged.length ? `${flagged.length} outside range` : null]
        .filter(Boolean).join(' · ')
    });
  });

  chart.protocolChanges.forEach((c: Record<string, unknown>) => {
    events.push({
      at: String(c.changed_at),
      kind: 'dose',
      what: c.old_value ? `${c.old_value} → ${c.new_value}` : `Started ${c.new_value}`,
      detail: String(c.reason_clinical ?? '')
    });
  });

  chart.checkins
    .filter((c: Record<string, unknown>) => c.notes_free_text)
    .forEach((c: Record<string, unknown>) => {
      events.push({
        at: String(c.week_of),
        kind: 'flag',
        what: 'Check-in note',
        detail: `“${c.notes_free_text}”`
      });
    });

  events.sort((a, b) => b.at.localeCompare(a.at));

  const openPackages = chart.packages.filter(
    (pk: Record<string, unknown>) => Number(pk.sessionsRemaining) > 0
  );
  const failedPayment = chart.payments.find(
    (pay: Record<string, unknown>) => pay.status === 'failed'
  );
  const adverse = chart.treatments.find((t: Record<string, unknown>) => t.adverse_event);

  /* -------------------------------------------------------------- notes -- */
  // Read here rather than inside getChart because notes and their photographs
  // need signed URLs, and getChart is also used by screens that do not render
  // images — minting signed URLs nobody looks at is work and a small exposure.
  const supabase = await serverClient();

  const [{ data: noteRows }, { data: notePhotos }, { data: serviceRows }] = await Promise.all([
    supabase.from('client_note').select('*').eq('patient_id', id)
      .order('performed_at', { ascending: false }).order('created_at'),
    supabase.from('photo').select('id, note_id, pose_key, storage_path')
      .eq('patient_id', id).not('note_id', 'is', null),
    supabase.from('service').select('id, name').eq('clinic_id', clinic.id)
      .eq('active', true).order('name')
  ]);

  // One round trip for every image on the page, including the face.
  const urls = await signedPhotoUrls([
    p.photo_path ?? null,
    ...(notePhotos ?? []).map(ph => ph.storage_path as string | null)
  ]);

  const faceUrl = p.photo_path ? urls.get(p.photo_path) ?? null : null;

  const photosByNote = new Map<string, { id: string; pose_key: string; url: string | null }[]>();
  for (const ph of notePhotos ?? []) {
    const key = String(ph.note_id);
    if (!photosByNote.has(key)) photosByNote.set(key, []);
    photosByNote.get(key)!.push({
      id: String(ph.id),
      pose_key: String(ph.pose_key),
      url: ph.storage_path ? urls.get(String(ph.storage_path)) ?? null : null
    });
  }

  const notes: NoteRow[] = (noteRows ?? []).map(n => ({
    ...(n as unknown as NoteRow),
    photos: photosByNote.get(String(n.id)) ?? []
  }));

  /* ----------------------------------------------------------- birthday -- */
  // Month and day, never a year — the year is genuinely unknown for imported
  // clients and inventing one would be worse than leaving it out. See 0019.
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                  'August', 'September', 'October', 'November', 'December'];
  const bm = (p as unknown as { birth_month?: number | null }).birth_month;
  const bd = (p as unknown as { birth_day?: number | null }).birth_day;
  const birthday = bm && bd ? `${MONTHS[bm - 1]} ${bd}` : null;

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">
            <Link href="/console/clients" className="banner-link">{words.people}</Link>
          </div>
          <h1>{name}</h1>
        </div>
        <div className="spacer" />
        <div className="row tight">
          <Link className="btn sm" href={`/console/clients/new?id=${id}`}>Edit</Link>
          <Link className="btn sm" href={`/console/book?patient=${id}`}>Book</Link>
          {hasModule(clinic, 'treatment_records') && (
            <Link className="btn sm primary" href={`/console/treatments/new?patient=${id}`}>
              Record treatment
            </Link>
          )}
          {hasModule(clinic, 'labs') && (
            <Link className="btn sm primary" href={`/console/labs?patient=${id}`}>Enter labs</Link>
          )}
        </div>
      </header>

      <div className="view wide">
        <section className={`card${adverse ? ' critical' : ''}`}>
          <div className="row" style={{ gap: '1rem', alignItems: 'flex-start' }}>
            <ClientPhoto patientId={id} name={name} url={faceUrl} />
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <div style={{ fontSize: 'var(--gd-step-1)', fontWeight: 700 }}>{name}</div>
              <div className="muted" style={{ fontSize: '.86rem' }}>
                {phone(p.phone)}{p.email ? ` · ${p.email}` : ''}
              </div>
              <div className="row tight" style={{ marginTop: '.5rem' }}>
                <span className="pill">Since {dateLabel(p.created_at, 'md')}</span>
                {birthday && <span className="pill">Birthday {birthday}</span>}
                {p.acquisition_source && (
                  <span className="pill">via {titleCase(p.acquisition_source)}</span>
                )}
                {chart.membership && (
                  <span className="pill" data-tone={chart.membership.status === 'active' ? 'ok' : 'warn'}>
                    <i className="dot" />{titleCase(chart.membership.status)} membership
                  </span>
                )}
              </div>
            </div>
          </div>

          {adverse && (
            <div className="note-band critical" style={{ marginTop: '1rem' }}>
              <b>Adverse event on record.</b> {String(adverse.adverse_event_note ?? '')}
              {adverse.follow_up_due != null && (
                <> Follow-up due {dateLabel(String(adverse.follow_up_due), 'long')}.</>
              )}
            </div>
          )}

          {failedPayment && (
            <div className="note-band warn" style={{ marginTop: '.6rem' }}>
              <b>Payment declined</b> — {money(Number(failedPayment.amount_cents))} on{' '}
              {dateLabel(String(failedPayment.created_at))}. Involuntary churn if nobody calls.
            </div>
          )}
        </section>

        {/* Treatment notes sit directly under the header, above everything
            else, because they are what the practitioner opens this screen to
            read before walking into the room. Append-only: see migration 0019
            and components/ClientNotes.tsx. */}
        <ClientNotes
          patientId={id}
          notes={notes}
          services={(serviceRows ?? []).map(s => ({ id: String(s.id), name: String(s.name) }))}
        />

        {/* Prepaid balances. Money already taken, sessions still owed. */}
        {hasModule(clinic, 'packages') && openPackages.length > 0 && (
          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Prepaid</div>
                <h2>Sessions still owed</h2>
                <p>Already paid for. The practice owes these treatments.</p>
              </div>
            </div>
            <div className="list">
              {openPackages.map((pk: Record<string, unknown>) => {
                const days = daysUntil(pk.expires_on as string | null);
                return (
                  <div className="item" data-tone={days !== null && days < 60 ? 'warn' : undefined} key={String(pk.id)}>
                    <span className="body">
                      <span className="ttl">{String(pk.package_name)}</span>
                      <span className="sub">
                        {String(pk.sessionsRemaining)} of {String(pk.sessions_total)} remaining ·
                        paid {money(Number(pk.price_paid_cents))}
                        {pk.expires_on != null && days !== null && (
                          <> · expires {dateLabel(String(pk.expires_on), 'md')} ({days} days)</>
                        )}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Men's-health clinical block. */}
        {hasModule(clinic, 'labs') && chart.labPanels.length > 0 && (
          <section className="card flush">
            <div className="card-head">
              <div>
                <div className="eyebrow">Labs</div>
                <h2>Every draw, side by side</h2>
                <p>
                  Flagged against the clinic target and the lab reference range —
                  which are different things, and conflating them is how a patient
                  panics over a value his provider is happy with.
                </p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Analyte</th>
                    {chart.labPanels.map((panel: Record<string, unknown>) => (
                      <th className="num" key={String(panel.id)}>
                        {dateLabel(String(panel.drawn_at), 'md')}
                      </th>
                    ))}
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {[...new Set(chart.labResults.map((r: Record<string, unknown>) => String(r.analyte_key)))]
                    .map(key => {
                      const forKey = chart.labResults.filter(
                        (r: Record<string, unknown>) => r.analyte_key === key
                      );
                      const sample = forKey[0] as Record<string, unknown> | undefined;
                      return (
                        <tr key={key}>
                          <td className="an">{titleCase(key)}</td>
                          {chart.labPanels.map((panel: Record<string, unknown>) => {
                            const hit = forKey.find(
                              (r: Record<string, unknown>) => r.panel_id === panel.id
                            ) as Record<string, unknown> | undefined;
                            if (!hit) return <td className="dim" key={String(panel.id)}>—</td>;
                            const cls =
                              hit.flag === 'critical' ? 'down' :
                              hit.flag === 'above_ref' || hit.flag === 'below_ref' ? 'warnc' : '';
                            return (
                              <td className={`num ${cls}`} key={String(panel.id)}>
                                <b>{num(Number(hit.value_numeric))}</b>
                              </td>
                            );
                          })}
                          <td className="rng">
                            {sample ? `${num(Number(sample.target_low))}–${num(Number(sample.target_high))} ${sample.unit ?? ''}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: 'var(--gd-4) var(--gd-5)' }}>
              <div className="note-band warn">
                Every range in this dataset is a provisional placeholder. Get the
                clinic&rsquo;s real target ranges and safety thresholds before
                production — <span className="mono">docs/11-discovery-questions.md §3</span>.
              </div>
            </div>
          </section>
        )}

        {hasModule(clinic, 'protocols') && chart.protocolItems.length > 0 && (
          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Current</div>
                <h2>{words.plan}</h2>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Medication</th><th>Dose</th><th>Route</th><th>Frequency</th></tr>
                </thead>
                <tbody>
                  {chart.protocolItems.map((it: Record<string, unknown>) => (
                    <tr key={String(it.id)}>
                      <td><b>{String(it.medication_name)}</b></td>
                      <td className="num">{num(Number(it.dose_amount))} {String(it.dose_unit ?? '')}</td>
                      <td>{String(it.route ?? '')}</td>
                      <td>{String(it.frequency ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="note-band" style={{ marginTop: '1rem' }}>
              <b>This records what a licensed provider decided elsewhere.</b> There is
              no prescribing, no e-prescribing and no pharmacy transmission anywhere
              in this system. Testosterone is Schedule III and that stays in the
              clinical system of record.
            </div>
          </section>
        )}

        {/* Med spa clinical block. */}
        {hasModule(clinic, 'treatment_records') && chart.treatments.length > 0 && (
          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Treatments</div>
                <h2>What was done, where, and from which lot</h2>
                <p>
                  For injectables the lot linkage is a record-keeping requirement,
                  not a note.
                </p>
              </div>
            </div>
            <div className="stack">
              {chart.treatments.map((t: Record<string, unknown>) => {
                const details = chart.treatmentDetails.filter(
                  (d: Record<string, unknown>) => d.treatment_record_id === t.id
                );
                return (
                  <div className="labcard" data-flag={t.adverse_event ? 'critical' : undefined} key={String(t.id)}>
                    <div className="row between">
                      <div>
                        <b>{dateLabel(String(t.performed_at), 'long')}</b>
                        {t.total_units ? (
                          <span className="pill" style={{ marginLeft: '.5rem' }}>
                            {num(Number(t.total_units), 0)} units total
                          </span>
                        ) : null}
                      </div>
                      {t.adverse_event ? (
                        <span className="pill" data-tone="critical"><i className="dot" />adverse event</span>
                      ) : null}
                    </div>
                    {details.length > 0 && (
                      <div className="table-scroll" style={{ marginTop: '.7rem' }}>
                        <table>
                          <thead>
                            <tr><th>Area</th><th className="num">Units</th><th>Product</th><th>Technique</th></tr>
                          </thead>
                          <tbody>
                            {details.map((d: Record<string, unknown>) => (
                              <tr key={String(d.id)}>
                                <td>{String(d.area)}</td>
                                <td className="num">{d.units ? num(Number(d.units), 0) : '—'}</td>
                                <td className="dim">{String(d.product_name ?? '—')}</td>
                                <td className="dim">{String(d.technique ?? d.depth ?? '—')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {t.notes_clinical ? (
                      <div className="note-band" style={{ marginTop: '.7rem' }}>
                        <b>Clinical:</b> {String(t.notes_clinical)}
                      </div>
                    ) : null}
                    {t.notes_patient_facing ? (
                      <div className="note-band" style={{ marginTop: '.4rem' }}>
                        <b>Shared with the client:</b> {String(t.notes_patient_facing)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">{events.length} events</div>
              <h2>Everything, one axis</h2>
              <p>Newest first. Visits, treatments, labs, dose changes, notes.</p>
            </div>
          </div>
          <div className="timeline">
            {events.map((e, i) => (
              <div className="tl-item" data-kind={e.kind} key={i}>
                <div className="when">{dateLabel(e.at, 'long')} · {relative(e.at)}</div>
                <div className="what">{e.what}</div>
                {e.detail ? <div className="detail">{e.detail}</div> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
