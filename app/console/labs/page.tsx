/**
 * app/console/labs/page.tsx
 * Manual structured lab entry — and it genuinely writes.
 *
 * Manual entry is the design, not a fallback. Most projects of this shape die
 * trying to integrate HL7 on day one, and the trend charts do not care where the
 * numbers came from. Attaching a PDF is not structured entry: a PDF cannot be
 * charted, and the whole retention engine depends on charting.
 *
 * So this has to be fast enough that nobody resents it: one column of inputs, the
 * previous panel's value beside each row, both ranges visible, and flags computed
 * on save by the same rule the seeded data used — so a typed value flags
 * identically to a seeded one.
 *
 * VALIDATE AT GATE A: time a provider entering a real panel against whatever they
 * do now. If it is slower than their paper process, this has failed regardless of
 * how good the charts downstream look.
 */

import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { serverClient, currentViewer } from '@/lib/supabase/server';
import { getClinic, getAnalytes, getRecentPanels, getClients, flagFor } from '@/lib/db/queries';
import { dateLabel, relative, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function savePanel(formData: FormData) {
  'use server';

  const viewer = await currentViewer();
  if (!viewer || viewer.kind !== 'staff') redirect('/sign-in');

  const patientId = String(formData.get('patient_id') ?? '');
  const drawnAt = String(formData.get('drawn_at') ?? '');
  const note = String(formData.get('note') ?? '').trim() || null;
  if (!patientId || !drawnAt) redirect('/console/labs?error=missing');

  const supabase = await serverClient();
  const analytes = await getAnalytes();

  // Only analytes that were actually filled in. An empty box means "not measured",
  // which is different from zero — and storing zero for an unmeasured analyte would
  // put a false point on a chart a patient is shown.
  const entered = analytes
    .map((a: Record<string, unknown>) => {
      const raw = formData.get(`v_${a.key}`);
      const text = raw === null ? '' : String(raw).trim();
      if (text === '') return null;
      const value = Number(text);
      if (!Number.isFinite(value)) return null;
      return { analyte: a, value };
    })
    .filter(Boolean) as { analyte: Record<string, unknown>; value: number }[];

  if (entered.length === 0) redirect('/console/labs?error=empty');

  const { data: panel, error: panelError } = await supabase
    .from('lab_panel')
    .insert({
      clinic_id: viewer.clinicId,
      patient_id: patientId,
      drawn_at: drawnAt,
      source: 'in_clinic',
      entered_by: viewer.staffId,
      note,
      // The database refuses non-synthetic rows while this practice is in pilot
      // mode. Marking it here is honest: everything entered in the pilot IS
      // synthetic, and the guard is what stops a real panel being typed in.
      synthetic: true
    })
    .select('id')
    .single();

  if (panelError || !panel) redirect('/console/labs?error=panel');

  const rows = entered.map(({ analyte, value }) => ({
    clinic_id: viewer.clinicId,
    panel_id: panel.id,
    patient_id: patientId,
    analyte_key: String(analyte.key),
    value_numeric: value,
    unit: String(analyte.unit ?? ''),
    // Ranges are snapshot onto the result. If the practice revises a target range
    // next year, last year's flags must not silently change underneath a chart the
    // patient has already been shown.
    ref_low: analyte.ref_low as number | null,
    ref_high: analyte.ref_high as number | null,
    target_low: analyte.target_low as number | null,
    target_high: analyte.target_high as number | null,
    flag: flagFor(analyte as never, value),
    provisional_ranges: true,
    synthetic: true
  }));

  const { error: resultError } = await supabase.from('lab_result').insert(rows);
  if (resultError) redirect('/console/labs?error=results');

  // A critical value creates work for a person rather than sitting in a table.
  const criticals = rows.filter(r => r.flag === 'critical' || r.flag === 'above_ref' || r.flag === 'below_ref');
  if (criticals.length) {
    const { data: patient } = await supabase
      .from('patient').select('first_name, last_name').eq('id', patientId).maybeSingle();
    await supabase.from('task').insert({
      clinic_id: viewer.clinicId,
      patient_id: patientId,
      title: `Review ${criticals.length} flagged lab value${criticals.length === 1 ? '' : 's'} — ` +
        `${patient?.first_name ?? ''} ${patient?.last_name ?? ''}`.trim(),
      priority: 'high',
      source: 'lab_entry',
      due_on: drawnAt,
      synthetic: true
    });
  }

  revalidatePath('/console/labs');
  revalidatePath(`/console/clients/${patientId}`);
  redirect(`/console/clients/${patientId}?saved=labs`);
}

export default async function LabsPage({
  searchParams
}: {
  searchParams: Promise<{ patient?: string; error?: string }>;
}) {
  const params = await searchParams;
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const [analytes, panels, clients] = await Promise.all([
    getAnalytes(),
    getRecentPanels(),
    getClients()
  ]);

  const selectedPatient = params.patient ?? '';

  // Previous values for the chosen patient, so the provider is comparing rather
  // than typing blind.
  let previous: Record<string, { value: number; drawn_at: string }> = {};
  if (selectedPatient) {
    const supabase = await serverClient();
    const { data: lastPanel } = await supabase
      .from('lab_panel')
      .select('id, drawn_at')
      .eq('patient_id', selectedPatient)
      .order('drawn_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastPanel) {
      const { data: lastResults } = await supabase
        .from('lab_result')
        .select('analyte_key, value_numeric')
        .eq('panel_id', lastPanel.id);
      (lastResults ?? []).forEach(r => {
        previous[r.analyte_key] = { value: Number(r.value_numeric), drawn_at: lastPanel.drawn_at };
      });
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  const errorText: Record<string, string> = {
    missing: 'Pick a patient and a draw date.',
    empty: 'No values were entered.',
    panel: 'Could not save the panel. If this says PILOT MODE, the row was rejected for not being marked synthetic.',
    results: 'The panel saved but the values did not. Check the logs.'
  };

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">Clinical</div>
          <h1>Lab entry</h1>
        </div>
        <div className="spacer" />
        <span className="pill">{analytes.length} analytes</span>
      </header>

      <div className="view wide">
        {params.error && (
          <div className="note-band critical" style={{ marginBottom: 'var(--gd-5)' }}>
            {errorText[params.error] ?? 'Something went wrong saving that panel.'}
          </div>
        )}

        <form action={savePanel}>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Enter a panel</h2>
                <p>
                  Leave a box empty if it was not measured — empty means not measured,
                  which is different from zero.
                </p>
              </div>
            </div>

            <div className="grid g3">
              <div className="field">
                <label htmlFor="patient_id">Patient</label>
                {/* Changing the patient reloads with their previous values in view.
                    Typing a panel without the last one beside it is how a transcription
                    error goes unnoticed. */}
                <select id="patient_id" name="patient_id" defaultValue={selectedPatient} required>
                  <option value="">Choose…</option>
                  {clients.map(c => (
                    <option value={c.id} key={c.id}>{c.last_name}, {c.first_name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="drawn_at">Drawn on</label>
                <input type="date" id="drawn_at" name="drawn_at" defaultValue={today} required />
              </div>
              <div className="field">
                <label htmlFor="note">Panel note</label>
                <input
                  type="text" id="note" name="note"
                  placeholder="e.g. Week 7 recheck, dose increased to 120mg weekly"
                />
              </div>
            </div>

            {selectedPatient && Object.keys(previous).length > 0 && (
              <div className="note-band" style={{ marginTop: 'var(--gd-4)' }}>
                Previous panel drawn{' '}
                {dateLabel(Object.values(previous)[0]!.drawn_at, 'long')} — shown in the
                &ldquo;Last&rdquo; column below.
              </div>
            )}

            <div className="table-scroll" style={{ marginTop: 'var(--gd-5)' }}>
              <table className="labgrid">
                <thead>
                  <tr>
                    <th>Analyte</th>
                    <th className="num">Last</th>
                    <th>Value</th>
                    <th>Unit</th>
                    <th>Reference</th>
                    <th>Clinic target</th>
                  </tr>
                </thead>
                <tbody>
                  {analytes.map((a: Record<string, unknown>) => {
                    const prev = previous[String(a.key)];
                    return (
                      <tr key={String(a.id)}>
                        <td className="an">
                          {String(a.label)}
                          {a.is_safety ? (
                            <span className="pill" data-tone="info" style={{ marginLeft: '.4rem' }}>
                              <i className="dot" />safety
                            </span>
                          ) : null}
                        </td>
                        <td className="num dim">{prev ? num(prev.value) : '—'}</td>
                        <td>
                          <input
                            type="number" step="any" inputMode="decimal"
                            name={`v_${String(a.key)}`}
                            aria-label={String(a.label)}
                          />
                        </td>
                        <td className="rng">{String(a.unit ?? '')}</td>
                        <td className="rng">
                          {num(Number(a.ref_low))}–{num(Number(a.ref_high))}
                        </td>
                        <td className="rng">
                          {num(Number(a.target_low))}–{num(Number(a.target_high))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="row" style={{ marginTop: 'var(--gd-5)' }}>
              <button className="btn primary" type="submit">Save panel</button>
              {selectedPatient && (
                <Link className="btn ghost" href="/console/labs">Clear</Link>
              )}
            </div>

            <div className="note-band warn" style={{ marginTop: 'var(--gd-4)' }}>
              Reference and target ranges here are provisional placeholders. Ask the
              provider which analytes they actually track and which they never use —
              that conversation validates or kills this list.
            </div>
          </section>
        </form>

        <div className="section-title">Recent panels</div>
        <section className="card flush">
          {panels.length === 0 ? (
            <div className="empty">
              <div className="big" aria-hidden="true">⚗</div>
              <h3>No panels yet</h3>
              <p>Enter a baseline panel and every trend for that patient turns on.</p>
            </div>
          ) : (
            <div className="list">
              {panels.map((p: Record<string, unknown>) => {
                const who = p.patient as { id: string; first_name: string; last_name: string } | null;
                return (
                  <div className="item" key={String(p.id)}>
                    <span className="body">
                      <span className="ttl">
                        {who
                          ? <Link href={`/console/clients/${who.id}`}>{who.first_name} {who.last_name}</Link>
                          : 'Unknown'}
                      </span>
                      <span className="sub">
                        {dateLabel(String(p.drawn_at), 'long')} · {relative(String(p.drawn_at))}
                        {p.note ? ` · ${String(p.note)}` : ''}
                      </span>
                    </span>
                    {who && (
                      <span className="side">
                        <Link className="btn sm ghost" href={`/console/labs?patient=${who.id}`}>
                          New panel
                        </Link>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
