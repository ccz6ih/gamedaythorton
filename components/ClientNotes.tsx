'use client';

/**
 * components/ClientNotes.tsx
 * Treatment notes on the client chart.
 *
 * THE INTERFACE TEACHES THE RULE.
 *
 * There is no edit button, and its absence is explained in one line rather than
 * left as a puzzle. A practitioner who goes looking for "edit", fails to find
 * it, and concludes the software is unfinished is worse off than one who is
 * told plainly that notes do not change and corrections are added.
 *
 * Amendments render underneath the note they correct, indented, with their own
 * date and author. Reading top to bottom gives what was written at the time and
 * then what was added — which is the sequence that makes a correction credible.
 *
 * The composer opens closed. A chart is usually opened to read, not to write,
 * and a form sitting open above the history pushes the history off the screen.
 */

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { addNote, amendNote, removePhoto } from '@/app/console/clients/[id]/actions';

export type NotePhoto = { id: string; pose_key: string; url: string | null };

export type NoteRow = {
  id: string;
  created_at: string;
  performed_at: string;
  author_name: string;
  kind: string;
  service_name: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  body: string | null;
  products_used: string | null;
  units_total: number | null;
  areas_treated: string | null;
  aftercare_given: boolean;
  adverse_event: boolean;
  follow_up_on: string | null;
  amends_id: string | null;
  photos: NotePhoto[];
};

function when(value: string) {
  return new Date(value).toLocaleString('en-US', {
    timeZone: 'America/Denver', dateStyle: 'medium', timeStyle: 'short'
  });
}

const SOAP: [keyof NoteRow, string][] = [
  ['subjective', 'Subjective'],
  ['objective', 'Objective'],
  ['assessment', 'Assessment'],
  ['plan', 'Plan']
];

