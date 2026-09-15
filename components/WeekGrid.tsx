'use client';

/**
 * components/WeekGrid.tsx
 * The working week — drawn to scale on a desktop, listed on a phone.
 *
 * WHY A GRID AND NOT A LIST (on a wide screen)
 *
 * A list of appointments answers "what is booked". A practitioner planning her
 * week needs the other question — "where are the gaps, and how big are they" —
 * and that one is only answerable if time is drawn to scale. A ninety-minute
 * treatment has to LOOK three times a fifteen-minute consult, or the empty
 * afternoon between two of them is invisible.
 *
 * WHY A LIST AND NOT A GRID (on a phone)
 *
 * And that argument stops applying at about 700px. Seven columns need roughly
 * 830px before a treatment name fits in one, so on a phone the grid became a
 * horizontal scroll through seven slivers: you could see Monday or Thursday,
 * never the week, which is the only thing the grid was for. Worse, every
 * affordance on it was hover-only, and a phone has no hover — an empty day was
 * a blank rectangle with nothing to press.
 *
 * So under 880px this renders an agenda instead: each open day, its
 * appointments in order, closed days collapsed to one quiet line. Same data,
 * same component, chosen in CSS rather than JavaScript so it is right on the
 * first paint and cannot flash the wrong layout while hydrating.
 *
 * CLOSED DAYS STAY IN THE WEEK, greyed. Removing them would make a Mon/Wed/Fri
 * practice's week three columns wide and hide the shape of it — and the day she
 * is closed is exactly where an extra session would go if somebody asked.
 *
 * The hour range comes from the practice's own opening times, widened to cover
 * anything already booked outside them. Midnight-to-midnight is mostly empty
 * space; stopping at closing time hides the appointment that overran.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { CalendarEvent } from '@/lib/db/calendar';

const TZ = 'America/Denver';

/** Minutes from midnight, read in the practice's timezone. */
function minutesInto(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date(iso));
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

function dayKeyOf(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
}

function clockOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: TZ, hour: 'numeric', minute: '2-digit'
  });
}

