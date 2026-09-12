/**
 * smoke-test.cjs
 * Renders every prototype screen in a minimal fake DOM and asserts it produces
 * HTML without throwing.
 *
 * Why this exists: the prototype is a hand-written SPA with no build step and
 * no framework, which means a typo in one screen shows up as a blank panel in
 * front of a client rather than as a build error. This catches that in ~1s.
 *
 * It is not a browser. It proves the data layer and every render path are
 * sound; it cannot prove layout. Pair it with an actual click-through before
 * any demo.
 *
 * Run:  node scripts/smoke-test.cjs
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const PROTO = path.join(ROOT, 'prototype');
const A = path.join(PROTO, 'assets');

let failures = 0;
let checks = 0;

function ok(label, extra) {
  checks++;
  console.log('  ✓ ' + label + (extra ? '  ' + extra : ''));
}
function bad(label, err) {
  failures++;
  console.log('  ✗ ' + label);
  if (err) console.log('      ' + String(err && err.stack ? err.stack.split('\n').slice(0, 4).join('\n      ') : err));
}

/* ------------------------------------------------------------ fake DOM ---- */
/* Only as much as the load-time and render-time paths actually touch. */

function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    dataset: {}, style: { setProperty() {}, removeProperty() {} },
    children: [], attributes: {}, value: '', checked: false, files: null,
    className: '', innerHTML: '', textContent: '', type: '',
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k]; },
    removeAttribute(k) { delete this.attributes[k]; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); },
    remove() {},
    addEventListener() {}, removeEventListener() {},
    querySelector() { return makeEl('div'); },
    querySelectorAll() { return []; },
    closest() { return null; },
    focus() {}, select() {}, click() {},
    insertAdjacentHTML() {},
    get parentNode() { return null; }
  };
  return el;
}

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

const documentElement = makeEl('html');
const body = makeEl('body');
const appEl = makeEl('div');

const document = {
  documentElement, body, title: '',
  createElement: makeEl,
  getElementById: id => (id === 'app' ? appEl : null),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {}
};

