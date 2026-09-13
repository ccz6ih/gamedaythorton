/**
 * app/console/book/page.tsx
 * Book an appointment, with availability computed from the practice's own hours.
 *
 * Two things make this feel like a clinic system rather than a form:
 *
 *   Real availability. Slots come from the practice's opening hours minus what is
 *   already booked minus each service's turnaround, so a closed Tuesday offers
 *   nothing and a 120-minute treatment cannot be slotted at 2:30pm on a day that
 *   closes at 3.
 *
 *   The rebook default. When this is reached from a completed visit, the next date
 *   is already filled with the clinically indicated interval. Pre-selecting it is
 *   honest — the recheck is indicated — and it converts far better than asking.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { getClinic, getServices, getClients } from '@/lib/db/queries';
import { vocab } from '@/components/Brand';
import { requireStaff, pilotFields, text, requiredText, int, formMessage } from '@/lib/actions';
import { dateLabel, timeLabel, priceLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function toHHMM(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

async function book(formData: FormData) {
  'use server';

  const staff = await requireStaff();
  const qs = new URLSearchParams({
    service: String(formData.get('service_id') ?? ''),
    date: String(formData.get('date') ?? ''),
    patient: String(formData.get('patient_id') ?? '')
  });

  try {
    const serviceId = requiredText(formData, 'service_id');
    const patientId = requiredText(formData, 'patient_id');
    const date = requiredText(formData, 'date');
    const time = requiredText(formData, 'time');

    const supabase = await serverClient();
    const { data: service } = await supabase
      .from('service')
      .select('duration_min, buffer_after_min')
      .eq('id', serviceId)
      .maybeSingle();
    if (!service) throw new Error('That service no longer exists.');

    const { error } = await supabase.from('appointment').insert({
      clinic_id: staff.clinicId,
      patient_id: patientId,
      service_id: serviceId,
      provider_id: text(formData, 'provider_id'),
      // Naive local time. The practice's timezone is what a wall clock means here.
      starts_at: `${date}T${time}:00`,
      duration_min: service.duration_min,
      buffer_min: service.buffer_after_min,
      status: 'booked',
      booking_channel: 'staff',
      room: text(formData, 'room'),
      notes: text(formData, 'notes'),
      intake_complete: false,
      ...(await pilotFields(staff.clinicId))
    });
    // The database has an exclusion constraint on provider + time, so a
    // double-booking surfaces here as a real error rather than as two people in a
    // waiting room.
    if (error) throw new Error(error.message);
  } catch (err) {
    redirect(`/console/book?${qs}&error=${encodeURIComponent(formMessage(err))}`);
  }

  revalidatePath('/console/today');
  redirect('/console/today?booked=1');
}

export default async function BookPage({
  searchParams
}: {
  searchParams: Promise<{ service?: string; date?: string; patient?: string; error?: string }>;
}) {
  const params = await searchParams;
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const words = vocab(clinic);
  const [services, clients] = await Promise.all([getServices(), getClients()]);
  const bookable = services.filter(s => s.active);

  const selectedService = params.service
    ? bookable.find(s => s.id === params.service)
    : undefined;

  const supabase = await serverClient();
  const { data: providers } = await supabase.from('provider_public').select('*').order('sort_order');

  /* ------------------------------------------------ availability ---- */

  let slots: string[] = [];
  let dayClosed = false;
  const date = params.date ?? '';

  if (selectedService && date) {
    const dow = DOW[new Date(date + 'T12:00:00Z').getUTCDay()];
    const hours = clinic.hours.find(h => h.day === dow);

    if (!hours?.open || !hours?.close) {
      dayClosed = true;
    } else {
      const { data: booked } = await supabase
        .from('appointment')
        .select('starts_at, duration_min, buffer_min')
        .gte('starts_at', `${date}T00:00:00`)
        .lte('starts_at', `${date}T23:59:59`)
        .in('status', ['booked', 'confirmed', 'arrived']);

      const taken = (booked ?? []).map(a => {
        const start = toMinutes(String(a.starts_at).slice(11, 16));
        return { start, end: start + a.duration_min + (a.buffer_min ?? 0) };
      });

      const open = toMinutes(hours.open);
      const close = toMinutes(hours.close);
      const need = selectedService.duration_min + selectedService.buffer_after_min;

      for (let t = open; t + selectedService.duration_min <= close; t += 15) {
        // Lunch. A practice that works through it can remove this, but silently
        // booking over it is worse than offering one fewer slot.
        if (t < 13 * 60 && t + selectedService.duration_min > 12 * 60) continue;
        const clashes = taken.some(b => t < b.end && t + need > b.start);
        if (!clashes) slots.push(toHHMM(t));
      }
    }
  }

  const openDays = clinic.hours.filter(h => h.open).map(h => h.day);

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{clinic.name}</div>
          <h1>Book an appointment</h1>
        </div>
        <div className="spacer" />
        <Link className="btn ghost" href="/console/today">Today</Link>
      </header>

      <div className="view narrow">
        {params.error && (
          <div className="note-band critical" style={{ marginBottom: 'var(--gd-5)' }}>{params.error}</div>
        )}

        {/* Service and date are a GET form so picking them recomputes availability
            without needing client-side state. */}
        <form method="get">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>What and when</h2>
                <p>Pick the service first — how long it takes decides which times are free.</p>
              </div>
            </div>
            <div className="grid g2">
              <div className="field">
                <label htmlFor="service">Service</label>
                <select id="service" name="service" defaultValue={params.service ?? ''}>
                  <option value="">Choose…</option>
                  {bookable.map(s => (
                    <option value={s.id} key={s.id}>
                      {s.name} — {s.duration_min} min, {priceLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="date">Date</label>
                <input id="date" name="date" type="date" defaultValue={date} />
                <div className="hint">Open {openDays.join(', ')}.</div>
              </div>
            </div>
            {params.patient && <input type="hidden" name="patient" value={params.patient} />}
            <button className="btn" type="submit" style={{ marginTop: 'var(--gd-4)' }}>
              Show available times
            </button>
          </section>
        </form>

        {selectedService && date && (
          <form action={book}>
            <input type="hidden" name="service_id" value={selectedService.id} />
            <input type="hidden" name="date" value={date} />

            <section className="card">
              <div className="card-head">
                <div>
                  <div className="eyebrow">{dateLabel(date, 'long')}</div>
                  <h2>
                    {dayClosed
                      ? 'Closed that day'
                      : slots.length
                        ? `${slots.length} time${slots.length === 1 ? '' : 's'} free`
                        : 'Nothing free that day'}
                  </h2>
                  <p>
                    {selectedService.name} — {selectedService.duration_min} min
                    {selectedService.buffer_after_min
                      ? ` plus ${selectedService.buffer_after_min} min turnaround`
                      : ''}
                  </p>
                </div>
              </div>

              {dayClosed ? (
                <div className="note-band">
                  {clinic.name} is closed on {DOW[new Date(date + 'T12:00:00Z').getUTCDay()]}.
                  Open days are {openDays.join(', ')}.
                </div>
              ) : slots.length === 0 ? (
                <div className="note-band warn">
                  Nothing long enough is free. A {selectedService.duration_min}-minute
                  treatment needs an unbroken run, and the turnaround after each
                  appointment counts.
                </div>
              ) : (
                <div className="field">
                  <label>Time</label>
                  <div className="opts">
                    {slots.map((s, i) => (
                      <label className="opt" key={s} style={{ cursor: 'pointer' }}>
                        <input
                          type="radio" name="time" value={s} required defaultChecked={i === 0}
                          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                        />
                        {timeLabel(`2020-01-01T${s}:00`)}
                      </label>
                    ))}
                  </div>
                  <div className="hint">First one is pre-selected. Confirming beats deciding.</div>
                </div>
              )}
            </section>

            {!dayClosed && slots.length > 0 && (
              <>
                <section className="card">
                  <div className="card-head"><div><h2>Who</h2></div></div>
                  <div className="grid g2">
                    <div className="field">
                      <label htmlFor="patient_id">{words.person}</label>
                      <select id="patient_id" name="patient_id" required defaultValue={params.patient ?? ''}>
                        <option value="">Choose…</option>
                        {clients.map(c => (
                          <option value={c.id} key={c.id}>{c.last_name}, {c.first_name}</option>
                        ))}
                      </select>
                      <div className="hint">
                        Not listed? <Link href="/console/clients/new" className="banner-link">Add them first</Link>.
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="provider_id">Provider</label>
                      <select id="provider_id" name="provider_id">
                        <option value="">Unassigned</option>
                        {(providers ?? []).map((p: Record<string, unknown>) => (
                          <option value={String(p.id)} key={String(p.id)}>{String(p.name)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid g2" style={{ marginTop: 'var(--gd-4)' }}>
                    <div className="field">
                      <label htmlFor="room">Room</label>
                      <input id="room" name="room" type="text" placeholder="Treatment room" />
                    </div>
                    <div className="field">
                      <label htmlFor="notes">Note</label>
                      <input id="notes" name="notes" type="text" placeholder="Anything the provider should know" />
                    </div>
                  </div>
                </section>

                <div className="row" style={{ marginTop: 'var(--gd-5)' }}>
                  <button className="btn primary big" type="submit">Book it</button>
                  <Link className="btn ghost" href="/console/book">Start again</Link>
                </div>
              </>
            )}
          </form>
        )}

        {!selectedService && (
          <div className="card">
            <div className="eyebrow quiet">How availability works</div>
            <p className="muted" style={{ fontSize: '.86rem', lineHeight: 1.6 }}>
              Times come from this practice&rsquo;s own opening hours, minus what is
              already booked, minus the turnaround after each appointment. Double
              booking is refused by the database rather than checked here, so two
              people booking the same slot at the same moment cannot both succeed.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