/** "45 min" / "1h 30". Duration is the thing the grid draws, so it is named. */
function lengthOf(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}` : `${h}h`;
}

const CANCELLED = new Set(['cancelled', 'no_show']);

type Day = { date: string; label: string; dow: string; isToday: boolean; open: boolean };

export function WeekGrid({
  week,
  focusDate
}: {
  week: {
    startDate: string;
    days: Day[];
    events: CalendarEvent[];
    firstHour: number;
    lastHour: number;
  };
  focusDate?: string | null;
}) {
  const router = useRouter();

  const top = week.firstHour * 60;
  const bottom = week.lastHour * 60;
  const span = Math.max(60, bottom - top);

  /**
   * 1.1px per minute — an hour is 66px.
   *
   * Was 0.9 (54px/hour), which made a 15-minute consult 13px tall: shorter than
   * the line of text inside it, so the time and the name collided into an
   * unreadable smear. At 1.1 the shortest bookable slot clears its own label
   * and a nine-hour day is still under 600px.
   */
  const SCALE = 1.1;
  /**
   * Rounded, every time it reaches a style attribute.
   *
   * 1.1 is not representable in binary floating point, so `198 * 1.1` prints as
   * 198.00000000000003 and thirty-four of those went into the markup. Beyond
   * being noise, a value the server computes and the client recomputes is a
   * hydration mismatch waiting for a rounding difference.
   */
  const px = (n: number) => `${Math.round(n)}px`;
  const height = span * SCALE;

  const hours = Array.from(
    { length: week.lastHour - week.firstHour + 1 },
    (_, i) => week.firstHour + i
  );

  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of week.events) {
    const key = dayKeyOf(e.startsAt);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }
  const eventsFor = (date: string) =>
    (byDay.get(date) ?? []).slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  /**
   * The red line across now.
   *
   * Rendered only after mount. The server does not know the reader's clock, and
   * a time drawn during SSR is wrong by however long the page sat in a cache —
   * on a screen whose whole job is "what is happening now", a confidently
   * misplaced line is worse than no line.
   */
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [todayKey, setTodayKey] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const iso = new Date().toISOString();
      setNowMin(minutesInto(iso));
      setTodayKey(dayKeyOf(iso));
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  const visibleDays = focusDate
    ? week.days.filter(d => d.date === focusDate)
    : week.days;
  const openDays = visibleDays.filter(d => d.open);
  const closedDays = visibleDays.filter(d => !d.open);
  const total = week.events.filter(e => !CANCELLED.has(e.status)).length;

  function EventButton({ e }: { e: CalendarEvent }) {
    const cancelled = CANCELLED.has(e.status);
    return (
      <button
        type="button"
        className={`cal-row st-${e.status}`}
        onClick={() => e.patientId && router.push(`/console/clients/${e.patientId}`)}
        // Not a button at all when there is nothing to open. A control that
        // looks pressable and does nothing is worse than plain text.
        disabled={!e.patientId}
      >
        <span className="cal-row-time">
          <span className="t">{clockOf(e.startsAt)}</span>
          <span className="d">{lengthOf(e.durationMin)}</span>
        </span>
        <span className="cal-row-body">
          <span className="cal-row-who">
            {e.title}
            {e.bookedOnline && <i className="cal-dot online" title="Booked online" />}
            {!e.intakeComplete && <i className="cal-dot intake" title="Intake incomplete" />}
          </span>
          {e.subtitle && <span className="cal-row-what">{e.subtitle}</span>}
          {/* Spelled out rather than conveyed by a strikethrough nobody can
              read at 40% opacity. */}
          {cancelled && <span className="cal-row-flag">{e.status === 'no_show' ? 'No show' : 'Cancelled'}</span>}
        </span>
      </button>
    );
  }

  return (
    <div className={`cal${focusDate ? ' cal-day-view' : ''}`}>
      {/* ------------------------------------------------ wide screens -- */}
      <div className="cal-week" aria-hidden={false}>
        <div className="cal-grid" style={{ height: px(height + 42) }}>
          <div className="cal-gutter">
            <div className="cal-dayhead" aria-hidden="true" />
            <div className="cal-hours" style={{ height: px(height) }}>
              {hours.map(h => (
                <div key={h} className="cal-hour"
                     style={{ top: px((h * 60 - top) * SCALE) }}>
                  {h % 12 === 0 ? 12 : h % 12}<small>{h < 12 ? 'am' : 'pm'}</small>
                </div>
              ))}
            </div>
          </div>

          {week.days.map(day => {
            const events = eventsFor(day.date);
            const isNowDay = todayKey === day.date && nowMin !== null
              && nowMin >= top && nowMin <= bottom;

            return (
              <div className={`cal-col${day.isToday ? ' is-today' : ''}${day.open ? '' : ' is-closed'}`}
                   key={day.date}>
                <div className="cal-dayhead">
                  <span className="dow">{day.dow}</span>
                  <span className="dat">{day.label}</span>
                  {!day.open && <span className="shut">closed</span>}
                </div>

                <div className="cal-day" style={{ height: px(height) }}>
                  {hours.map(h => (
                    <div key={h} className="cal-line"
                         style={{ top: px((h * 60 - top) * SCALE) }} aria-hidden="true" />
                  ))}

                  {isNowDay && (
                    <div className="cal-now" style={{ top: px((nowMin! - top) * SCALE) }}
                         aria-hidden="true" />
                  )}

                  {events.map(e => {
                    const s = minutesInto(e.startsAt);
                    const mins = Math.max(15, e.durationMin);
                    const y = (s - top) * SCALE;
                    const h = mins * SCALE;

                    if (e.kind === 'blocked') {
                      return (
                        <div key={e.id} className="cal-block"
                             style={{ top: px(y), height: px(h) }}
                             title={e.title}>
                          <span>{e.title}</span>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={e.id}
                        type="button"
                        className={`cal-event st-${e.status}${mins < 40 ? ' is-short' : ''}`}
                        style={{ top: px(y), height: px(h) }}
                        onClick={() => e.patientId && router.push(`/console/clients/${e.patientId}`)}
                        title={`${clockOf(e.startsAt)} · ${lengthOf(e.durationMin)} · ${e.title}${e.subtitle ? ' · ' + e.subtitle : ''}`}
                      >
                        <span className="cal-event-time">{clockOf(e.startsAt)}</span>
                        <span className="cal-event-who">
                          {e.title}
                          {e.bookedOnline && <i className="cal-dot online" title="Booked online" />}
                          {!e.intakeComplete && <i className="cal-dot intake" title="Intake incomplete" />}
                        </span>
                        {mins >= 40 && e.subtitle && (
                          <span className="cal-event-what">{e.subtitle}</span>
                        )}
                      </button>
                    );
                  })}

                  {/*
                    Visible, not hover-only. This was opacity:0 until :hover,
                    which means it never appeared on a touch screen at all and
                    an empty day had nothing to press. It is quiet instead.
                  */}
                  {day.open && events.length === 0 && (
                    <Link className="cal-empty" href={`/console/book?date=${day.date}`}>
                      <span>+ book</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ----------------------------------------------------- phones -- */}
      <div className="cal-agenda">
        {openDays.map(day => {
          const events = eventsFor(day.date);
          return (
            <section className={`cal-agenda-day${day.isToday ? ' is-today' : ''}`} key={day.date}>
              <h3>
                <span className="dow">{day.dow}</span>
                <span className="dat">{day.label}</span>
                {day.isToday && <span className="today">today</span>}
                <span className="n">
                  {events.length === 0 ? 'free' : `${events.length} booked`}
                </span>
              </h3>

              {events.length === 0 ? (
                <Link className="cal-agenda-empty" href={`/console/book?date=${day.date}`}>
                  Nothing booked — add an appointment
                </Link>
              ) : (
                <div className="cal-agenda-list">
                  {events.map(e => <EventButton key={e.id} e={e} />)}
                </div>
              )}
            </section>
          );
        })}

        {closedDays.length > 0 && (
          <p className="cal-agenda-closed">
            Closed {closedDays.map(d => d.dow).join(', ')}
          </p>
        )}

        {total === 0 && openDays.length === 0 && (
          <p className="cal-agenda-closed">The practice is closed all week.</p>
        )}
      </div>

      <p className="cal-key">
        <span><i className="cal-swatch st-confirmed" /> confirmed by the client</span>
        <span><i className="cal-dot online" /> booked online</span>
        <span><i className="cal-dot intake" /> intake incomplete</span>
        <span><i className="cal-swatch st-complete" /> complete</span>
        <span><i className="cal-swatch st-cancelled" /> cancelled</span>
      </p>
    </div>
  );
}
