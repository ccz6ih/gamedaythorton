/**
 * app/console/calendar/page.tsx — the week.
 *
 * "Today" answers what is happening now. This answers what the week looks like,
 * which is the question behind every other one: whether to take a walk-in,
 * whether Friday is worth opening, where a rebooking actually fits.
 *
 * Drawn to scale rather than listed. See components/WeekGrid.tsx.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { getClinic } from '@/lib/db/queries';
import { getCalendarWeek, weekStart } from '@/lib/db/calendar';
import { WeekGrid } from '@/components/WeekGrid';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Calendar' };

function shiftWeek(startDate: string, weeks: number): string {
  const d = new Date(startDate + 'T12:00:00');
  d.setDate(d.getDate() + weeks * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDay(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<{ week?: string; day?: string }>;
}) {
  const params = await searchParams;
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const tz = clinic.timezone || 'America/Denver';
  const thisWeek = weekStart(new Date(), tz);
  const validDay = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : null;

  // Only accept a date we generated. A hand-typed value would otherwise decide
  // what the query asks for.
  const requested = validDay
    ? weekStart(new Date(validDay + 'T12:00:00'), tz)
    : params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week)
    ? weekStart(new Date(params.week + 'T12:00:00'), tz)
    : thisWeek;

  const week = await getCalendarWeek(clinic, requested);

  const appointments = week.events.filter(e => e.kind === 'appointment');
  const live = appointments.filter(e => e.status !== 'cancelled' && e.status !== 'no_show');
  const online = live.filter(e => e.bookedOnline).length;
  const missingIntake = live.filter(e => !e.intakeComplete).length;
  const bookedMinutes = live.reduce((sum, e) => sum + e.durationMin, 0);

  const openDays = week.days.filter(d => d.open).length;
  const capacityMinutes = (clinic.hours ?? [])
    .filter(h => h.open && h.close)
    .reduce((sum, h) => {
      const open = Number(h.open!.slice(0, 2)) * 60 + Number(h.open!.slice(3, 5));
      const close = Number(h.close!.slice(0, 2)) * 60 + Number(h.close!.slice(3, 5));
      return sum + Math.max(0, close - open);
    }, 0);

  const utilisation = capacityMinutes
    ? Math.round((bookedMinutes / capacityMinutes) * 100)
    : 0;

  const label = `${new Date(week.days[0]!.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${new Date(week.days[6]!.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{clinic.name}</div>
          <h1>Calendar</h1>
        </div>
        <div className="spacer" />
        <div className="row tight">
          {validDay ? (
            <>
              <Link className="btn sm" href={`/console/calendar?day=${shiftDay(validDay, -1)}`}>&lsaquo;</Link>
              <Link className="btn sm" href={`/console/calendar?day=${shiftDay(validDay, 1)}`}>&rsaquo;</Link>
              <Link className="btn sm" href={`/console/calendar?week=${requested}`}>Week</Link>
            </>
          ) : (
            <>
              <Link className="btn sm" href={`/console/calendar?week=${shiftWeek(requested, -1)}`}>&lsaquo;</Link>
              <Link className="btn sm" href="/console/calendar">This week</Link>
              <Link className="btn sm" href={`/console/calendar?week=${shiftWeek(requested, 1)}`}>&rsaquo;</Link>
              <Link className="btn sm" href={`/console/calendar?day=${requested}`}>Day</Link>
            </>
          )}
          <Link className="btn sm primary" href="/console/book">Book</Link>
        </div>
      </header>

      <div className="view wide">
        <div className="cal-title">
          <h2>{validDay ? new Date(validDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : label}</h2>
          {validDay ? (
            <Link href={requested === thisWeek ? '/console/calendar' : `/console/calendar?week=${requested}`} className="banner-link">back to week</Link>
          ) : requested !== thisWeek && (
            <Link href="/console/calendar" className="banner-link">back to this week</Link>
          )}
        </div>

        <div className="grid g4">
          <div className="stat">
            <div className="lab">Booked</div>
            <div className="stat-val">{live.length}</div>
            <div className="note">
              {Math.round(bookedMinutes / 60 * 10) / 10} hours across {openDays} open day{openDays === 1 ? '' : 's'}
            </div>
          </div>
          <div className="stat">
            <div className="lab">How full</div>
            <div className="stat-val">{utilisation}%</div>
            <div className="note">Of the hours the practice is open</div>
          </div>
          <div className="stat">
            <div className="lab">Booked online</div>
            <div className="stat-val">{online}</div>
            <div className="note">
              {live.length ? `${Math.round((online / live.length) * 100)}% of the week` : 'Nothing booked yet'}
            </div>
          </div>
          <div className="stat">
            <div className="lab">Intake missing</div>
            <div className="stat-val">{missingIntake}</div>
            <div className="note">
              {missingIntake ? 'Each one costs clinical minutes' : 'All complete'}
            </div>
          </div>
        </div>

        <section className="card flush" style={{ marginTop: 'var(--gd-5)' }}>
          <WeekGrid week={week} focusDate={validDay} />
        </section>

        {live.length === 0 && (
          <p className="muted" style={{ marginTop: 'var(--gd-5)' }}>
            Nothing booked this week. Appointments taken on the website land here
            on their own &mdash; <Link href="/console/book">or add one</Link>.
          </p>
        )}
      </div>
    </>
  );
}
