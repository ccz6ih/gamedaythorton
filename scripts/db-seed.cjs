/**
 * db-seed.cjs
 * Loads both synthetic tenants into Supabase:
 *
 *   Gameday Thornton  practice_type mens_health  (fixtures/*.json)
 *   The Med Bar        practice_type med_spa      (fixtures/medbar/*.json)
 *
 * Idempotent. Fixture keys like "p_04_doubter" are hashed into stable UUIDv5
 * values, so re-running updates rows in place rather than duplicating them and
 * every cross-reference resolves without a lookup table.
 *
 * Dates are shifted forward by whole weeks at seed time, the same way the static
 * prototype does it, so the seeded database is always "this week" while weekday
 * alignment survives — which matters more for The Med Bar than for Gameday,
 * because she is only open Monday, Wednesday and Friday.
 *
 * EVERY PATIENT, APPOINTMENT, TREATMENT AND PAYMENT HERE IS FABRICATED.
 * The database refuses non-synthetic rows while pilot_mode is true, so this
 * script sets synthetic = true explicitly on every PHI row rather than relying
 * on the fixture files to carry it.
 *
 * Run:  node scripts/db-seed.cjs
 *       node scripts/db-seed.cjs --wipe     remove seeded tenants first
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const ROOT = path.resolve(__dirname, '..');
const FIX = path.join(ROOT, 'fixtures');
const MB = path.join(FIX, 'medbar');
const WIPE = process.argv.includes('--wipe');

// ------------------------------------------------------------ stable uuids ----

const NS = '6f1c2b84-9a3d-4f7e-8b21-5c0e7d4a1f93';   // fixed for this project
function uuid5(name) {
  const hash = crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from(NS.replace(/-/g, ''), 'hex'), Buffer.from(String(name), 'utf8')]))
    .digest();
  const b = Buffer.from(hash.slice(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const U = k => (k === null || k === undefined ? null : uuid5(k));

// -------------------------------------------------------------- demo clock ----

const DAY = 864e5;
const ANCHOR = '2026-09-14';                     // a Monday, both datasets
function resolveShift() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dow = today.getUTCDay();
  let monday;
  if (dow === 0) monday = new Date(today.getTime() + DAY);
  else if (dow === 6) monday = new Date(today.getTime() + 2 * DAY);
  else monday = new Date(today.getTime() - (dow - 1) * DAY);
  return Math.round((monday - new Date(ANCHOR + 'T00:00:00Z')) / DAY);
}
const SHIFT = resolveShift();

const DATEY = /^(\d{4})-(\d{2})-(\d{2})(T[\d:.]+)?$/;
function shift(value, key) {
  if (typeof value !== 'string') return value;
  if (key === 'dob') return value;                 // ages must not drift
  const m = DATEY.exec(value);
  if (!m) return value;
  const base = new Date(value.slice(0, 10) + 'T00:00:00Z');
  const moved = new Date(base.getTime() + SHIFT * DAY).toISOString().slice(0, 10);
  return m[4] ? moved + m[4] : moved;
}

// ------------------------------------------------------------------- io ----

const read = (dir, name) => {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

let client;
const counts = {};

/** Upsert on id. Column list comes from the first row, so every row must share
 *  a shape — the callers below build uniform objects deliberately. */
