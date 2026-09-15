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
import { serverClient } from '@/lib/supabase/server';
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
  searchParams: Promise<{ week?: string; day?: string; at?: string }>;
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

  /**
   * WHERE, as a filter. Everything, by default.
   *
   * Seeing the whole week regardless of where each appointment is is the right
   * default and always was — she is one person and can only be in one place at
   * a time, so a day with two appointments in two towns is exactly the day she
   * most needs drawn together rather than split apart.
   *
   * The filter is for the other question: "what am I doing at Gameday this
   * month", when reconciling with them or deciding whether the arrangement is
   * worth keeping. In the URL like the roster search, so it survives the week
   * arrows and can be sent to somebody.
   *
   * 'base' rather than a uuid for the usual room, because the default location
   * is recorded as NULL on the appointment — every booking made before
   * locations existed means "the usual place", and a filter that missed those
   * would quietly under-report her own studio.
   */
  const supabaseForLocations = await serverClient();
  const { data: locationRows } = await supabaseForLocations
    .from('location')
    .select('id, name, is_default')
    .eq('clinic_id', clinic.id)
    .eq('active', true)
    .order('sort_order');

  const locations = (locationRows ?? []) as { id: string; name: string; is_default: boolean }[];
  const at = params.at ?? '';
  const defaultLocationId = locations.find(l => l.is_default)?.id ?? null;

  const matchesFilter = (e: { locationId?: string | null }) => {
    if (!at) return true;
    const isDefault = !e.locationId || e.locationId === defaultLocationId;
    return at === 'base' ? isDefault : e.locationId === at;
  };

  const shown = { ...week, events: week.events.filter(matchesFilter) };

  const appointments = shown.events.filter(e => e.kind === 'appointment');
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
        {/*
          Only when there is more than one place to be. A practice with one
          room does not need a control that always says the same thing.

          Plain links, so the filter lives in the URL: it survives the week
          arrows, it can be sent to somebody, and the back button works.
        */}
        {locations.length > 1 && (
          <nav className="loc-filter" aria-label="Filter by location">
            <Link
              href={`/console/calendar?week=${requested}`}
              className={`btn sm${at ? '' : ' primary'}`}
            >
              Everywhere
            </Link>
            {locations.map(l => {
              const key = l.is_default ? 'base' : l.id;
              return (
                <Link
                  key={l.id}
                  href={`/console/calendar?week=${requested}&at=${key}`}
                  className={`btn sm${at === key ? ' primary' : ''}`}
                >
                  {l.name}
                </Link>
              );
            })}
          </nav>
        )}

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
