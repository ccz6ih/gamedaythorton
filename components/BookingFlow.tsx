'use client';

/**
 * components/BookingFlow.tsx
 * Treatment, then time, then details. The three steps a booking actually has.
 *
 * WHY THE ORDER MATTERS: the service determines how long the appointment is,
 * and therefore which times can be offered at all. Asking for a day first —
 * which looks friendlier — means showing times that may vanish once a
 * ninety-minute treatment is chosen, and a slot that disappears after you
 * picked it is worse than one that was never offered.
 *
 * THE CALENDAR ONLY OFFERS DAYS THE PRACTICE IS OPEN. Greying out closed days
 * is computed from the practice's own hours, which are already public, so it
 * costs no round trip and a visitor never clicks a Tuesday to be told nothing
 * is free. The availability call happens once a day is chosen.
 *
 * Each step is reachable backwards. Somebody who picks a time and then changes
 * their mind about the treatment should not start again.
 */

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { slotsFor, book, type BookingResult } from '@/app/c/[slug]/book/actions';

export type BookService = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  duration_min: number;
  priceLabel: string;
};

export type OpenDay = { day: string; open: string | null; close: string | null };

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];

/** Today in the practice's timezone, not the visitor's. */
function denverToday(): Date {
  const s = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
  return new Date(s + 'T12:00:00');
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prettyTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h! < 12 ? 'AM' : 'PM';
  const hour = h! % 12 === 0 ? 12 : h! % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function BookingFlow({
  slug, services, hours, servicesHref, preselect
}: {
  slug: string;
  services: BookService[];
  hours: OpenDay[];
  servicesHref: string;
  preselect?: string;
}) {
  const today = useMemo(denverToday, []);

  const [step, setStep] = useState(preselect ? 2 : 1);
  const [service, setService] = useState<BookService | null>(
    preselect ? services.find(s => s.id === preselect || s.name === preselect) ?? null : null
  );
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [time, setTime] = useState<string | null>(null);

  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [sms, setSms] = useState(false);

  const [result, setResult] = useState<BookingResult | null>(null);
  const [pending, startTransition] = useTransition();

  /** Days the practice opens at all, by weekday name. */
  const openDays = useMemo(
    () => new Set(hours.filter(h => h.open && h.close).map(h => h.day)),
    [hours]
  );

  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 60);
    return d;
  }, [today]);

  function bookable(d: Date) {
    if (d < today) return false;
    if (d > maxDate) return false;
    return openDays.has(DOW[d.getDay()]!);
  }

  // Times are fetched when a day is picked, and cleared the moment anything
  // upstream changes — showing yesterday's availability under today's date is
  // the bug this avoids.
  useEffect(() => {
    if (!service || !date) { setSlots(null); return; }
    let cancelled = false;
    setSlots(null);
    setTime(null);
    slotsFor(slug, service.id, date).then(s => { if (!cancelled) setSlots(s); });
    return () => { cancelled = true; };
  }, [slug, service, date]);

  /* ------------------------------------------------------------ booked -- */
  if (result?.ok) {
    const when = new Date(result.when).toLocaleString('en-US', {
      timeZone: 'America/Denver', dateStyle: 'full', timeStyle: 'short'
    });
    return (
      <div className="bk-done">
        <h2 className="sf-display-sm">You&rsquo;re booked.</h2>
        <p className="sf-lede sm">
          <b>{result.serviceName}</b><br />{when}
        </p>
        {/* Only promise the email if one actually went. Somebody waiting for a
            confirmation that is never coming assumes the booking failed and
            books again — which is worse than saying nothing. */}
        <p className="sf-note-line">
          {result.emailed
            ? <>A confirmation is on its way to {email}. To change or cancel, reply to it{result.practicePhone ? <> or call {result.practicePhone}</> : null}.</>
            : <>We have you down. To change or cancel, {result.practicePhone ? <>call {result.practicePhone}</> : <>get in touch</>}.</>}
        </p>
        {result.requiresConsent && (
          <p className="sf-note">
            This treatment needs a consent form and a short assessment before we
            start &mdash; we&rsquo;ll go through both at your appointment, so
            allow a few extra minutes.
          </p>
        )}
        <div className="sf-actions">
          <Link href={servicesHref} className="sf-btn ghost">Back to treatments</Link>
        </div>
      </div>
    );
  }

  const byCategory = new Map<string, BookService[]>();
  for (const s of services) {
    if (!byCategory.has(s.category)) byCategory.set(s.category, []);
    byCategory.get(s.category)!.push(s);
  }

  /* ------------------------------------------------------------ steps -- */
  return (
    <div className="bk">
      <ol className="bk-steps" aria-label="Booking steps">
        {['Treatment', 'Date & time', 'Your details'].map((label, i) => (
          <li key={label}
              className={`bk-step${step === i + 1 ? ' is-current' : ''}${step > i + 1 ? ' is-done' : ''}`}>
            <button type="button"
                    disabled={step <= i + 1}
                    onClick={() => setStep(i + 1)}>
              <span className="bk-step-n" aria-hidden="true">{i + 1}</span>
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ol>

      {/* ------------------------------------------------- 1. treatment -- */}
      {step === 1 && (
        <div className="bk-panel">
          <h2 className="bk-h">Which treatment?</h2>
          {services.length === 0 && (
            <p className="sf-note">
              Nothing is bookable online just now. <Link href={servicesHref}>See the menu</Link> and
              get in touch and we&rsquo;ll find you a time.
            </p>
          )}
          {[...byCategory.entries()].map(([cat, items]) => (
            <div key={cat} className="bk-group">
              <div className="bk-group-h">{cat.replace(/_/g, ' ')}</div>
              {items.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={`bk-service${service?.id === s.id ? ' is-picked' : ''}`}
                  onClick={() => { setService(s); setStep(2); }}
                >
                  <span className="bk-service-main">
                    <b>{s.name}</b>
                    {s.description && <span className="bk-service-desc">{s.description}</span>}
                  </span>
                  <span className="bk-service-meta">
                    <b>{s.priceLabel}</b>
                    <span>{s.duration_min} min</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------ 2. date & time -- */}
      {step === 2 && service && (
        <div className="bk-panel">
          <h2 className="bk-h">When suits you?</h2>
          <p className="bk-chosen">{service.name} · {service.duration_min} min</p>

          <div className="bk-cal">
            <div className="bk-cal-head">
              <button type="button" aria-label="Previous month"
                      disabled={month <= new Date(today.getFullYear(), today.getMonth(), 1)}
                      onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
                &lsaquo;
              </button>
              <span>{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
              <button type="button" aria-label="Next month"
                      onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
                &rsaquo;
              </button>
            </div>

            <div className="bk-cal-grid" role="grid">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div className="bk-cal-dow" key={i} aria-hidden="true">{d}</div>
              ))}
              {Array.from({ length: new Date(month.getFullYear(), month.getMonth(), 1).getDay() })
                .map((_, i) => <div key={`pad${i}`} />)}
              {Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() })
                .map((_, i) => {
                  const d = new Date(month.getFullYear(), month.getMonth(), i + 1, 12);
                  const key = iso(d);
                  const can = bookable(d);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`bk-day${date === key ? ' is-picked' : ''}`}
                      disabled={!can}
                      aria-label={`${d.getDate()} ${MONTHS[d.getMonth()]}`}
                      onClick={() => setDate(key)}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
            </div>
          </div>

          {date && (
            <div className="bk-times">
              <h3 className="bk-h3">
                {new Date(date + 'T12:00:00').toLocaleDateString('en-US',
                  { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>

              {slots === null && <p className="muted">Looking for free times&hellip;</p>}

              {slots !== null && slots.length === 0 && (
                <p className="sf-note">
                  Nothing free that day. Try another &mdash; or{' '}
                  <Link href={`${servicesHref.replace('/services', '/enquire')}`}>ask us</Link> and
                  we&rsquo;ll see what we can do.
                </p>
              )}

              {slots !== null && slots.length > 0 && (
                <div className="bk-slots">
                  {slots.map(s => (
                    <button key={s} type="button"
                            className={`bk-slot${time === s ? ' is-picked' : ''}`}
                            onClick={() => { setTime(s); setStep(3); }}>
                      {prettyTime(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------- 3. details -- */}
      {step === 3 && service && date && time && (
        <form
          className="bk-panel"
          onSubmit={e => {
            e.preventDefault();
            setResult(null);
            startTransition(async () => {
              setResult(await book({
                slug, serviceId: service.id, date, time,
                first, last, email,
                phone: phone || undefined,
                note: note || undefined,
                smsConsent: sms
              }));
            });
          }}
        >
          <h2 className="bk-h">And who shall we put down?</h2>
          <p className="bk-chosen">
            {service.name} ·{' '}
            {new Date(date + 'T12:00:00').toLocaleDateString('en-US',
              { weekday: 'long', month: 'long', day: 'numeric' })} at {prettyTime(time)}
          </p>

          <div className="bk-fields">
            <label className="field">
              <span>First name</span>
              <input value={first} onChange={e => setFirst(e.target.value)}
                     required autoComplete="given-name" />
            </label>
            <label className="field">
              <span>Last name</span>
              <input value={last} onChange={e => setLast(e.target.value)}
                     required autoComplete="family-name" />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                     required autoComplete="email" />
            </label>
            <label className="field">
              <span>Phone</span>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                     autoComplete="tel" />
            </label>
          </div>

          <label className="field">
            <span>Anything we should know? <em>(optional)</em></span>
            <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
                      placeholder="Allergies, what you have had done before, what you are hoping for." />
          </label>

          {/*
            Unticked by default and worded so it is obvious what is being agreed
            to. A pre-ticked consent box is not consent, and an SMS list built
            from one cannot be defended if anybody asks.
          */}
          <label className="inline bk-consent">
            <input type="checkbox" checked={sms} onChange={e => setSms(e.target.checked)} />
            <span>
              Text me about this appointment. Reminders and changes only &mdash;
              not marketing. Reply STOP any time.
            </span>
          </label>

          {result && !result.ok && <p className="sf-error" role="alert">{result.error}</p>}

          <button className="sf-btn primary" type="submit" disabled={pending}>
            {pending ? 'Booking…' : 'Confirm booking'}
          </button>
        </form>
      )}
    </div>
  );
}
