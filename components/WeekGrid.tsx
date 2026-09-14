'use client';

/**
 * components/WeekGrid.tsx
 * The working week, drawn to scale.
 *
 * WHY A GRID AND NOT A LIST
 *
 * A list of appointments answers "what is booked". A practitioner planning her
 * week needs the other question — "where are the gaps, and how big are they" —
 * and that one is only answerable if time is drawn to scale. A ninety-minute
 * treatment has to LOOK three times a fifteen-minute consult, or the empty
 * afternoon between two of them is invisible.
 *
 * CLOSED DAYS STAY IN THE GRID, greyed. Removing them would make a Mon/Wed/Fri
 * practice's week three columns wide and hide the shape of it — and the day she
 * is closed is exactly where an extra session would go if somebody asked.
 *
 * The hour range comes from the practice's own opening times, widened to cover
 * anything already booked outside them. Midnight-to-midnight is mostly empty
 * space; stopping at closing time hides the appointment that overran.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export function WeekGrid({
  week
}: {
  week: {
    startDate: string;
    days: { date: string; label: string; dow: string; isToday: boolean; open: boolean }[];
    events: CalendarEvent[];
    firstHour: number;
    lastHour: number;
  };
}) {
  const router = useRouter();

  const top = week.firstHour * 60;
  const bottom = week.lastHour * 60;
  const span = Math.max(60, bottom - top);

  // 0.9px per minute: an hour is ~54px, which fits a nine-hour day on a laptop
  // without scrolling and still leaves a 15-minute slot tall enough to label.
  const SCALE = 0.9;
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

  return (
    <div className="cal">
      <div className="cal-grid" style={{ height: `${height + 34}px` }}>
        {/* Hour gutter */}
        <div className="cal-gutter">
          <div className="cal-dayhead" aria-hidden="true" />
          <div className="cal-hours" style={{ height: `${height}px` }}>
            {hours.map(h => (
              <div key={h} className="cal-hour"
                   style={{ top: `${(h * 60 - top) * SCALE}px` }}>
                {h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'am' : 'pm'}
              </div>
            ))}
          </div>
        </div>

        {week.days.map(day => {
          const events = (byDay.get(day.date) ?? [])
            .slice()
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

          return (
            <div className={`cal-col${day.isToday ? ' is-today' : ''}${day.open ? '' : ' is-closed'}`}
                 key={day.date}>
              <div className="cal-dayhead">
                <span className="dow">{day.dow}</span>
                <span className="dat">{day.label}</span>
              </div>

              <div className="cal-day" style={{ height: `${height}px` }}>
                {hours.map(h => (
                  <div key={h} className="cal-line"
                       style={{ top: `${(h * 60 - top) * SCALE}px` }} aria-hidden="true" />
                ))}

                {events.map(e => {
                  const s = minutesInto(e.startsAt);
                  const mins = Math.max(15, e.durationMin);
                  const y = (s - top) * SCALE;
                  const h = mins * SCALE;

                  if (e.kind === 'blocked') {
                    return (
                      <div key={e.id} className="cal-block"
                           style={{ top: `${y}px`, height: `${h}px` }}
                           title={e.title}>
                        <span>{e.title}</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={e.id}
                      type="button"
                      className={`cal-event st-${e.status}`}
                      style={{ top: `${y}px`, height: `${h}px` }}
                      onClick={() => e.patientId && router.push(`/console/clients/${e.patientId}`)}
                      title={`${clockOf(e.startsAt)} · ${e.title}${e.subtitle ? ' · ' + e.subtitle : ''}`}
                    >
                      <span className="cal-event-time">{clockOf(e.startsAt)}</span>
                      <span className="cal-event-who">
                        {e.title}
                        {/* Two things a practitioner needs to see without
                            opening anything: it came in by itself, and the
                            intake is not done. */}
                        {e.bookedOnline && <i className="cal-dot online" title="Booked online" />}
                        {!e.intakeComplete && <i className="cal-dot intake" title="Intake incomplete" />}
                      </span>
                      {mins >= 30 && e.subtitle && (
                        <span className="cal-event-what">{e.subtitle}</span>
                      )}
                    </button>
                  );
                })}

                {day.open && events.length === 0 && (
                  <Link className="cal-empty" href={`/console/book?date=${day.date}`}>
                    nothing booked
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="cal-key">
        <span><i className="cal-dot online" /> booked online</span>
        <span><i className="cal-dot intake" /> intake incomplete</span>
        <span><i className="cal-swatch st-cancelled" /> cancelled</span>
        <span><i className="cal-swatch st-complete" /> complete</span>
      </p>
    </div>
  );
}
