/* ==========================================================================
   store.js — the pilot data layer
   --------------------------------------------------------------------------
   Wraps the synthetic dataset in demo-data.js and adds:

     1. A demo clock. Every date in the fixtures shifts forward by whole weeks
        so the prototype is always "this week" whenever it is demoed, while
        weekday alignment (clinic runs Mon-Fri) stays intact.

     2. A write overlay in localStorage. Anything the client does in the demo
        -- submit a check-in, enter a lab panel, book a visit, change a dose,
        upload a headshot -- persists across reloads and can be reset in one
        click. Without this, a demo session cannot show cause and effect.

     3. Derived selectors. Every number on the Scoreboard is computed here,
        never in a screen file, so the owner asking "where does that come
        from" has exactly one answer per metric.

   NOTHING HERE IS REAL. See docs/09-compliance-register.md.
   In production this file is replaced by lib/db queries against Supabase;
   the selector names are the contract. See docs/13-build-sequence.md.
   ========================================================================== */

(function () {
  'use strict';

  var GD = window.GD = window.GD || {};
  var OVERLAY_KEY = 'gd_pilot_overlay_v2';

  /* ---------------------------------------------------------- demo clock -- */

  var DAY = 864e5;
  function ymd(d) { return d.toISOString().slice(0, 10); }
  function parse(s) { return new Date(s + (s.length === 10 ? 'T00:00:00Z' : 'Z')); }

  // The clinic is closed weekends, so a weekend demo rolls forward to Monday.
  // Otherwise "Today's patients" is empty and the whole console looks broken.
  function resolveClock(anchorISO) {
    var real = new Date();
    var realUTC = new Date(Date.UTC(real.getFullYear(), real.getMonth(), real.getDate()));
    var dow = realUTC.getUTCDay();                    // 0 Sun .. 6 Sat
    var weekMonday;
    if (dow === 0) weekMonday = new Date(realUTC.getTime() + DAY);          // Sun -> tomorrow
    else if (dow === 6) weekMonday = new Date(realUTC.getTime() + 2 * DAY); // Sat -> Monday
    else weekMonday = new Date(realUTC.getTime() - (dow - 1) * DAY);
    var anchor = parse(anchorISO);
    var shiftDays = Math.round((weekMonday - anchor) / DAY);
    var today = (dow === 0 || dow === 6) ? weekMonday : realUTC;
    return { shiftDays: shiftDays, todayISO: ymd(today), mondayISO: ymd(weekMonday), rolledForward: dow === 0 || dow === 6 };
  }

  var DATEY = /^(\d{4})-(\d{2})-(\d{2})(T[\d:.]+)?$/;
  var NEVER_SHIFT = { dob: 1, anchor_today: 1, generated_at: 1, template_version: 1, consent_text_shown: 1 };

  function shiftDeep(value, days, key) {
    if (typeof value === 'string') {
      if (NEVER_SHIFT[key]) return value;
      var m = DATEY.exec(value);
      if (!m) return value;
      var shifted = ymd(new Date(parse(value.slice(0, 10)).getTime() + days * DAY));
      return m[4] ? shifted + m[4] : shifted;
    }
    if (Array.isArray(value)) return value.map(function (v) { return shiftDeep(v, days, key); });
    if (value && typeof value === 'object') {
      var out = {};
      Object.keys(value).forEach(function (k) { out[k] = shiftDeep(value[k], days, k); });
      return out;
    }
    return value;
  }

  /* ------------------------------------------------------------- overlay -- */

  function blankOverlay() {
    return { added: {}, patched: {}, removed: {}, media: {}, brand: null, prefs: {}, version: 2 };
  }

  function readOverlay() {
    try {
      var raw = localStorage.getItem(OVERLAY_KEY);
      if (!raw) return blankOverlay();
      var parsed = JSON.parse(raw);
      return Object.assign(blankOverlay(), parsed);
    } catch (e) {
      console.warn('[store] overlay unreadable, starting clean', e);
      return blankOverlay();
    }
  }

  function writeOverlay(o) {
    try {
      localStorage.setItem(OVERLAY_KEY, JSON.stringify(o));
    } catch (e) {
      // Almost always the 5MB quota, and almost always uploaded images.
      GD.bus && GD.bus.emit('storage-full', e);
      console.warn('[store] could not persist overlay', e);
    }
  }

  /* ------------------------------------------------------------ tiny bus -- */

  GD.bus = (function () {
    var subs = {};
    return {
      on: function (evt, fn) { (subs[evt] = subs[evt] || []).push(fn); return fn; },
      off: function (evt, fn) { subs[evt] = (subs[evt] || []).filter(function (f) { return f !== fn; }); },
      emit: function (evt, data) { (subs[evt] || []).forEach(function (f) { try { f(data); } catch (e) { console.error(e); } }); }
    };
  })();

  /* --------------------------------------------------------------- store -- */

  var store = GD.store = {
    raw: null,
    clock: null,
    base: {},
    overlay: readOverlay(),

    init: function () {
      var demo = window.GD_DEMO;
      if (!demo) throw new Error('demo-data.js did not load. Run: node scripts/generate-fixtures.cjs');
      this.clock = resolveClock(demo.anchor_today || '2026-09-14');
      this.raw = demo;

      var self = this;
      Object.keys(demo).forEach(function (k) {
        self.base[k] = shiftDeep(demo[k], self.clock.shiftDays, k);
      });
      return this;
    },

    /** Today, per the demo clock. Always a clinic day. */
    today: function () { return this.clock.todayISO; },
    monday: function () { return this.clock.mondayISO; },

    /** Merged view of a table: base + added, patched, minus removed. */
    all: function (table) {
      var base = this.base[table];
      if (!Array.isArray(base)) base = base ? [base] : [];
      var rows = base.concat(this.overlay.added[table] || []);
      var patched = this.overlay.patched[table] || {};
      var removed = this.overlay.removed[table] || [];
      return rows
        .filter(function (r) { return removed.indexOf(r.id) === -1; })
        .map(function (r) { return patched[r.id] ? Object.assign({}, r, patched[r.id]) : r; });
    },

    one: function (table, id) {
      return this.all(table).filter(function (r) { return r.id === id; })[0] || null;
    },

    /** Singletons (clinic, intake_template) are objects, not arrays. */
    obj: function (key) {
      var patched = this.overlay.patched['__' + key];
      return Object.assign({}, this.base[key] || {}, patched || {});
    },

    patchObj: function (key, fields) {
      var k = '__' + key;
      this.overlay.patched[k] = Object.assign({}, this.overlay.patched[k] || {}, fields);
      writeOverlay(this.overlay); GD.bus.emit('data', { table: key });
    },

    add: function (table, row) {
      if (!row.id) row.id = table + '_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      row.clinic_id = row.clinic_id || 'clinic_thornton_co';
      row.synthetic = true;
      row.created_in_pilot = true;
      (this.overlay.added[table] = this.overlay.added[table] || []).push(row);
      writeOverlay(this.overlay); GD.bus.emit('data', { table: table, id: row.id, action: 'add' });
      return row;
    },

    patch: function (table, id, fields) {
      var t = this.overlay.patched[table] = this.overlay.patched[table] || {};
      t[id] = Object.assign({}, t[id] || {}, fields);
      writeOverlay(this.overlay); GD.bus.emit('data', { table: table, id: id, action: 'patch' });
      return this.one(table, id);
    },

    remove: function (table, id) {
      (this.overlay.removed[table] = this.overlay.removed[table] || []).push(id);
      writeOverlay(this.overlay); GD.bus.emit('data', { table: table, id: id, action: 'remove' });
    },

    /* Media (logos, headshots, progress photos) are data URLs held in the
       overlay. Browser-only by design: nothing is uploaded anywhere, which is
       what makes it safe to hand this demo to a client before Phase C.
       docs/16-media-pipeline.md. */
    putMedia: function (key, dataUrl) {
      this.overlay.media[key] = dataUrl;
      writeOverlay(this.overlay); GD.bus.emit('media', { key: key });
    },
    getMedia: function (key) { return this.overlay.media[key] || null; },
    delMedia: function (key) {
      delete this.overlay.media[key];
      writeOverlay(this.overlay); GD.bus.emit('media', { key: key });
    },
    mediaBytes: function () {
      var o = this.overlay.media, n = 0;
      Object.keys(o).forEach(function (k) { n += (o[k] || '').length; });
      return Math.round(n * 0.75);            // base64 -> bytes, roughly
    },

    pref: function (key, val) {
      if (arguments.length === 1) return this.overlay.prefs[key];
      this.overlay.prefs[key] = val;
      writeOverlay(this.overlay); GD.bus.emit('pref', { key: key, value: val });
      return val;
    },

    saveBrand: function (brand) {
      this.overlay.brand = brand; writeOverlay(this.overlay); GD.bus.emit('brand', brand);
    },
    loadBrand: function () { return this.overlay.brand; },

    /** Wipes every pilot mutation. Demo sessions need a clean restart. */
    reset: function (opts) {
      opts = opts || {};
      var keepBrand = opts.keepBrand ? this.overlay.brand : null;
      var keepMedia = opts.keepMedia ? this.overlay.media : {};
      this.overlay = blankOverlay();
      this.overlay.brand = keepBrand;
      this.overlay.media = keepMedia;
      writeOverlay(this.overlay);
      GD.bus.emit('reset');
    },

    /** Count of pilot-created records, shown in the banner. */
    pilotWrites: function () {
      var o = this.overlay, n = 0;
      Object.keys(o.added).forEach(function (t) { n += o.added[t].length; });
      Object.keys(o.patched).forEach(function (t) { n += Object.keys(o.patched[t]).length; });
      return n;
    }
  };

  /* ------------------------------------------------------------- formats -- */

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  GD.fmt = {
    money: function (cents, opts) {
      opts = opts || {};
      var n = (cents || 0) / 100;
      if (opts.compact && Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
      return '$' + n.toLocaleString('en-US', { minimumFractionDigits: opts.cents ? 2 : 0, maximumFractionDigits: opts.cents ? 2 : 0 });
    },
    date: function (iso, style) {
      if (!iso) return '—';
      var d = parse(iso.slice(0, 10));
      if (style === 'long') return DAYS[d.getUTCDay()] + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
      if (style === 'dow') return DAYS[d.getUTCDay()] + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
      if (style === 'md') return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
      return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
    },
    time: function (iso) {
      if (!iso || iso.length < 13) return '';
      var hm = iso.slice(11, 16).split(':');
      var h = parseInt(hm[0], 10), ampm = h >= 12 ? 'pm' : 'am';
      var h12 = h % 12 === 0 ? 12 : h % 12;
      return h12 + (hm[1] === '00' ? '' : ':' + hm[1]) + ampm;
    },
    /** Relative to the demo clock, never the wall clock. */
    ago: function (iso) {
      if (!iso) return '—';
      var days = Math.round((parse(store.today()) - parse(iso.slice(0, 10))) / DAY);
      if (days === 0) return 'today';
      if (days === 1) return 'yesterday';
      if (days === -1) return 'tomorrow';
      if (days < 0) return 'in ' + Math.abs(days) + ' days';
      if (days < 14) return days + ' days ago';
      if (days < 60) return Math.round(days / 7) + ' weeks ago';
      return Math.round(days / 30.4) + ' months ago';
    },
    daysBetween: function (a, b) { return Math.round((parse(b.slice(0, 10)) - parse(a.slice(0, 10))) / DAY); },
    plusDays: function (iso, n) { return ymd(new Date(parse(iso.slice(0, 10)).getTime() + n * DAY)); },
    dow: function (iso) { return DAYS[parse(iso.slice(0, 10)).getUTCDay()]; },
    num: function (n, dp) {
      if (n === null || n === undefined || isNaN(n)) return '—';
      return Number(n).toFixed(dp === undefined ? (Math.abs(n) < 10 ? 1 : 0) : dp);
    },
    signed: function (n, dp) { var s = GD.fmt.num(Math.abs(n), dp); return (n > 0 ? '+' : n < 0 ? '−' : '') + s; },
    pct: function (n, dp) { return GD.fmt.num(n, dp === undefined ? 0 : dp) + '%'; },
    initials: function (name) {
      return (name || '?').split(/[\s,]+/).filter(Boolean).slice(0, 2)
        .map(function (w) { return w[0].toUpperCase(); }).join('');
    },
    phone: function (p) {
      var d = (p || '').replace(/\D/g, '').slice(-10);
      return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : p;
    },
    title: function (s) {
      return (s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
  };

  /* ----------------------------------------------------------- selectors -- */
  /* Every derived number in the product is defined exactly once, here. */

  var q = GD.q = {

    /* -- people -------------------------------------------------------- */
    patients: function () { return store.all('patients'); },
    patient: function (id) { return store.one('patients', id); },
    name: function (p) { return p ? (p.first_name + ' ' + p.last_name) : 'Unknown'; },
    age: function (p) {
      if (!p || !p.dob) return null;
      return Math.floor((parse(store.today()) - parse(p.dob)) / (365.25 * DAY));
    },
    providers: function () { return store.all('providers'); },
    provider: function (id) { return store.one('providers', id); },
    staff: function () { return store.all('staff'); },
    services: function () { return store.all('services'); },
    service: function (id) { return store.one('services', id); },
    plans: function () { return store.all('plans'); },
    clinic: function () { return store.obj('clinic'); },
    analytes: function () { return store.all('analytes'); },
    analyte: function (key) { return store.all('analytes').filter(function (a) { return a.key === key; })[0]; },

    /* -- appointments -------------------------------------------------- */
    appointments: function () {
      return store.all('appointments').sort(function (a, b) { return a.starts_at.localeCompare(b.starts_at); });
    },
    apptsOn: function (iso) {
      return q.appointments().filter(function (a) { return a.starts_at.slice(0, 10) === iso; });
    },
    apptsToday: function () { return q.apptsOn(store.today()); },
    apptsForPatient: function (pid) {
      return q.appointments().filter(function (a) { return a.patient_id === pid; });
    },
    nextAppt: function (pid) {
      var t = store.today();
      return q.apptsForPatient(pid).filter(function (a) {
        return a.starts_at.slice(0, 10) >= t && ['booked', 'confirmed'].indexOf(a.status) > -1;
      })[0] || null;
    },
    apptLabel: function (a) {
      if (!a) return '—';
      var svc = q.service(a.service_id);
      return svc ? svc.name : GD.fmt.title(a.reason_code || 'Visit');
    },
    apptPatientName: function (a) {
      if (a.patient_id) { var p = q.patient(a.patient_id); return p ? q.name(p) : a.patient_id; }
      return a.patient_display || 'Unnamed';
    },

    /* -- labs ---------------------------------------------------------- */
    panels: function (pid) {
      return store.all('lab_panels')
        .filter(function (p) { return p.patient_id === pid; })
        .sort(function (a, b) { return a.drawn_at.localeCompare(b.drawn_at); });
    },
    resultsFor: function (panelId) {
      return store.all('lab_results').filter(function (r) { return r.panel_id === panelId; });
    },
    result: function (panelId, analyte) {
      return q.resultsFor(panelId).filter(function (r) { return r.analyte === analyte; })[0] || null;
    },
    latestPanel: function (pid) { var ps = q.panels(pid); return ps[ps.length - 1] || null; },
    baselinePanel: function (pid) { return q.panels(pid)[0] || null; },
    /** Every value of one analyte over time, for a trend line. */
    analyteSeries: function (pid, analyte) {
      return q.panels(pid).map(function (p) {
        var r = q.result(p.id, analyte);
        return r ? { date: p.drawn_at, value: r.value_numeric, flag: r.flag, unit: r.unit } : null;
      }).filter(Boolean);
    },
    /** Flag for a value against its analyte definition. Mirrors the generator
        so values typed in the pilot flag identically to seeded ones. */
    flagFor: function (analyteKey, value) {
      var a = q.analyte(analyteKey);
      if (!a || value === null || value === '' || isNaN(value)) return null;
      value = Number(value);
      if (a.ceiling && value >= a.ceiling) return 'critical';
      if (value < a.refLow) return 'below_ref';
      if (value > a.refHigh) return 'above_ref';
      if (value < a.targetLow) return 'below_target';
      if (value > a.targetHigh) return 'above_target';
      return 'in_range';
    },

    /* -- check-ins ----------------------------------------------------- */
    checkins: function (pid) {
      return store.all('checkins')
        .filter(function (c) { return c.patient_id === pid; })
        .sort(function (a, b) { return a.week_of.localeCompare(b.week_of); });
    },
    checkinDims: ['energy', 'libido', 'sleep_quality', 'mood', 'gym_performance', 'mental_clarity'],
    dimLabel: function (d) {
      return { energy: 'Energy', libido: 'Libido', sleep_quality: 'Sleep', mood: 'Mood',
        gym_performance: 'Gym', mental_clarity: 'Clarity' }[d] || GD.fmt.title(d);
    },
    lastCheckin: function (pid) { var c = q.checkins(pid); return c[c.length - 1] || null; },
    daysSinceCheckin: function (pid) {
      var last = q.lastCheckin(pid);
      return last ? GD.fmt.daysBetween(last.week_of, store.today()) : null;
    },
    /** Mean of the six dimensions — the single "how are you doing" number. */
    checkinAvg: function (c) {
      if (!c) return null;
      var vals = q.checkinDims.map(function (d) { return c[d]; }).filter(function (v) { return typeof v === 'number'; });
      return vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
    },
    /** Baseline vs now for every dimension. The contrast band. */
    thenVsNow: function (pid) {
      var cs = q.checkins(pid);
      if (cs.length < 2) return null;
      var first = cs[0], last = cs[cs.length - 1];
      return q.checkinDims.map(function (d) {
        return { dim: d, label: q.dimLabel(d), then: first[d], now: last[d], delta: last[d] - first[d] };
      });
    },
    /** Weeks since the scores last meaningfully improved.
     *
     * This is the doubter's shape and the reason the product exists: clearly
     * better than baseline, but flat for long enough that he has adapted to it
     * and concluded it stopped working.
     *
     * Raw weekly scores are too noisy to read directly — a good week inside a
     * plateau would reset the clock — so it smooths first, then looks for the
     * last point that beat the running best by more than the noise floor.
     * Measured to today, not to the last check-in, so a man who has gone quiet
     * for three weeks is counted as three weeks further into the plateau.
     */
    plateauWeeks: function (pid) {
      var cs = q.checkins(pid);
      if (cs.length < 6) return 0;
      var avgs = cs.map(q.checkinAvg);

      // 3-point moving average.
      var smooth = avgs.map(function (_, i) {
        var lo = Math.max(0, i - 1), hi = Math.min(avgs.length - 1, i + 1);
        var slice = avgs.slice(lo, hi + 1);
        return slice.reduce(function (a, b) { return a + b; }, 0) / slice.length;
      });

      var NOISE = 0.25;                  // below this, a rise is not a real gain
      var best = smooth[0], lastGainIdx = 0;
      for (var i = 1; i < smooth.length; i++) {
        if (smooth[i] > best + NOISE) lastGainIdx = i;
        if (smooth[i] > best) best = smooth[i];
      }
      var weeks = Math.round(GD.fmt.daysBetween(cs[lastGainIdx].week_of, store.today()) / 7);
      return weeks >= 4 ? weeks : 0;
    },

    /* -- protocol ------------------------------------------------------ */
    protocol: function (pid) {
      return store.all('protocols').filter(function (p) { return p.patient_id === pid; })[0] || null;
    },
    protocolItems: function (pid) {
      var pr = q.protocol(pid);
      if (!pr) return [];
      return store.all('protocol_items').filter(function (i) { return i.protocol_id === pr.id; });
    },
    protocolChanges: function (pid) {
      return store.all('protocol_changes')
        .filter(function (c) { return c.patient_id === pid; })
        .sort(function (a, b) { return a.changed_at.localeCompare(b.changed_at); });
    },
    /** Week N of the 12-week Season. Goal gradient: never show "Week 6"
        without "of 12". docs/07-design-system.md rule 2. */
    season: function (pid) {
      var p = q.patient(pid);
      if (!p || !p.therapy_start_date) return null;
      var weeks = Math.floor(GD.fmt.daysBetween(p.therapy_start_date, store.today()) / 7);
      var seasonNo = Math.floor(weeks / 12) + 1;
      return { seasonNo: seasonNo, week: (weeks % 12) + 1, of: 12, totalWeeks: weeks,
        months: +(weeks / 4.345).toFixed(1) };
    },
    /** Next dose due, from frequency. Weekly protocols only in the pilot. */
    nextDose: function (pid) {
      var p = q.patient(pid);
      if (!p || !p.therapy_start_date) return null;
      var items = q.protocolItems(pid).filter(function (i) { return i.frequency === 'weekly'; });
      if (!items.length) return null;
      var days = GD.fmt.daysBetween(p.therapy_start_date, store.today());
      var into = days % 7;
      return { inDays: into === 0 ? 0 : 7 - into, date: GD.fmt.plusDays(store.today(), into === 0 ? 0 : 7 - into), item: items[0] };
    },

    /* -- membership & money -------------------------------------------- */
    membership: function (pid) {
      return store.all('memberships').filter(function (m) { return m.patient_id === pid; })[0] || null;
    },
    payments: function (pid) {
      return store.all('payments').filter(function (p) { return p.patient_id === pid; })
        .sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });
    },
    mrr: function () {
      return store.all('memberships')
        .filter(function (m) { return m.status === 'active'; })
        .reduce(function (s, m) { return s + (m.mrr_cents || 0); }, 0);
    },
    activeMembers: function () { return store.all('memberships').filter(function (m) { return m.status === 'active'; }).length; },
    pausedMembers: function () { return store.all('memberships').filter(function (m) { return m.status === 'paused'; }).length; },
    cancelledMembers: function () { return store.all('memberships').filter(function (m) { return m.status === 'cancelled'; }); },
    /** The number that actually governs this business. */
    avgMonthsOnProtocol: function () {
      var ms = store.all('memberships').filter(function (m) { return m.status !== 'cancelled' || m.cancelled_at; });
      if (!ms.length) return 0;
      var total = ms.reduce(function (s, m) {
        var end = m.cancelled_at || store.today();
        return s + GD.fmt.daysBetween(m.started_at, end) / 30.44;
      }, 0);
      return +(total / ms.length).toFixed(1);
    },
    /** Net revenue retention, month over month, from collected payments.
     *
     * Buckets are 35 days wide rather than 30. Membership charges land on a
     * monthly cycle that drifts by a few days, and a 30-day bucket drops a
     * charge that fell on day 31 — which reads as a catastrophic revenue
     * collapse rather than a calendar artefact. Widen the bucket, not the
     * interpretation.
     */
    nrr: function () {
      var pays = store.all('payments').filter(function (p) { return p.status === 'succeeded'; });
      var today = parse(store.today());
      function windowSum(fromDaysAgo, toDaysAgo) {
        return pays.filter(function (p) {
          var d = Math.round((today - parse(p.created_at)) / DAY);
          return d >= fromDaysAgo && d < toDaysAgo;
        }).reduce(function (s, p) { return s + p.amount_cents; }, 0);
      }
      var thisMonth = windowSum(0, 35), lastMonth = windowSum(35, 70);
      if (!lastMonth) return thisMonth ? 100 : 0;
      return Math.round((thisMonth / lastMonth) * 100);
    },
    failedPayments: function () {
      return store.all('payments').filter(function (p) { return p.status === 'failed'; });
    },

    /* -- pipeline ------------------------------------------------------ */
    leads: function () { return store.all('leads'); },
    funnel: function () {
      var leads = q.leads();
      var booked = leads.filter(function (l) { return ['booked', 'converted'].indexOf(l.status) > -1; });
      var showed = q.appointments().filter(function (a) { return a.status === 'complete' && !a.filler; });
      var converted = leads.filter(function (l) { return l.status === 'converted'; });
      var active = q.activeMembers();
      var churned = q.cancelledMembers().length;
      return [
        { key: 'lead', label: 'Leads', n: leads.length },
        { key: 'booked', label: 'Booked', n: booked.length },
        { key: 'showed', label: 'Showed', n: showed.length },
        { key: 'converted', label: 'Converted', n: converted.length },
        { key: 'active', label: 'Active now', n: active },
        { key: 'churned', label: 'Churned', n: churned }
      ];
    },
    /** Speed to lead. While the corporate form is a callback queue, response
        time IS the conversion rate. docs/01-audit-findings.md. */
    speedToLead: function () {
      var ls = q.leads();
      var answered = ls.filter(function (l) { return l.first_response_at; });
      return { total: ls.length, answered: answered.length,
        unanswered: ls.length - answered.length,
        pct: ls.length ? Math.round((answered.length / ls.length) * 100) : 0 };
    },
    attribution: function () {
      var bySource = {};
      q.leads().forEach(function (l) {
        var s = bySource[l.source] = bySource[l.source] || { source: l.source, leads: 0, booked: 0, converted: 0, revenue_cents: 0 };
        s.leads++;
        if (['booked', 'converted'].indexOf(l.status) > -1) s.booked++;
        if (l.status === 'converted') {
          s.converted++;
          if (l.converted_patient_id) {
            q.payments(l.converted_patient_id).forEach(function (p) {
              if (p.status === 'succeeded') s.revenue_cents += p.amount_cents;
            });
          }
        }
      });
      return Object.keys(bySource).map(function (k) { return bySource[k]; })
        .sort(function (a, b) { return b.revenue_cents - a.revenue_cents || b.leads - a.leads; });
    },
    churnCohorts: function () {
      var byReason = {};
      q.cancelledMembers().forEach(function (m) {
        var k = m.cancel_reason_code || 'unknown';
        byReason[k] = byReason[k] || { reason: k, n: 0, months: [], notes: [] };
        byReason[k].n++;
        byReason[k].months.push(GD.fmt.daysBetween(m.started_at, m.cancelled_at) / 30.44);
        if (m.cancel_reason_text) byReason[k].notes.push(m.cancel_reason_text);
      });
      return Object.keys(byReason).map(function (k) {
        var r = byReason[k];
        r.avgMonths = +(r.months.reduce(function (a, b) { return a + b; }, 0) / r.months.length).toFixed(1);
        return r;
      }).sort(function (a, b) { return b.n - a.n; });
    },

    /* -- work queues --------------------------------------------------- */
    /** At-risk, with the reason on every row. A list without reasons gets
        looked at once and never again. */
    atRisk: function () {
      var out = [];
      q.patients().forEach(function (p) {
        var m = q.membership(p.id);
        if (!m || m.status === 'cancelled') return;
        var reasons = [];
        var since = q.daysSinceCheckin(p.id);
        if (since !== null && since >= 21) reasons.push({ code: 'no_checkin', text: 'No check-in for ' + since + ' days', tone: 'critical' });
        var plateau = q.plateauWeeks(p.id);
        if (plateau >= 5) reasons.push({ code: 'plateau', text: 'Scores flat ' + plateau + ' weeks', tone: 'warn' });
        if (q.payments(p.id).some(function (x) { return x.status === 'failed'; }))
          reasons.push({ code: 'payment_failed', text: 'Payment failed', tone: 'critical' });
        if (!q.nextAppt(p.id)) reasons.push({ code: 'no_next_appt', text: 'No future appointment', tone: 'warn' });
        var due = q.labsDue(p.id);
        if (due && due.overdueDays > 0) reasons.push({ code: 'labs_overdue', text: 'Labs overdue ' + due.overdueDays + ' days', tone: 'warn' });
        if (m.status === 'paused') reasons.push({ code: 'paused', text: 'Membership paused', tone: 'warn' });
        if (reasons.length) out.push({ patient: p, reasons: reasons,
          severity: reasons.some(function (r) { return r.tone === 'critical'; }) ? 2 : 1 });
      });
      return out.sort(function (a, b) { return b.severity - a.severity || b.reasons.length - a.reasons.length; });
    },
    /** Safety queue. Thresholds here are PROVISIONAL — get the clinic's real
        numbers before production. docs/11-discovery-questions.md §3. */
    safetyQueue: function () {
      var out = [];
      q.patients().forEach(function (p) {
        var panel = q.latestPanel(p.id);
        if (!panel) return;
        var items = [];
        var hct = q.result(panel.id, 'hematocrit');
        if (hct && hct.value_numeric >= 52) items.push({ code: 'hematocrit_ceiling', tone: 'critical',
          text: 'Hematocrit ' + hct.value_numeric + '% — at or above the 52% ceiling', analyte: 'hematocrit', value: hct.value_numeric });
        else if (hct && hct.value_numeric >= 50) items.push({ code: 'hematocrit_rising', tone: 'warn',
          text: 'Hematocrit ' + hct.value_numeric + '% — approaching ceiling', analyte: 'hematocrit', value: hct.value_numeric });

        var psaSeries = q.analyteSeries(p.id, 'psa');
        if (psaSeries.length >= 2) {
          var first = psaSeries[0], last = psaSeries[psaSeries.length - 1];
          var years = Math.max(0.25, GD.fmt.daysBetween(first.date, last.date) / 365.25);
          var velocity = (last.value - first.value) / years;
          if (last.value >= 4) items.push({ code: 'psa_absolute', tone: 'critical', text: 'PSA ' + last.value + ' ng/mL — above reference', analyte: 'psa', value: last.value });
          else if (velocity >= 0.75) items.push({ code: 'psa_velocity', tone: 'warn',
            text: 'PSA velocity ' + velocity.toFixed(2) + ' ng/mL/yr — above 0.75 threshold', analyte: 'psa', value: last.value });
        }
        var e2 = q.result(panel.id, 'estradiol_sensitive');
        if (e2 && (e2.flag === 'above_ref' || e2.flag === 'below_ref')) items.push({ code: 'estradiol', tone: 'warn',
          text: 'Estradiol ' + e2.value_numeric + ' pg/mL — outside reference', analyte: 'estradiol_sensitive', value: e2.value_numeric });

        var due = q.labsDue(p.id);
        if (due && due.overdueDays > 14) items.push({ code: 'monitoring_overdue', tone: 'warn',
          text: 'Monitoring labs overdue by ' + due.overdueDays + ' days' });

        var lastCi = q.lastCheckin(p.id);
        if (lastCi && lastCi.notes_free_text) items.push({ code: 'checkin_note', tone: 'warn',
          text: 'Check-in note needs reading', note: lastCi.notes_free_text });
        if (lastCi && lastCi.missed_doses_count > 0) items.push({ code: 'missed_doses', tone: 'warn',
          text: 'Reported ' + lastCi.missed_doses_count + ' missed dose(s)' });

        if (items.length) out.push({ patient: p, panel: panel, items: items,
          severity: items.some(function (i) { return i.tone === 'critical'; }) ? 2 : 1 });
      });
      return out.sort(function (a, b) { return b.severity - a.severity || b.items.length - a.items.length; });
    },
    /** Lab cadence: 7 weeks after start, then quarterly. PROVISIONAL. */
    labsDue: function (pid) {
      var p = q.patient(pid);
      if (!p || !p.therapy_start_date) return null;
      var last = q.latestPanel(pid);
      if (!last) return { dueOn: p.therapy_start_date, overdueDays: GD.fmt.daysBetween(p.therapy_start_date, store.today()), reason: 'Baseline not drawn' };
      var weeksOn = GD.fmt.daysBetween(p.therapy_start_date, store.today()) / 7;
      var intervalDays = weeksOn < 10 ? 49 : 91;
      var dueOn = GD.fmt.plusDays(last.drawn_at, intervalDays);
      return { dueOn: dueOn, overdueDays: GD.fmt.daysBetween(dueOn, store.today()),
        reason: weeksOn < 10 ? 'Initial recheck (7 weeks)' : 'Quarterly monitoring' };
    },
    dueForLabs: function () {
      return q.patients().map(function (p) {
        var m = q.membership(p.id);
        if (!m || m.status === 'cancelled') return null;
        var due = q.labsDue(p.id);
        if (!due || due.overdueDays < -14) return null;
        return { patient: p, due: due };
      }).filter(Boolean).sort(function (a, b) { return b.due.overdueDays - a.due.overdueDays; });
    },
    tasks: function () {
      return store.all('tasks').filter(function (t) { return !t.done; })
        .sort(function (a, b) {
          var rank = { high: 0, med: 1, low: 2 };
          return (rank[a.priority] - rank[b.priority]) || a.due.localeCompare(b.due);
        });
    },
    threads: function () {
      return store.all('message_threads').sort(function (a, b) { return b.last_at.localeCompare(a.last_at); });
    },
    messagesIn: function (threadId) {
      return store.all('messages').filter(function (m) { return m.thread_id === threadId; })
        .sort(function (a, b) { return a.sent_at.localeCompare(b.sent_at); });
    },
    threadFor: function (pid) {
      return q.threads().filter(function (t) { return t.patient_id === pid; })[0] || null;
    },
    unreadStaff: function () {
      return q.threads().reduce(function (s, t) { return s + (t.unread_staff || 0); }, 0);
    },

    /* -- photos & body comp -------------------------------------------- */
    photoSeries: function (pid) {
      return store.all('photo_series').filter(function (s) { return s.patient_id === pid; });
    },
    photos: function (seriesId, poseKey) {
      return store.all('photos')
        .filter(function (p) { return p.series_id === seriesId && (!poseKey || p.pose_key === poseKey); })
        .sort(function (a, b) { return a.captured_at.localeCompare(b.captured_at); });
    },
    bodyComp: function (pid) {
      return store.all('body_comp').filter(function (b) { return b.patient_id === pid; })
        .sort(function (a, b) { return a.measured_at.localeCompare(b.measured_at); });
    },

    /* -- inventory ----------------------------------------------------- */
    inventory: function () {
      return store.all('inventory_items').map(function (item) {
        var lots = store.all('inventory_lots').filter(function (l) { return l.item_id === item.id; });
        var onHand = lots.reduce(function (s, l) { return s + l.qty_remaining; }, 0);
        var soonest = lots.filter(function (l) { return l.qty_remaining > 0; })
          .sort(function (a, b) { return a.expiry_date.localeCompare(b.expiry_date); })[0];
        var expiryDays = soonest ? GD.fmt.daysBetween(store.today(), soonest.expiry_date) : null;
        return { item: item, lots: lots, onHand: onHand, soonest: soonest, expiryDays: expiryDays,
          low: onHand <= item.reorder_threshold, expiringSoon: expiryDays !== null && expiryDays <= 45 };
      });
    },

    /* -- automations & queues ------------------------------------------ */
    automationRuns: function () {
      return store.all('automation_runs').sort(function (a, b) { return b.triggered_at.localeCompare(a.triggered_at); });
    },
    missedCalls: function () { return store.all('missed_calls'); },
    waitlist: function () { return store.all('waitlist').filter(function (w) { return w.status === 'waiting'; }); },

    /** Does a patient-facing notification leak clinical content? P35.
     *
     * Matches on word boundaries, not substrings. A naive `indexOf` check for
     * "ED" fires on "scheduled", "needs" and "linked", which makes the whole
     * check useless — it flags everything, so everyone stops reading it.
     */
    previewSafe: function (text) {
      var banned = store.base.banned_preview_terms || [];
      var body = ' ' + (text || '') + ' ';
      var hit = banned.filter(function (term) {
        var escaped = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp('(^|[^a-z0-9])' + escaped + '([^a-z0-9]|$)', 'i').test(body);
      });
      return { safe: hit.length === 0, offending: hit };
    },

    /* -- open availability, computed from clinic hours ------------------ */
    slotsFor: function (iso, serviceId) {
      var clinic = q.clinic();
      var dow = GD.fmt.dow(iso);
      var hours = (clinic.hours || []).filter(function (h) { return h.day === dow; })[0];
      if (!hours || !hours.open) return [];
      var svc = q.service(serviceId);
      var step = svc && svc.duration_min > 30 ? 30 : 15;
      var taken = q.apptsOn(iso).map(function (a) { return a.starts_at.slice(11, 16); });
      var out = [];
      var start = parseInt(hours.open.slice(0, 2), 10) * 60 + parseInt(hours.open.slice(3), 10);
      var end = parseInt(hours.close.slice(0, 2), 10) * 60 + parseInt(hours.close.slice(3), 10);
      for (var m = start; m + (svc ? svc.duration_min : 30) <= end; m += step) {
        if (m >= 12 * 60 && m < 13 * 60) continue;                 // lunch
        var hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(m % 60).padStart(2, '0');
        var t = hh + ':' + mm;
        if (taken.indexOf(t) > -1) continue;
        out.push(t);
      }
      return out;
    },

    /** Plain-language read of one lab value. Deliberately calm, specific, and
        never alarming about a value the provider is happy with. */
    interpret: function (analyteKey, value, prev) {
      var a = q.analyte(analyteKey);
      if (!a || value === null || value === undefined) return '';
      var flag = q.flagFor(analyteKey, value);
      var dir = prev === null || prev === undefined ? null : value > prev ? 'up' : value < prev ? 'down' : 'flat';
      var moved = dir && dir !== 'flat' ? ' It has moved ' + dir + ' since your last draw.' : '';
      var band = 'Your clinic aims for ' + a.targetLow + '–' + a.targetHigh + ' ' + a.unit + '.';
      switch (flag) {
        case 'critical':
          return 'This is above the level your provider watches for and is being reviewed. ' + band +
            ' This is exactly the kind of thing monitoring exists to catch early.';
        case 'above_ref':
          return 'This sits above the lab’s reference range. ' + band + moved;
        case 'below_ref':
          return 'This sits below the lab’s reference range. ' + band + moved;
        case 'above_target':
          return 'Within the lab’s normal range but above where your clinic aims. ' + band + moved;
        case 'below_target':
          return 'Within the lab’s normal range but below where your clinic aims. ' + band + moved;
        default:
          return 'In range and where your clinic wants it.' + moved;
      }
    }
  };

  /* --------------------------------------------------------- roster tags -- */
  /* The fixture keys encode what each patient is for. Surfaced in the demo so
     whoever is driving knows which patient shows which behaviour. */
  GD.rosterNote = {
    p_01_new: 'Booked, intake incomplete, visit tomorrow',
    p_02_firstvisit: 'Baseline labs drawn, protocol just published',
    p_03_enthusiast: 'Month 2, scores climbing — the happy path',
    p_04_doubter: 'Month 4, plateaued, silent 3 weeks — the demo patient',
    p_05_safety: 'Hematocrit at the ceiling — safety queue',
    p_06_psa: 'PSA velocity flag — escalation path',
    p_07_churned: 'Cancelled month 6, no perceived benefit',
    p_08_paused: 'Paused month 3, cost concern',
    p_09_noshow: 'No-showed, recovered by SMS, now active',
    p_10_weightloss: 'GLP-1 + body comp, no TRT',
    p_11_hairloss: 'Finasteride + PRP, 6-month photo series',
    p_12_failedpay: 'Active but card declined twice'
  };

  store.init();
})();