export function ClientNotes({
  patientId, notes, services
}: {
  patientId: string;
  notes: NoteRow[];
  services: { id: string; name: string }[];
}) {
  const [composing, setComposing] = useState(false);
  const [amending, setAmending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Amendments hang off their parent rather than sitting in the main list.
  const amendmentsFor = new Map<string, NoteRow[]>();
  for (const n of notes) {
    if (!n.amends_id) continue;
    if (!amendmentsFor.has(n.amends_id)) amendmentsFor.set(n.amends_id, []);
    amendmentsFor.get(n.amends_id)!.push(n);
  }
  const top = notes.filter(n => !n.amends_id);

  function submit(e: React.FormEvent<HTMLFormElement>, fn: (fd: FormData) => Promise<unknown>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = (await fn(fd)) as { ok: boolean; error?: string };
      if (result.ok) {
        setComposing(false);
        setAmending(null);
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(result.error ?? 'Could not save.');
      }
    });
  }

  return (
    <section className="card" style={{ marginTop: 'var(--gd-6)' }}>
      <header className="card-head">
        <h2 style={{ margin: 0 }}>Treatment notes</h2>
        <div className="spacer" />
        <button type="button" className="btn primary sm" onClick={() => setComposing(v => !v)}>
          {composing ? 'Cancel' : 'Add a note'}
        </button>
      </header>

      <div className="card-body">
        {/* ------------------------------------------------------ composer -- */}
        {composing && (
          <form
            ref={formRef}
            onSubmit={e => submit(e, fd => addNote(patientId, fd))}
            className="note-form"
            style={{ marginBottom: 'var(--gd-6)' }}
          >
            <div className="grid g2">
              <label className="field">
                <span>Treatment</span>
                <input name="service_name" list="note-services" placeholder="e.g. Jeuveau Neurotoxin Treatment" />
                <datalist id="note-services">
                  {services.map(s => <option key={s.id} value={s.name} />)}
                </datalist>
              </label>
              <label className="field">
                <span>When</span>
                <input name="performed_at" type="datetime-local" />
                <small>Leave blank for now.</small>
              </label>
            </div>

            {SOAP.map(([field, label]) => (
              <label className="field" key={field as string}>
                <span>{label}</span>
                <textarea name={field as string} rows={field === 'subjective' ? 3 : 2}
                  placeholder={
                    field === 'subjective' ? 'What the client reported, in their words.' :
                    field === 'objective' ? 'What you observed and did — areas, products, units.' :
                    field === 'assessment' ? 'Your read on it.' :
                    'Next steps, follow-up interval, aftercare given.'
                  } />
              </label>
            ))}

            <div className="grid g3">
              <label className="field">
                <span>Products used</span>
                <input name="products_used" placeholder="Jeuveau, lot 24B" />
              </label>
              <label className="field">
                <span>Total units</span>
                <input name="units_total" type="number" step="0.5" min="0" />
              </label>
              <label className="field">
                <span>Areas treated</span>
                <input name="areas_treated" placeholder="Frontalis, glabella" />
              </label>
            </div>

            <div className="grid g2">
              <label className="field">
                <span>Follow-up on</span>
                <input name="follow_up_on" type="date" />
              </label>
              <div className="field">
                <span>Photos</span>
                <input name="photos" type="file" accept="image/*" multiple />
                <div style={{ display: 'flex', gap: '1rem', marginTop: '.4rem' }}>
                  <label className="inline"><input type="radio" name="photo_pose" value="before" defaultChecked /> Before</label>
                  <label className="inline"><input type="radio" name="photo_pose" value="after" /> After</label>
                </div>
                <small>Stored privately. Never published, never on the website.</small>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', margin: '.6rem 0' }}>
              <label className="inline"><input type="checkbox" name="aftercare_given" /> Aftercare given</label>
              <label className="inline"><input type="checkbox" name="adverse_event" /> Adverse event</label>
            </div>

            {error && <p className="err" role="alert">{error}</p>}

            <p className="dim" style={{ fontSize: '.78rem' }}>
              Notes cannot be edited once saved. If something needs correcting you
              add an amendment, and both are shown — which is what makes a
              correction worth anything later.
            </p>

            <button className="btn primary" type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save note'}
            </button>
          </form>
        )}

        {/* -------------------------------------------------------- history -- */}
        {top.length === 0 && !composing && (
          <p className="muted">
            No notes yet. The first one is the most useful &mdash; it is what you
            will read before the next appointment.
          </p>
        )}

        {top.map(n => (
          <article className="note" key={n.id}>
            <header className="note-head">
              <div>
                <b>{n.service_name ?? 'Note'}</b>
                {n.adverse_event && <span className="pill" data-tone="warn" style={{ marginLeft: '.5rem' }}>Adverse event</span>}
                <div className="dim" style={{ fontSize: '.78rem' }}>
                  {when(n.performed_at)} &middot; {n.author_name}
                </div>
              </div>
              <div className="spacer" />
              <button type="button" className="btn ghost sm"
                      onClick={() => setAmending(amending === n.id ? null : n.id)}>
                {amending === n.id ? 'Cancel' : 'Amend'}
              </button>
            </header>

            {n.kind === 'note' && n.body && <p className="note-body">{n.body}</p>}

            {SOAP.map(([field, label]) =>
              n[field] ? (
                <div className="note-part" key={field as string}>
                  <div className="note-label">{label}</div>
                  <p className="note-body">{String(n[field])}</p>
                </div>
              ) : null
            )}

            {(n.products_used || n.units_total || n.areas_treated || n.follow_up_on || n.aftercare_given) && (
              <ul className="note-facts">
                {n.products_used && <li><span>Products</span> {n.products_used}</li>}
                {n.units_total !== null && <li><span>Units</span> {n.units_total}</li>}
                {n.areas_treated && <li><span>Areas</span> {n.areas_treated}</li>}
                {n.aftercare_given && <li><span>Aftercare</span> given</li>}
                {n.follow_up_on && <li><span>Follow-up</span> {n.follow_up_on}</li>}
              </ul>
            )}

            {n.photos.length > 0 && (
              <div className="note-photos">
                {n.photos.map(ph => (
                  <figure key={ph.id}>
                    {ph.url
                      ? <img src={ph.url} alt={`${ph.pose_key} photo`} loading="lazy" />
                      : <div className="note-photo-missing">Photo unavailable</div>}
                    <figcaption>
                      {ph.pose_key}
                      <button type="button" className="linkish"
                              onClick={() => startTransition(async () => {
                                await removePhoto(patientId, ph.id);
                                router.refresh();
                              })}>
                        remove
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}

            {/* --------------------------------------------------- amendments -- */}
            {(amendmentsFor.get(n.id) ?? []).map(a => (
              <div className="note-amendment" key={a.id}>
                <div className="note-label">
                  Amendment &middot; {when(a.created_at)} &middot; {a.author_name}
                </div>
                <p className="note-body">{a.body}</p>
              </div>
            ))}

            {amending === n.id && (
              <form onSubmit={e => submit(e, fd => amendNote(patientId, n.id, fd))}
                    className="note-amendment">
                <label className="field">
                  <span>Amendment</span>
                  <textarea name="body" rows={3} required autoFocus
                            placeholder="What needs correcting or adding. The original stays exactly as written." />
                </label>
                {error && <p className="err" role="alert">{error}</p>}
                <button className="btn primary sm" type="submit" disabled={pending}>
                  {pending ? 'Saving…' : 'Add amendment'}
                </button>
              </form>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
