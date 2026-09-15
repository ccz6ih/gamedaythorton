/**
 * lib/time.ts
 * Turning "the 16th at 2pm" into an instant, in the practice's timezone.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * The staff booking form built its timestamp like this:
 *
 *     starts_at: `${date}T${time}:00`
 *
 * with a comment saying "Naive local time. The practice's timezone is what a
 * wall clock means here." That was the intent, and nothing implemented it. A
 * naive string going into a `timestamptz` column is interpreted in the server's
 * timezone, which on Supabase is UTC — so a receptionist typing 9:00 stored
 * 09:00 UTC, which is 3:00 in the morning in Colorado.
 *
 * It was found on a real appointment: a client's second hair-restoration
 * session, booked for tomorrow, sitting in the calendar at 3am.
 *
 * The public booking path never had this bug. app.book_appointment does the
 * conversion in SQL —
 *
 *     (p_date || ' ' || p_time)::timestamp at time zone 'America/Denver'
 *
 * — so appointments clients made themselves are correct and appointments the
 * practice made are six hours out. Which is the worst way round for it to be:
 * the ones staff enter are the ones staff trust.
 *
 * ---------------------------------------------------------------------------
 * WHY NOT JUST APPEND "-06:00"
 * ---------------------------------------------------------------------------
 * Because Colorado is -06:00 for eight months of the year and -07:00 for the
 * other four, and the changeover lands mid-season on a working week. Hard-coding
 * either one is a bug with a date on it.
 *
 * Intl knows the rules. This asks it what the offset actually is on that day.
 */

/** The practice's zone, when the clinic record has not set one. */
export const DEFAULT_TZ = 'America/Denver';

/**
 * How far `timeZone` is from UTC at a given instant, in milliseconds.
 *
 * Works by formatting the instant AS that zone, reading the wall-clock digits
 * back, and asking how far they are from the same digits read as UTC. It is the
 * standard trick, and it is here rather than inline because getting it slightly
 * wrong produces times that are correct for most of the year.
 */
function offsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(at);

  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
  // Intl renders midnight as hour 24 in some environments.
  const hour = get('hour') % 24;

  const asIfUtc = Date.UTC(
    get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second')
  );
  return asIfUtc - at.getTime();
}

/**
 * "2026-09-16" + "14:00" in Denver → the ISO instant that actually is.
 *
 * Two passes. The first guess uses the offset at the UTC-interpreted time,
 * which is the wrong instant and therefore possibly the wrong side of a
 * daylight-saving change; correcting and re-reading the offset settles it. On
 * the two days a year when the clock moves, one pass can be an hour out, and an
 * appointment an hour out is a client arriving to a locked door.
 */
export function localToInstant(date: string, time: string, timeZone = DEFAULT_TZ): string {
  const naive = Date.parse(`${date}T${time}:00Z`);
  if (Number.isNaN(naive)) {
    throw new Error(`Not a date and time: "${date}" "${time}"`);
  }

  let utc = naive - offsetMs(new Date(naive), timeZone);
  utc = naive - offsetMs(new Date(utc), timeZone);

  return new Date(utc).toISOString();
}
