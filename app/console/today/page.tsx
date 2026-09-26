/**
 * app/console/today/page.tsx
 *
 * Everything the provider needs before walking into the room, on one line per
 * arrival: who, when, what, intake status, and anything flagged.
 * docs/14-screen-specs.md.
 */

import Link from 'next/link';
import { getClinic, getToday } from '@/lib/db/queries';
import { vocab } from '@/components/Brand';
import { timeLabel, titleCase, dateLabel } from '@/lib/format';
import { serverClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

async function setStatus(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const status = String(formData.get('status'));
  if (!['arrived', 'complete', 'no_show'].includes(status)) return;

  const supabase = await serverClient();
  // RLS scopes this to the caller's own clinic; no clinic filter needed here and
  // adding one would imply the policy could be bypassed.
  await supabase.from('appointment').update({ status }).eq('id', id);
  revalidatePath('/console/today');
}

/**
 * Tick a task off.
 *
 * RLS scopes the update to the caller's own practice, same as setStatus above.
 * `done_at` is stamped rather than the row deleted: an adverse-event follow-up
 * that was closed is part of the record of how it was handled, and a task that
 * vanishes cannot be shown to have been done.
 */
async function completeTask(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const supabase = await serverClient();
  await supabase.from('task').update({ done: true, done_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/console/today');
  revalidatePath('/console');
}

export default async function TodayPage({
  searchParams
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const params = await searchParams;
  const offset = Number(params.offset ?? 0) || 0;

  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const rows = await getToday(clinic, offset);
  const words = vocab(clinic);

  /**
   * THE TASKS NOBODY COULD SEE.
   *
   * The dashboard has always counted open tasks and linked here, and this page
   * never rendered them — so recording an adverse event created a high-priority
   * follow-up that was invisible from the moment it was made. Two screens write
   * tasks (lab entry, treatment records) and until now none read them.
   *
   * Synthetic rows are excluded once a practice is live, for the same reason
   * they are excluded from the dashboard: seed data naming clients who do not
   * exist is worse than an empty list.
   */
  const supabaseForTasks = await serverClient();
  const { data: flags } = await supabaseForTasks
    .from('clinic').select('pilot_mode').eq('id', clinic.id).maybeSingle();
  const liveClinic = flags?.pilot_mode === false;

  const { data: taskRows } = await supabaseForTasks
    .from('task')
    .select('id, title, priority, due_on, patient_id, source')
    .eq('done', false)
    .match(liveClinic ? { synthetic: false } : {})
    .order('due_on', { ascending: true, nullsFirst: false })
    .limit(50);

  const tasks = (taskRows ?? []) as {
    id: string; title: string; priority: string | null;
    due_on: string | null; patient_id: string | null; source: string | null;
  }[];

  const todayKey = new Date().toISOString().slice(0, 10);
  const dayIso = new Date(Date.now() + offset * 864e5).toISOString();

  const arrived = rows.filter(r => r.status === 'arrived').length;
  const done = rows.filter(r => r.status === 'complete').length;
  const missingIntake = rows.filter(r => !r.intake_complete).length;

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{dateLabel(dayIso, 'long')}</div>
          <h1>{offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : dateLabel(dayIso, 'dow')}</h1>
        </div>
        <div className="spacer" />
        <div className="row tight">
          <Link className="btn sm" href={`/console/today?offset=${offset - 1}`}>‹ Prev</Link>
          <Link className="btn sm" href="/console/today">Today</Link>
          <Link className="btn sm" href={`/console/today?offset=${offset + 1}`}>Next ›</Link>
        </div>
      </header>

      <div className="view">
        <div className="grid g4">
          <div className="stat"><div className="lab">Booked</div><div className="stat-val">{rows.length}</div></div>
          <div className="stat"><div className="lab">Arrived</div><div className="stat-val">{arrived}</div></div>
          <div className="stat"><div className="lab">Complete</div><div className="stat-val">{done}</div></div>
          <div className="stat">
            <div className="lab">Intake missing</div>
            <div className="stat-val">{missingIntake}</div>
            {missingIntake > 0 && <div className="note">Each one costs clinical minutes</div>}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="big" aria-hidden="true">▦</div>
              <h3>Nothing on the books</h3>
              <p>
                {clinic.practice_type === 'med_spa'
                  ? `${clinic.name} is open ${clinic.hours.filter(h => h.open).map(h => h.day).join(', ')}. Pick another day above.`
                  : 'Appointments booked online or by the front desk appear here in time order.'}
              </p>
            </div>
          </div>
        ) : (
          <section className="card flush">
            <div className="card-head">
              <div>
                <h2>In time order</h2>
                <p>One line per arrival, with whatever needs knowing before the room.</p>
              </div>
            </div>
            <div className="list">
              {rows.map(row => (
                <div className="item" data-tone={!row.intake_complete ? 'warn' : undefined} key={row.id}>
                  <span className="side" style={{ minWidth: 62, fontWeight: 700, color: 'var(--gd-text)' }}>
                    {timeLabel(row.starts_at, clinic.timezone)}
                  </span>
                  <span className="body">
                    <span className="ttl">
                      {row.patient
                        ? `${row.patient.first_name} ${row.patient.last_name}`
                        : 'Unnamed'}
                      {!row.intake_complete && (
                        <span className="pill" data-tone="warn"><i className="dot" />intake incomplete</span>
                      )}
                      {row.status === 'no_show' && (
                        <span className="pill" data-tone="critical"><i className="dot" />no-show</span>
                      )}
                      {row.status === 'complete' && (
                        <span className="pill" data-tone="ok"><i className="dot" />done</span>
                      )}
                      {/*
                        Next to the name, not buried in the sub-line with the
                        duration and the room number.

                        This is the screen she opens in the morning, and the
                        only fact on it that changes what time she has to leave
                        the house. It is drawn only when the appointment is NOT
                        at the usual place — marking every row "The Med Bar"
                        would bury the one that matters.
                      */}
                      {row.location && !row.location.is_default && (
                        <span className="pill" data-tone="warn">
                          <i className="dot" />{row.location.name}
                        </span>
                      )}
                    </span>
                    <span className="sub">
                      {row.service?.name ?? titleCase(row.status)}
                      {' · '}{row.duration_min} min
                      {row.provider?.name ? ` · ${row.provider.name}` : ''}
                      {row.room ? ` · ${row.room}` : ''}
                    </span>
                  </span>
                  <span className="side row tight" style={{ justifyContent: 'flex-end' }}>
                    {row.status === 'booked' && (
                      <form action={setStatus} className="inline-form">
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="status" value="arrived" />
                        <button className="btn sm" type="submit">Arrived</button>
                      </form>
                    )}
                    {row.status === 'arrived' && (
                      <form action={setStatus} className="inline-form">
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="status" value="complete" />
                        <button className="btn sm primary" type="submit">Complete</button>
                      </form>
                    )}
                    {row.patient && (
                      <Link className="btn sm ghost" href={`/console/clients/${row.patient.id}`}>Open</Link>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {tasks.length > 0 && (
          <section className="card flush" style={{ marginTop: 'var(--gd-5)' }}>
            <div className="card-head">
              <div>
                <div className="eyebrow">Open tasks</div>
                <h2>{tasks.length} to do</h2>
              </div>
            </div>
            <ul className="task-list">
              {tasks.map(t => {
                const overdue = t.due_on !== null && t.due_on < todayKey;
                return (
                  <li key={t.id} className="task-row">
                    <div className="task-body">
                      <span className="task-title">
                        {t.priority === 'high' && <i className="task-flag" aria-label="High priority" />}
                        {/* Linked to the chart when the task is about somebody,
                            because "follow up on bruising" is not actionable
                            without the person it concerns. */}
                        {t.patient_id
                          ? <Link href={`/console/clients/${t.patient_id}`}>{t.title}</Link>
                          : t.title}
                      </span>
                      <span className="task-meta">
                        {t.due_on
                          ? <span className={overdue ? 'warnc' : 'dim'}>
                              {overdue ? 'overdue — ' : 'due '}{dateLabel(t.due_on, 'md')}
                            </span>
                          : <span className="dim">no date</span>}
                        {t.source && <span className="dim"> · {titleCase(t.source.replace(/_/g, ' '))}</span>}
                      </span>
                    </div>
                    <form action={completeTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="btn sm" type="submit">Done</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="card">
          <div className="eyebrow quiet">Not built yet</div>
          <p className="muted" style={{ fontSize: '.86rem', lineHeight: 1.6 }}>
            Completing a visit should immediately offer the next booking with the
            clinically correct date already filled — the single highest-leverage
            default in the build. It works in the Phase A prototype
            (<Link className="banner-link" href="/prototype/index.html#/staff/today">see it there</Link>)
            and is the next thing to port here.
          </p>
        </div>
      </div>
    </>
  );
}
