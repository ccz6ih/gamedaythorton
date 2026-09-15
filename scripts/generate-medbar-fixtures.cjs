/**
 * generate-medbar-fixtures.cjs
 * Second tenant: The Med Bar, a med spa in Loveland CO — practice_type 'med_spa'.
 *
 * WHAT IS REAL HERE
 *   The practice name, address, opening hours, service catalogue, prices and
 *   package contents are taken from the practice's own public booking site
 *   (themedbarco.glossgenius.com). They are real so the demo is recognisable to
 *   the person who has to use it.
 *
 * WHAT IS DELIBERATELY BLANK
 *   The practitioner's credentials, licence details, bio, phone and email. Those
 *   are not published on her site and inventing professional qualifications for
 *   a real clinician would be indefensible — a fabricated credential in a
 *   medical product is not a placeholder, it is a false claim. They are marked
 *   TODO and collected at discovery.
 *
 * WHAT IS FABRICATED
 *   Every client, appointment, treatment record, photo and payment. As always.
 *   docs/09-compliance-register.md.
 *
 * Run:  node scripts/generate-medbar-fixtures.cjs
 * Out:  fixtures/medbar/*.json
 */

const fs = require('fs');
const { applyCopy } = require('./medbar-copy.cjs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'fixtures', 'medbar');
const CLINIC = 'clinic_medbar_loveland';

// Same anchor as the Gameday dataset: a Monday, so the demo clock shifts by
// whole weeks and weekday alignment survives. The Med Bar is open Mon/Wed/Fri,
// which makes correct weekday alignment more important here, not less.
const TODAY = new Date('2026-09-14T00:00:00Z');

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(4242);
const iso = d => new Date(d).toISOString().slice(0, 10);
const daysAgo = n => iso(new Date(TODAY.getTime() - n * 864e5));
const daysAhead = n => iso(new Date(TODAY.getTime() + n * 864e5));
const weeksAgo = w => daysAgo(w * 7);
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

// --------------------------------------------------------------- clinic ----

const clinic = {
  id: CLINIC,
  slug: 'medbar-loveland',
  name: 'The Med Bar',
  location_name: 'Loveland',
  practice_type: 'med_spa',
  address_line1: '2362 West 44th Street',
  address_city: 'Loveland',
  address_state: 'CO',
  address_zip: '80538',
  phone_voice: null,
  phone_text: null,
  email: 'jamie@medbarco.com',
  timezone: 'America/Denver',
  // Published hours. Narrow and split across three days, which makes the
  // waitlist and self-serve rebooking matter more here than they would for a
  // five-day practice.
  hours: [
    { day: 'Mon', open: '08:00', close: '15:00' },
    { day: 'Tue', open: null, close: null },
    { day: 'Wed', open: '08:00', close: '15:00' },
    { day: 'Thu', open: null, close: null },
    { day: 'Fri', open: '10:00', close: '15:00' },
    { day: 'Sat', open: null, close: null },
    { day: 'Sun', open: null, close: null }
  ],
  brand: {
    clinicName: 'The Med Bar',
    locationName: 'Loveland',
    tagline: 'PRF & Regenerative Aesthetics · Loveland, CO',
    // Read off her existing site rather than guessed: near-black ground, rose
    // gold line art, cream. An earlier version of this file had a muted brown
    // on a light surface, which was nothing like her actual brand.
    accent: '#d9a88c',
    accentInk: '#1a1513',
    radius: 14,
    font: '"Cal Sans", "Montserrat", sans-serif',
    displayFont: '"Cal Sans", "Montserrat", sans-serif',
    surface: 'dark',
    // A med spa has no reason to inherit a sports metaphor.
    sportsVocabulary: false
  },
  visit_facts: {
    parking: 'Dedicated on-site parking lot directly in front of the building at 2362 W 44th St.',
    draw: 'PRF treatments begin with a standard blood draw, about a minute.',
    duration: 'Most treatments run 45–120 minutes. Your confirmation shows the exact length.',
    privacy: 'Private single-client treatment room.',
    cost: 'Price is confirmed before anything begins. Buy Now Pay Later is available in person for $50–$4,000.'
  },
  pilot_mode: true
};

const providers = [
  {
    id: 'mb_prov_01',
    clinic_id: CLINIC,
    name: 'Jamie Salazar',
    credentials: null,   // TODO discovery — do not invent a credential
    role_label: 'Owner',
    bio: null,           // TODO discovery — do not write a bio on her behalf
    // Supplied by the client. A leading slash means /public — a marketing
    // asset, deliberately world-readable, and not PHI. Patient photos are
    // private storage objects and never take this shape.
    photo_path: '/practitioners/jamie-salazar.jpg',
    hours: [],
    active: true,
    sort_order: 0
  }
];

const staff = [
  { id: 'mb_stf_owner', clinic_id: CLINIC, name: 'Jamie Salazar',
    email: 'owner@medbar.pilot.invalid', role: 'owner', mfa_enabled: false, active: true }
];

// -------------------------------------------------------------- services ----
// [name, category, duration_min, buffer_after_min, price_mode, cents, unit_label]
// Prices and durations are as published.

const serviceDefs = [
  // Injectables & regenerative
  ['Jeuveau® Neurotoxin Treatment', 'injectables', 60, 15, 'per_unit', 1400, 'unit'],
  ['PRF Under-Eye Injectable Treatment', 'injectables', 60, 20, 'flat', 45000, null],
  ['PRF Microneedling Treatment', 'injectables', 85, 20, 'from', 80000, null],
  ['PRF + Nue Strand Hair Restoration', 'injectables', 85, 20, 'from', 80000, null],

  // Lashes
  ['UV Classic Lashes | New Full Set', 'lashes', 120, 15, 'flat', 17500, null],
  ['UV Classic | 2-Week Fill', 'lashes', 90, 15, 'flat', 10000, null],
  ['UV Classic | 3-Week Fill', 'lashes', 90, 15, 'flat', 12500, null],
  ['UV Hybrid Lashes | New Full Set', 'lashes', 120, 15, 'flat', 20000, null],
  ['UV Hybrid | 2-Week Fill', 'lashes', 90, 15, 'flat', 11500, null],
  ['UV Hybrid | 3-Week Fill', 'lashes', 90, 15, 'flat', 14000, null],
  ['UV Volume Lashes | New Full Set', 'lashes', 120, 15, 'flat', 22500, null],
  ['UV Volume | 2-Week Fill', 'lashes', 90, 15, 'flat', 13000, null],
  ['UV Volume | 3-Week Fill', 'lashes', 90, 15, 'flat', 15500, null],

  // Scar & skin revision
  ['Paramedical Tattoo | Small Area', 'paramedical', 60, 15, 'flat', 20000, null],
  ['Paramedical Tattoo | Medium Area', 'paramedical', 90, 15, 'flat', 30000, null],
  ['Paramedical Tattoo | Large Area', 'paramedical', 120, 15, 'from', 40000, null],

  // Skin treatments
  ['Performance Bacne Peel', 'skin', 75, 15, 'flat', 26000, null],
  ['LED Light Therapy', 'skin', 30, 10, 'from', 4000, null],
  ['Radiofrequency Skin Tightening', 'skin', 60, 15, 'flat', 15000, null],
  ['Waxing', 'skin', 60, 10, 'flat', 5000, null],

  // Facials
  ['Wellness Signature Facial', 'facials', 60, 15, 'flat', 12000, null],
  ['Dermaplaning Facial', 'facials', 45, 15, 'flat', 15000, null],
  ['Express Skin Clearing Facial', 'facials', 45, 10, 'flat', 12000, null],
  ['Floraessence Lactic Peel 20%', 'facials', 30, 10, 'flat', 15000, null],
  ['Getaway Glow', 'facials', 60, 15, 'flat', 15000, null],
  ['Golden Hour Glow Firming Facial', 'facials', 60, 15, 'flat', 20000, null],
  ['Hydrodermabrasion Facial', 'facials', 45, 15, 'flat', 12000, null],
  ['Nano Infusion Facial', 'facials', 60, 15, 'flat', 20000, null],
  ['Skin Clearing Facial', 'facials', 85, 15, 'flat', 15000, null],

  // Consultation — free, and deliberately so
  ['Consultation | 15 Minutes', 'consult', 15, 5, 'free', 0, null]
];

const slug = s => s.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const services = serviceDefs.map(([name, category, duration, buffer, mode, cents, unit], i) => ({
  id: 'mb_svc_' + String(i + 1).padStart(2, '0'),
  clinic_id: CLINIC,
  name,
  slug: slug(name),
  category,
  duration_min: duration,
  buffer_after_min: buffer,
  price_mode: mode,
  price_cents: mode === 'flat' || mode === 'free' ? cents : null,
  price_from_cents: mode === 'from' || mode === 'per_unit' ? cents : null,
  unit_label: unit,
  min_units: mode === 'per_unit' ? 20 : null,
  requires_consent: ['injectables', 'paramedical'].includes(category),
  requires_labs: false,
  online_bookable: true,
  active: true,
  sort_order: i
}));

const svcId = name => (services.find(s => s.name === name) || {}).id;

// -------------------------------------------------------------- packages ----
// Prepaid series. Real money for sessions not yet delivered, which is a
// liability on the practice's books — see docs/12 § Cutover.

const packages = [
  {
    id: 'mb_pkg_01', clinic_id: CLINIC,
    name: 'PRF Eye Rejuvenation — Series of 3',
    description: 'Series of 3 liquid PRF under-eye treatments to support natural collagen production and improve the appearance of crepey, tired or hollow-looking under-eyes.',
    service_id: svcId('PRF Under-Eye Injectable Treatment'),
    sessions: 3, price_cents: 120000, list_price_cents: 135000,
    interval_note: 'Treatments scheduled several weeks apart.',
    expiry_days: 365, active: true, sort_order: 0
  },
  {
    id: 'mb_pkg_02', clinic_id: CLINIC,
    name: 'PRF Microneedling | 3 treatments',
    description: 'Customised PRF microneedling treatments to support collagen production and progressively improve tone, texture, fine lines, pores and acne scarring. PRF preparation included each time.',
    service_id: svcId('PRF Microneedling Treatment'),
    sessions: 3, price_cents: 210000, list_price_cents: 240000,
    interval_note: 'Treatments scheduled several weeks apart.',
    expiry_days: 365, active: true, sort_order: 1
  },
  {
    id: 'mb_pkg_03', clinic_id: CLINIC,
    name: 'PRF + Nue Strand Hair Restoration 3',
    description: 'PRF, Nue Strand and scalp microneedling for hair restoration. Blood draw, PRF preparation and Nue Strand included each session.',
    service_id: svcId('PRF + Nue Strand Hair Restoration'),
    sessions: 3, price_cents: 210000, list_price_cents: 240000,
    interval_note: 'Treatments scheduled several weeks apart.',
    expiry_days: 365, active: true, sort_order: 2
  }
];

// ------------------------------------------------------------- inventory ----

const inventoryItems = [
  { id: 'mb_inv_jeuveau', clinic_id: CLINIC, name: 'Jeuveau 100u vial', category: 'injectable',
    is_controlled: false, schedule: null, unit: 'vial', unit_label: 'unit',
    units_per_container: 100, reorder_threshold: 2 },
  { id: 'mb_inv_prf_tube', clinic_id: CLINIC, name: 'PRF collection tube', category: 'consumable',
    is_controlled: false, schedule: null, unit: 'tube', unit_label: 'tube',
    units_per_container: 1, reorder_threshold: 20 },
  { id: 'mb_inv_nuestrand', clinic_id: CLINIC, name: 'Nue Strand serum', category: 'topical',
    is_controlled: false, schedule: null, unit: 'vial', unit_label: 'vial',
    units_per_container: 1, reorder_threshold: 3 },
  { id: 'mb_inv_numbing', clinic_id: CLINIC, name: 'Topical numbing cream 30g', category: 'topical',
    is_controlled: false, schedule: null, unit: 'tube', unit_label: 'g',
    units_per_container: 30, reorder_threshold: 2 },
  { id: 'mb_inv_lash_adhesive', clinic_id: CLINIC, name: 'Lash adhesive 5ml', category: 'consumable',
    is_controlled: false, schedule: null, unit: 'bottle', unit_label: 'ml',
    units_per_container: 5, reorder_threshold: 2 },
  { id: 'mb_inv_microneedle', clinic_id: CLINIC, name: 'Microneedling cartridge 12-pin', category: 'consumable',
    is_controlled: false, schedule: null, unit: 'cartridge', unit_label: 'cartridge',
    units_per_container: 1, reorder_threshold: 10 }
];

const inventoryLots = [
  { id: 'mb_lot_01', clinic_id: CLINIC, item_id: 'mb_inv_jeuveau', lot_number: 'SYN-JEU-8841',
    expiry_date: daysAhead(210), qty_received: 5, qty_remaining: 2, received_at: daysAgo(40) },
  { id: 'mb_lot_02', clinic_id: CLINIC, item_id: 'mb_inv_jeuveau', lot_number: 'SYN-JEU-9012',
    expiry_date: daysAhead(38), qty_received: 3, qty_remaining: 3, received_at: daysAgo(10) },
  { id: 'mb_lot_03', clinic_id: CLINIC, item_id: 'mb_inv_prf_tube', lot_number: 'SYN-PRF-3320',
    expiry_date: daysAhead(400), qty_received: 60, qty_remaining: 34, received_at: daysAgo(70) },
  { id: 'mb_lot_04', clinic_id: CLINIC, item_id: 'mb_inv_nuestrand', lot_number: 'SYN-NS-118',
    expiry_date: daysAhead(25), qty_received: 6, qty_remaining: 2, received_at: daysAgo(120) },
  { id: 'mb_lot_05', clinic_id: CLINIC, item_id: 'mb_inv_numbing', lot_number: 'SYN-NUM-77',
    expiry_date: daysAhead(300), qty_received: 8, qty_remaining: 5, received_at: daysAgo(55) },
  { id: 'mb_lot_06', clinic_id: CLINIC, item_id: 'mb_inv_lash_adhesive', lot_number: 'SYN-ADH-455',
    expiry_date: daysAhead(60), qty_received: 6, qty_remaining: 1, received_at: daysAgo(80) },
  { id: 'mb_lot_07', clinic_id: CLINIC, item_id: 'mb_inv_microneedle', lot_number: 'SYN-MN-902',
    expiry_date: daysAhead(500), qty_received: 50, qty_remaining: 31, received_at: daysAgo(65) }
];

// ---------------------------------------------------------------- clients ----
// Built around the awkward cases, same principle as the Gameday roster: a list
// of happy clients demos beautifully and teaches nothing.

const roster = [
  { key: 'mb_01_consult',   first: 'Renata', last: 'Oyelaran', age: 34, status: 'lead',
    note: 'Free consult booked, intake not started' },
  { key: 'mb_02_lash',      first: 'Harper', last: 'Quintanilla', age: 29, status: 'active',
    note: 'Lash client on a 3-week fill cadence — the rebook default proves itself here' },
  { key: 'mb_03_series_mid', first: 'Delphine', last: 'Bettencourt', age: 41, status: 'active',
    note: 'PRF microneedling series, 1 of 3 used — outstanding package liability' },
  { key: 'mb_04_series_done', first: 'Marisol', last: 'Achterberg', age: 47, status: 'active',
    note: 'Completed series of 3 with a full photo series — the before/after moment' },
  { key: 'mb_05_tox',       first: 'Coralie', last: 'Wexford', age: 38, status: 'active',
    note: 'Neurotoxin regular — units per area, tied to a lot number' },
  { key: 'mb_06_tattoo',    first: 'Imogen', last: 'Strayhorn', age: 52, status: 'active',
    note: 'Paramedical tattoo across multiple sessions' },
  { key: 'mb_07_adverse',   first: 'Tabitha', last: 'Nkemelu', age: 44, status: 'active',
    note: 'Bruising after PRF under-eye — adverse event recorded, follow-up due' },
  { key: 'mb_08_expiring',  first: 'Saoirse', last: 'Valdivia', age: 36, status: 'active',
    note: 'Package bought 10 months ago, 1 of 3 used, expires in 8 weeks' },
  { key: 'mb_09_lapsed',    first: 'Beatriz', last: 'Okonkwo', age: 31, status: 'churned',
    note: 'Has not rebooked in 8 months — nothing chased her' }
];

const patients = roster.map((p, i) => ({
  id: p.key,
  clinic_id: CLINIC,
  synthetic: true,
  first_name: p.first,
  last_name: p.last,
  dob: `${2026 - p.age}-0${(i % 9) + 1}-1${(i % 8) + 1}`,
  email: `${p.first.toLowerCase()}.${p.last.toLowerCase()}@pilot.invalid`,
  phone: `+1970555${String(3000 + i).slice(-4)}`,
  status: p.status,
  acquisition_source: ['instagram', 'friend_family', 'google_search_maps', 'walk_by',
    'instagram', 'friend_family', 'tiktok', 'google_search_maps', 'instagram'][i],
  roster_note: p.note
}));

// ------------------------------------------------------------ appointments ----
// Single provider, Mon/Wed/Fri only, treatments up to 120 minutes. Allocated
// against a per-day cursor so nothing overlaps — the production schema rejects
// overlaps outright.

const OPEN = { Mon: [8 * 60, 15 * 60], Wed: [8 * 60, 15 * 60], Fri: [10 * 60, 15 * 60] };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const appointments = [];
let apptSeq = 0;

function openDays(fromOffset, toOffset) {
  const out = [];
  for (let d = fromOffset; d <= toOffset; d++) {
    const date = new Date(TODAY.getTime() + d * 864e5);
    const dow = DOW[date.getUTCDay()];
    if (OPEN[dow]) out.push({ iso: iso(date), dow, offset: d });
  }
  return out;
}

const cursors = {};
function book(dayIso, dow, serviceName, patientId, status, extra) {
  const svc = services.find(s => s.name === serviceName);
  if (!svc) throw new Error('unknown service: ' + serviceName);
  const [open, close] = OPEN[dow];
  if (cursors[dayIso] === undefined) cursors[dayIso] = open;

  let start = cursors[dayIso];
  if (start + svc.duration_min > close) return null;            // day is full
  cursors[dayIso] = start + svc.duration_min + svc.buffer_after_min;

  const appt = Object.assign({
    id: 'mb_apt_' + String(++apptSeq).padStart(3, '0'),
    clinic_id: CLINIC,
    patient_id: patientId,
    provider_id: 'mb_prov_01',
    service_id: svc.id,
    starts_at: `${dayIso}T${hhmm(start)}:00`,
    duration_min: svc.duration_min,
    buffer_min: svc.buffer_after_min,
    status,
    room: 'Treatment room',
    booking_channel: 'web',
    reason_code: svc.category,
    intake_complete: status !== 'booked' || patientId !== 'mb_01_consult'
  }, extra || {});
  appointments.push(appt);
  return appt;
}

// Past: a plausible history, oldest first so the cursors fill days in order.
const past = openDays(-120, -1);
const future = openDays(0, 21);

// Harper: lash fills every three weeks, like clockwork. Seven visits back.
const harperDays = past.filter(d => d.dow === 'Wed').slice(-8);
harperDays.forEach((d, i) => {
  book(d.iso, d.dow, i === 0 ? 'UV Hybrid Lashes | New Full Set' : 'UV Hybrid | 3-Week Fill',
    'mb_02_lash', 'complete');
});

// Delphine: bought the series, has had one of three.
const delDay = past.filter(d => d.dow === 'Mon').slice(-6)[0];
if (delDay) book(delDay.iso, delDay.dow, 'PRF Microneedling Treatment', 'mb_03_series_mid', 'complete');

// Marisol: completed all three, spaced several weeks apart.
past.filter(d => d.dow === 'Mon').slice(-14).filter((_, i) => i % 5 === 0).slice(0, 3)
  .forEach(d => book(d.iso, d.dow, 'PRF Microneedling Treatment', 'mb_04_series_done', 'complete'));

// Coralie: neurotoxin roughly every four months.
past.filter(d => d.dow === 'Fri').slice(-12).filter((_, i) => i % 6 === 0).slice(0, 2)
  .forEach(d => book(d.iso, d.dow, 'Jeuveau® Neurotoxin Treatment', 'mb_05_tox', 'complete'));

// Imogen: paramedical tattoo, two sessions done.
past.filter(d => d.dow === 'Wed').slice(-11).filter((_, i) => i % 4 === 0).slice(0, 2)
  .forEach(d => book(d.iso, d.dow, 'Paramedical Tattoo | Medium Area', 'mb_06_tattoo', 'complete'));

// Tabitha: PRF under-eye three weeks ago; bruised afterwards.
const tabDay = past.filter(d => d.dow === 'Mon').slice(-3)[0];
if (tabDay) book(tabDay.iso, tabDay.dow, 'PRF Under-Eye Injectable Treatment', 'mb_07_adverse', 'complete');

// Saoirse: one session of a package bought ten months ago.
const saoDay = past[2];
if (saoDay) book(saoDay.iso, saoDay.dow, 'PRF Microneedling Treatment', 'mb_08_expiring', 'complete');

// Beatriz: last seen eight months ago, then nothing.
const beaDay = past[0];
if (beaDay) book(beaDay.iso, beaDay.dow, 'Wellness Signature Facial', 'mb_09_lapsed', 'complete');

// One no-show, because the no-show recovery path needs something to recover.
const nsDay = past.filter(d => d.dow === 'Fri').slice(-4)[0];
if (nsDay) book(nsDay.iso, nsDay.dow, 'Dermaplaning Facial', 'mb_09_lapsed', 'no_show');

// Future
if (future[0]) {
  book(future[0].iso, future[0].dow, 'Consultation | 15 Minutes', 'mb_01_consult', 'booked');
  book(future[0].iso, future[0].dow, 'UV Hybrid | 3-Week Fill', 'mb_02_lash', 'booked');
  book(future[0].iso, future[0].dow, 'Golden Hour Glow Firming Facial', 'mb_04_series_done', 'booked');
}
if (future[1]) {
  book(future[1].iso, future[1].dow, 'PRF Microneedling Treatment', 'mb_03_series_mid', 'booked');
  book(future[1].iso, future[1].dow, 'Jeuveau® Neurotoxin Treatment', 'mb_05_tox', 'booked');
}
if (future[2]) {
  book(future[2].iso, future[2].dow, 'PRF Under-Eye Injectable Treatment', 'mb_07_adverse', 'booked',
    { reason_code: 'follow_up' });
  book(future[2].iso, future[2].dow, 'Paramedical Tattoo | Medium Area', 'mb_06_tattoo', 'booked');
}
if (future[3]) {
  book(future[3].iso, future[3].dow, 'Nano Infusion Facial', 'mb_08_expiring', 'booked');
}

appointments.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

// ------------------------------------------------------ treatment records ----
// The med spa equivalent of a protocol: what was done, where, how much, from
// which lot. For injectables the lot linkage is a genuine record-keeping
// requirement.

const treatmentRecords = [];
const treatmentDetails = [];
let trSeq = 0, tdSeq = 0;

function treat(patientId, apptId, serviceName, performedAt, details, extra) {
  const id = 'mb_tr_' + String(++trSeq).padStart(3, '0');
  const totalUnits = details.reduce((s, d) => s + (d.units || 0), 0) || null;
  treatmentRecords.push(Object.assign({
    id, clinic_id: CLINIC, patient_id: patientId, appointment_id: apptId,
    service_id: svcId(serviceName), provider_id: 'mb_prov_01',
    performed_at: performedAt, total_units: totalUnits,
    aftercare_given: true, aftercare_version: 'v1',
    adverse_event: false, adverse_event_note: null, follow_up_due: null,
    notes_clinical: null, notes_patient_facing: null, synthetic: true
  }, extra || {}));
  details.forEach((d, i) => treatmentDetails.push(Object.assign({
    id: 'mb_td_' + String(++tdSeq).padStart(3, '0'),
    clinic_id: CLINIC, treatment_record_id: id, patient_id: patientId,
    sort_order: i
  }, d)));
  return id;
}

const apptFor = (pid, status) => appointments.filter(a => a.patient_id === pid && a.status === status);

// Coralie's neurotoxin sessions: real area/unit breakdown against a lot.
apptFor('mb_05_tox', 'complete').forEach((a, i) => {
  treat('mb_05_tox', a.id, 'Jeuveau® Neurotoxin Treatment', a.starts_at, [
    { area: 'Glabella', units: 20, product_name: 'Jeuveau', lot_id: 'mb_lot_01', depth: 'intramuscular' },
    { area: 'Frontalis', units: 10 + i * 2, product_name: 'Jeuveau', lot_id: 'mb_lot_01', depth: 'intramuscular' },
    { area: 'Lateral orbicularis oculi', units: 12, product_name: 'Jeuveau', lot_id: 'mb_lot_01', depth: 'subcutaneous' }
  ], {
    notes_clinical: i === 0
      ? 'First treatment. Symmetric brow at rest. Advised on onset timing and 2-week review.'
      : 'Maintenance. Good result from previous cycle; frontalis nudged up 2u.',
    notes_patient_facing: 'Treated the same three areas as last time, with a small adjustment to the forehead. Give it up to two weeks to settle fully.'
  });
});

// Marisol's completed series, with clinical notes that read like notes.
apptFor('mb_04_series_done', 'complete').forEach((a, i) => {
  treat('mb_04_series_done', a.id, 'PRF Microneedling Treatment', a.starts_at, [
    { area: 'Full face', product_name: 'PRF (autologous)', lot_id: 'mb_lot_03', technique: 'microneedling 1.0-1.5mm' },
    { area: 'Cheeks — acne scarring', product_name: 'PRF (autologous)', lot_id: 'mb_lot_03', technique: 'targeted 1.5mm' }
  ], {
    notes_clinical: `Session ${i + 1} of 3. Tolerated well. Pinpoint bleeding as expected, no adverse reaction.`,
    notes_patient_facing: `Session ${i + 1} of 3 done. Expect redness for 24–48 hours. The texture change builds over the next few weeks.`
  });
});

// Tabitha: the adverse event. Recorded as a finding with a follow-up, not buried
// in a note where nobody would find it again.
const tabAppt = apptFor('mb_07_adverse', 'complete')[0];
if (tabAppt) {
  treat('mb_07_adverse', tabAppt.id, 'PRF Under-Eye Injectable Treatment', tabAppt.starts_at, [
    { area: 'Left infraorbital', product_name: 'PRF (autologous)', lot_id: 'mb_lot_03', depth: 'subdermal' },
    { area: 'Right infraorbital', product_name: 'PRF (autologous)', lot_id: 'mb_lot_03', depth: 'subdermal' }
  ], {
    adverse_event: true,
    adverse_event_note: 'Significant bruising left infraorbital, reported day 2. Arnica advised, photos requested, reviewed by phone day 4. Resolving by day 10.',
    follow_up_due: daysAhead(4),
    notes_clinical: 'Bruising left side, likely vessel contact. Discussed at length; client reassured and content to continue.',
    notes_patient_facing: 'The bruising you had is a known possibility and it is settling as expected. We will take a look at your follow-up.'
  });
}

// Imogen's tattoo sessions.
apptFor('mb_06_tattoo', 'complete').forEach((a, i) => {
  treat('mb_06_tattoo', a.id, 'Paramedical Tattoo | Medium Area', a.starts_at, [
    { area: 'Abdominal scar — medial third', product_name: 'Pigment blend 3N', technique: 'micropigmentation' }
  ], {
    notes_clinical: `Session ${i + 1}. Pigment retention good from prior pass.`,
    notes_patient_facing: `Session ${i + 1} complete. Colour settles over about four weeks before we judge the match.`
  });
});

// -------------------------------------------------------------- packages ----

const packagePurchases = [
  { id: 'mb_pp_01', clinic_id: CLINIC, patient_id: 'mb_03_series_mid', package_id: 'mb_pkg_02',
    package_name: 'PRF Microneedling | 3 treatments', sessions_total: 3, price_paid_cents: 210000,
    purchased_at: weeksAgo(6), expires_on: daysAhead(320), status: 'active', synthetic: true },
  { id: 'mb_pp_02', clinic_id: CLINIC, patient_id: 'mb_04_series_done', package_id: 'mb_pkg_02',
    package_name: 'PRF Microneedling | 3 treatments', sessions_total: 3, price_paid_cents: 210000,
    purchased_at: weeksAgo(16), expires_on: daysAhead(240), status: 'complete', synthetic: true },
  // The liability case: bought ten months ago, one session used, eight weeks to expiry.
  { id: 'mb_pp_03', clinic_id: CLINIC, patient_id: 'mb_08_expiring', package_id: 'mb_pkg_01',
    package_name: 'PRF Eye Rejuvenation — Series of 3', sessions_total: 3, price_paid_cents: 120000,
    purchased_at: daysAgo(300), expires_on: daysAhead(56), status: 'active', synthetic: true }
];

const packageRedemptions = [];
let prSeq = 0;
function redeem(purchaseId, patientId, apptId, when) {
  packageRedemptions.push({
    id: 'mb_pr_' + String(++prSeq).padStart(3, '0'),
    clinic_id: CLINIC, purchase_id: purchaseId, patient_id: patientId,
    appointment_id: apptId, sessions: 1, redeemed_at: when, synthetic: true
  });
}
const delAppt = apptFor('mb_03_series_mid', 'complete')[0];
if (delAppt) redeem('mb_pp_01', 'mb_03_series_mid', delAppt.id, delAppt.starts_at);
apptFor('mb_04_series_done', 'complete').forEach(a => redeem('mb_pp_02', 'mb_04_series_done', a.id, a.starts_at));
const saoAppt = apptFor('mb_08_expiring', 'complete')[0];
if (saoAppt) redeem('mb_pp_03', 'mb_08_expiring', saoAppt.id, saoAppt.starts_at);

// -------------------------------------------------------------- payments ----

const payments = [];
let paySeq = 0;
function pay(patientId, cents, type, when, status) {
  payments.push({
    id: 'mb_pay_' + String(++paySeq).padStart(3, '0'),
    clinic_id: CLINIC, patient_id: patientId,
    amount_cents: cents, type, status: status || 'succeeded',
    // Neutral by construction. The DB trigger rejects anything clinical here.
    descriptor: 'THE MED BAR - SERVICES',
    processor: 'stripe', processor_ref: 'test_pi_mb_' + paySeq,
    paid_at: when, created_at: when, synthetic: true
  });
}
packagePurchases.forEach(p => pay(p.patient_id, p.price_paid_cents, 'package', p.purchased_at));
appointments.filter(a => a.status === 'complete').forEach(a => {
  const svc = services.find(s => s.id === a.service_id);
  if (!svc) return;
  // Sessions drawn from a package were already paid for at purchase.
  const covered = packageRedemptions.some(r => r.appointment_id === a.id);
  if (covered || svc.price_mode === 'free') return;
  const cents = svc.price_cents || svc.price_from_cents || 0;
  pay(a.patient_id, svc.price_mode === 'per_unit' ? cents * 42 : cents, 'visit', a.starts_at.slice(0, 10));
});

// -------------------------------------------------------------- photos ----

const photoSeries = [];
const photos = [];
function series(patientId, type, label, poses, dates) {
  const sid = `mb_ps_${patientId}_${type}`;
  photoSeries.push({ id: sid, clinic_id: CLINIC, patient_id: patientId, series_type: type,
    label, guide_version: 'v1', capture_guide_ref: `guide_${type}_v1`, synthetic: true });
  dates.forEach((d, i) => poses.forEach(pose => photos.push({
    id: `mb_ph_${patientId}_${type}_${i}_${pose}`,
    clinic_id: CLINIC, series_id: sid, patient_id: patientId,
    captured_at: d, week_index: i, pose_key: pose, guide_version: 'v1',
    storage_path: null, placeholder: true, synthetic: true
  })));
}
series('mb_04_series_done', 'face', 'PRF microneedling — texture and scarring',
  ['front', 'left_profile', 'right_profile'], [weeksAgo(16), weeksAgo(11), weeksAgo(6), weeksAgo(1)]);
series('mb_03_series_mid', 'face', 'PRF microneedling — in progress',
  ['front'], [weeksAgo(6), weeksAgo(1)]);
series('mb_06_tattoo', 'treatment_area', 'Paramedical tattoo — abdominal scar',
  ['front'], [weeksAgo(11), weeksAgo(7), weeksAgo(2)]);
series('mb_07_adverse', 'treatment_area', 'Under-eye — bruising resolution',
  ['front'], [weeksAgo(3), weeksAgo(2)]);

// ------------------------------------------------------------- messages ----

const messageThreads = [
  { id: 'mb_thr_01', clinic_id: CLINIC, patient_id: 'mb_07_adverse', triage_tag: 'clinical',
    status: 'open', last_at: daysAgo(1), unread_staff: 1, synthetic: true },
  { id: 'mb_thr_02', clinic_id: CLINIC, patient_id: 'mb_08_expiring', triage_tag: 'billing',
    status: 'open', last_at: daysAgo(2), unread_staff: 1, synthetic: true },
  { id: 'mb_thr_03', clinic_id: CLINIC, patient_id: 'mb_02_lash', triage_tag: 'scheduling',
    status: 'closed', last_at: daysAgo(9), unread_staff: 0, synthetic: true }
];

const messages = [
  { id: 'mb_msg_01', clinic_id: CLINIC, thread_id: 'mb_thr_01', patient_id: 'mb_07_adverse',
    sender_type: 'patient', body: 'The bruising is nearly gone but the left side still looks a bit fuller than the right. Is that normal at three weeks?',
    sent_at: daysAgo(1), synthetic: true },
  { id: 'mb_msg_02', clinic_id: CLINIC, thread_id: 'mb_thr_02', patient_id: 'mb_08_expiring',
    sender_type: 'patient', body: 'I think I still have treatments left on the package I bought last year? Do they run out?',
    sent_at: daysAgo(2), synthetic: true },
  { id: 'mb_msg_03', clinic_id: CLINIC, thread_id: 'mb_thr_03', patient_id: 'mb_02_lash',
    sender_type: 'patient', body: 'Can I move to Fridays for my fills?', sent_at: daysAgo(10), synthetic: true },
  { id: 'mb_msg_04', clinic_id: CLINIC, thread_id: 'mb_thr_03', patient_id: 'mb_02_lash',
    sender_type: 'staff', body: 'Of course — Fridays open at 10. I have moved your next one.',
    sent_at: daysAgo(9), synthetic: true }
];

// ---------------------------------------------------------------- tasks ----

const tasks = [
  { id: 'mb_task_01', clinic_id: CLINIC, patient_id: 'mb_07_adverse',
    title: 'Follow up on bruising — Tabitha Nkemelu', priority: 'high',
    due_on: daysAhead(4), source: 'adverse_event', done: false, synthetic: true },
  { id: 'mb_task_02', clinic_id: CLINIC, patient_id: 'mb_08_expiring',
    title: 'Package expires in 8 weeks, 2 sessions unused — Saoirse Valdivia', priority: 'high',
    due_on: daysAhead(7), source: 'package_expiring', done: false, synthetic: true },
  { id: 'mb_task_03', clinic_id: CLINIC, patient_id: 'mb_01_consult',
    title: 'Consult tomorrow, intake not started — Renata Oyelaran', priority: 'med',
    due_on: daysAhead(0), source: 'intake_incomplete', done: false, synthetic: true },
  { id: 'mb_task_04', clinic_id: CLINIC, patient_id: 'mb_09_lapsed',
    title: 'No visit in 8 months — Beatriz Okonkwo', priority: 'med',
    due_on: daysAhead(2), source: 'at_risk', done: false, synthetic: true },
  { id: 'mb_task_05', clinic_id: CLINIC, patient_id: null,
    title: 'Nue Strand serum expires in 25 days, 2 vials left', priority: 'low',
    due_on: daysAhead(10), source: 'inventory', done: false, synthetic: true }
];

// ----------------------------------------------------------- automations ----

const automationRuns = [
  { id: 'mb_auto_01', clinic_id: CLINIC, patient_id: 'mb_02_lash', rule_key: 'rebook_cadence',
    channel: 'sms', status: 'logged_not_sent', triggered_at: daysAgo(2),
    payload_preview: 'The Med Bar: you are due for your next appointment. Book here: [link]', synthetic: true },
  { id: 'mb_auto_02', clinic_id: CLINIC, patient_id: 'mb_08_expiring', rule_key: 'package_expiring',
    channel: 'email', status: 'logged_not_sent', triggered_at: daysAgo(2),
    payload_preview: 'The Med Bar: something on your account needs attention before it expires.', synthetic: true },
  { id: 'mb_auto_03', clinic_id: CLINIC, patient_id: 'mb_09_lapsed', rule_key: 'winback',
    channel: 'sms', status: 'logged_not_sent', triggered_at: daysAgo(5),
    payload_preview: 'The Med Bar: it has been a while. Want to come in? [link]', synthetic: true },
  { id: 'mb_auto_04', clinic_id: CLINIC, patient_id: 'mb_01_consult', rule_key: 'intake_incomplete_t24',
    channel: 'sms', status: 'logged_not_sent', triggered_at: daysAgo(0),
    payload_preview: 'The Med Bar: one quick form to finish before tomorrow. [link]', synthetic: true },
  { id: 'mb_auto_05', clinic_id: CLINIC, patient_id: 'mb_07_adverse', rule_key: 'post_treatment_checkin',
    channel: 'sms', status: 'logged_not_sent', triggered_at: weeksAgo(3),
    payload_preview: 'The Med Bar: how are you getting on? Reply any time.', synthetic: true }
];

// ----------------------------------------------------------------- copy ----
// Public menu copy lives in medbar-copy.cjs, condensed from what the practice
// already publishes. Applied here so the service list and its copy cannot
// drift apart, and so anything she has not written is flagged rather than
// silently blank.

{
  const { written, flagged, total } = applyCopy(services);
  console.log(`
  storefront copy: ${written} of ${total} written, ${flagged} awaiting the practice
`);
}

// ---------------------------------------------------------------- write ----

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const files = {
  'clinic.json': clinic,
  'providers.json': providers,
  'staff.json': staff,
  'services.json': services,
  'packages.json': packages,
  'patients.json': patients,
  'appointments.json': appointments,
  'treatment_records.json': treatmentRecords,
  'treatment_details.json': treatmentDetails,
  'package_purchases.json': packagePurchases,
  'package_redemptions.json': packageRedemptions,
  'payments.json': payments,
  'photo_series.json': photoSeries,
  'photos.json': photos,
  'message_threads.json': messageThreads,
  'messages.json': messages,
  'inventory_items.json': inventoryItems,
  'inventory_lots.json': inventoryLots,
  'tasks.json': tasks,
  'automation_runs.json': automationRuns
};

Object.entries(files).forEach(([name, data]) => {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2));
  console.log(`  fixtures/medbar/${name.padEnd(26)} ${Array.isArray(data) ? data.length : '-'} records`);
});

