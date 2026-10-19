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
import { sendBookingConfirmation, intakeLinkFor } from '@/lib/notify';
import { dateLabel, timeLabel, priceLabel } from '@/lib/format';
import { localToInstant, DEFAULT_TZ } from '@/lib/time';
import type { Modality } from '@/lib/appointment-where';

export const dynamic = 'force-dynamic';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * The three ways an appointment can happen, and what to call each of them to
 * somebody standing at a front desk. Both this form and the inline editor on
 * Today offer the same three words, because two screens describing the same
 * column differently is how a phone consult ends up labelled "virtual" in one
 * place and "remote" in the other.
 */
const MODALITIES: Modality[] = ['in_person', 'phone', 'video'];
const MODALITY_LABEL: Record<Modality, string> = {
  in_person: 'In person',
  phone: 'Phone call',
  video: 'Video call'
};

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

  /**
   * Declared out here so the redirect after the try can report it. 'no_email'
   * is the honest default: until we have found an address, nobody has been
   * told anything.
   */
  let told: 'sent' | 'unsent' | 'no_email' = 'no_email';

  const qs = new URLSearchParams({
    service: String(formData.get('service_id') ?? ''),
    date: String(formData.get('date') ?? ''),
    patient: String(formData.get('patient_id') ?? '')
  });

  try {
    const serviceId = requiredText(formData, 'service_id');
    const patientId = requiredText(formData, 'patient_id');
    const date = requiredText(formData, 'date');

    /**
     * A typed time wins over the slot buttons.
     *
     * The buttons come from the practice's opening hours minus what is booked,
     * which is right for the common case and wrong for a front desk. Jamie hit
     * this within a week: a client wanted 2pm, the treatment ran past closing,
     * and there was no way to say "I will stay late for this one".
     *
     * Worse, the rest of this form used to be hidden entirely whenever the day
     * was closed or nothing fit — so a closed Tuesday could not be booked at
     * all, even though a practice opening specially for somebody is an
     * completely ordinary thing to do.
     *
     * Overlapping is still impossible: appointment_no_double_book is a GIST
     * exclusion constraint on the provider and the time range, so the database
     * refuses a clash whatever this form sends. What is being relaxed is the
     * OPENING HOURS, which are a preference, not the double-booking rule,
     * which is a fact.
     */
    const custom = text(formData, 'custom_time');
    const time = custom || text(formData, 'time');
    if (!time) throw new Error('Pick a time, or type one.');

    const supabase = await serverClient();
    const { data: service } = await supabase
      .from('service')
      .select('duration_min, buffer_after_min, default_modality')
      .eq('id', serviceId)
      .maybeSingle();
    if (!service) throw new Error('That service no longer exists.');

    /**
     * Read the service's default from the database, not from the form.
     *
     * The form's pre-selection is a convenience for whoever is looking at the
     * screen; this is the value of record. If the field is missing or has been
     * tampered with, the service's own default stands — and that column itself
     * defaults to 'in_person'.
     */
    const asked = text(formData, 'modality');
    const modality = MODALITIES.includes(asked as Modality)
      ? (asked as Modality)
      : (service.default_modality as Modality | null) ?? 'in_person';

    const pasted = text(formData, 'meeting_url') ?? '';
    const meetingUrl =
      modality === 'video' && /^https?:\/\/\S+$/i.test(pasted) ? pasted : null;
    if (modality === 'video' && pasted && !meetingUrl) {
      throw new Error(
        'That meeting link does not look like a link. Paste the whole thing, starting with https://. Booked without it, you can add it later on Today.'
      );
    }

    // The practice's own zone. The clinic row carries it; America/Denver is the
    // fallback and is what every other time in this codebase already assumes.
    const { data: tzRow } = await supabase
      .from('clinic')
      .select('timezone, name, phone_voice, address_line1, address_city, address_state, address_zip')
      .eq('id', staff.clinicId)
      .maybeSingle();
    const timeZone = tzRow?.timezone || DEFAULT_TZ;

    const { data: booked, error } = await supabase.from('appointment').insert({
      clinic_id: staff.clinicId,
      patient_id: patientId,
      service_id: serviceId,
      provider_id: text(formData, 'provider_id'),
      /**
       * The practice's wall clock, converted to a real instant.
       *
       * This was `${date}T${time}:00` — a naive string into a timestamptz
       * column, which Postgres reads in the SERVER's zone. On Supabase that is
       * UTC, so a receptionist typing 9:00 stored 09:00 UTC and the calendar
       * showed 3:00 in the morning. It was found on a live booking: a client's
       * second hair-restoration session, sitting at 3am.
       *
       * The public booking path never had this bug — app.book_appointment does
       * `at time zone` in SQL — so appointments clients made themselves were
       * right and appointments the practice made were six hours out. The worst
       * way round, because the staff ones are the ones staff trust.
       */
      starts_at: localToInstant(date, time, timeZone),
      duration_min: service.duration_min,
      buffer_min: service.buffer_after_min,
      status: 'booked',
      booking_channel: 'staff',
      /**
       * Where, not just when.
       *
       * Jamie splits her week between her own room in Loveland and Gameday's
       * in Northglenn, and which one is unpredictable. Null means the clinic
       * default, which is what every appointment booked before this existed
       * means — so nothing already on the books changes meaning.
       *
       * This reaches the client: the confirmation and the reminder render this
       * location's address. A client who sees Loveland drives to Loveland.
       */
      location_id: text(formData, 'location_id'),
      /**
       * In person, on the phone, or on video — decided here rather than
       * inherited silently.
       *
       * The form pre-selects the service's own default, so the common case is
       * one fewer decision, but a consultation booked over the phone that the
       * client would rather do on video can be said so at the time. The
       * fallback is the service default, which is itself 'in_person', so an
       * absent field never means something new.
       *
       * The link is only kept when this is a video call and only when it
       * parses. A half-pasted string in a client's reminder, looking like
       * something they can click, is worse than no link at all — and a
       * leftover link on an appointment that moved back to in-person is worse
       * again.
       */
      modality,
      meeting_url: meetingUrl,
      room: text(formData, 'room'),
      notes: text(formData, 'notes'),
      intake_complete: false,
      ...(await pilotFields(staff.clinicId))
    })
      .select(`
        id, starts_at, intake_token,
        patient:patient_id ( first_name, last_name, email, phone ),
        service:service_id ( name, requires_consent ),
        location:location_id ( name, address, is_default )
      `)
      .maybeSingle();
    // The database has an exclusion constraint on provider + time, so a
    // double-booking surfaces here as a real error rather than as two people in a
    // waiting room.
    if (error) throw new Error(error.message);

    /**
     * Tell the client. Nothing used to.
     *
     * A booking the client made themselves has always sent a confirmation; a
     * booking the practice made for them sent nothing at all, and the first
     * they heard of it was the reminder the day before. That was survivable
     * while every appointment was in the same room at the same address. It
     * stopped being survivable the moment a consultation could be a phone call
     * or a video call: a link pasted here would have sat in the database until
     * the night before.
     *
     * It is the same whereLine() the public path uses, so both say the same
     * sentence. No practice notice goes with it — she does not need an email
     * about a booking she just made.
     *
     * After the insert and in its own try, because the appointment exists
     * whether or not this sends. The helper logs its own failures.
     */
    const row = booked as unknown as {
      starts_at: string; intake_token: string | null;
      patient: { first_name: string; last_name: string; email: string | null; phone: string | null } | null;
      service: { name: string; requires_consent: boolean } | null;
      location: { name: string; address: string | null; is_default: boolean } | null;
    } | null;

    if (row?.patient?.email) {
      const elsewhere = row.location && !row.location.is_default;
      try {
        const sent = await sendBookingConfirmation({
          clinicId: staff.clinicId,
          clinicName: tzRow?.name ?? 'the practice',
          clinicAddress: [tzRow?.address_line1, tzRow?.address_city, tzRow?.address_state, tzRow?.address_zip]
            .filter(Boolean).join(', ') || null,
          practicePhone: tzRow?.phone_voice ?? null,
          practiceInbox: null,
          clientName: `${row.patient.first_name} ${row.patient.last_name}`,
          clientEmail: row.patient.email,
          clientPhone: row.patient.phone ?? null,
          serviceName: row.service?.name ?? 'your appointment',
          whenText: new Date(row.starts_at).toLocaleString('en-US', {
            timeZone, dateStyle: 'full', timeStyle: 'short'
          }),
          note: null,
          requiresConsent: row.service?.requires_consent === true,
          modality,
          meetingUrl,
          locationName: elsewhere ? row.location!.name : null,
          locationAddress: elsewhere ? row.location!.address : null,
          intakeUrl: await intakeLinkFor(row.intake_token),
          ...(await pilotFields(staff.clinicId))
        });
        told = sent.delivered ? 'sent' : 'unsent';
      } catch {
        // The booking stands. Nothing here may undo it.
        told = 'unsent';
      }
    }
  } catch (err) {
    redirect(`/console/book?${qs}&error=${encodeURIComponent(formMessage(err))}`);
  }

  revalidatePath('/console/today');
  /**
   * Say whether the client was actually told.
   *
   * "Booked" on its own is not enough information to act on: if nothing went
   * out, somebody has to pick up the phone, and she can only know that if the
   * screen says so. The old behaviour — silence, every time — was the same as
   * always claiming success.
   */
  redirect(`/console/today?booked=1&told=${told}`);
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

  /**
   * Where she might be. Read here rather than hardcoded, so adding a third
   * place is a row rather than a deploy.
   */
  const supabaseForLocations = await serverClient();
  const { data: locations } = await supabaseForLocations
    .from('location')
    .select('id, name, address, is_default')
    .eq('clinic_id', clinic?.id ?? '')
    .eq('active', true)
    .order('sort_order');
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

              {dayClosed && (
                <div className="note-band">
                  {clinic.name} is closed on {DOW[new Date(date + 'T12:00:00Z').getUTCDay()]}.
                  Open days are {openDays.join(', ')}. You can still book by typing
                  a time below.
                </div>
              )}

              {!dayClosed && slots.length === 0 && (
                <div className="note-band warn">
                  Nothing long enough is free. A {selectedService.duration_min}-minute
                  treatment needs an unbroken run, and the turnaround after each
                  appointment counts. Type a time below to book anyway.
                </div>
              )}

              {slots.length > 0 && (
                <div className="field">
                  <label>Time</label>
                  <div className="opts">
                    {slots.map((s, i) => (
                      <label className="opt" key={s} style={{ cursor: 'pointer' }}>
                        <input
                          type="radio" name="time" value={s} defaultChecked={i === 0}
                          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                        />
                        {timeLabel(`2020-01-01T${s}:00`)}
                      </label>
                    ))}
                  </div>
                  <div className="hint">First one is pre-selected. Confirming beats deciding.</div>
                </div>
              )}

              {/*
                ALWAYS OFFERED, including on a closed day and a full one.

                The buttons above are the practice's hours minus what is booked.
                That is right for most bookings and wrong for a front desk: a
                client wants 2pm, the treatment runs ten minutes past closing,
                and somebody has to be able to say "I'll stay late for this one".

                Nothing unsafe is being allowed. The database has a GIST
                exclusion constraint on provider and time range, so a genuine
                clash is refused whatever is typed here. What this relaxes is
                the opening hours — a preference — not double-booking, which is
                a fact.
              */}
              <div className="field">
                <label htmlFor="custom_time">
                  {slots.length > 0 ? 'Or type a time' : 'Time'}
                </label>
                <input
                  id="custom_time"
                  name="custom_time"
                  type="time"
                  step={300}
                  style={{ maxWidth: '10rem' }}
                />
                <div className="hint">
                  {slots.length > 0
                    ? 'Overrides the buttons above. Use it for outside opening hours.'
                    : 'Outside the usual hours. The practice will not be double-booked — that is refused by the database — but nothing else is checked.'}
                </div>
              </div>
            </section>

            {/* The rest of the form is no longer conditional. A closed day and a
                full day both used to hide the Who, the notes and the submit
                button, which made "book them anyway" impossible rather than
                merely discouraged. */}
                {/*
                  ALWAYS SHOWN, even for a practice with one room.

                  It used to appear only when there were two locations to
                  choose between, which was right while "where" meant only
                  "which address". It does not any more: a consultation can
                  happen on the phone or on video, and the client has to be
                  told which. Jamie had a consult arrive with no way to know,
                  and no way to say.
                */}
                <section className="card">
                  <div className="card-head">
                    <div>
                      <h2>Where</h2>
                      <p>
                        This is the sentence the client reads in their
                        confirmation and again in their reminder.
                      </p>
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="modality">How it happens</label>
                    {/*
                      Pre-selected from the service's own default, so booking a
                      consultation that is normally a phone call needs no
                      thought — but it is a dropdown rather than a fixed value,
                      because the one that matters is the consult booked by
                      phone that becomes a video call once they agree a time.
                    */}
                    <select
                      id="modality"
                      name="modality"
                      defaultValue={selectedService.default_modality ?? 'in_person'}
                    >
                      {MODALITIES.map(m => (
                        <option key={m} value={m}>{MODALITY_LABEL[m]}</option>
                      ))}
                    </select>
                    <div className="hint">
                      {selectedService.default_modality === 'phone'
                        ? `${selectedService.name} is usually a phone call. We will tell them we are ringing them.`
                        : selectedService.default_modality === 'video'
                          ? `${selectedService.name} is usually a video call. Paste the link below and it goes out with the confirmation.`
                          : `${selectedService.name} is usually in person. Change it here for this one appointment — the service itself is untouched.`}
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="meeting_url">Meeting link</label>
                    <input
                      id="meeting_url"
                      name="meeting_url"
                      type="url"
                      inputMode="url"
                      placeholder="https://…"
                      autoComplete="off"
                    />
                    <div className="hint">
                      Only used for a video call, and ignored otherwise. You can
                      leave it blank and add it later on Today — but it has to
                      be there before the reminder goes out the day before, or
                      it reaches them too late to be any use.
                    </div>
                  </div>

                  {(locations?.length ?? 0) > 1 && (
                    <div className="field">
                      {/*
                        Only when there is a choice. A practice with one room
                        does not need a field that always says the same thing.

                        This is not a tenancy switch. Seeing her own client in
                        Gameday's room for an afternoon keeps the appointment on
                        HER books at HER prices; filing it under Gameday would put
                        her client in their patient list and her money in their
                        takings.
                      */}
                      <label htmlFor="location_id">Location</label>
                      <select id="location_id" name="location_id" defaultValue="">
                        {locations!.map(l => (
                          <option key={l.id} value={l.is_default ? '' : l.id}>
                            {l.name}{l.is_default ? ' (usual)' : ''}
                          </option>
                        ))}
                      </select>
                      <div className="hint">
                        The address for whichever is chosen is what goes in the
                        client&rsquo;s confirmation and reminder. Ignored if this
                        is a phone or video call.
                      </div>
                    </div>
                  )}
                </section>

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