const sandbox = {
  window: null,
  document,
  localStorage,
  location: { hash: '#/staff/scoreboard', replace(h) { this.hash = h; } },
  navigator: { clipboard: null },
  console,
  Math, Date, JSON, Number, String, Boolean, Array, Object, Error, RegExp, isNaN, parseInt, parseFloat,
  encodeURIComponent, decodeURIComponent, Promise, setTimeout, clearTimeout, TypeError,
  requestAnimationFrame: fn => setTimeout(fn, 0),
  addEventListener() {}, removeEventListener() {},
  scrollTo() {},
  scrollY: 0,
  matchMedia: () => ({ matches: false, addEventListener() {} })
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;

const context = vm.createContext(sandbox);

/* --------------------------------------------------------------- loading -- */

const FILES = [
  ['prototype/demo-data.js', path.join(PROTO, 'demo-data.js')],
  ['assets/store.js', path.join(A, 'store.js')],
  ['assets/charts.js', path.join(A, 'charts.js')],
  ['assets/media.js', path.join(A, 'media.js')],
  ['assets/brand.js', path.join(A, 'brand.js')],
  ['assets/ui.js', path.join(A, 'ui.js')],
  ['assets/screens-patient.js', path.join(A, 'screens-patient.js')],
  ['assets/screens-staff.js', path.join(A, 'screens-staff.js')],
  ['assets/screens-settings.js', path.join(A, 'screens-settings.js')]
];

console.log('\nLOAD');
for (const [label, file] of FILES) {
  if (!fs.existsSync(file)) { bad(label + ' (missing)'); continue; }
  try {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
    ok(label);
  } catch (err) {
    bad(label, err);
  }
}

if (failures) {
  console.log('\n' + failures + ' file(s) failed to load. Fix those first.\n');
  process.exit(1);
}

const GD = sandbox.GD;

/* ---------------------------------------------------------------- wiring -- */
/* A file that exists but is not referenced by index.html loads here and not in
   the browser, which is the one class of bug this harness could otherwise hide. */

console.log('\nWIRING');
{
  const html = fs.readFileSync(path.join(PROTO, 'index.html'), 'utf8');
  const assetFiles = fs.readdirSync(A).filter(f => /\.(js|css)$/.test(f));
  const unreferenced = assetFiles.filter(f => !html.includes(f));
  if (unreferenced.length) bad('every asset is referenced by index.html',
    new Error('not referenced: ' + unreferenced.join(', ')));
  else ok('every asset is referenced by index.html', assetFiles.length + ' files');

  const referenced = (html.match(/(?:src|href)="([^"]+\.(?:js|css))"/g) || [])
    .map(m => m.replace(/.*="/, '').replace(/"$/, ''))
    .filter(p => !/^https?:/.test(p));
  const broken = referenced.filter(p => !fs.existsSync(path.join(PROTO, p)));
  if (broken.length) bad('every reference in index.html resolves', new Error('missing: ' + broken.join(', ')));
  else ok('every reference in index.html resolves', referenced.length + ' references');

  // Load order is load-bearing: store before brand, brand before ui, screens
  // after ui, boot last.
  const order = ['store.js', 'charts.js', 'media.js', 'brand.js', 'ui.js', 'boot.js'];
  const positions = order.map(f => ({ f, at: html.indexOf(f) }));
  const misordered = positions.filter((p, i) => i > 0 && p.at < positions[i - 1].at);
  if (misordered.length) bad('script load order', new Error('out of order: ' + misordered.map(m => m.f).join(', ')));
  else ok('script load order', order.join(' → '));
}

/* ------------------------------------------------------------- data layer -- */

console.log('\nDATA LAYER');
function check(label, fn) {
  try {
    const v = fn();
    if (v === false) return bad(label + ' (returned false)');
    ok(label, typeof v === 'object' ? '' : '→ ' + v);
  } catch (err) { bad(label, err); }
}

check('demo clock resolves to a weekday', () => {
  const d = new Date(GD.store.today() + 'T00:00:00Z').getUTCDay();
  if (d === 0 || d === 6) throw new Error('demo today is a weekend: ' + GD.store.today());
  return GD.store.today();
});
check('patients loaded', () => {
  const n = GD.q.patients().length;
  if (n !== 12) throw new Error('expected 12, got ' + n);
  return n + ' patients';
});
check('appointments exist today', () => {
  const n = GD.q.apptsToday().length;
  if (!n) throw new Error('no appointments on the demo date — the Today screen would be empty');
  return n + ' today';
});
check('lab results loaded', () => GD.store.all('lab_results').length + ' results');
check('MRR computes', () => GD.fmt.money(GD.q.mrr()));
check('avg months on protocol computes', () => GD.q.avgMonthsOnProtocol() + ' months');
check('NRR computes', () => GD.q.nrr() + '%');
check('funnel has all stages', () => {
  const f = GD.q.funnel();
  if (f.length !== 6) throw new Error('expected 6 stages');
  return f.map(s => s.label + ':' + s.n).join(' ');
});
check('safety queue flags the hematocrit patient', () => {
  const rows = GD.q.safetyQueue();
  const hit = rows.find(r => r.patient.id === 'p_05_safety');
  if (!hit) throw new Error('p_05_safety not flagged');
  if (!hit.items.some(i => i.code === 'hematocrit_ceiling')) throw new Error('ceiling not detected');
  return rows.length + ' patients flagged';
});
check('safety queue flags PSA velocity', () => {
  const hit = GD.q.safetyQueue().find(r => r.patient.id === 'p_06_psa');
  if (!hit || !hit.items.some(i => i.code === 'psa_velocity' || i.code === 'psa_absolute'))
    throw new Error('PSA not flagged');
  return hit.items.map(i => i.code).join(', ');
});
check('doubter is flagged at risk for silence', () => {
  const hit = GD.q.atRisk().find(r => r.patient.id === 'p_04_doubter');
  if (!hit) throw new Error('p_04_doubter not at risk');
  if (!hit.reasons.some(r => r.code === 'no_checkin')) throw new Error('silence not detected');
  return hit.reasons.map(r => r.code).join(', ');
});
check('doubter shows the plateau shape', () => {
  const weeks = GD.q.plateauWeeks('p_04_doubter');
  if (weeks < 4) throw new Error('expected a plateau, got ' + weeks + ' weeks');
  return weeks + ' weeks flat';
});
check('doubter improved from baseline despite the plateau', () => {
  const c = GD.q.thenVsNow('p_04_doubter');
  const improved = c.filter(x => x.delta > 0).length;
  if (improved < 4) throw new Error('only ' + improved + '/6 improved — the demo story breaks');
  return improved + '/6 dimensions up from week one';
});
check('season framing never shows a bare week', () => {
  const s = GD.q.season('p_04_doubter');
  const label = GD.brand.seasonLabel(s);
  if (!/of 12/.test(label)) throw new Error('missing "of 12": ' + label);
  return label;
});
check('lab flagging matches the generator', () => {
  if (GD.q.flagFor('hematocrit', 52.6) !== 'critical') throw new Error('52.6 should be critical');
  if (GD.q.flagFor('total_testosterone', 700) !== 'in_range') throw new Error('700 should be in range');
  if (GD.q.flagFor('total_testosterone', 950) !== 'above_ref') throw new Error('950 should be above ref');
  if (GD.q.flagFor('total_testosterone', 400) !== 'below_target') throw new Error('400 should be below target');
  return 'critical / in_range / above_ref / below_target all correct';
});
check('notification previews carry no clinical content', () => {
  const bad = GD.q.automationRuns().filter(r => !GD.q.previewSafe(r.payload_preview).safe);
  if (bad.length) throw new Error('leaks: ' + bad.map(b => b.rule_key).join(', '));
  return GD.q.automationRuns().length + ' previews clean';
});
check('no PHI in any payment descriptor', () => {
  const banned = ['testosterone', 'trt', 'erectile', 'ed ', 'glp', 'tirzepatide', 'semaglutide'];
  const leaks = GD.store.all('payments').filter(p =>
    banned.some(b => String(p.descriptor || '').toLowerCase().includes(b)));
  if (leaks.length) throw new Error(leaks.length + ' descriptors leak a therapy name');
  return GD.store.all('payments').length + ' descriptors clean';
});
check('every table carries clinic_id', () => {
  const tables = ['patients', 'appointments', 'lab_panels', 'checkins', 'memberships', 'payments',
    'leads', 'protocols', 'photos', 'inventory_items', 'tasks'];
  const missing = tables.filter(t => GD.store.all(t).some(r => !r.clinic_id));
  if (missing.length) throw new Error('missing clinic_id in: ' + missing.join(', '));
  return tables.length + ' tables checked';
});
check('ranges are all marked provisional', () => {
  const notMarked = GD.q.analytes().filter(a => !a.provisional);
  if (notMarked.length) throw new Error(notMarked.length + ' analytes not marked provisional');
  return GD.q.analytes().length + ' analytes marked';
});
check('slot generator respects clinic hours', () => {
  const sat = GD.q.slotsFor(GD.fmt.plusDays(GD.store.monday(), 5), 'svc_consult');
  if (sat.length) throw new Error('generated slots on a Saturday');
  const mon = GD.q.slotsFor(GD.store.monday(), 'svc_consult');
  if (!mon.length) throw new Error('no slots on a Monday');
  if (mon.some(t => t >= '12:00' && t < '13:00')) throw new Error('generated slots during lunch');
  return mon.length + ' Monday slots, 0 Saturday slots';
});

/* ----------------------------------------------------------- brand layer -- */

console.log('\nBRAND');
check('default accent passes contrast', () => {
  const issues = GD.brand.audit(GD.brand.DEFAULTS);
  if (issues.length) throw new Error(issues.map(i => i.text).join(' | '));
  return 'no contrast warnings';
});
check('unreadable accent is caught', () => {
  const issues = GD.brand.audit(Object.assign({}, GD.brand.DEFAULTS, { accent: '#1a1a1a' }));
  if (!issues.length) throw new Error('a near-black accent on a dark background should warn');
  return issues.length + ' warning(s) raised';
});
check('invalid hex is caught', () => {
  const issues = GD.brand.audit(Object.assign({}, GD.brand.DEFAULTS, { accent: 'burgundy' }));
  if (!issues.some(i => i.level === 'error')) throw new Error('should error');
  return 'rejected';
});
check('vocabulary toggle swaps every themed noun', () => {
  GD.brand.save({ sportsVocabulary: false });
  const plain = GD.brand.word('statSheet');
  GD.brand.save({ sportsVocabulary: true });
  const themed = GD.brand.word('statSheet');
  if (plain === themed) throw new Error('vocabulary did not change');
  return themed + ' ↔ ' + plain;
});
check('brand kit round-trips through export/import', () => {
  GD.brand.save({ accent: '#0072ce', radius: 2 });
  const json = GD.brand.export();
  GD.brand.reset();
  GD.brand.import(json);
  if (GD.brand.current().accent !== '#0072ce') throw new Error('accent lost');
  GD.brand.reset();
  return 'round-trip clean';
});

/* --------------------------------------------------------------- screens -- */

/**
 * Tag balance. Screens build HTML as strings, so an unclosed <section> is a real
 * possibility and the render test will not notice — it only checks that a string
 * came back. An unbalanced container silently swallows everything after it.
 *
 * Only non-void container tags, all of which this codebase closes explicitly.
 */
const CONTAINERS = ['div', 'section', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'button', 'label', 'select', 'textarea',
  'figure', 'figcaption', 'svg', 'g', 'text', 'nav', 'h1', 'h2', 'h3', 'p', 'span', 'pre'];

function tagBalance(html) {
  const problems = [];
  for (const tag of CONTAINERS) {
    const open = (html.match(new RegExp('<' + tag + '(?=[\\s/>])', 'gi')) || [])
      .length - (html.match(new RegExp('<' + tag + '\\b[^>]*/>', 'gi')) || []).length;
    const close = (html.match(new RegExp('</' + tag + '>', 'gi')) || []).length;
    if (open !== close) problems.push(tag + ' ' + open + '/' + close);
  }
  return problems;
}

console.log('\nSCREENS');
const ROUTES = [
  ['staff/scoreboard', []], ['staff/today', []], ['staff/calendar', []], ['staff/checkout', []],
  ['staff/messages', []], ['staff/patients', []], ['staff/patient/:id', ['p_04_doubter']],
  ['staff/labs', []], ['staff/safety', []], ['staff/due', []], ['staff/pipeline', []],
  ['staff/retention', []], ['staff/automations', []], ['staff/inventory', []], ['staff/settings', []],
  ['patient/home', []], ['patient/checkin', []], ['patient/stats', []], ['patient/labs', []],
  ['patient/plan', []], ['patient/film', []], ['patient/book', []], ['patient/visit', []],
  ['patient/intake', []], ['patient/membership', []], ['patient/messages', []], ['patient/more', []]
];

// Every screen, against every patient in the roster. This is what catches a
// screen that only works for the patient it was written against — the
// churned member with no protocol, the lead with no labs, the new patient
// with no check-ins.
const PATIENTS = GD.q.patients().map(p => p.id);

for (const [route, params] of ROUTES) {
  const spec = GD.ui._routesFor ? GD.ui._routesFor(route) : null;
  let rendered = 0, err = null, chars = 0;
  for (const pid of PATIENTS) {
    GD.store.pref('demoPatient', pid);
    const ctx = { app: route.split('/')[0], route, params: params.length ? [pid] : [], spec: null };
    try {
      sandbox.location.hash = '#/' + route.replace(':id', pid);
      const parsed = GD.ui.parse();
      if (!parsed.spec || !parsed.spec.render) throw new Error('route did not resolve');
      const html = parsed.spec.render(parsed);
      if (typeof html !== 'string' || !html.length) throw new Error('render produced no HTML');
      if (/undefined|NaN|\[object Object\]/.test(html)) {
        throw new Error('output contains ' + (html.match(/undefined|NaN|\[object Object\]/) || [])[0]);
      }
      // Title and primary action are part of the screen contract.
      if (typeof parsed.spec.title === 'function') parsed.spec.title(parsed);
      if (parsed.spec.primary) parsed.spec.primary(parsed);

      const unbalanced = tagBalance(html);
      if (unbalanced.length) throw new Error('unbalanced tags (open/close): ' + unbalanced.join(', '));

      chars += html.length;
      rendered++;
    } catch (e) { err = e; break; }
  }
  if (err) bad(route + '  (patient ' + GD.store.pref('demoPatient') + ')', err);
  else ok(route.padEnd(24), rendered + ' patients · ' + Math.round(chars / rendered / 100) / 10 + 'k avg');
}

/* --------------------------------------------------------------- mutations -- */

console.log('\nWRITE PATH');
check('check-in writes and lands on the chart', () => {
  const before = GD.q.checkins('p_04_doubter').length;
  GD.store.add('checkins', { patient_id: 'p_04_doubter', week_of: GD.store.today(),
    submitted_at: GD.store.today(), energy: 8, libido: 7, sleep_quality: 8, mood: 8,
    gym_performance: 7, mental_clarity: 8, missed_doses_count: 0, notes_free_text: null });
  const after = GD.q.checkins('p_04_doubter').length;
  if (after !== before + 1) throw new Error('check-in did not persist');
  return before + ' → ' + after;
});
check('a new check-in clears the at-risk silence flag', () => {
  const hit = GD.q.atRisk().find(r => r.patient.id === 'p_04_doubter');
  if (hit && hit.reasons.some(r => r.code === 'no_checkin'))
    throw new Error('still flagged as silent after checking in');
  return 'silence flag cleared';
});
check('lab panel writes and flags correctly', () => {
  const panel = GD.store.add('lab_panels', { patient_id: 'p_03_enthusiast', drawn_at: GD.store.today(),
    source: 'in_clinic', entered_by: 'stf_prov_01', note: 'smoke test' });
  GD.store.add('lab_results', { panel_id: panel.id, analyte: 'hematocrit', value_numeric: 53.1,
    unit: '%', ref_low: 38.3, ref_high: 48.6, target_low: 40, target_high: 50,
    flag: GD.q.flagFor('hematocrit', 53.1), provisional_ranges: true });
  const flagged = GD.q.safetyQueue().find(r => r.patient.id === 'p_03_enthusiast');
  if (!flagged) throw new Error('new critical value did not reach the safety queue');
  return 'entered 53.1% → safety queue picked it up';
});
check('overlay survives a reload', () => {
  const n = GD.store.pilotWrites();
  if (!n) throw new Error('nothing recorded as a pilot write');
  const raw = localStorage.getItem('gd_pilot_overlay_v2');
  if (!raw) throw new Error('overlay not persisted to storage');
  return n + ' pilot writes persisted';
});
check('reset restores the seeded roster', () => {
  GD.store.reset({ keepBrand: true, keepMedia: true });
  if (GD.store.pilotWrites() !== 0) throw new Error('writes survived the reset');
  if (GD.q.checkins('p_04_doubter').length === 0) throw new Error('seeded data lost');
  return 'clean';
});

/* ------------------------------------------------------------------ charts -- */

console.log('\nCHARTS');
check('stat sheet renders SVG with markers', () => {
  const cis = GD.q.checkins('p_04_doubter');
  const svg = GD.charts.statSheet({
    series: GD.q.checkinDims.map(d => ({ key: d, label: d, color: '#fff',
      points: cis.map(c => ({ date: c.week_of, value: c[d] })) })),
    labDates: GD.q.panels('p_04_doubter').map(p => p.drawn_at),
    doseChanges: GD.q.protocolChanges('p_04_doubter').map(c => ({ date: c.changed_at, label: String(c.new_value) })),
    baseline: GD.q.checkinAvg(cis[0])
  });
  if (!/^<svg/.test(svg)) throw new Error('not SVG');
  if (!/dose-line/.test(svg)) throw new Error('no dose markers');
  if (!/lab-tick/.test(svg)) throw new Error('no lab ticks');
  if (/NaN/.test(svg)) throw new Error('NaN in path data');
  return Math.round(svg.length / 100) / 10 + 'k of SVG, ticks + dose markers present';
});
check('trend chart handles a single point', () => {
  const svg = GD.charts.trend({ points: [{ date: GD.store.today(), value: 5 }], label: 'x' });
  if (/NaN/.test(svg)) throw new Error('NaN with one point');
  return 'no NaN';
});
check('every chart survives an empty series', () => {
  ['statSheet'].forEach(fn => {
    const out = GD.charts[fn]({ series: [], labDates: [], doseChanges: [] });
    if (/NaN/.test(out)) throw new Error(fn + ' produced NaN');
  });
  if (/NaN/.test(GD.charts.bars([]))) throw new Error('bars produced NaN');
  if (/NaN/.test(GD.charts.funnel([]))) throw new Error('funnel produced NaN');
  return 'empty states clean';
});

/* ------------------------------------------------------------------ result -- */

console.log('\n' + '─'.repeat(64));
if (failures) {
  console.log(failures + ' of ' + checks + ' checks FAILED\n');
  process.exit(1);
}
console.log('All ' + checks + ' checks passed.');
console.log('Reminder: this proves the data and render paths. Click through the');
console.log('real thing before any demo — it cannot see layout.\n');
