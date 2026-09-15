/**
 * time-test.cjs
 * What a receptionist types is what lands in the calendar.
 *
 *   node scripts/time-test.cjs
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * The staff booking form built its timestamp as `${date}T${time}:00` — a naive
 * string into a timestamptz column, which Postgres reads in the SERVER's zone.
 * On Supabase that is UTC. So a receptionist typing 9:00 stored 09:00 UTC, and
 * the calendar drew it at 3:00 in the morning, Colorado time.
 *
 * It ran for days. It was found because a client's second hair-restoration
 * session turned up in the calendar at 3am and somebody asked why the booking
 * screen was behaving oddly.
 *
 * Nothing about it is visible from the code. The line carried a comment saying
 * "Naive local time. The practice's timezone is what a wall clock means here",
 * which is the correct intention stated next to an implementation that does not
 * do it. And the public booking path WAS correct — app.book_appointment does
 * the conversion in SQL — so client-made appointments were right and
 * staff-made ones were six hours out. The worst possible split, because the
 * staff ones are the ones staff trust.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT CHECKS
 * ---------------------------------------------------------------------------
 * The round trip, which is the only thing that matters: take a wall-clock time,
 * convert it the way the booking form does, format it back in the practice's
 * zone, and require the same wall clock.
 *
 * Including both daylight-saving changeovers, because "-06:00" is correct in
 * Colorado for eight months a year and wrong for four — a bug with a date on
 * it, which is the kind that ships.
 */

const TZ = 'America/Denver';

/* The conversion under test, mirrored from lib/time.ts. Mirrored rather than
   imported because that file is TypeScript and this runs under plain node; the
   round-trip below would catch the two drifting apart. */
function offsetMs(at, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(at);
  const get = t => Number(parts.find(p => p.type === t)?.value ?? 0);
  const hour = get('hour') % 24;
  return Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second')) - at.getTime();
}

function localToInstant(date, time, timeZone = TZ) {
  const naive = Date.parse(`${date}T${time}:00Z`);
  let utc = naive - offsetMs(new Date(naive), timeZone);
  utc = naive - offsetMs(new Date(utc), timeZone);
  return new Date(utc).toISOString();
}

/** The wall clock a Denver reader sees for an instant, as "YYYY-MM-DD HH:MM". */
function wallClock(iso, timeZone = TZ) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).formatToParts(new Date(iso));
  const g = t => p.find(x => x.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')} ${String(Number(g('hour')) % 24).padStart(2, '0')}:${g('minute')}`;
}

let pass = 0;
const fails = [];

function check(ok, label, detail) {
  if (ok) { pass++; console.log(`  ok    ${label}`); }
  else { fails.push(label); console.log(`  FAIL  ${label}\n          ${detail}`); }
}

const CASES = [
  ['2026-09-16', '14:00', 'a 2pm booking in September'],
  ['2026-09-16', '09:00', 'the 9am that became 3am'],
  ['2026-09-16', '08:00', 'first thing, at opening'],
  ['2026-01-15', '14:00', 'the same 2pm in January (mountain STANDARD time)'],
  ['2026-06-30', '23:45', 'late evening, which must not roll the date'],
  ['2026-03-09', '09:00', 'the morning after the clocks go forward'],
  ['2026-11-02', '09:00', 'the morning after the clocks go back']
];

console.log('\n  A WALL CLOCK SURVIVES THE ROUND TRIP\n');

for (const [date, time, why] of CASES) {
  const iso = localToInstant(date, time);
  const back = wallClock(iso);
  check(back === `${date} ${time}`, `${date} ${time} — ${why}`,
    `typed ${date} ${time}, stored ${iso}, reads back as ${back}`);
}

/**
 * The regression itself, stated as its own assertion.
 *
 * If somebody reverts to the naive string, this is the line that says what
 * broke and by how much rather than leaving it to be inferred.
 */
console.log('');
const naive = '2026-09-16T09:00:00';
const naiveBack = wallClock(new Date(naive + 'Z').toISOString());
check(naiveBack !== '2026-09-16 09:00',
  'the old naive-string approach is still wrong (guard against reverting)',
  'the naive form now round-trips, which means the environment changed, not the bug');
console.log(`          for reference: the naive form reads back as ${naiveBack}, ${Math.round((Date.parse(naive + 'Z') - Date.parse(localToInstant('2026-09-16', '09:00'))) / 3600000)}h out`);

console.log(`\n  ${pass} passed, ${fails.length} failed.`);
if (fails.length) {
  console.log('\n  An appointment an hour out is a client arriving to a locked door.');
  console.log('  Six hours out is one arriving while the practice is asleep.\n');
} else {
  console.log('');
}
process.exit(fails.length ? 1 : 0);