async function upsert(table, rows) {
  if (!rows || !rows.length) return;
  const cols = Object.keys(rows[0]);
  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const values = [];
    const params = [];
    slice.forEach((row, r) => {
      const ph = cols.map((c, ci) => `$${r * cols.length + ci + 1}`);
      values.push(`(${ph.join(',')})`);
      cols.forEach(c => params.push(row[c] === undefined ? null : row[c]));
    });
    const updates = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`);
    const sql =
      `insert into ${table} (${cols.join(',')}) values ${values.join(',')} ` +
      (updates.length ? `on conflict (id) do update set ${updates.join(', ')}` : 'on conflict (id) do nothing');
    try {
      await client.query(sql, params);
    } catch (err) {
      console.error(`\n  ${table}: ${err.message}`);
      if (err.detail) console.error(`  detail: ${err.detail}`);
      console.error(`  first row: ${JSON.stringify(slice[0]).slice(0, 300)}\n`);
      throw err;
    }
  }
  counts[table] = (counts[table] || 0) + rows.length;
}

// ============================== Gameday Thornton ==========================

async function seedGameday() {
  const clinicKey = 'clinic_thornton_co';
  const cid = U(clinicKey);
  const gClinic = read(FIX, 'clinic.json');
  const analytes = read(FIX, 'analytes.json');
  const services = read(FIX, 'services.json');
  const providers = read(FIX, 'providers.json');
  const staff = read(FIX, 'staff.json');
  const plans = read(FIX, 'plans.json');
  const patients = read(FIX, 'patients.json');
  const appointments = read(FIX, 'appointments.json');
  const labPanels = read(FIX, 'lab_panels.json');
  const labResults = read(FIX, 'lab_results.json');
  const checkins = read(FIX, 'checkins.json');
  const protocols = read(FIX, 'protocols.json');
  const protoItems = read(FIX, 'protocol_items.json');
  const protoChanges = read(FIX, 'protocol_changes.json');
  const memberships = read(FIX, 'memberships.json');
  const payments = read(FIX, 'payments.json');
  const leads = read(FIX, 'leads.json');
  const intakeTemplate = read(FIX, 'intake_template.json');
  const intakeSubs = read(FIX, 'intake_submissions.json');
  const threads = read(FIX, 'message_threads.json');
  const messages = read(FIX, 'messages.json');
  const photoSeries = read(FIX, 'photo_series.json');
  const photos = read(FIX, 'photos.json');
  const bodyComp = read(FIX, 'body_comp.json');
  const invItems = read(FIX, 'inventory_items.json');
  const invLots = read(FIX, 'inventory_lots.json');
  const autoRuns = read(FIX, 'automation_runs.json');
  const missed = read(FIX, 'missed_calls.json');
  const waitlist = read(FIX, 'waitlist.json');
  const tasks = read(FIX, 'tasks.json');

  await upsert('clinic', [{
    id: cid, slug: 'gameday-thornton',
    name: gClinic.name, location_name: gClinic.location_name,
    legal_name: gClinic.legal_name, practice_type: 'mens_health',
    address_line1: gClinic.address_line1, address_city: gClinic.address_city,
    address_state: gClinic.address_state, address_zip: gClinic.address_zip,
    address_note: gClinic.nap_conflict_note,
    phone_voice: gClinic.phone_voice, phone_text: gClinic.phone_text,
    timezone: gClinic.timezone,
    hours: JSON.stringify(gClinic.hours),
    brand: JSON.stringify({
      clinicName: gClinic.name, locationName: gClinic.location_name,
      tagline: 'Built for men who are done guessing.',
      accent: '#d7262f', radius: 10, font: 'system', surface: 'dark',
      sportsVocabulary: true
    }),
    visit_facts: JSON.stringify(gClinic.visit_facts),
    pilot_mode: true, active: true
  }]);

  await upsert('staff_user', staff.map(s => ({
    id: U(s.id), clinic_id: cid, name: s.name, email: s.email,
    role: s.role, mfa_enabled: false, active: true
  })));

  await upsert('provider', providers.map((p, i) => ({
    id: U(p.id), clinic_id: cid, name: p.name, credentials: p.credentials,
    role_label: p.role, bio: p.bio, active: true, sort_order: i,
    hours: JSON.stringify([])
  })));

  await upsert('service', services.map((s, i) => ({
    id: U(s.id), clinic_id: cid, name: s.name, slug: s.id.replace('svc_', ''),
    category: s.category, duration_min: s.duration_min,
    buffer_after_min: 5,
    // A Gameday service priced at 0 is membership-inclusive or quoted in the
    // room, not free. Saying "free" would be a false claim on a price screen.
    price_mode: s.price_cents > 0 ? 'flat' : 'quoted',
    price_cents: s.price_cents > 0 ? s.price_cents : null,
    price_from_cents: null, unit_label: null,
    requires_labs: !!s.requires_labs, requires_consent: !!s.requires_consent,
    is_membership: !!s.is_membership, online_bookable: true,
    active: true, sort_order: i
  })));

  await upsert('plan', plans.map((p, i) => ({
    id: U(p.id), clinic_id: cid, name: p.name, price_cents: p.price_cents,
    interval: p.interval, includes: JSON.stringify(p.includes),
    provisional_price: true, active: true, sort_order: i
  })));

  await upsert('analyte', analytes.map((a, i) => ({
    id: U('analyte_' + a.key), clinic_id: cid, key: a.key, label: a.label,
    unit: a.unit, ref_low: a.refLow, ref_high: a.refHigh,
    target_low: a.targetLow, target_high: a.targetHigh, ceiling: a.ceiling ?? null,
    higher_better: a.higherBetter ?? null, is_safety: !!a.safety,
    provisional: true, sort_order: i, active: true
  })));

  await upsert('intake_template', [{
    id: U('intake_tpl_gameday_v1'), clinic_id: cid, version: intakeTemplate.version,
    name: 'New patient intake',
    sections: JSON.stringify(intakeTemplate.sections),
    consents: JSON.stringify(intakeTemplate.consents),
    active: true
  }]);

  // Named patients.
  await upsert('patient', patients.map(p => ({
    id: U(p.id), clinic_id: cid,
    first_name: p.first_name, last_name: p.last_name, dob: p.dob,
    email: p.email, phone: p.phone, status: p.status,
    acquisition_source: p.acquisition_source,
    therapy_start_date: shift(p.therapy_start_date),
    privacy_flags: JSON.stringify(p.privacy_flags || {}),
    synthetic: true
  })));

  // Filler appointments carry a display name rather than a patient. The schema
  // requires a patient on every appointment — an appointment without one is not
  // a thing a clinic has — so each distinct name becomes a synthetic record.
  const fillerNames = [...new Set(appointments.filter(a => !a.patient_id && a.patient_display)
    .map(a => a.patient_display))];
  await upsert('patient', fillerNames.map(display => {
    const parts = display.split(' ');
    return {
      id: U('filler_' + display), clinic_id: cid,
      first_name: parts[0], last_name: parts.slice(1).join(' ') || 'Unknown',
      dob: null, email: null, phone: null, status: 'active',
      acquisition_source: 'unknown', therapy_start_date: null,
      privacy_flags: JSON.stringify({}), synthetic: true
    };
  }));
  const fillerId = display => U('filler_' + display);

  await upsert('lead', leads.map(l => ({
    id: U(l.id), clinic_id: cid, name: l.name, email: l.email, phone: l.phone,
    source: l.source,
    consent_transactional_sms: l.consent_transactional_sms,
    consent_marketing_sms: l.consent_marketing_sms,
    consent_email: l.consent_email,
    consent_captured_at: shift(l.consent_captured_at),
    consent_ip: l.consent_ip,
    consent_text_version: l.consent_text_shown,
    first_response_at: shift(l.first_response_at),
    status: l.status,
    converted_patient_id: U(l.converted_patient_id),
    synthetic: true
  })));

  await upsert('appointment', appointments.map(a => ({
    id: U(a.id), clinic_id: cid,
    patient_id: a.patient_id ? U(a.patient_id) : fillerId(a.patient_display),
    provider_id: U(a.provider_id), service_id: U(a.service_id),
    starts_at: shift(a.starts_at), duration_min: a.duration_min || 30,
    buffer_min: 5, status: a.status, room: a.room,
    booking_channel: a.booking_channel, reason_code: a.reason_code,
    intake_complete: !!a.intake_complete, synthetic: true
  })));

  await upsert('intake_submission', intakeSubs.map(s => ({
    id: U(s.id), clinic_id: cid, patient_id: U(s.patient_id),
    appointment_id: U(s.appointment_id),
    template_id: U('intake_tpl_gameday_v1'), template_version: s.template_version,
    answers: JSON.stringify(s.answers || {}),
    percent_complete: s.percent_complete,
    submitted_at: shift(s.submitted_at), signed_at: shift(s.signed_at),
    signature_ref: s.signature_ref, synthetic: true
  })));

  await upsert('lab_panel', labPanels.map(p => ({
    id: U(p.id), clinic_id: cid, patient_id: U(p.patient_id),
    drawn_at: shift(p.drawn_at), source: p.source,
    entered_by: U(p.entered_by), note: p.note, synthetic: true
  })));

  const panelPatient = Object.fromEntries(labPanels.map(p => [p.id, p.patient_id]));
  await upsert('lab_result', labResults.map(r => ({
    id: U(r.id), clinic_id: cid, panel_id: U(r.panel_id),
    patient_id: U(panelPatient[r.panel_id]),
    analyte_key: r.analyte, value_numeric: r.value_numeric, unit: r.unit,
    ref_low: r.ref_low, ref_high: r.ref_high,
    target_low: r.target_low, target_high: r.target_high,
    flag: r.flag, provisional_ranges: true, synthetic: true
  })));

  await upsert('protocol', protocols.map(p => ({
    id: U(p.id), clinic_id: cid, patient_id: U(p.patient_id),
    status: p.status, started_at: shift(p.started_at), ended_at: shift(p.ended_at),
    synthetic: true
  })));

  const protoPatient = Object.fromEntries(protocols.map(p => [p.id, p.patient_id]));
  await upsert('protocol_item', protoItems.map((it, i) => ({
    id: U(it.id), clinic_id: cid, protocol_id: U(it.protocol_id),
    patient_id: U(protoPatient[it.protocol_id]),
    medication_name: it.medication_name, dose_amount: it.dose_amount,
    dose_unit: it.dose_unit, route: it.route, frequency: it.frequency,
    notes: it.notes, sort_order: i, synthetic: true
  })));

  await upsert('protocol_change', protoChanges.map(c => ({
    id: U(c.id), clinic_id: cid, protocol_id: U(c.protocol_id),
    patient_id: U(c.patient_id), changed_at: shift(c.changed_at),
    changed_by: U(c.changed_by), field: c.field,
    old_value: c.old_value, new_value: c.new_value,
    reason_clinical: c.reason_clinical,
    reason_patient_facing: c.reason_patient_facing, synthetic: true
  })));

  await upsert('checkin', checkins.map(c => ({
    id: U(c.id), clinic_id: cid, patient_id: U(c.patient_id),
    week_of: shift(c.week_of), submitted_at: shift(c.submitted_at),
    energy: c.energy, libido: c.libido, sleep_quality: c.sleep_quality,
    mood: c.mood, gym_performance: c.gym_performance, mental_clarity: c.mental_clarity,
    notes_free_text: c.notes_free_text,
    missed_doses_count: c.missed_doses_count || 0, synthetic: true
  })));

  await upsert('body_comp', bodyComp.map(b => ({
    id: U(b.id), clinic_id: cid, patient_id: U(b.patient_id),
    measured_at: shift(b.measured_at), weight_lbs: b.weight_lbs,
    body_fat_pct: b.body_fat_pct, lean_mass_lbs: b.lean_mass_lbs,
    visceral_fat_level: b.visceral_fat_level, device: b.device, synthetic: true
  })));

  // A photo series needs a consent record to point at. Creating one per series
  // exercises the link the Phase C revocation path depends on.
  //
  // Consent is dated to the earliest frame in the series: a consent record with
  // no capture date is useless as evidence, which is why the column is NOT NULL.
  const firstFrame = pid => {
    const dates = photos.filter(p => p.patient_id === pid).map(p => p.captured_at).sort();
    return shift(dates[0] || null);
  };
  await upsert('consent_record', photoSeries.map(s => ({
    id: U('consent_photo_' + s.patient_id), clinic_id: cid,
    patient_id: U(s.patient_id), type: 'photo', granted: true,
    text_version: 'v1', captured_at: firstFrame(s.patient_id), synthetic: true
  })));

  await upsert('photo_series', photoSeries.map(s => ({
    id: U(s.id), clinic_id: cid, patient_id: U(s.patient_id),
    series_type: s.series_type, guide_version: s.guide_version || 'v1',
    capture_guide_ref: s.capture_guide_ref,
    consent_record_id: U('consent_photo_' + s.patient_id), synthetic: true
  })));

  await upsert('photo', photos.map(p => ({
    id: U(p.id), clinic_id: cid, series_id: U(p.series_id),
    patient_id: U(p.patient_id), captured_at: shift(p.captured_at),
    week_index: p.week_index, pose_key: p.pose_key,
    guide_version: p.guide_version || 'v1', storage_path: null,
    placeholder: true, synthetic: true
  })));

  await upsert('membership', memberships.map(m => ({
    id: U(m.id), clinic_id: cid, patient_id: U(m.patient_id),
    plan_id: U(m.plan_id), status: m.status,
    started_at: shift(m.started_at), paused_at: shift(m.paused_at),
    cancelled_at: shift(m.cancelled_at),
    cancel_reason_code: m.cancel_reason_code, cancel_reason_text: m.cancel_reason_text,
    mrr_cents: m.mrr_cents, synthetic: true
  })));

  await upsert('payment', payments.map(p => ({
    id: U(p.id), clinic_id: cid, patient_id: U(p.patient_id),
    amount_cents: p.amount_cents, type: p.type, status: p.status,
    descriptor: p.descriptor, processor: 'stripe', processor_ref: p.processor_ref,
    paid_at: p.status === 'succeeded' ? shift(p.created_at) : null,
    created_at: shift(p.created_at), synthetic: true
  })));

  await upsert('message_thread', threads.map(t => ({
    id: U(t.id), clinic_id: cid, patient_id: U(t.patient_id),
    triage_tag: t.triage_tag, status: t.status, assigned_to: U(t.assigned_to),
    last_at: shift(t.last_at), unread_staff: t.unread_staff || 0, synthetic: true
  })));

  const threadPatient = Object.fromEntries(threads.map(t => [t.id, t.patient_id]));
  await upsert('message', messages.map(m => ({
    id: U(m.id), clinic_id: cid, thread_id: U(m.thread_id),
    patient_id: U(threadPatient[m.thread_id]),
    sender_type: m.sender_type,
    sender_staff_id: m.sender_type === 'staff' ? U(m.sender_id) : null,
    body: m.body, sent_at: shift(m.sent_at), read_at: shift(m.read_at),
    synthetic: true
  })));

  await upsert('inventory_item', invItems.map(i => ({
    id: U(i.id), clinic_id: cid, name: i.name, category: i.category,
    is_controlled: i.is_controlled, schedule: i.schedule, unit: i.unit,
    reorder_threshold: i.reorder_threshold, active: true
  })));

  await upsert('inventory_lot', invLots.map(l => ({
    id: U(l.id), clinic_id: cid, item_id: U(l.item_id), lot_number: l.lot_number,
    expiry_date: shift(l.expiry_date), qty_received: l.qty_received,
    qty_remaining: l.qty_remaining
  })));

  await upsert('automation_run', autoRuns.map(r => ({
    id: U(r.id), clinic_id: cid, patient_id: U(r.patient_id),
    lead_id: U(r.lead_id), rule_key: r.rule_key, channel: r.channel,
    status: 'logged_not_sent', payload_preview: r.payload_preview,
    triggered_at: shift(r.triggered_at), latency_seconds: r.latency_seconds ?? null,
    consent_verified: true, synthetic: true
  })));

  await upsert('missed_call', missed.map(m => ({
    id: U(m.id), clinic_id: cid, from_number: m.from_number,
    received_at: shift(m.received_at), duration_seconds: m.duration_seconds,
    textback_sent: m.textback_sent, status: m.status, synthetic: true
  })));

  await upsert('waitlist', waitlist.map(w => ({
    id: U(w.id), clinic_id: cid,
    patient_id: w.patient_id ? U(w.patient_id) : fillerId(w.patient_display),
    service_id: U(w.service_id), preferred_window: w.preferred_window,
    status: w.status, synthetic: true
  })).filter(w => w.patient_id));

  await upsert('task', tasks.map(t => ({
    id: U(t.id), clinic_id: cid, patient_id: U(t.patient_id),
    title: t.title, assigned_to: U(t.assigned_to), due_on: shift(t.due),
    priority: t.priority, source: t.source, done: !!t.done, synthetic: true
  })));

  return cid;
}

// ================================ The Med Bar =============================

async function seedMedBar() {
  if (!fs.existsSync(MB)) {
    console.log('  fixtures/medbar missing — run: node scripts/generate-medbar-fixtures.cjs');
    return null;
  }
  const c = read(MB, 'clinic.json');
  const cid = U(c.id);

  await upsert('clinic', [{
    id: cid, slug: c.slug, name: c.name, location_name: c.location_name,
    legal_name: null, practice_type: 'med_spa',
    address_line1: c.address_line1, address_city: c.address_city,
    address_state: c.address_state, address_zip: c.address_zip,
    address_note: null,
    phone_voice: c.phone_voice, phone_text: c.phone_text, email: c.email,
    timezone: c.timezone,
    hours: JSON.stringify(c.hours),
    brand: JSON.stringify(c.brand),
    visit_facts: JSON.stringify(c.visit_facts),
    pilot_mode: true, active: true
  }]);

  await upsert('staff_user', read(MB, 'staff.json').map(s => ({
    id: U(s.id), clinic_id: cid, name: s.name, email: s.email,
    role: s.role, mfa_enabled: false, active: true
  })));

  await upsert('provider', read(MB, 'providers.json').map(p => ({
    id: U(p.id), clinic_id: cid, name: p.name,
    credentials: p.credentials, role_label: p.role_label, bio: p.bio,
    hours: JSON.stringify([]), active: true, sort_order: p.sort_order
  })));

  const services = read(MB, 'services.json');
  await upsert('service', services.map(s => ({
    id: U(s.id), clinic_id: cid, name: s.name, slug: s.slug,
    category: s.category, duration_min: s.duration_min,
    buffer_after_min: s.buffer_after_min, price_mode: s.price_mode,
    price_cents: s.price_cents, price_from_cents: s.price_from_cents,
    unit_label: s.unit_label, min_units: s.min_units,
    requires_labs: false, requires_consent: s.requires_consent,
    is_membership: false, online_bookable: true,
    active: true, sort_order: s.sort_order
  })));

  await upsert('service_package', read(MB, 'packages.json').map(p => ({
    id: U(p.id), clinic_id: cid, name: p.name, description: p.description,
    service_id: U(p.service_id), sessions: p.sessions,
    price_cents: p.price_cents, list_price_cents: p.list_price_cents,
    expiry_days: p.expiry_days, interval_note: p.interval_note,
    active: true, sort_order: p.sort_order
  })));

  await upsert('patient', read(MB, 'patients.json').map(p => ({
    id: U(p.id), clinic_id: cid, first_name: p.first_name, last_name: p.last_name,
    dob: p.dob, email: p.email, phone: p.phone, status: p.status,
    acquisition_source: p.acquisition_source, therapy_start_date: null,
    privacy_flags: JSON.stringify({}), synthetic: true
  })));

  await upsert('inventory_item', read(MB, 'inventory_items.json').map(i => ({
    id: U(i.id), clinic_id: cid, name: i.name, category: i.category,
    is_controlled: i.is_controlled, schedule: i.schedule, unit: i.unit,
    unit_label: i.unit_label, units_per_container: i.units_per_container,
    reorder_threshold: i.reorder_threshold, active: true
  })));

  await upsert('inventory_lot', read(MB, 'inventory_lots.json').map(l => ({
    id: U(l.id), clinic_id: cid, item_id: U(l.item_id), lot_number: l.lot_number,
    expiry_date: shift(l.expiry_date), qty_received: l.qty_received,
    qty_remaining: l.qty_remaining, received_at: shift(l.received_at)
  })));

  await upsert('appointment', read(MB, 'appointments.json').map(a => ({
    id: U(a.id), clinic_id: cid, patient_id: U(a.patient_id),
    provider_id: U(a.provider_id), service_id: U(a.service_id),
    starts_at: shift(a.starts_at), duration_min: a.duration_min,
    buffer_min: a.buffer_min, status: a.status, room: a.room,
    booking_channel: a.booking_channel, reason_code: a.reason_code,
    intake_complete: !!a.intake_complete, synthetic: true
  })));

  await upsert('treatment_record', read(MB, 'treatment_records.json').map(t => ({
    id: U(t.id), clinic_id: cid, patient_id: U(t.patient_id),
    appointment_id: U(t.appointment_id), service_id: U(t.service_id),
    provider_id: U(t.provider_id), performed_at: shift(t.performed_at),
    total_units: t.total_units, notes_clinical: t.notes_clinical,
    notes_patient_facing: t.notes_patient_facing,
    aftercare_given: t.aftercare_given, aftercare_version: t.aftercare_version,
    adverse_event: t.adverse_event, adverse_event_note: t.adverse_event_note,
    follow_up_due: shift(t.follow_up_due), synthetic: true
  })));

  await upsert('treatment_detail', read(MB, 'treatment_details.json').map(d => ({
    id: U(d.id), clinic_id: cid, treatment_record_id: U(d.treatment_record_id),
    patient_id: U(d.patient_id), area: d.area, units: d.units ?? null,
    product_name: d.product_name, lot_id: U(d.lot_id),
    depth: d.depth ?? null, technique: d.technique ?? null,
    sort_order: d.sort_order, synthetic: true
  })));

  await upsert('package_purchase', read(MB, 'package_purchases.json').map(p => ({
    id: U(p.id), clinic_id: cid, patient_id: U(p.patient_id),
    package_id: U(p.package_id), package_name: p.package_name,
    sessions_total: p.sessions_total, price_paid_cents: p.price_paid_cents,
    purchased_at: shift(p.purchased_at), expires_on: shift(p.expires_on),
    status: p.status, synthetic: true
  })));

  await upsert('package_redemption', read(MB, 'package_redemptions.json').map(r => ({
    id: U(r.id), clinic_id: cid, purchase_id: U(r.purchase_id),
    patient_id: U(r.patient_id), appointment_id: U(r.appointment_id),
    sessions: r.sessions, redeemed_at: shift(r.redeemed_at), synthetic: true
  })));

  await upsert('payment', read(MB, 'payments.json').map(p => ({
    id: U(p.id), clinic_id: cid, patient_id: U(p.patient_id),
    amount_cents: p.amount_cents, type: p.type, status: p.status,
    descriptor: p.descriptor, processor: 'stripe', processor_ref: p.processor_ref,
    paid_at: shift(p.paid_at), created_at: shift(p.created_at), synthetic: true
  })));

  const mbSeries = read(MB, 'photo_series.json');
  const mbPhotos = read(MB, 'photos.json');
  const mbFirstFrame = pid => {
    const dates = mbPhotos.filter(p => p.patient_id === pid).map(p => p.captured_at).sort();
    return shift(dates[0] || null);
  };
  await upsert('consent_record', mbSeries.map(s => ({
    id: U('mb_consent_photo_' + s.patient_id), clinic_id: cid,
    patient_id: U(s.patient_id), type: 'photo', granted: true,
    text_version: 'v1', captured_at: mbFirstFrame(s.patient_id), synthetic: true
  })));

  await upsert('photo_series', mbSeries.map(s => ({
    id: U(s.id), clinic_id: cid, patient_id: U(s.patient_id),
    series_type: s.series_type, label: s.label,
    guide_version: s.guide_version, capture_guide_ref: s.capture_guide_ref,
    consent_record_id: U('mb_consent_photo_' + s.patient_id), synthetic: true
  })));

  await upsert('photo', read(MB, 'photos.json').map(p => ({
    id: U(p.id), clinic_id: cid, series_id: U(p.series_id),
    patient_id: U(p.patient_id), captured_at: shift(p.captured_at),
    week_index: p.week_index, pose_key: p.pose_key,
    guide_version: p.guide_version, storage_path: null,
    placeholder: true, synthetic: true
  })));

  const mbThreads = read(MB, 'message_threads.json');
  await upsert('message_thread', mbThreads.map(t => ({
    id: U(t.id), clinic_id: cid, patient_id: U(t.patient_id),
    triage_tag: t.triage_tag, status: t.status, assigned_to: U('mb_stf_owner'),
    last_at: shift(t.last_at), unread_staff: t.unread_staff, synthetic: true
  })));

  await upsert('message', read(MB, 'messages.json').map(m => ({
    id: U(m.id), clinic_id: cid, thread_id: U(m.thread_id),
    patient_id: U(m.patient_id), sender_type: m.sender_type,
    sender_staff_id: m.sender_type === 'staff' ? U('mb_stf_owner') : null,
    body: m.body, sent_at: shift(m.sent_at), synthetic: true
  })));

  await upsert('automation_run', read(MB, 'automation_runs.json').map(r => ({
    id: U(r.id), clinic_id: cid, patient_id: U(r.patient_id), lead_id: null,
    rule_key: r.rule_key, channel: r.channel, status: 'logged_not_sent',
    payload_preview: r.payload_preview, triggered_at: shift(r.triggered_at),
    consent_verified: true, synthetic: true
  })));

  await upsert('task', read(MB, 'tasks.json').map(t => ({
    id: U(t.id), clinic_id: cid, patient_id: U(t.patient_id),
    title: t.title, assigned_to: U('mb_stf_owner'), due_on: shift(t.due_on),
    priority: t.priority, source: t.source, done: !!t.done, synthetic: true
  })));

  return cid;
}

// ==================================== run =================================

(async () => {
  const ref = process.env.SUPABASE_PROJECT_REF;
  client = new Client({
    host: process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`,
    port: Number(process.env.SUPABASE_DB_PORT || 5432),
    user: process.env.SUPABASE_DB_USER || 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
  });
  await client.connect();

  // Naive timestamps in the fixtures are clinic-local wall time. Setting the
  // session zone makes Postgres interpret them that way instead of as UTC,
  // which would shift every appointment by six hours.
  await client.query(`set time zone 'America/Denver'`);

  try {
    if (WIPE) {
      console.log('\n  Wiping seeded tenants (cascades through every table)...');
      await client.query('delete from clinic where slug in ($1, $2)',
        ['gameday-thornton', 'medbar-loveland']);
    }

    console.log(`\n  Demo clock: fixtures shifted ${SHIFT >= 0 ? '+' : ''}${SHIFT} days from anchor ${ANCHOR}`);

    console.log('\nGAMEDAY THORNTON  (mens_health)');
    const g = await seedGameday();
    console.log('\nTHE MED BAR  (med_spa)');
    const m = await seedMedBar();

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log('\n  ' + Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${t} ${n}`).join('  ·  '));
    console.log(`\n  ${total} rows across ${Object.keys(counts).length} tables.`);

    const check = await client.query(`
      select c.name, c.practice_type, c.pilot_mode,
             (select count(*) from patient p where p.clinic_id = c.id) as patients,
             (select count(*) from appointment a where a.clinic_id = c.id) as appts,
             (select count(*) from patient p where p.clinic_id = c.id and p.synthetic is not true) as non_synthetic
      from clinic c order by c.name`);
    console.log('\n  TENANTS');
    check.rows.forEach(r => {
      console.log(`    ${r.name.padEnd(22)} ${r.practice_type.padEnd(12)} ` +
        `pilot=${r.pilot_mode}  patients=${r.patients}  appts=${r.appts}  non-synthetic=${r.non_synthetic}`);
    });
    if (check.rows.some(r => Number(r.non_synthetic) > 0)) {
      console.error('\n  WARNING: a patient row is not marked synthetic. Investigate before demoing.\n');
      process.exit(1);
    }
    console.log('\n  All patient rows are marked synthetic.\n');
  } catch (err) {
    console.error('\n  Seed failed:', err.message, '\n');
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
})();
