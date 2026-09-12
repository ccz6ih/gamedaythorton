/**
 * generate-fixtures.cjs
 * Deterministic synthetic dataset for the Gameday Thornton pilot.
 *
 * EVERYTHING THIS PRODUCES IS FABRICATED. No real person, lab value, or photo.
 * See docs/09-compliance-register.md.
 *
 * Run:  node scripts/generate-fixtures.cjs
 * Out:  fixtures/*.json  +  prototype/demo-data.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FIX = path.join(ROOT, 'fixtures');
const PROTO = path.join(ROOT, 'prototype');
const CLINIC = 'clinic_thornton_co';

// Pilot "today". Fixed so the dataset is reproducible.
//
// Deliberately a MONDAY. The clinic runs Mon-Fri, so anchoring the dataset to a
// Monday means "Today's patients" and the week calendar always have content.
// The prototype shifts every date forward by whole weeks at load time
// (see prototype/assets/store.js -> shiftWeeks) so the demo is always "this
// week" while the weekday alignment stays intact.
const TODAY = new Date('2026-09-14T00:00:00Z');

// ---------- deterministic RNG (mulberry32) ----------
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const iso = d => new Date(d).toISOString().slice(0, 10);
const weeksAgo = w => iso(new Date(TODAY.getTime() - w * 7 * 864e5));
const daysAgo = d => iso(new Date(TODAY.getTime() - d * 864e5));
const daysAhead = d => iso(new Date(TODAY.getTime() + d * 864e5));

// ---------- analytes ----------
// PROVISIONAL. Replace with the clinic's real values — docs/11-discovery-questions.md §3.
const analytes = [
  { key: 'total_testosterone', label: 'Total Testosterone', unit: 'ng/dL', refLow: 264, refHigh: 916, targetLow: 600, targetHigh: 900, higherBetter: true, provisional: true },
  { key: 'free_testosterone', label: 'Free Testosterone', unit: 'pg/mL', refLow: 8.7, refHigh: 25.1, targetLow: 15, targetHigh: 25, higherBetter: true, provisional: true },
  { key: 'shbg', label: 'SHBG', unit: 'nmol/L', refLow: 16.5, refHigh: 55.9, targetLow: 20, targetHigh: 45, higherBetter: null, provisional: true },
  { key: 'estradiol_sensitive', label: 'Estradiol (sensitive)', unit: 'pg/mL', refLow: 8, refHigh: 43, targetLow: 20, targetHigh: 35, higherBetter: null, provisional: true },
  { key: 'hematocrit', label: 'Hematocrit', unit: '%', refLow: 38.3, refHigh: 48.6, targetLow: 40, targetHigh: 50, ceiling: 52, higherBetter: null, safety: true, provisional: true },
  { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', refLow: 13.2, refHigh: 16.6, targetLow: 14, targetHigh: 17, higherBetter: null, provisional: true },
  { key: 'psa', label: 'PSA', unit: 'ng/mL', refLow: 0, refHigh: 4.0, targetLow: 0, targetHigh: 2.5, higherBetter: false, safety: true, provisional: true },
  { key: 'lh', label: 'LH', unit: 'IU/L', refLow: 1.7, refHigh: 8.6, targetLow: 1.7, targetHigh: 8.6, higherBetter: null, provisional: true },
  { key: 'tsh', label: 'TSH', unit: 'mIU/L', refLow: 0.45, refHigh: 4.5, targetLow: 0.5, targetHigh: 2.5, higherBetter: null, provisional: true },
  { key: 'a1c', label: 'Hemoglobin A1c', unit: '%', refLow: 4.0, refHigh: 5.6, targetLow: 4.5, targetHigh: 5.4, higherBetter: false, provisional: true },
  { key: 'ldl', label: 'LDL Cholesterol', unit: 'mg/dL', refLow: 0, refHigh: 99, targetLow: 0, targetHigh: 99, higherBetter: false, provisional: true },
  { key: 'hdl', label: 'HDL Cholesterol', unit: 'mg/dL', refLow: 40, refHigh: 90, targetLow: 50, targetHigh: 90, higherBetter: true, provisional: true },
  { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', refLow: 0, refHigh: 149, targetLow: 0, targetHigh: 120, higherBetter: false, provisional: true },
  { key: 'vitamin_d', label: 'Vitamin D, 25-OH', unit: 'ng/mL', refLow: 30, refHigh: 100, targetLow: 50, targetHigh: 80, higherBetter: true, provisional: true }
];

// ---------- services (seeded from docs/01-audit-findings.md) ----------
const services = [
  ['svc_consult', 'New Patient Consultation', 'consult', 60, 0, true, true],
  ['svc_followup', 'Follow-Up Visit', 'consult', 25, 0, false, false],
  ['svc_labdraw', 'Lab Draw & Review', 'labs', 30, 0, false, false],
  ['svc_trt_cyp', 'Testosterone Cypionate Injection', 'trt', 15, 0, true, true],
  ['svc_trt_pellet', 'Testosterone Pellets', 'trt', 45, 90000, true, true],
  ['svc_trt_oral', 'Oral TRT (Kyzatrex)', 'trt', 20, 0, true, true],
  ['svc_clomid', 'Clomid / Enclomiphene', 'trt', 20, 0, true, true],
  ['svc_glp1', 'GLP-1 Therapy', 'weight', 20, 0, true, true],
  ['svc_tirzepatide', 'Tirzepatide', 'weight', 20, 0, true, true],
  ['svc_phentermine', 'Phentermine', 'weight', 15, 0, true, true],
  ['svc_mic_b12', 'MIC Lipotropic + B12', 'weight', 10, 4500, false, false],
  ['svc_bodycomp', 'Body Composition Scan', 'weight', 20, 5000, false, false],
  ['svc_shockwave_ed', 'Shockwave Therapy (ED)', 'sexual', 30, 45000, false, true],
  ['svc_pshot', 'P-Shot', 'sexual', 60, 175000, false, true],
  ['svc_trimix', 'Trimix Injections', 'sexual', 20, 0, false, true],
  ['svc_pt141', 'PT-141 Peptide', 'sexual', 15, 0, false, true],
  ['svc_ed_oral', 'Viagra / Cialis', 'sexual', 15, 0, false, true],
  ['svc_nad', 'NAD+ Injection', 'longevity', 20, 12500, false, false],
  ['svc_sermorelin', 'Sermorelin Peptide', 'longevity', 15, 0, false, true],
  ['svc_glutathione', 'Glutathione Injection', 'longevity', 10, 6000, false, false],
  ['svc_b12', 'Vitamin B12 Injection', 'vitamins', 10, 3500, false, false],
  ['svc_bcomplex', 'Vitamin B Complex Injection', 'vitamins', 10, 3500, false, false],
  ['svc_vitc', 'Vitamin C Injection', 'vitamins', 10, 4000, false, false],
  ['svc_finasteride', 'Finasteride', 'hair', 15, 0, false, true],
  ['svc_minoxidil', 'Minoxidil', 'hair', 15, 0, false, false],
  ['svc_prp_hair', 'PRP Hair Treatment', 'hair', 60, 65000, false, true],
  ['svc_shockwave_sports', 'Shockwave Therapy (Sports Injury)', 'sports', 30, 25000, false, true]
].map(([id, name, category, duration_min, price_cents, requires_labs, requires_consent]) => ({
  id, clinic_id: CLINIC, name, category, duration_min, price_cents, requires_labs, requires_consent, active: true
}));

// ---------- providers (invented) ----------
const providers = [
  { id: 'prov_01', clinic_id: CLINIC, name: 'Dana Whitfield, NP', credentials: 'FNP-BC', role: 'Clinic Director', photo_ref: 'placeholder/prov_01.jpg', bio: 'Fictional provider for pilot demonstration only.', active: true },
  { id: 'prov_02', clinic_id: CLINIC, name: 'Marcus Elleby, PA-C', credentials: 'PA-C', role: 'Provider', photo_ref: 'placeholder/prov_02.jpg', bio: 'Fictional provider for pilot demonstration only.', active: true }
];

const staff = [
  { id: 'stf_owner', clinic_id: CLINIC, name: 'Ray Okonjo', email: 'owner@pilot.invalid', role: 'owner', mfa_enabled: false, active: true },
  { id: 'stf_prov_01', clinic_id: CLINIC, name: 'Dana Whitfield, NP', email: 'director@pilot.invalid', role: 'provider', mfa_enabled: false, active: true },
  { id: 'stf_front', clinic_id: CLINIC, name: 'Tess Marlow', email: 'frontdesk@pilot.invalid', role: 'front_desk', mfa_enabled: false, active: true }
];

const SOURCES = ['google_search_maps', 'facebook_instagram', 'youtube', 'tiktok', 'friend_family',
  'tv_commercial', 'radio', 'podcast', 'local_event', 'online_article', 'email_newsletter',
  'gym_referral', 'billboard', 'mailbox_flyer', 'parking_lot_flyer', 'other'];

// ---------- patient roster ----------
// weeksOn = weeks since therapy start. null = not started.
const roster = [
  { key: 'p_01_new', first: 'Aaron', last: 'Petrak', age: 41, status: 'lead', weeksOn: null, source: 'google_search_maps' },
  { key: 'p_02_firstvisit', first: 'Curtis', last: 'Nahm', age: 37, status: 'active', weeksOn: 0, source: 'gym_referral' },
  { key: 'p_03_enthusiast', first: 'Dominic', last: 'Rauwerda', age: 45, status: 'active', weeksOn: 9, source: 'friend_family' },
  { key: 'p_04_doubter', first: 'Gregory', last: 'Sunderman', age: 52, status: 'active', weeksOn: 18, source: 'billboard' },
  { key: 'p_05_safety', first: 'Vaughn', last: 'Iselin', age: 48, status: 'active', weeksOn: 22, source: 'podcast' },
  { key: 'p_06_psa', first: 'Errol', last: 'Bratcher', age: 61, status: 'active', weeksOn: 35, source: 'online_article' },
  { key: 'p_07_churned', first: 'Damon', last: 'Kelsoe', age: 39, status: 'churned', weeksOn: 26, source: 'facebook_instagram' },
  { key: 'p_08_paused', first: 'Leland', last: 'Ashcraft', age: 44, status: 'paused', weeksOn: 13, source: 'radio' },
  { key: 'p_09_noshow', first: 'Trent', last: 'Mabry', age: 35, status: 'active', weeksOn: 6, source: 'tiktok' },
  { key: 'p_10_weightloss', first: 'Hollis', last: 'Draney', age: 50, status: 'active', weeksOn: 14, source: 'email_newsletter' },
  { key: 'p_11_hairloss', first: 'Simon', last: 'Vertrees', age: 33, status: 'active', weeksOn: 26, source: 'youtube' },
  { key: 'p_12_failedpay', first: 'Brady', last: 'Hollifield', age: 43, status: 'active', weeksOn: 11, source: 'mailbox_flyer' }
];

const patients = roster.map((p, i) => ({
  id: p.key,
  clinic_id: CLINIC,
  synthetic: true,
  first_name: p.first,
  last_name: p.last,
  dob: `${2026 - p.age}-0${(i % 9) + 1}-1${i % 9}`,
  email: `${p.first.toLowerCase()}.${p.last.toLowerCase()}@pilot.invalid`,
  phone: `+1720555${String(1000 + i).slice(-4)}`,
  status: p.status,
  acquisition_source: p.source,
  therapy_start_date: p.weeksOn === null ? null : weeksAgo(p.weeksOn),
  weeks_on_therapy: p.weeksOn,
  external_emr_id: null,
  privacy_flags: { biometric_lock: i % 3 === 0, hide_sensitive: i % 4 === 0 }
}));

// ---------- check-in curves ----------
// Shape: rise from baseline, then plateau. `gapWeeks` = recent weeks with no check-in.
function checkinSeries(patientId, weeks, opts) {
  const { start, peak, riseWeeks, gapWeeks = 0, seed = 1, decline = false } = opts;
  const rand = rng(seed);
  const dims = ['energy', 'libido', 'sleep_quality', 'mood', 'gym_performance', 'mental_clarity'];
  const offsets = { energy: 0, libido: -0.8, sleep_quality: 0.4, mood: 0.2, gym_performance: -0.3, mental_clarity: 0 };
  const out = [];
  for (let w = 0; w <= weeks; w++) {
    if (w > weeks - gapWeeks) continue;         // recent silence
    if (w > 0 && rand() < 0.10) continue;       // real men skip weeks
    const t = Math.min(1, w / riseWeeks);
    const eased = 1 - Math.pow(1 - t, 2);
    let base = start + (peak - start) * eased;
    if (decline && w > riseWeeks + 4) base -= (w - riseWeeks - 4) * 0.12;
    const row = {
      id: `ci_${patientId}_${w}`, clinic_id: CLINIC, patient_id: patientId,
      week_index: w, week_of: weeksAgo(weeks - w), submitted_at: weeksAgo(weeks - w)
    };
    dims.forEach(d => {
      row[d] = clamp(Math.round(base + (offsets[d] || 0) + (rand() * 2 - 1) * 0.9), 1, 10);
    });
    row.missed_doses_count = rand() < 0.12 ? 1 : 0;
    row.notes_free_text = null;
    out.push(row);
  }
  return out;
}

// ---------- lab panels ----------
function labPanel(patientId, weeksAgoDrawn, values, note) {
  const id = `lp_${patientId}_w${weeksAgoDrawn}`;
  return {
    panel: {
      id, clinic_id: CLINIC, patient_id: patientId,
      drawn_at: weeksAgo(weeksAgoDrawn), source: 'in_clinic',
      entered_by: 'stf_prov_01', document_ref: null, note: note || null
    },
    results: Object.entries(values).map(([key, value]) => {
      const a = analytes.find(x => x.key === key);
      let flag = 'in_range';
      if (a) {
        if (value < a.refLow) flag = 'below_ref';
        else if (value > a.refHigh) flag = 'above_ref';
        else if (value < a.targetLow) flag = 'below_target';
        else if (value > a.targetHigh) flag = 'above_target';
        if (a.ceiling && value >= a.ceiling) flag = 'critical';
      }
      return {
        id: `lr_${id}_${key}`, panel_id: id, analyte: key, value_numeric: value,
        unit: a ? a.unit : '', ref_low: a ? a.refLow : null, ref_high: a ? a.refHigh : null,
        target_low: a ? a.targetLow : null, target_high: a ? a.targetHigh : null,
        flag, provisional_ranges: true
      };
    })
  };
}

const labPanels = [];
const labResults = [];
const push = p => { labPanels.push(p.panel); labResults.push(...p.results); };

// p_04_doubter — THE demo patient.
// Improved clearly from baseline, then flat. Exactly the shape where a man cancels
// while his own data says he is far better off than when he started.
push(labPanel('p_04_doubter', 18, {
  total_testosterone: 243, free_testosterone: 6.1, shbg: 42.4, estradiol_sensitive: 17,
  hematocrit: 44.2, hemoglobin: 14.8, psa: 0.8, lh: 4.2, tsh: 2.1,
  a1c: 5.5, ldl: 118, hdl: 42, triglycerides: 168, vitamin_d: 24
}, 'Baseline draw at first visit.'));
push(labPanel('p_04_doubter', 11, {
  total_testosterone: 596, free_testosterone: 13.4, shbg: 38.1, estradiol_sensitive: 29,
  hematocrit: 46.9, hemoglobin: 15.6, psa: 0.9, a1c: 5.3, ldl: 104, hdl: 46, triglycerides: 141, vitamin_d: 38
}, 'Week 7 recheck. Dose increased to 120mg weekly.'));
push(labPanel('p_04_doubter', 2, {
  total_testosterone: 688, free_testosterone: 16.2, shbg: 35.7, estradiol_sensitive: 33,
  hematocrit: 48.8, hemoglobin: 16.1, psa: 0.9, a1c: 5.1, ldl: 96, hdl: 51, triglycerides: 118, vitamin_d: 54
}, 'Quarterly monitoring.'));

// p_03_enthusiast
push(labPanel('p_03_enthusiast', 9, { total_testosterone: 288, free_testosterone: 7.4, shbg: 39, estradiol_sensitive: 19, hematocrit: 43.1, hemoglobin: 14.5, psa: 0.6, a1c: 5.4, ldl: 112, hdl: 45, triglycerides: 152, vitamin_d: 29 }, 'Baseline.'));
push(labPanel('p_03_enthusiast', 1, { total_testosterone: 704, free_testosterone: 17.8, shbg: 34, estradiol_sensitive: 30, hematocrit: 46.2, hemoglobin: 15.4, psa: 0.7, a1c: 5.2, ldl: 98, hdl: 49, triglycerides: 126, vitamin_d: 47 }, 'Week 8 recheck.'));

// p_05_safety — hematocrit climbing toward ceiling
push(labPanel('p_05_safety', 22, { total_testosterone: 210, free_testosterone: 5.2, shbg: 31, estradiol_sensitive: 15, hematocrit: 46.8, hemoglobin: 15.5, psa: 1.1, a1c: 5.6, ldl: 126, hdl: 38, triglycerides: 189, vitamin_d: 21 }, 'Baseline. Note starting hematocrit at upper-normal.'));
push(labPanel('p_05_safety', 14, { total_testosterone: 742, free_testosterone: 19.1, shbg: 28, estradiol_sensitive: 36, hematocrit: 50.4, hemoglobin: 16.9, psa: 1.2, a1c: 5.4, ldl: 114, hdl: 41, triglycerides: 162, vitamin_d: 36 }, 'Week 8 recheck. Hematocrit rising.'));
push(labPanel('p_05_safety', 3, { total_testosterone: 812, free_testosterone: 21.4, shbg: 26, estradiol_sensitive: 39, hematocrit: 52.6, hemoglobin: 17.6, psa: 1.3, a1c: 5.3, ldl: 108, hdl: 43, triglycerides: 148, vitamin_d: 49 }, 'FLAG: hematocrit above ceiling. Provider review required.'));

// p_06_psa — PSA velocity
push(labPanel('p_06_psa', 35, { total_testosterone: 226, free_testosterone: 5.8, shbg: 46, estradiol_sensitive: 16, hematocrit: 43.9, hemoglobin: 14.6, psa: 1.4, a1c: 5.5, ldl: 121, hdl: 44, triglycerides: 158, vitamin_d: 26 }, 'Baseline.'));
push(labPanel('p_06_psa', 22, { total_testosterone: 668, free_testosterone: 15.2, shbg: 41, estradiol_sensitive: 28, hematocrit: 46.1, hemoglobin: 15.3, psa: 2.1, a1c: 5.4, ldl: 110, hdl: 47, triglycerides: 139, vitamin_d: 41 }, 'Recheck.'));
push(labPanel('p_06_psa', 9, { total_testosterone: 691, free_testosterone: 15.9, shbg: 40, estradiol_sensitive: 30, hematocrit: 46.8, hemoglobin: 15.5, psa: 3.2, a1c: 5.3, ldl: 104, hdl: 49, triglycerides: 128, vitamin_d: 52 }, 'FLAG: PSA velocity elevated. Urology referral discussion.'));

// p_07_churned
push(labPanel('p_07_churned', 26, { total_testosterone: 301, free_testosterone: 8.1, shbg: 33, estradiol_sensitive: 21, hematocrit: 44.6, hemoglobin: 14.9, psa: 0.7, a1c: 5.2, ldl: 106, hdl: 48, triglycerides: 131, vitamin_d: 31 }, 'Baseline.'));
push(labPanel('p_07_churned', 18, { total_testosterone: 641, free_testosterone: 15.1, shbg: 30, estradiol_sensitive: 31, hematocrit: 47.2, hemoglobin: 15.7, psa: 0.8, a1c: 5.1, ldl: 99, hdl: 51, triglycerides: 119, vitamin_d: 44 }, 'Recheck. Patient reported minimal subjective change.'));

// p_08_paused
push(labPanel('p_08_paused', 13, { total_testosterone: 264, free_testosterone: 6.6, shbg: 37, estradiol_sensitive: 18, hematocrit: 45.1, hemoglobin: 15.0, psa: 0.9, a1c: 5.7, ldl: 133, hdl: 40, triglycerides: 176, vitamin_d: 23 }, 'Baseline.'));
push(labPanel('p_08_paused', 5, { total_testosterone: 623, free_testosterone: 14.7, shbg: 34, estradiol_sensitive: 28, hematocrit: 47.0, hemoglobin: 15.6, psa: 0.9, a1c: 5.5, ldl: 118, hdl: 44, triglycerides: 149, vitamin_d: 39 }, 'Recheck.'));

// p_09_noshow
push(labPanel('p_09_noshow', 6, { total_testosterone: 312, free_testosterone: 8.8, shbg: 29, estradiol_sensitive: 22, hematocrit: 44.0, hemoglobin: 14.7, psa: 0.5, a1c: 5.3, ldl: 101, hdl: 50, triglycerides: 122, vitamin_d: 33 }, 'Baseline (after rescheduled no-show).'));

// p_10_weightloss — GLP-1, no TRT
push(labPanel('p_10_weightloss', 14, { total_testosterone: 421, free_testosterone: 10.2, shbg: 30, estradiol_sensitive: 24, hematocrit: 45.4, hemoglobin: 15.1, psa: 1.0, a1c: 6.1, ldl: 148, hdl: 36, triglycerides: 232, vitamin_d: 19 }, 'Baseline. Metabolic focus.'));
push(labPanel('p_10_weightloss', 2, { total_testosterone: 487, free_testosterone: 12.1, shbg: 32, estradiol_sensitive: 22, hematocrit: 44.8, hemoglobin: 14.9, psa: 1.0, a1c: 5.4, ldl: 112, hdl: 44, triglycerides: 141, vitamin_d: 48 }, 'A1c and lipids substantially improved on GLP-1.'));

// p_11_hairloss
push(labPanel('p_11_hairloss', 26, { total_testosterone: 552, free_testosterone: 13.9, shbg: 28, estradiol_sensitive: 26, hematocrit: 45.0, hemoglobin: 15.0, psa: 0.4, a1c: 5.1, ldl: 94, hdl: 54, triglycerides: 98, vitamin_d: 42 }, 'Baseline. Hair restoration focus.'));

// p_12_failedpay
push(labPanel('p_12_failedpay', 11, { total_testosterone: 271, free_testosterone: 6.9, shbg: 40, estradiol_sensitive: 19, hematocrit: 44.3, hemoglobin: 14.8, psa: 0.8, a1c: 5.4, ldl: 115, hdl: 45, triglycerides: 144, vitamin_d: 28 }, 'Baseline.'));
push(labPanel('p_12_failedpay', 3, { total_testosterone: 655, free_testosterone: 15.5, shbg: 36, estradiol_sensitive: 30, hematocrit: 46.6, hemoglobin: 15.5, psa: 0.8, a1c: 5.3, ldl: 103, hdl: 48, triglycerides: 127, vitamin_d: 45 }, 'Recheck.'));

// ---------- check-ins ----------
const checkins = [
  ...checkinSeries('p_04_doubter', 18, { start: 3.0, peak: 6.9, riseWeeks: 10, gapWeeks: 3, seed: 401 }),
  ...checkinSeries('p_03_enthusiast', 9, { start: 3.4, peak: 7.6, riseWeeks: 8, seed: 301 }),
  ...checkinSeries('p_05_safety', 22, { start: 2.8, peak: 7.2, riseWeeks: 9, seed: 501 }),
  ...checkinSeries('p_06_psa', 35, { start: 3.1, peak: 7.0, riseWeeks: 11, seed: 601 }),
  ...checkinSeries('p_07_churned', 26, { start: 4.2, peak: 5.1, riseWeeks: 10, gapWeeks: 8, seed: 701, decline: true }),
  ...checkinSeries('p_08_paused', 13, { start: 3.3, peak: 6.4, riseWeeks: 9, gapWeeks: 4, seed: 801 }),
  ...checkinSeries('p_09_noshow', 6, { start: 3.6, peak: 6.0, riseWeeks: 7, seed: 901 }),
  ...checkinSeries('p_10_weightloss', 14, { start: 3.9, peak: 7.1, riseWeeks: 10, seed: 1001 }),
  ...checkinSeries('p_11_hairloss', 26, { start: 5.2, peak: 7.0, riseWeeks: 12, seed: 1101 }),
  ...checkinSeries('p_12_failedpay', 11, { start: 3.2, peak: 6.7, riseWeeks: 9, seed: 1201 })
];

// Free-text notes a provider must actually read. Proves someone has to monitor this field.
const flagged = checkins.find(c => c.patient_id === 'p_05_safety' && c.week_index === 20);
if (flagged) flagged.notes_free_text = 'Headaches most mornings the last two weeks and my face feels flushed. Probably nothing.';
const doubterNote = checkins.filter(c => c.patient_id === 'p_04_doubter').slice(-1)[0];
if (doubterNote) doubterNote.notes_free_text = 'Honestly not sure this is doing much anymore. Felt great around month two.';

// ---------- protocols ----------
const protocols = [];
const protocolItems = [];
const protocolChanges = [];

function protocol(patientId, startWeeksAgo, items, changes, status = 'active') {
  const pid = `proto_${patientId}`;
  protocols.push({ id: pid, clinic_id: CLINIC, patient_id: patientId, status, started_at: weeksAgo(startWeeksAgo), ended_at: status === 'ended' ? weeksAgo(1) : null });
  items.forEach((it, i) => protocolItems.push({ id: `${pid}_item${i}`, protocol_id: pid, ...it }));
  (changes || []).forEach((c, i) => protocolChanges.push({
    id: `${pid}_chg${i}`, protocol_id: pid, patient_id: patientId,
    changed_at: weeksAgo(c.weeksAgo), changed_by: 'stf_prov_01',
    field: c.field, old_value: c.from, new_value: c.to,
    reason_clinical: c.clinical, reason_patient_facing: c.patient
  }));
}

protocol('p_04_doubter', 18,
  [{ medication_name: 'Testosterone Cypionate', dose_amount: 120, dose_unit: 'mg', route: 'IM', frequency: 'weekly', notes: 'Rotate injection sites.' },
   { medication_name: 'Vitamin D3', dose_amount: 5000, dose_unit: 'IU', route: 'oral', frequency: 'daily', notes: null }],
  [{ weeksAgo: 18, field: 'testosterone_cypionate_dose', from: null, to: '100mg weekly', clinical: 'Initiation. Total T 243 with symptomatic hypogonadism.', patient: 'Starting you at 100mg weekly. We will recheck your levels in about seven weeks and adjust from there.' },
   { weeksAgo: 11, field: 'testosterone_cypionate_dose', from: '100mg weekly', to: '120mg weekly', clinical: 'Total T 596, below target range. Free T 13.4. Hematocrit stable at 46.9. Increase warranted.', patient: 'Your levels came up well but are still just under where we want them. Nudging your dose up slightly to 120mg weekly.' }]);

protocol('p_03_enthusiast', 9,
  [{ medication_name: 'Testosterone Cypionate', dose_amount: 100, dose_unit: 'mg', route: 'IM', frequency: 'weekly', notes: null }],
  [{ weeksAgo: 9, field: 'testosterone_cypionate_dose', from: null, to: '100mg weekly', clinical: 'Initiation. Total T 288.', patient: 'Starting you at 100mg weekly.' }]);

protocol('p_05_safety', 22,
  [{ medication_name: 'Testosterone Cypionate', dose_amount: 160, dose_unit: 'mg', route: 'IM', frequency: 'weekly', notes: 'Under review — hematocrit.' }],
  [{ weeksAgo: 22, field: 'testosterone_cypionate_dose', from: null, to: '120mg weekly', clinical: 'Initiation. Total T 210. Baseline hematocrit 46.8 — monitor.', patient: 'Starting at 120mg weekly.' },
   { weeksAgo: 14, field: 'testosterone_cypionate_dose', from: '120mg weekly', to: '160mg weekly', clinical: 'Total T 742 mid-target but incomplete symptom resolution. Hematocrit 50.4 — flagged for closer monitoring.', patient: 'Adjusting your dose up. We are going to keep a close eye on your blood counts.' }]);

protocol('p_06_psa', 35, [{ medication_name: 'Testosterone Cypionate', dose_amount: 110, dose_unit: 'mg', route: 'IM', frequency: 'weekly', notes: null }],
  [{ weeksAgo: 35, field: 'testosterone_cypionate_dose', from: null, to: '110mg weekly', clinical: 'Initiation. Total T 226.', patient: 'Starting at 110mg weekly.' }]);

protocol('p_07_churned', 26, [{ medication_name: 'Testosterone Cypionate', dose_amount: 100, dose_unit: 'mg', route: 'IM', frequency: 'weekly', notes: null }],
  [{ weeksAgo: 26, field: 'testosterone_cypionate_dose', from: null, to: '100mg weekly', clinical: 'Initiation.', patient: 'Starting at 100mg weekly.' }], 'ended');

protocol('p_08_paused', 13, [{ medication_name: 'Testosterone Cypionate', dose_amount: 100, dose_unit: 'mg', route: 'IM', frequency: 'weekly', notes: 'Paused.' }],
  [{ weeksAgo: 13, field: 'testosterone_cypionate_dose', from: null, to: '100mg weekly', clinical: 'Initiation.', patient: 'Starting at 100mg weekly.' }], 'paused');

protocol('p_09_noshow', 6, [{ medication_name: 'Testosterone Cypionate', dose_amount: 100, dose_unit: 'mg', route: 'IM', frequency: 'weekly', notes: null }],
  [{ weeksAgo: 6, field: 'testosterone_cypionate_dose', from: null, to: '100mg weekly', clinical: 'Initiation.', patient: 'Starting at 100mg weekly.' }]);

protocol('p_10_weightloss', 14, [{ medication_name: 'Tirzepatide', dose_amount: 7.5, dose_unit: 'mg', route: 'SubQ', frequency: 'weekly', notes: 'Titration ongoing.' }],
  [{ weeksAgo: 14, field: 'tirzepatide_dose', from: null, to: '2.5mg weekly', clinical: 'Initiation. A1c 6.1.', patient: 'Starting low at 2.5mg weekly to let your body adjust.' },
   { weeksAgo: 10, field: 'tirzepatide_dose', from: '2.5mg weekly', to: '5mg weekly', clinical: 'Tolerated well. Standard titration.', patient: 'Stepping up to 5mg — you have tolerated the starting dose well.' },
   { weeksAgo: 5, field: 'tirzepatide_dose', from: '5mg weekly', to: '7.5mg weekly', clinical: 'Continued titration. 14 lb loss to date.', patient: 'Moving to 7.5mg. You are down 14 pounds and tracking well.' }]);

protocol('p_11_hairloss', 26, [{ medication_name: 'Finasteride', dose_amount: 1, dose_unit: 'mg', route: 'oral', frequency: 'daily', notes: null },
  { medication_name: 'Minoxidil 5%', dose_amount: 1, dose_unit: 'mL', route: 'topical', frequency: 'twice daily', notes: null }],
  [{ weeksAgo: 26, field: 'finasteride_dose', from: null, to: '1mg daily', clinical: 'Initiation.', patient: 'Starting finasteride 1mg daily alongside topical minoxidil.' }]);

protocol('p_12_failedpay', 11, [{ medication_name: 'Testosterone Cypionate', dose_amount: 100, dose_unit: 'mg', route: 'IM', frequency: 'weekly', notes: null }],
  [{ weeksAgo: 11, field: 'testosterone_cypionate_dose', from: null, to: '100mg weekly', clinical: 'Initiation.', patient: 'Starting at 100mg weekly.' }]);

// ---------- memberships & payments ----------
const PLAN = 24900; // $249/mo PLACEHOLDER — confirm real pricing (docs/11 §5)
const memberships = patients.filter(p => p.status !== 'lead').map(p => {
  const r = roster.find(x => x.key === p.id);
  let status = 'active', paused_at = null, cancelled_at = null, reason = null, reasonText = null;
  if (p.status === 'churned') { status = 'cancelled'; cancelled_at = weeksAgo(3); reason = 'no_perceived_benefit'; reasonText = 'Said he never really felt a difference and could not justify the cost.'; }
  if (p.status === 'paused') { status = 'paused'; paused_at = weeksAgo(4); reason = 'cost'; reasonText = 'Asked to pause for two months, cash flow.'; }
  return { id: `mem_${p.id}`, clinic_id: CLINIC, patient_id: p.id, plan_id: 'plan_core', status,
    started_at: weeksAgo(r.weeksOn || 1), paused_at, cancelled_at,
    cancel_reason_code: reason, cancel_reason_text: reasonText, mrr_cents: status === 'active' ? PLAN : 0 };
});

const payments = [];
memberships.forEach(m => {
  const months = Math.max(1, Math.floor((roster.find(r => r.key === m.patient_id).weeksOn || 1) / 4.33));
  for (let i = months; i >= 1; i--) {
    const failed = m.patient_id === 'p_12_failedpay' && i <= 2;
    payments.push({
      id: `pay_${m.patient_id}_${i}`, clinic_id: CLINIC, patient_id: m.patient_id,
      amount_cents: PLAN, type: 'membership',
      processor_ref: `test_pi_${m.patient_id}_${i}`,
      descriptor: 'GAMEDAY THORNTON - MEMBERSHIP',   // no PHI in descriptors, ever
      status: failed ? 'failed' : 'succeeded',
      created_at: daysAgo(i * 30)
    });
  }
});

// ---------- appointments ----------
const appointments = [
  { id: 'apt_01', patient_id: 'p_01_new', service_id: 'svc_consult', provider_id: 'prov_01', starts_at: daysAhead(1), status: 'booked', intake_complete: false, booking_channel: 'web', reason_code: 'low_t_consult' },
  { id: 'apt_02', patient_id: 'p_02_firstvisit', service_id: 'svc_consult', provider_id: 'prov_01', starts_at: daysAgo(0), status: 'complete', intake_complete: true, booking_channel: 'web', reason_code: 'low_t_consult' },
  { id: 'apt_03', patient_id: 'p_04_doubter', service_id: 'svc_labdraw', provider_id: 'prov_01', starts_at: weeksAgo(2), status: 'complete', intake_complete: true, booking_channel: 'staff', reason_code: 'monitoring' },
  { id: 'apt_04', patient_id: 'p_04_doubter', service_id: 'svc_followup', provider_id: 'prov_01', starts_at: daysAhead(3), status: 'booked', intake_complete: true, booking_channel: 'staff', reason_code: 'followup' },
  { id: 'apt_05', patient_id: 'p_05_safety', service_id: 'svc_followup', provider_id: 'prov_01', starts_at: daysAhead(2), status: 'booked', intake_complete: true, booking_channel: 'staff', reason_code: 'safety_review' },
  { id: 'apt_06', patient_id: 'p_09_noshow', service_id: 'svc_consult', provider_id: 'prov_02', starts_at: weeksAgo(8), status: 'no_show', intake_complete: false, booking_channel: 'web', reason_code: 'low_t_consult' },
  { id: 'apt_07', patient_id: 'p_09_noshow', service_id: 'svc_consult', provider_id: 'prov_02', starts_at: weeksAgo(6), status: 'complete', intake_complete: true, booking_channel: 'sms_recovery', reason_code: 'low_t_consult' },
  { id: 'apt_08', patient_id: 'p_06_psa', service_id: 'svc_followup', provider_id: 'prov_01', starts_at: daysAhead(5), status: 'booked', intake_complete: true, booking_channel: 'app', reason_code: 'safety_review' },
  { id: 'apt_09', patient_id: 'p_10_weightloss', service_id: 'svc_bodycomp', provider_id: 'prov_02', starts_at: daysAhead(1), status: 'booked', intake_complete: true, booking_channel: 'app', reason_code: 'weight_followup' },
  { id: 'apt_10', patient_id: 'p_11_hairloss', service_id: 'svc_prp_hair', provider_id: 'prov_02', starts_at: daysAhead(9), status: 'booked', intake_complete: false, booking_channel: 'app', reason_code: 'hair_treatment' },
  { id: 'apt_11', patient_id: 'p_03_enthusiast', service_id: 'svc_labdraw', provider_id: 'prov_01', starts_at: weeksAgo(1), status: 'complete', intake_complete: true, booking_channel: 'app', reason_code: 'monitoring' },
  { id: 'apt_12', patient_id: 'p_12_failedpay', service_id: 'svc_followup', provider_id: 'prov_01', starts_at: daysAhead(6), status: 'booked', intake_complete: true, booking_channel: 'staff', reason_code: 'followup' }
].map(a => ({ clinic_id: CLINIC, ...a }));

// ---------- leads (all 16 corporate-form sources represented) ----------
const leads = SOURCES.map((src, i) => ({
  id: `lead_${String(i + 1).padStart(2, '0')}`, clinic_id: CLINIC,
  created_at: daysAgo(30 - i), name: `Synthetic Lead ${i + 1}`,
  email: `lead${i + 1}@pilot.invalid`, phone: `+1720555${String(2000 + i).slice(-4)}`,
  source: src,
  consent_transactional_sms: true, consent_marketing_sms: i % 3 !== 0, consent_email: true,
  consent_captured_at: daysAgo(30 - i), consent_ip: '203.0.113.' + (10 + i),
  consent_text_shown: 'v1.0 — transactional SMS consent, Gameday Thornton',
  first_response_at: i % 4 === 0 ? null : daysAgo(30 - i),
  status: i < 6 ? 'converted' : i < 10 ? 'booked' : 'new',
  converted_patient_id: i < 6 ? patients[i].id : null
}));

// ---------- clinic record ----------
// Everything the prototype needs to render itself as a branded property.
// The client overrides all of this from PRESS BOX -> Settings -> Brand Kit;
// these are the defaults it resets to.
const clinic = {
  id: CLINIC,
  name: 'Gameday Men’s Health',
  location_name: 'Thornton',
  legal_name: 'Gameday Thornton (pilot)',
  address_line1: '10701 Melody Dr #315',
  address_city: 'Northglenn',
  address_state: 'CO',
  address_zip: '80234',
  // Documented NAP conflict — see docs/01-audit-findings.md. Surfaced in the
  // prototype so the owner sees it during the demo instead of us explaining it.
  nap_conflict_note: 'Listed as Thornton in copy, Northglenn in the footer, Westminster on Yelp.',
  phone_voice: '+1 (720) 967-4263',
  phone_text: '+1 (970) 804-4263',
  timezone: 'America/Denver',
  hours: [
    { day: 'Mon', open: '09:00', close: '17:00' },
    { day: 'Tue', open: '09:00', close: '17:00' },
    { day: 'Wed', open: '09:00', close: '17:00' },
    { day: 'Thu', open: '09:00', close: '17:00' },
    { day: 'Fri', open: '09:00', close: '17:00' },
    { day: 'Sat', open: null, close: null },
    { day: 'Sun', open: null, close: null }
  ],
  // Anxiety-reduction card content (P13). Specificity kills anxiety —
  // docs/07-design-system.md rule 5. Photos are uploaded by the client.
  visit_facts: {
    parking: 'Free surface lot directly in front of the suite. No garage, no meters.',
    suite: 'Building 10701, third floor, Suite 315. Elevator on the right as you enter.',
    draw: 'The blood draw is a single standard venipuncture. About 40 seconds.',
    duration: 'First visit runs 45–60 minutes. Follow-ups are usually under 25.',
    privacy: 'Private consult rooms. Nobody else is in the room. No waiting-room sign-in sheet.',
    cost: 'Cash-pay. Price is confirmed before anything is drawn or administered.'
  }
};

const plans = [
  { id: 'plan_core', clinic_id: CLINIC, name: 'Core Membership', price_cents: 24900, interval: 'month', provisional_price: true, includes: ['Provider visits', 'Protocol management', 'Quarterly monitoring labs', 'Weekly check-ins + Stat Sheet'] },
  { id: 'plan_performance', clinic_id: CLINIC, name: 'Performance Membership', price_cents: 34900, interval: 'month', provisional_price: true, includes: ['Everything in Core', 'Monthly vitamin injections', 'Body composition scans', 'Priority scheduling'] },
  { id: 'plan_metabolic', clinic_id: CLINIC, name: 'Metabolic Membership', price_cents: 39900, interval: 'month', provisional_price: true, includes: ['GLP-1 or tirzepatide management', 'Monthly titration visits', 'Body composition scans'] }
];

// ---------- appointment times + a full week of calendar density ----------
// Hand-authored appointments above carry dates only. Give them clinic-hours
// times, then fill the rest of the week so the calendar demos honestly —
// a calendar with four appointments in it does not look like a real clinic.
const apptTimes = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
const aRand = rng(77);
appointments.forEach((a, i) => {
  a.starts_at = `${a.starts_at}T${apptTimes[i % apptTimes.length]}:00`;
  const svc = services.find(s => s.id === a.service_id);
  a.duration_min = svc ? svc.duration_min : 30;
  a.room = i % 2 === 0 ? 'Room 1' : 'Room 2';
});

// Filler appointments: synthetic names, quick-service visits. These exist to
// make the calendar and utilisation views legible, not to carry any story.
const fillerNames = ['R. Alcaraz', 'J. Pilcher', 'M. Treadaway', 'D. Osgood', 'K. Winterbourne',
  'S. Hallmark', 'T. Brogden', 'N. Cazares', 'P. Rennick', 'W. Duffield', 'A. Sloane', 'C. Yerkes',
  'F. Mattingly', 'G. Ravenel', 'H. Stoddard', 'L. Prewitt', 'B. Ockerman', 'E. Tarleton'];
const fillerServices = ['svc_trt_cyp', 'svc_b12', 'svc_followup', 'svc_labdraw', 'svc_mic_b12', 'svc_glutathione', 'svc_nad', 'svc_bcomplex'];
let fillerIdx = 0;
for (let dayOffset = -2; dayOffset <= 11; dayOffset++) {
  const d = new Date(TODAY.getTime() + dayOffset * 864e5);
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) continue;                 // clinic closed weekends
  const count = 4 + Math.floor(aRand() * 4);
  const used = new Set();
  for (let k = 0; k < count; k++) {
    let slot = apptTimes[Math.floor(aRand() * apptTimes.length)];
    if (used.has(slot)) continue;
    used.add(slot);
    const svcId = fillerServices[Math.floor(aRand() * fillerServices.length)];
    const svc = services.find(s => s.id === svcId);
    const past = dayOffset < 0;
    appointments.push({
      id: `apt_f${String(++fillerIdx).padStart(3, '0')}`,
      clinic_id: CLINIC,
      patient_id: null,
      patient_display: fillerNames[fillerIdx % fillerNames.length],
      service_id: svcId,
      provider_id: aRand() < 0.6 ? 'prov_01' : 'prov_02',
      starts_at: `${iso(d)}T${slot}:00`,
      duration_min: svc ? svc.duration_min : 20,
      status: past ? (aRand() < 0.08 ? 'no_show' : 'complete') : 'booked',
      intake_complete: true,
      booking_channel: aRand() < 0.5 ? 'app' : 'staff',
      reason_code: 'routine',
      room: k % 2 === 0 ? 'Room 1' : 'Room 2',
      filler: true
    });
  }
}
appointments.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

// ---------- intake submissions ----------
const intakeTemplate = {
  version: 'v1.0',
  sections: [
    { key: 'symptoms', title: 'What brought you in', fields: [
      { key: 'primary_concern', label: 'Primary concern', type: 'choice', options: ['Low energy / fatigue', 'Low libido or sexual function', 'Weight gain', 'Poor sleep', 'Mood or focus', 'Hair loss', 'Athletic recovery'], multi: true },
      { key: 'duration', label: 'How long has this been going on?', type: 'choice', options: ['Under 6 months', '6–12 months', '1–3 years', 'Over 3 years'] }
    ]},
    { key: 'history', title: 'Medical history', fields: [
      { key: 'conditions', label: 'Diagnosed conditions', type: 'choice', options: ['High blood pressure', 'Diabetes / pre-diabetes', 'High cholesterol', 'Sleep apnea', 'Heart disease', 'Prostate issues', 'Blood clots', 'None of these'], multi: true },
      { key: 'surgeries', label: 'Surgeries or hospitalisations', type: 'text' },
      { key: 'family_prostate', label: 'Family history of prostate cancer', type: 'choice', options: ['Yes', 'No', 'Not sure'] }
    ]},
    { key: 'meds', title: 'Medications & supplements', fields: [
      { key: 'medications', label: 'Current prescription medications', type: 'text' },
      { key: 'supplements', label: 'Supplements', type: 'text' },
      { key: 'allergies', label: 'Allergies', type: 'text' }
    ]},
    { key: 'lifestyle', title: 'Lifestyle', fields: [
      { key: 'exercise', label: 'Exercise per week', type: 'choice', options: ['None', '1–2 days', '3–4 days', '5+ days'] },
      { key: 'alcohol', label: 'Alcohol per week', type: 'choice', options: ['None', '1–3 drinks', '4–7 drinks', '8–14 drinks', '15+'] },
      { key: 'tobacco', label: 'Tobacco / nicotine', type: 'choice', options: ['Never', 'Former', 'Current'] },
      { key: 'sleep_hours', label: 'Typical hours of sleep', type: 'choice', options: ['Under 5', '5–6', '6–7', '7–8', '8+'] }
    ]},
    { key: 'adam', title: 'Symptom questionnaire (ADAM)', instrument: 'ADAM', fields: [
      { key: 'adam_1', label: 'Do you have a decrease in libido (sex drive)?', type: 'yesno' },
      { key: 'adam_2', label: 'Do you have a lack of energy?', type: 'yesno' },
      { key: 'adam_3', label: 'Do you have a decrease in strength and/or endurance?', type: 'yesno' },
      { key: 'adam_4', label: 'Have you lost height?', type: 'yesno' },
      { key: 'adam_5', label: 'Have you noticed a decreased enjoyment of life?', type: 'yesno' },
      { key: 'adam_6', label: 'Are you sad and/or grumpy?', type: 'yesno' },
      { key: 'adam_7', label: 'Are your erections less strong?', type: 'yesno' },
      { key: 'adam_8', label: 'Have you noticed a recent deterioration in your ability to play sports?', type: 'yesno' },
      { key: 'adam_9', label: 'Are you falling asleep after dinner?', type: 'yesno' },
      { key: 'adam_10', label: 'Has there been a recent deterioration in your work performance?', type: 'yesno' }
    ]}
  ],
  consents: [
    { key: 'treatment', label: 'Consent to evaluation and treatment', required: true },
    { key: 'trt_risks', label: 'Testosterone therapy risks and benefits discussed', required: true },
    { key: 'telecom', label: 'Consent to receive appointment texts and emails', required: true },
    { key: 'photo', label: 'Consent to clinical progress photography (optional, revocable)', required: false }
  ]
};

const intakeSubmissions = [
  { id: 'intk_p_02', clinic_id: CLINIC, patient_id: 'p_02_firstvisit', appointment_id: 'apt_02', template_version: 'v1.0', submitted_at: daysAgo(1), signed_at: daysAgo(1), signature_ref: 'sig_synthetic_02', percent_complete: 100, answers: { primary_concern: ['Low energy / fatigue', 'Low libido or sexual function'], duration: '1–3 years', conditions: ['High cholesterol'], exercise: '3–4 days', alcohol: '4–7 drinks', tobacco: 'Never', sleep_hours: '5–6', adam_score: 7 } },
  { id: 'intk_p_01', clinic_id: CLINIC, patient_id: 'p_01_new', appointment_id: 'apt_01', template_version: 'v1.0', submitted_at: null, signed_at: null, signature_ref: null, percent_complete: 30, answers: { primary_concern: ['Low energy / fatigue'] } }
];

// ---------- message threads ----------
const messageThreads = [
  { id: 'thr_01', clinic_id: CLINIC, patient_id: 'p_05_safety', triage_tag: 'clinical', status: 'open', assigned_to: 'stf_prov_01', last_at: daysAgo(0), unread_staff: 1 },
  { id: 'thr_02', clinic_id: CLINIC, patient_id: 'p_04_doubter', triage_tag: 'clinical', status: 'open', assigned_to: 'stf_prov_01', last_at: daysAgo(2), unread_staff: 1 },
  { id: 'thr_03', clinic_id: CLINIC, patient_id: 'p_12_failedpay', triage_tag: 'billing', status: 'open', assigned_to: 'stf_front', last_at: daysAgo(1), unread_staff: 1 },
  { id: 'thr_04', clinic_id: CLINIC, patient_id: 'p_03_enthusiast', triage_tag: 'scheduling', status: 'closed', assigned_to: 'stf_front', last_at: daysAgo(6), unread_staff: 0 },
  { id: 'thr_05', clinic_id: CLINIC, patient_id: 'p_08_paused', triage_tag: 'billing', status: 'open', assigned_to: 'stf_front', last_at: daysAgo(4), unread_staff: 1 }
];

const messages = [
  { id: 'msg_01a', thread_id: 'thr_01', sender_type: 'patient', sender_id: 'p_05_safety', body: 'Getting headaches most mornings and my face feels flushed a lot. Is that from the dose increase?', sent_at: daysAgo(0), read_at: null },
  { id: 'msg_02a', thread_id: 'thr_02', sender_type: 'patient', sender_id: 'p_04_doubter', body: 'Being honest, I am not sure this is doing much anymore. I felt great around month two and now it feels like where I started. Thinking about stopping.', sent_at: daysAgo(2), read_at: null },
  { id: 'msg_03a', thread_id: 'thr_03', sender_type: 'staff', sender_id: 'stf_front', body: 'Hi Brady — the card on file was declined on this month’s membership. Can you update it when you get a minute? No rush on your therapy, nothing changes today.', sent_at: daysAgo(3), read_at: daysAgo(3) },
  { id: 'msg_03b', thread_id: 'thr_03', sender_type: 'patient', sender_id: 'p_12_failedpay', body: 'Yeah that card got replaced after a fraud alert. I will put the new one in tonight.', sent_at: daysAgo(1), read_at: null },
  { id: 'msg_04a', thread_id: 'thr_04', sender_type: 'patient', sender_id: 'p_03_enthusiast', body: 'Can I move my lab draw to a Friday? Mondays are rough with work.', sent_at: daysAgo(7), read_at: daysAgo(7) },
  { id: 'msg_04b', thread_id: 'thr_04', sender_type: 'staff', sender_id: 'stf_front', body: 'Done — moved you to Friday at 9:30. You will get a confirmation.', sent_at: daysAgo(6), read_at: daysAgo(6) },
  { id: 'msg_05a', thread_id: 'thr_05', sender_type: 'patient', sender_id: 'p_08_paused', body: 'Is there a cheaper plan? I want to keep going but this month got tight.', sent_at: daysAgo(4), read_at: null }
];

// ---------- photo series (metadata only) ----------
// No image bytes ship in this repo. The prototype renders a generated
// placeholder until the client uploads real photos, which are then held in
// the browser only. See docs/16-media-pipeline.md.
const poseKeys = ['front', 'left_profile', 'right_profile', 'crown'];
const photoSeries = [];
const photos = [];
function series(patientId, type, weeksBack, poses, everyWeeks) {
  const sid = `ps_${patientId}_${type}`;
  photoSeries.push({ id: sid, clinic_id: CLINIC, patient_id: patientId, series_type: type, capture_guide_ref: `guide_${type}_v1`, guide_version: 'v1', consent_ref: 'consent_photo_v1' });
  for (let w = weeksBack; w >= 0; w -= everyWeeks) {
    poses.forEach(pose => {
      photos.push({
        id: `ph_${patientId}_${type}_w${w}_${pose}`,
        clinic_id: CLINIC, series_id: sid, patient_id: patientId,
        captured_at: weeksAgo(w), week_index: weeksBack - w,
        pose_key: pose, guide_version: 'v1',
        storage_ref: null,               // populated only by a real upload
        placeholder: true,
        reviewed_by: null
      });
    });
  }
}
series('p_11_hairloss', 'hair', 26, ['crown', 'front'], 6);
series('p_10_weightloss', 'body', 14, ['front', 'left_profile'], 7);
series('p_04_doubter', 'body', 18, ['front'], 9);

// ---------- body composition ----------
const bodyComp = [];
function bodyCompSeries(patientId, weeksBack, startWeight, endWeight, startBf, endBf, everyWeeks, seed) {
  const r = rng(seed);
  const steps = Math.floor(weeksBack / everyWeeks);
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 1 : i / steps;
    const w = weeksBack - i * everyWeeks;
    const weight = +(startWeight + (endWeight - startWeight) * t + (r() * 2 - 1) * 1.4).toFixed(1);
    const bf = +(startBf + (endBf - startBf) * t + (r() * 2 - 1) * 0.5).toFixed(1);
    bodyComp.push({
      id: `bc_${patientId}_w${w}`, clinic_id: CLINIC, patient_id: patientId,
      measured_at: weeksAgo(w), weight_lbs: weight, body_fat_pct: bf,
      lean_mass_lbs: +(weight * (1 - bf / 100)).toFixed(1),
      visceral_fat_level: Math.max(3, Math.round(12 - (startBf - bf) * 0.8)),
      device: 'InBody-style (synthetic)'
    });
  }
}
bodyCompSeries('p_10_weightloss', 14, 268, 241, 34.2, 28.1, 2, 2001);
bodyCompSeries('p_04_doubter', 18, 214, 203, 27.4, 22.9, 6, 2002);
bodyCompSeries('p_03_enthusiast', 9, 196, 193, 23.1, 20.4, 3, 2003);

// ---------- inventory ----------
const inventoryItems = [
  { id: 'inv_test_cyp', clinic_id: CLINIC, name: 'Testosterone Cypionate 200mg/mL 10mL', category: 'injectable', is_controlled: true, schedule: 'III', unit: 'vial', reorder_threshold: 6 },
  { id: 'inv_tirzepatide', clinic_id: CLINIC, name: 'Tirzepatide compounded 10mg', category: 'injectable', is_controlled: false, schedule: null, unit: 'vial', reorder_threshold: 4 },
  { id: 'inv_b12', clinic_id: CLINIC, name: 'Vitamin B12 (cyanocobalamin) 1000mcg/mL', category: 'injectable', is_controlled: false, schedule: null, unit: 'vial', reorder_threshold: 8 },
  { id: 'inv_nad', clinic_id: CLINIC, name: 'NAD+ 100mg/mL', category: 'injectable', is_controlled: false, schedule: null, unit: 'vial', reorder_threshold: 3 },
  { id: 'inv_syringe', clinic_id: CLINIC, name: 'Syringe 25g 1mL', category: 'consumable', is_controlled: false, schedule: null, unit: 'box', reorder_threshold: 10 },
  { id: 'inv_pellet', clinic_id: CLINIC, name: 'Testosterone pellets 75mg', category: 'implant', is_controlled: true, schedule: 'III', unit: 'pellet', reorder_threshold: 20 }
];

const inventoryLots = [
  { id: 'lot_01', item_id: 'inv_test_cyp', lot_number: 'SYN-4471A', expiry_date: daysAhead(240), qty_received: 12, qty_remaining: 4 },
  { id: 'lot_02', item_id: 'inv_test_cyp', lot_number: 'SYN-4608B', expiry_date: daysAhead(31), qty_received: 10, qty_remaining: 9 },
  { id: 'lot_03', item_id: 'inv_tirzepatide', lot_number: 'SYN-TZ-220', expiry_date: daysAhead(95), qty_received: 8, qty_remaining: 3 },
  { id: 'lot_04', item_id: 'inv_b12', lot_number: 'SYN-B12-77', expiry_date: daysAhead(410), qty_received: 20, qty_remaining: 14 },
  { id: 'lot_05', item_id: 'inv_nad', lot_number: 'SYN-NAD-12', expiry_date: daysAhead(18), qty_received: 6, qty_remaining: 2 },
  { id: 'lot_06', item_id: 'inv_syringe', lot_number: 'SYN-SYR-900', expiry_date: daysAhead(720), qty_received: 40, qty_remaining: 31 },
  { id: 'lot_07', item_id: 'inv_pellet', lot_number: 'SYN-PEL-33', expiry_date: daysAhead(150), qty_received: 60, qty_remaining: 48 }
];

// ---------- automation log ----------
// Nothing here was ever sent. PILOT_MODE logs instead of transmitting.
const automationRuns = [
  { id: 'auto_01', clinic_id: CLINIC, rule_key: 'speed_to_lead', patient_id: null, lead_id: 'lead_11', triggered_at: daysAgo(0), channel: 'sms', status: 'logged_not_sent', latency_seconds: 41, payload_preview: 'Thanks for reaching out to Gameday Thornton. Here is a link to pick a time that works: [link]. Reply STOP to opt out.' },
  { id: 'auto_02', clinic_id: CLINIC, rule_key: 'intake_incomplete_t24', patient_id: 'p_01_new', triggered_at: daysAgo(0), channel: 'sms', status: 'logged_not_sent', payload_preview: 'Gameday: you have one item to finish before tomorrow. [link]' },
  { id: 'auto_03', clinic_id: CLINIC, rule_key: 'no_show_recovery', patient_id: 'p_09_noshow', triggered_at: weeksAgo(8), channel: 'sms', status: 'logged_not_sent', payload_preview: 'Gameday: we missed you today. Want to grab another time? [link]' },
  { id: 'auto_04', clinic_id: CLINIC, rule_key: 'no_checkin_21d', patient_id: 'p_04_doubter', triggered_at: daysAgo(2), channel: 'push', status: 'logged_not_sent', payload_preview: 'Gameday: you have an update.' },
  { id: 'auto_05', clinic_id: CLINIC, rule_key: 'payment_failed_retry', patient_id: 'p_12_failedpay', triggered_at: daysAgo(3), channel: 'email', status: 'logged_not_sent', payload_preview: 'Gameday: a billing item needs your attention.' },
  { id: 'auto_06', clinic_id: CLINIC, rule_key: 'due_for_labs', patient_id: 'p_06_psa', triggered_at: daysAgo(5), channel: 'sms', status: 'logged_not_sent', payload_preview: 'Gameday: you are due for a quick lab draw. Book here: [link]' },
  { id: 'auto_07', clinic_id: CLINIC, rule_key: 'month_3_progress', patient_id: 'p_08_paused', triggered_at: weeksAgo(1), channel: 'push', status: 'logged_not_sent', payload_preview: 'Gameday: you have an update.' },
  { id: 'auto_08', clinic_id: CLINIC, rule_key: 'missed_call_textback', patient_id: null, triggered_at: daysAgo(1), channel: 'sms', status: 'logged_not_sent', latency_seconds: 22, payload_preview: 'Sorry we missed your call — this is Gameday Thornton. Can we help you book? [link]' }
];

// Notification-preview discipline (P35): every patient-facing message above must
// pass this. Clinical content in a lock-screen preview is the whole risk.
const bannedPreviewTerms = ['testosterone', 'erectile', 'ED', 'hematocrit', 'PSA', 'results are ready', 'lab result'];

// ---------- front-desk queues ----------
const missedCalls = [
  { id: 'mc_01', clinic_id: CLINIC, from_number: '+17205550137', received_at: daysAgo(0), duration_seconds: 0, textback_sent: true, status: 'awaiting_reply' },
  { id: 'mc_02', clinic_id: CLINIC, from_number: '+13035550192', received_at: daysAgo(0), duration_seconds: 0, textback_sent: true, status: 'booked' },
  { id: 'mc_03', clinic_id: CLINIC, from_number: '+17205550244', received_at: daysAgo(1), duration_seconds: 0, textback_sent: false, status: 'needs_callback' }
];

const waitlist = [
  { id: 'wl_01', clinic_id: CLINIC, patient_id: 'p_03_enthusiast', service_id: 'svc_followup', preferred_window: 'Weekday mornings', added_at: daysAgo(3), status: 'waiting' },
  { id: 'wl_02', clinic_id: CLINIC, patient_id: null, patient_display: 'J. Pilcher', service_id: 'svc_consult', preferred_window: 'Any afternoon this week', added_at: daysAgo(1), status: 'waiting' },
  { id: 'wl_03', clinic_id: CLINIC, patient_id: 'p_10_weightloss', service_id: 'svc_bodycomp', preferred_window: 'Friday', added_at: daysAgo(2), status: 'waiting' }
];

const tasks = [
  { id: 'task_01', clinic_id: CLINIC, title: 'Review hematocrit 52.6 — Vaughn Iselin', patient_id: 'p_05_safety', assigned_to: 'stf_prov_01', due: daysAgo(0), priority: 'high', source: 'safety_queue', done: false },
  { id: 'task_02', clinic_id: CLINIC, title: 'PSA velocity discussion — Errol Bratcher', patient_id: 'p_06_psa', assigned_to: 'stf_prov_01', due: daysAhead(5), priority: 'high', source: 'safety_queue', done: false },
  { id: 'task_03', clinic_id: CLINIC, title: 'No check-in 3 weeks — call Gregory Sunderman', patient_id: 'p_04_doubter', assigned_to: 'stf_front', due: daysAgo(0), priority: 'high', source: 'at_risk', done: false },
  { id: 'task_04', clinic_id: CLINIC, title: 'Chase intake — Aaron Petrak, visit tomorrow', patient_id: 'p_01_new', assigned_to: 'stf_front', due: daysAgo(0), priority: 'med', source: 'intake_incomplete', done: false },
  { id: 'task_05', clinic_id: CLINIC, title: 'Card declined twice — Brady Hollifield', patient_id: 'p_12_failedpay', assigned_to: 'stf_front', due: daysAhead(1), priority: 'med', source: 'payment_failed', done: false },
  { id: 'task_06', clinic_id: CLINIC, title: 'Pause ends in 4 weeks — Leland Ashcraft', patient_id: 'p_08_paused', assigned_to: 'stf_front', due: daysAhead(28), priority: 'low', source: 'membership', done: false }
];

// ---------- write ----------
const files = {
  'analytes.json': analytes,
  'services.json': services,
  'providers.json': providers,
  'staff.json': staff,
  'patients.json': patients,
  'appointments.json': appointments,
  'lab_panels.json': labPanels,
  'lab_results.json': labResults,
  'checkins.json': checkins,
  'protocols.json': protocols,
  'protocol_items.json': protocolItems,
  'protocol_changes.json': protocolChanges,
  'memberships.json': memberships,
  'payments.json': payments,
  'leads.json': leads,
  'clinic.json': clinic,
  'plans.json': plans,
  'intake_template.json': intakeTemplate,
  'intake_submissions.json': intakeSubmissions,
  'message_threads.json': messageThreads,
  'messages.json': messages,
  'photo_series.json': photoSeries,
  'photos.json': photos,
  'body_comp.json': bodyComp,
  'inventory_items.json': inventoryItems,
  'inventory_lots.json': inventoryLots,
  'automation_runs.json': automationRuns,
  'missed_calls.json': missedCalls,
  'waitlist.json': waitlist,
  'tasks.json': tasks
};

if (!fs.existsSync(FIX)) fs.mkdirSync(FIX, { recursive: true });
if (!fs.existsSync(PROTO)) fs.mkdirSync(PROTO, { recursive: true });

Object.entries(files).forEach(([name, data]) => {
  fs.writeFileSync(path.join(FIX, name), JSON.stringify(data, null, 2));
  console.log(`  fixtures/${name.padEnd(24)} ${Array.isArray(data) ? data.length : '-'} records`);
});

// Full demo payload — loadable over file:// without a dev server.
// `anchor_today` is what the prototype shifts from; see store.js -> shiftWeeks.
const demo = {
  generated_at: new Date().toISOString(),
  anchor_today: iso(TODAY),
  synthetic: true,
  pilot_mode: true,
  clinic,
  plans,
  analytes,
  services,
  providers,
  staff,
  patients,
  appointments,
  lab_panels: labPanels,
  lab_results: labResults,
  checkins,
  protocols,
  protocol_items: protocolItems,
  protocol_changes: protocolChanges,
  memberships,
  payments,
  leads,
  intake_template: intakeTemplate,
  intake_submissions: intakeSubmissions,
  message_threads: messageThreads,
  messages,
  photo_series: photoSeries,
  photos,
  body_comp: bodyComp,
  inventory_items: inventoryItems,
  inventory_lots: inventoryLots,
  automation_runs: automationRuns,
  banned_preview_terms: bannedPreviewTerms,
  missed_calls: missedCalls,
  waitlist,
  tasks
};
fs.writeFileSync(path.join(PROTO, 'demo-data.js'), 'window.GD_DEMO = ' + JSON.stringify(demo) + ';\n');
console.log('  prototype/demo-data.js');
console.log('\nDone. All data is synthetic. See docs/09-compliance-register.md\n');