// Overlap check, same reasoning as the Gameday generator: the production schema
// has a gist exclusion constraint and will reject an overlapping dataset.
(function assertNoOverlap() {
  const byDay = {};
  appointments.forEach(a => {
    const [h, m] = a.starts_at.slice(11, 16).split(':').map(Number);
    const start = h * 60 + m;
    const key = a.starts_at.slice(0, 10);
    (byDay[key] = byDay[key] || []).push({ id: a.id, start, end: start + a.duration_min + (a.buffer_min || 0) });
  });
  const clashes = [];
  Object.entries(byDay).forEach(([day, list]) => {
    list.sort((x, y) => x.start - y.start);
    for (let i = 1; i < list.length; i++) {
      if (list[i].start < list[i - 1].end) clashes.push(`${day}: ${list[i - 1].id} / ${list[i].id}`);
    }
  });
  if (clashes.length) {
    console.error('\n  Overlapping appointments:\n    ' + clashes.join('\n    ') + '\n');
    process.exit(1);
  }
  console.log(`\n  ${appointments.length} appointments, no overlaps.`);
})();

console.log('\n  Practice details (name, address, hours, services, prices, packages) are');
console.log('  real and public. Practitioner credentials and bio are deliberately null:');
console.log('  a fabricated credential in a medical product is a false claim, not a');
console.log('  placeholder. Every client, treatment and payment is fabricated.\n');
