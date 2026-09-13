/**
 * app/console/treatments/new/page.tsx
 * Record a treatment: areas, units, product, lot.
 *
 * This is the screen a med spa uses several times a day, and the lot selector is
 * the part that matters most. If a manufacturer recalls a lot, "who received it"
 * has to be answerable from the record rather than reconstructed from memory — so
 * the lot is a foreign key to actual inventory, not a text field.
 *
 * Two notes fields, on purpose. The clinical note stays internal; the
 * patient-facing one publishes to the client's own screen. A raw clinical note
 * should never be shown to the person it is about.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { getClinic, getClients, getServices } from '@/lib/db/queries';
import { requireRole, pilotFields, text, requiredText, decimal, bool, formMessage } from '@/lib/actions';
import { dateLabel, daysUntil } from '@/lib/format';

export const dynamic = 'force-dynamic';

const MAX_AREAS = 6;

async function save(formData: FormData) {
  'use server';

  const staff = await requireRole(['owner', 'admin', 'provider']);

  try {
    const patientId = requiredText(formData, 'patient_id');
    const pilot = await pilotFields(staff.clinicId);
    const supabase = await serverClient();

    const { data: record, error } = await supabase
      .from('treatment_record')
      .insert({
        clinic_id: staff.clinicId,
        patient_id: patientId,
        service_id: text(formData, 'service_id'),
        provider_id: text(formData, 'provider_id'),
        appointment_id: text(formData, 'appointment_id'),
        performed_at: `${requiredText(formData, 'performed_at')}T12:00:00`,
        notes_clinical: text(formData, 'notes_clinical'),
        notes_patient_facing: text(formData, 'notes_patient_facing'),
        aftercare_given: bool(formData, 'aftercare_given'),
        aftercare_version: bool(formData, 'aftercare_given') ? 'v1' : null,
        adverse_event: bool(formData, 'adverse_event'),
        adverse_event_note: text(formData, 'adverse_event_note'),
        follow_up_due: text(formData, 'follow_up_due'),
        ...pilot
      })
      .select('id')
      .single();

    if (error || !record) throw new Error(error?.message ?? 'Could not save the record.');

    // Areas. Blank rows are skipped rather than stored as empty, because an empty
    // area on a treatment record is worse than no row at all.
    const details: Record<string, unknown>[] = [];
    let totalUnits = 0;

    for (let i = 0; i < MAX_AREAS; i++) {
      const area = text(formData, `area_${i}`);
      if (!area) continue;
      const units = decimal(formData, `units_${i}`);
      if (units) totalUnits += units;
      details.push({
        clinic_id: staff.clinicId,
        treatment_record_id: record.id,
        patient_id: patientId,
        area,
        units,
        product_name: text(formData, `product_${i}`),
        lot_id: text(formData, `lot_${i}`),
        technique: text(formData, `technique_${i}`),
        sort_order: i,
        ...pilot
      });
    }

    if (details.length) {
      const { error: detailError } = await supabase.from('treatment_detail').insert(details);
      if (detailError) throw new Error(detailError.message);
      if (totalUnits > 0) {
        await supabase.from('treatment_record')
          .update({ total_units: totalUnits }).eq('id', record.id);
      }
    }

    // An adverse event becomes somebody's task, not a row nobody revisits.
    if (bool(formData, 'adverse_event')) {
      const { data: person } = await supabase
        .from('patient').select('first_name, last_name').eq('id', patientId).maybeSingle();
      await supabase.from('task').insert({
        clinic_id: staff.clinicId,
        patient_id: patientId,
        title: `Follow up on adverse event — ${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim(),
        priority: 'high',
        source: 'adverse_event',
        due_on: text(formData, 'follow_up_due'),
        ...pilot
      });
    }

    revalidatePath('/console/treatments');
    revalidatePath(`/console/clients/${patientId}`);
    redirect(`/console/clients/${patientId}?saved=treatment`);
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err;   // Next redirect
    redirect(`/console/treatments/new?error=${encodeURIComponent(formMessage(err))}`);
  }
}

export default async function NewTreatmentPage({
  searchParams
}: {
  searchParams: Promise<{ patient?: string; error?: string }>;
}) {
  const params = await searchParams;
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const supabase = await serverClient();
  const [clients, services, providersRes, lotsRes] = await Promise.all([
    getClients(),
    getServices(),
    supabase.from('provider_public').select('*').order('sort_order'),
    supabase
      .from('inventory_lot')
      .select('id, lot_number, expiry_date, qty_remaining, item:item_id ( name, unit_label )')
      .gt('qty_remaining', 0)
      .order('expiry_date')
  ]);

  const providers = providersRes.data ?? [];
  const lots = lotsRes.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">
            <Link href="/console/treatments" className="banner-link">Treatment records</Link>
          </div>
          <h1>Record a treatment</h1>
        </div>
      </header>

      <div className="view narrow">
        {params.error && (
          <div className="note-band critical" style={{ marginBottom: 'var(--gd-5)' }}>{params.error}</div>
        )}

        <form action={save}>
          <section className="card">
            <div className="card-head"><div><h2>Who and what</h2></div></div>
            <div className="grid g2">
              <div className="field">
                <label htmlFor="patient_id">Client</label>
                <select id="patient_id" name="patient_id" required defaultValue={params.patient ?? ''}>
                  <option value="">Choose…</option>
                  {clients.map(c => (
                    <option value={c.id} key={c.id}>{c.last_name}, {c.first_name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="service_id">Service</label>
                <select id="service_id" name="service_id">
                  <option value="">Not specified</option>
                  {services.filter(s => s.active).map(s => (
                    <option value={s.id} key={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid g2" style={{ marginTop: 'var(--gd-4)' }}>
              <div className="field">
                <label htmlFor="performed_at">Performed on</label>
                <input id="performed_at" name="performed_at" type="date" required defaultValue={today} />
              </div>
              <div className="field">
                <label htmlFor="provider_id">By</label>
                <select id="provider_id" name="provider_id">
                  <option value="">Not specified</option>
                  {providers.map((p: Record<string, unknown>) => (
                    <option value={String(p.id)} key={String(p.id)}>{String(p.name)}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Areas treated</h2>
                <p>
                  Leave rows blank if unused. The lot matters: it is what makes a recall
                  answerable.
                </p>
              </div>
            </div>

            {lots.length === 0 && (
              <div className="note-band warn" style={{ marginBottom: 'var(--gd-4)' }}>
                No inventory lots have stock. Areas can still be recorded, but without a
                lot the record cannot answer &ldquo;who received this batch&rdquo;.
              </div>
            )}

            <div className="stack">
              {Array.from({ length: MAX_AREAS }).map((_, i) => (
                <div className="labcard" key={i}>
                  <div className="grid g2">
                    <div className="field">
                      <label htmlFor={`area_${i}`}>Area {i + 1}</label>
                      <input id={`area_${i}`} name={`area_${i}`} type="text"
                        placeholder={i === 0 ? 'e.g. Glabella' : ''} />
                    </div>
                    <div className="field">
                      <label htmlFor={`units_${i}`}>Units</label>
                      <input id={`units_${i}`} name={`units_${i}`} type="number" step="any" min="0" />
                    </div>
                  </div>
                  <div className="grid g3" style={{ marginTop: '.6rem' }}>
                    <div className="field">
                      <label htmlFor={`product_${i}`}>Product</label>
                      <input id={`product_${i}`} name={`product_${i}`} type="text" />
                    </div>
                    <div className="field">
                      <label htmlFor={`lot_${i}`}>Lot</label>
                      <select id={`lot_${i}`} name={`lot_${i}`}>
                        <option value="">Not recorded</option>
                        {lots.map((l: Record<string, unknown>) => {
                          const item = l.item as unknown as { name: string } | null;
                          const days = daysUntil(l.expiry_date as string | null);
                          return (
                            <option value={String(l.id)} key={String(l.id)}>
                              {item?.name ?? 'Item'} · {String(l.lot_number)}
                              {days !== null && days < 60 ? ` (expires in ${days}d)` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`technique_${i}`}>Technique / depth</label>
                      <input id={`technique_${i}`} name={`technique_${i}`} type="text" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Notes</h2>
                <p>Two fields on purpose. One stays internal; one the client sees.</p>
              </div>
            </div>
            <div className="stack">
              <div className="field">
                <label htmlFor="notes_clinical">Clinical note (internal)</label>
                <textarea id="notes_clinical" name="notes_clinical"
                  placeholder="Tolerance, technique, anything a colleague would need." />
              </div>
              <div className="field">
                <label htmlFor="notes_patient_facing">Note for the client</label>
                <textarea id="notes_patient_facing" name="notes_patient_facing"
                  placeholder="Plain language. What to expect over the next few days." />
                <div className="hint">
                  Publishes to their own screen. Never paste the clinical note here.
                </div>
              </div>
              <label className="switch">
                <input type="checkbox" name="aftercare_given" defaultChecked />
                <span className="track" />
                <span className="txt">Aftercare instructions given</span>
              </label>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Anything go wrong?</h2>
                <p>
                  Recorded as a finding with a follow-up, so it is findable later rather
                  than buried in a note.
                </p>
              </div>
            </div>
            <div className="stack">
              <label className="switch">
                <input type="checkbox" name="adverse_event" />
                <span className="track" />
                <span className="txt">Record an adverse event</span>
              </label>
              <div className="field">
                <label htmlFor="adverse_event_note">What happened</label>
                <textarea id="adverse_event_note" name="adverse_event_note"
                  placeholder="What, which side, when reported, what was advised." />
              </div>
              <div className="field">
                <label htmlFor="follow_up_due">Follow up by</label>
                <input id="follow_up_due" name="follow_up_due" type="date" />
                <div className="hint">Creates a high-priority task automatically.</div>
              </div>
            </div>
          </section>

          <div className="row" style={{ marginTop: 'var(--gd-5)' }}>
            <button className="btn primary" type="submit">Save record</button>
            <Link className="btn ghost" href="/console/treatments">Cancel</Link>
          </div>
        </form>
      </div>
    </>
  );
}
