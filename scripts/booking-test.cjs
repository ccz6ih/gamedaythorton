/**
 * booking-test.cjs
 * Booking from the website: it works, and it tells a stranger nothing.
 *
 * The second half is the one worth having. A booking form necessarily leaks
 * SOME information — which times are free is, unavoidably, information about
 * the diary. What it must not leak is who is in it. These checks confirm that
 * an anonymous caller can find a slot and take it while learning nothing about
 * any appointment, client, or blocked period.
 *
 * Run:  node scripts/booking-test.cjs
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SLUG = 'medbar-loveland';
const TEST_EMAIL = 'booking-test@example.invalid';

let pass = 0, fail = 0;
const ok = (m, n) => { pass++; console.log(`  ✓ ${m}${n ? '  ' + n : ''}`); };
const bad = (m, e) => { fail++; console.log(`  ✗ ${m}`); if (e) console.log('      ' + String(e).slice(0, 240)); };

const anon = (p, opts = {}) =>
  fetch(`${URL_SB}/rest/v1/${p}`, {
    ...opts,
    headers: { apikey: KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

const rpc = (fn, args) => anon(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

/** The next date that falls on a day the practice opens. */
function nextOpenDate(hours, offsetDays = 3) {
  const open = new Set(hours.filter(h => h.open && h.close).map(h => h.day));
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  for (let i = 0; i < 21; i++) {
    if (open.has(DOW[d.getDay()])) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

(async () => {
  console.log('\nBOOKING — as an anonymous visitor\n');
  if (!URL_SB || !KEY) { console.error('  Missing Supabase config.\n'); process.exit(1); }

  /* ===================================================================
     THE DIARY IS NOT READABLE
     =================================================================== */
  console.log('THE DIARY STAYS PRIVATE');

  for (const table of ['appointment', 'patient', 'blocked_time', 'treatment_record', 'client_note']) {
    const { status, body } = await anon(`${table}?select=*&limit=5`);
    if (status >= 400 || (Array.isArray(body) && body.length === 0)) {
      ok(`anon reads no ${table}`, status >= 400 ? `refused (${status})` : 'returns empty');
    } else {
      bad(`anon reads no ${table}`, `${Array.isArray(body) ? body.length : '?'} rows visible`);
    }
  }

  /* ===================================================================
     AVAILABILITY
     =================================================================== */
  console.log('\nAVAILABILITY IS COMPUTED, NOT READ');

  const { body: clinics } = await anon(`clinic?select=hours&slug=eq.${SLUG}`);
  const hours = clinics?.[0]?.hours ?? [];
  if (hours.length) ok('opening hours are public', hours.filter(h => h.open).map(h => h.day).join(' '));
  else bad('opening hours are public');

  const { body: svcs } = await anon(
    `service?select=id,name,duration_min&online_bookable=eq.true&active=eq.true&limit=1`);
  const service = svcs?.[0];
  if (!service) { bad('found a bookable service'); process.exit(1); }
  ok('found a bookable service', `${service.name}, ${service.duration_min}min`);

  const openDate = nextOpenDate(hours);
  const closedDay = (() => {
    const open = new Set(hours.filter(h => h.open).map(h => h.day));
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const d = new Date();
    d.setDate(d.getDate() + 2);
    for (let i = 0; i < 14; i++) {
      if (!open.has(DOW[d.getDay()])) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      d.setDate(d.getDate() + 1);
    }
    return null;
  })();

  const free = await rpc('public_slots', {
    p_clinic_slug: SLUG, p_service_id: service.id, p_date: openDate
  });
  const slots = Array.isArray(free.body) ? free.body : [];
  if (slots.length > 0) ok('an open day offers times', `${openDate}: ${slots.length} slots`);
  else bad('an open day offers times', `${openDate} returned nothing`);

  if (closedDay) {
    const shut = await rpc('public_slots', {
      p_clinic_slug: SLUG, p_service_id: service.id, p_date: closedDay
    });
    if (Array.isArray(shut.body) && shut.body.length === 0) ok('a closed day offers none', closedDay);
    else bad('a closed day offers none', JSON.stringify(shut.body).slice(0, 120));
  }

  const past = await rpc('public_slots', {
    p_clinic_slug: SLUG, p_service_id: service.id, p_date: '2020-01-06'
  });
  if (Array.isArray(past.body) && past.body.length === 0) ok('the past offers none');
  else bad('the past offers none');

  const farOff = await rpc('public_slots', {
    p_clinic_slug: SLUG, p_service_id: service.id, p_date: '2030-01-07'
  });
  if (Array.isArray(farOff.body) && farOff.body.length === 0) ok('beyond the horizon offers none', 'no booking in 2030');
  else bad('beyond the horizon offers none');

  const otherClinic = await rpc('public_slots', {
    p_clinic_slug: 'gameday-thornton', p_service_id: service.id, p_date: openDate
  });
  if (Array.isArray(otherClinic.body) && otherClinic.body.length === 0) {
    ok('a retired practice offers none', 'and a service from another tenant is refused');
  } else {
    bad('a retired practice offers none', JSON.stringify(otherClinic.body).slice(0, 120));
  }

  /* ===================================================================
     BOOKING
     =================================================================== */
  console.log('\nA BOOKING CAN ACTUALLY BE MADE');

  const time = slots[Math.floor(slots.length / 2)];
  let booked = null;

  if (!time) {
    bad('took a slot', 'no free slot to take');
  } else {
    const res = await rpc('book_appointment', {
      p_clinic_slug: SLUG, p_service_id: service.id, p_date: openDate, p_time: time,
      p_first: 'Booking', p_last: 'Test', p_email: TEST_EMAIL, p_phone: '+19705550142'
    });

    if (res.status < 300 && res.body?.appointment_id) {
      booked = res.body;
      ok('took a slot', `${openDate} ${time}`);
    } else {
      bad('took a slot', JSON.stringify(res.body).slice(0, 220));
    }
  }

  if (booked) {
    const after = await rpc('public_slots', {
      p_clinic_slug: SLUG, p_service_id: service.id, p_date: openDate
    });
    const stillFree = Array.isArray(after.body) ? after.body : [];
    if (!stillFree.includes(time)) ok('that time is no longer offered');
    else bad('that time is no longer offered', 'the slot is still bookable — double booking is possible');

    // The same time again must be refused, which is the real double-booking test.
    const again = await rpc('book_appointment', {
      p_clinic_slug: SLUG, p_service_id: service.id, p_date: openDate, p_time: time,
      p_first: 'Second', p_last: 'Person', p_email: 'booking-test-2@example.invalid'
    });
    if (again.status >= 400) ok('the same time cannot be booked twice', `refused (${again.status})`);
    else bad('the same time cannot be booked twice', 'two people now hold one slot');

    // And the booking itself is still not readable.
    const { body: peek } = await anon('appointment?select=id,starts_at&limit=5');
    if (Array.isArray(peek) && peek.length === 0) ok('and the booking is invisible to anon');
    else bad('and the booking is invisible to anon', `${peek?.length} rows`);
  }

  /* ===================================================================
     BAD INPUT
     =================================================================== */
  console.log('\nBAD INPUT IS REFUSED');

  const noName = await rpc('book_appointment', {
    p_clinic_slug: SLUG, p_service_id: service.id, p_date: openDate,
    p_time: slots[0] ?? '09:00', p_first: '', p_last: '', p_email: TEST_EMAIL
  });
  if (noName.status >= 400) ok('a booking with no name is refused', `refused (${noName.status})`);
  else bad('a booking with no name is refused');

  const badEmail = await rpc('book_appointment', {
    p_clinic_slug: SLUG, p_service_id: service.id, p_date: openDate,
    p_time: slots[0] ?? '09:00', p_first: 'A', p_last: 'B', p_email: 'not-an-email'
  });
  if (badEmail.status >= 400) ok('a bad email is refused', `refused (${badEmail.status})`);
  else bad('a bad email is refused');

  const closedBooking = closedDay ? await rpc('book_appointment', {
    p_clinic_slug: SLUG, p_service_id: service.id, p_date: closedDay,
    p_time: '10:00', p_first: 'A', p_last: 'B', p_email: TEST_EMAIL
  }) : null;
  if (!closedBooking || closedBooking.status >= 400) {
    ok('a closed day cannot be booked', closedDay ?? 'no closed day to test');
  } else {
    bad('a closed day cannot be booked', 'booked on a day the practice is shut');
  }

  /* ------------------------------------------------------------ cleanup -- */
  console.log('\nCLEANUP');
  const { Client } = require('pg');
  const ref = process.env.SUPABASE_PROJECT_REF;
  const dbpw = process.env.SUPABASE_DB_PASSWORD;

  if (!ref || !dbpw) {
    bad('test bookings removed', "no database credentials; rows are on the practice's calendar");
  } else {
    const region = process.env.SUPABASE_REGION || 'us-east-1';
    const admin = new Client({
      connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(dbpw)}@aws-0-${region}.pooler.supabase.com:6543/postgres`
    });
    await admin.connect();
    await admin.query(
      `delete from appointment a using patient p
        where p.id = a.patient_id and p.email in ($1, 'booking-test-2@example.invalid')`, [TEST_EMAIL]);
    await admin.query(`delete from lead where email in ($1, 'booking-test-2@example.invalid')`, [TEST_EMAIL]);
    await admin.query(`delete from patient where email in ($1, 'booking-test-2@example.invalid')`, [TEST_EMAIL]);

    const { rows } = await admin.query(
      `select count(*)::int as n from patient where email in ($1, 'booking-test-2@example.invalid')`, [TEST_EMAIL]);
    await admin.end();

    if (rows[0].n === 0) ok('test bookings removed', 'and verified gone');
    else bad('test bookings removed', `${rows[0].n} left on the calendar`);
  }

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
