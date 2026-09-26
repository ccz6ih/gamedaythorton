/**
 * components/MonthGrid.tsx
 * A month at a glance, then the day you picked, underneath.
 *
 * ===========================================================================
 * BUILT FOR THE PHONE FIRST
 * ===========================================================================
 * The week grid is a time-proportional drawing: columns for days, rows for
 * hours, blocks sized by duration. That is the right picture on a laptop and
 * an impossible one at 390px, where it becomes an 832px canvas in a sideways
 * scroller. Below 880px it is swapped for an agenda list — which works, but
 * answers "what is on this week" by making you scroll through seven days.
 *
 * The question that actually comes first is WHICH DAY. So: a month grid where
 * every day is a tap target, and the chosen day printed properly beneath it.
 * That is what a paper appointment book does, and it is why the paper one is
 * still faster than most software for finding a free Tuesday.
 *
 * ===========================================================================
 * NO JAVASCRIPT
 * ===========================================================================
 * Every cell is a <Link> carrying the date in the URL, so this is a server
 * component with no state, no hydration and no click handler. It works on the
 * first paint, the back button behaves, a day can be sent to somebody, and a
 * dead zone of unhydrated JavaScript cannot eat a tap in a treatment room on
 * bad signal.
 *
 * ===========================================================================
 * COUNTS, NOT NAMES
 * ===========================================================================
 * Cells show density, not who is coming. Forty-two cells of clipped client
 * names is noise at any width and unreadable at phone width; what the grid is
 * for is showing where the space is. Names live in the agenda below, where
 * there is room to read them.
 */

import Link from 'next/link';
import type { CalendarMonth, CalendarEvent } from '@/lib/db/calendar';

const DOW_HEAD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function clockOf(iso: string, tz: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: tz, hour: 'numeric', minute: '2-digit'
  }).replace(':00', '').toLowerCase();
}

function lengthOf(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), r = min % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

const CANCELLED = new Set(['cancelled', 'no_show']);

export function MonthGrid({
  month,
  timezone,
  base
}: {
  month: CalendarMonth;
  timezone: string;
  /** Extra query the links must preserve, e.g. the location filter. */
  base?: string;
}) {
  const q = (date: string) => {
    const params = new URLSearchParams(base ?? '');
    params.set('month', date.slice(0, 7));
    params.set('on', date);
    return `?${params.toString()}`;
  };

  return (
    <div className="cal-month">
      <div className="cal-month-head">
        <Link
          className="cal-month-nav"
          href={q(`${month.prevMonth}-01`)}
          aria-label="Previous month"
        >‹</Link>
        <h2>{month.label}</h2>
        <Link
          className="cal-month-nav"
          href={q(`${month.nextMonth}-01`)}
          aria-label="Next month"
        >›</Link>
      </div>

      {/* Single letters, because seven three-letter headings do not fit at
          360px without either wrapping or shrinking the type past legibility.
          aria-hidden: the cells below carry their own full date label. */}
      <div className="cal-month-dow" aria-hidden="true">
        {DOW_HEAD.map((d, i) => <span key={i}>{d}</span>)}
      </div>

      <div className="cal-month-grid">
        {month.cells.map(c => {
          const selected = c.date === month.selected;
          const cls = [
            'cal-cell',
            c.inMonth ? '' : 'is-outside',
            c.isToday ? 'is-today' : '',
            selected ? 'is-selected' : '',
            !c.open ? 'is-closed' : '',
            c.isPast ? 'is-past' : ''
          ].filter(Boolean).join(' ');

          return (
            <Link
              key={c.date}
              href={q(c.date)}
              className={cls}
              aria-current={selected ? 'date' : undefined}
              aria-label={
                `${c.dow} ${c.dayNum}` +
                (c.count ? `, ${c.count} booked` : c.open ? ', nothing booked' : ', closed')
              }
            >
              <span className="n">{c.dayNum}</span>
              {/* Up to three dots, then a number. Dots read as "how full" at a
                  glance without being counted; past four they stop meaning
                  anything and a figure is honest. */}
              {c.count > 0 && (
                <span className="cal-cell-load">
                  {c.count <= 3
                    ? Array.from({ length: c.count }, (_, i) =>
                        <i key={i} className={`cal-pip${c.hasElsewhere ? ' is-elsewhere' : ''}`} />)
                    : <span className="cal-cell-n">{c.count}</span>}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <section className="cal-month-day">
        <h3>
          {month.selectedLabel}
          <span className="n">
            {month.selectedEvents.length === 0
              ? (month.selectedOpen ? 'nothing booked' : 'closed')
              : `${month.selectedEvents.length} booked`}
          </span>
        </h3>

        {month.selectedEvents.length === 0 ? (
          <Link className="cal-agenda-empty" href={`/console/book?date=${month.selected}`}>
            {month.selectedOpen
              ? 'Nothing booked — add an appointment'
              : 'Closed that day — you can still book by choosing a time'}
          </Link>
        ) : (
          <div className="cal-agenda-list">
            {month.selectedEvents.map(e => (
              <MonthRow key={e.id} e={e} tz={timezone} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * A link, not a button.
 *
 * The week grid's row is a <button> that calls router.push, which needs the
 * client bundle to have hydrated before a tap does anything. This one is an
 * anchor: it works immediately, opens in a new tab on middle click, and can be
 * long-pressed and shared — all of which the button silently refuses.
 */
function MonthRow({ e, tz }: { e: CalendarEvent; tz: string }) {
  const cancelled = CANCELLED.has(e.status);
  const inner = (
    <>
      <span className="cal-row-time">
        <span className="t">{clockOf(e.startsAt, tz)}</span>
        <span className="d">{lengthOf(e.durationMin)}</span>
      </span>
      <span className="cal-row-body">
        <span className="cal-row-who">
          {e.title}
          {e.bookedOnline && <i className="cal-dot online" title="Booked online" />}
          {!e.intakeComplete && <i className="cal-dot intake" title="Intake incomplete" />}
        </span>
        {e.subtitle && <span className="cal-row-what">{e.subtitle}</span>}
        {e.elsewhere && <span className="cal-row-where">{e.elsewhere}</span>}
        {cancelled && (
          <span className="cal-row-flag">{e.status === 'no_show' ? 'No show' : 'Cancelled'}</span>
        )}
      </span>
    </>
  );

  // Nothing to open for a blocked slot or a walk-in with no chart.
  if (!e.patientId) {
    return <div className={`cal-row st-${e.status} is-static`}>{inner}</div>;
  }
  return (
    <Link className={`cal-row st-${e.status}`} href={`/console/clients/${e.patientId}`}>
      {inner}
    </Link>
  );
}
