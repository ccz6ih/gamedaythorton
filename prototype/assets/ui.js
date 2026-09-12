/* ==========================================================================
   ui.js — shell, router, and interaction plumbing
   --------------------------------------------------------------------------
   Screens are pure functions that return an HTML string and declare their
   behaviour with data-act attributes. One delegated listener dispatches those
   to registered actions. That keeps every screen file readable top to bottom
   with no listener bookkeeping, and it is why a screen can be rewritten
   without touching anything else.

   Three usability decisions are enforced here rather than left to each screen,
   because they are the whole "easier to use" claim (docs/12-glossgenius-
   parity.md):

     1. NAVIGATION IS ONE LEVEL DEEP. A flat rail with counts. No nested menus,
        no settings buried three taps down.
     2. Ctrl/Cmd+K GOES ANYWHERE. Type a patient's name or a screen name and
        press Enter. This is the single biggest speed win for a front desk on
        the phone with a patient waiting.
     3. EVERY SCREEN NAMES ITS NEXT ACTION. Screens supply `primary`, which
        renders as one obvious button in the top bar. If a screen cannot name
        its next action it is usually the wrong screen.
   ========================================================================== */

(function () {
  'use strict';
  var GD = window.GD = window.GD || {};
  var esc = GD.esc;

  var routes = {};
  var actions = {};

  var ui = GD.ui = {

    /* --------------------------------------------------------- registration -- */

    /**
     * route: 'staff/scoreboard' | 'patient/home' | 'staff/patient/:id'
     * spec:  { app, title, crumb, nav, render(ctx), primary(ctx), after(ctx) }
     */
    register: function (route, spec) { routes[route] = spec; },
    act: function (name, fn) { actions[name] = fn; },

    /* ------------------------------------------------------------- demo state -- */

    /** Which patient the patient app and the staff detail screens default to.
        The month-4 doubter, because that is the patient the product exists for.
        `silent` skips the re-render: a screen that syncs this from its own route
        params must not trigger a render from inside a render. */
    patientId: function (id, silent) {
      if (id) {
        var changed = GD.store.pref('demoPatient') !== id;
        GD.store.pref('demoPatient', id);
        if (changed && !silent) ui.render();
        return id;
      }
      return GD.store.pref('demoPatient') || 'p_04_doubter';
    },
    patient: function () { return GD.q.patient(ui.patientId()) || GD.q.patients()[0]; },

    /** owner | provider | front_desk. Interviewed separately in the demo, so
        the console can be seen the way each of them would see it. */
    role: function (r) {
      if (r) { GD.store.pref('demoRole', r); ui.render(); return r; }
      return GD.store.pref('demoRole') || 'owner';
    },
    roleLabel: function () {
      return { owner: 'Owner', provider: 'Provider', front_desk: 'Front desk' }[ui.role()];
    },

    hideSensitive: function (on) {
      if (arguments.length) { GD.store.pref('hideSensitive', !!on); ui.render(); }
      return !!GD.store.pref('hideSensitive');
    },

    /* ------------------------------------------------------------------ router -- */

    parse: function () {
      var hash = (location.hash || '#/staff/scoreboard').replace(/^#\/?/, '');
      var parts = hash.split('/').filter(Boolean);
      var app = parts[0] === 'patient' ? 'patient' : 'staff';
      var rest = parts.slice(1);
      // Longest match first so 'staff/patient/:id' beats 'staff/patient'.
      for (var i = rest.length; i > 0; i--) {
        var candidate = app + '/' + rest.slice(0, i).join('/');
        if (routes[candidate]) return { app: app, route: candidate, params: rest.slice(i), spec: routes[candidate] };
        var wild = app + '/' + rest.slice(0, i - 1).concat(':id').join('/');
        if (i > 1 && routes[wild]) return { app: app, route: wild, params: rest.slice(i - 1), spec: routes[wild] };
      }
      var fallback = app === 'patient' ? 'patient/home' : 'staff/scoreboard';
      return { app: app, route: fallback, params: [], spec: routes[fallback] };
    },

    go: function (hash) {
      if (hash.charAt(0) !== '#') hash = '#/' + hash.replace(/^\/?/, '');
      if (location.hash === hash) ui.render(); else location.hash = hash;
    },

    /* -------------------------------------------------------------------- nav -- */

    staffNav: function () {
      var q = GD.q;
      var safety = q.safetyQueue().length;
      var due = q.dueForLabs().filter(function (d) { return d.due.overdueDays > 0; }).length;
      var risk = q.atRisk().length;
      var intake = q.apptsToday().filter(function (a) { return !a.intake_complete; }).length;
      return [
        { group: 'Run the day' },
        { to: 'staff/scoreboard', label: GD.brand.word('scoreboard'), ico: '◯', roles: ['owner', 'provider', 'front_desk'] },
        { to: 'staff/today', label: 'Today', ico: '▦', count: q.apptsToday().length, tone: 'quiet' },
        { to: 'staff/calendar', label: 'Calendar', ico: '▤' },
        { to: 'staff/checkout', label: 'Checkout', ico: '⌘' },
        { to: 'staff/messages', label: 'Messages', ico: '✉', count: q.unreadStaff() },
        { group: 'Clinical' },
        { to: 'staff/patients', label: 'Patients', ico: '⚇' },
        { to: 'staff/labs', label: 'Lab entry', ico: '⚗' },
        { to: 'staff/safety', label: 'Safety queue', ico: '⚠', count: safety },
        { to: 'staff/due', label: 'Due for labs', ico: '⏱', count: due },
        { group: 'Grow it' },
        { to: 'staff/pipeline', label: 'Pipeline', ico: '◧' },
        { to: 'staff/retention', label: 'Retention', ico: '♡', count: risk },
        { to: 'staff/automations', label: 'Automations', ico: '⚡' },
        { group: 'Back office' },
        { to: 'staff/inventory', label: 'Inventory', ico: '☷' },
        { to: 'staff/settings', label: 'Settings', ico: '⚙' },
        { to: 'staff/intake-chase', label: 'Intake chase', ico: '✎', count: intake, hidden: true }
      ];
    },

    patientNav: function () {
      return [
        { to: 'patient/home', label: 'Home', ico: '⌂' },
        { to: 'patient/checkin', label: GD.brand.word('checkIn'), ico: '✓' },
        { to: 'patient/stats', label: GD.brand.word('statSheet'), ico: '↗' },
        { to: 'patient/plan', label: GD.brand.word('gamePlan'), ico: '◈' },
        { to: 'patient/film', label: GD.brand.word('gameFilm'), ico: '◰' },
        { to: 'patient/more', label: 'More', ico: '⋯' }
      ];
    },

    /* ----------------------------------------------------------------- render -- */

    render: function () {
      var ctx = ui.parse();
      var b = GD.brand.current();
      var app = document.getElementById('app');
      if (!app) return;

      var body = '';
      try {
        body = ctx.spec && ctx.spec.render ? ctx.spec.render(ctx) : '<div class="empty"><h3>Screen not built yet</h3></div>';
      } catch (err) {
        console.error('[render]', ctx.route, err);
        body = '<div class="card critical"><div class="eyebrow">Render error</div>' +
          '<p class="muted">' + esc(ctx.route) + ' threw: ' + esc(err.message) + '</p>' +
          '<pre class="note-band" style="white-space:pre-wrap;margin-top:1rem">' + esc(err.stack || '') + '</pre></div>';
      }

      document.documentElement.setAttribute('data-hide-sensitive', ui.hideSensitive() ? '1' : '0');

      if (ctx.app === 'patient') {
        app.innerHTML =
          ui.bannerHtml() +
          '<div class="shell" data-app="patient"><div class="main"><div class="p-shell">' +
          ui.patientTopHtml(ctx) + body + '</div></div></div>' +
          ui.tabbarHtml(ctx);
      } else {
        app.innerHTML =
          ui.bannerHtml() +
          '<div class="shell" data-app="staff">' +
          '<nav class="rail" id="rail" aria-label="Console navigation">' + ui.railHtml(ctx) + '</nav>' +
          '<div class="main">' + ui.topbarHtml(ctx) +
          '<div class="view' + (ctx.spec && ctx.spec.width ? ' ' + ctx.spec.width : '') + '">' + body + '</div>' +
          '</div></div>';
      }

      if (ctx.spec && ctx.spec.after) {
        try { ctx.spec.after(ctx); } catch (e) { console.error('[after]', ctx.route, e); }
      }
      window.scrollTo(0, ui._scroll || 0);
      ui._scroll = 0;
    },

    /** Re-render without losing the reading position. Used after a mutation. */
    refresh: function () { ui._scroll = window.scrollY; ui.render(); },

    /* ------------------------------------------------------------------ chrome -- */

    bannerHtml: function () {
      var c = GD.store.clock;
      var writes = GD.store.pilotWrites();
      return '<div class="pilot-banner" role="status">' +
        '<span>Pilot — synthetic data only</span>' +
        '<span style="opacity:.72;font-weight:600;text-transform:none;letter-spacing:0">' +
          'demo date ' + esc(GD.fmt.date(GD.store.today(), 'dow')) +
          (writes ? ' · ' + writes + ' pilot edit' + (writes === 1 ? '' : 's') : '') +
        '</span>' +
        '<button data-act="about-pilot">Why?</button>' +
        '</div>';
    },

    railHtml: function (ctx) {
      var role = ui.role();
      var items = ui.staffNav().filter(function (i) {
        if (i.hidden) return false;
        if (i.roles && i.roles.indexOf(role) === -1) return false;
        return true;
      });
      var html = GD.brand.logoHtml({ sub: GD.brand.staffAppName() });
      html += '<button class="navlink" data-act="palette" style="margin-bottom:.4rem">' +
        '<span class="ico">⌕</span><span>Search</span>' +
        '<span class="count" data-tone="quiet">⌘K</span></button>';
      items.forEach(function (i) {
        if (i.group) { html += '<div class="rail-group">' + esc(i.group) + '</div>'; return; }
        var current = ctx.route.indexOf(i.to) === 0;
        html += '<a class="navlink" href="#/' + i.to + '"' + (current ? ' aria-current="page"' : '') + '>' +
          '<span class="ico" aria-hidden="true">' + i.ico + '</span><span>' + esc(i.label) + '</span>' +
          (i.count ? '<span class="count"' + (i.tone ? ' data-tone="' + i.tone + '"' : '') + '>' + i.count + '</span>' : '') +
          '</a>';
      });
      html += '<div class="rail-foot">' +
        '<div class="rail-group" style="padding-top:0">Viewing as</div>' +
        '<select data-act="set-role" aria-label="Role">' +
        ['owner', 'provider', 'front_desk'].map(function (r) {
          return '<option value="' + r + '"' + (r === role ? ' selected' : '') + '>' +
            esc({ owner: 'Owner', provider: 'Provider', front_desk: 'Front desk' }[r]) + '</option>';
        }).join('') + '</select>' +
        '<a class="navlink" href="#/patient/home" style="margin-top:.5rem">' +
          '<span class="ico">◳</span><span>Open ' + esc(GD.brand.patientAppName()) + '</span></a>' +
        '</div>';
      return html;
    },

    topbarHtml: function (ctx) {
      var spec = ctx.spec || {};
      var title = typeof spec.title === 'function' ? spec.title(ctx) : (spec.title || '');
      var crumb = typeof spec.crumb === 'function' ? spec.crumb(ctx) : spec.crumb;
      var primary = spec.primary ? spec.primary(ctx) : '';
      return '<header class="topbar">' +
        '<button class="btn ghost sm rail-toggle" data-act="toggle-rail" aria-label="Menu">≡</button>' +
        '<div><div class="crumb">' + esc(crumb || GD.brand.staffAppName()) + '</div>' +
        '<h1>' + esc(title) + '</h1></div>' +
        '<div class="spacer"></div>' + (primary || '') +
        '</header>';
    },

    patientTopHtml: function (ctx) {
      var p = ui.patient();
      var season = GD.q.season(p.id);
      return '<div class="p-top">' +
        GD.media.avatarHtml('patient:' + p.id + ':avatar', GD.q.name(p)) +
        '<div class="who">' + esc(GD.brand.patientAppName()) +
          '<b>' + esc(p.first_name) + '</b>' +
          (season ? '<span class="dim" style="font-size:.72rem">' + esc(GD.brand.seasonLabel(season)) + '</span>' : '') +
        '</div>' +
        '<div class="spacer" style="flex:1"></div>' +
        '<button class="btn ghost sm" data-act="toggle-sensitive" aria-pressed="' + (ui.hideSensitive() ? 'true' : 'false') +
          '" title="Blur values on screen">' + (ui.hideSensitive() ? '● Hidden' : '○ Hide') + '</button>' +
        '<button class="btn ghost sm" data-act="switch-patient" title="Demo control: change patient">⇄</button>' +
        '</div>';
    },

    tabbarHtml: function (ctx) {
      return '<nav class="tabbar" aria-label="Main">' + ui.patientNav().map(function (i) {
        var current = ctx.route === i.to;
        return '<button data-act="go" data-to="' + i.to + '"' + (current ? ' aria-current="page"' : '') + '>' +
          '<span class="ico" aria-hidden="true">' + i.ico + '</span>' + esc(i.label) + '</button>';
      }).join('') + '</nav>';
    },

    /* ------------------------------------------------------------------ pieces -- */

    stat: function (o) {
      var deltaHtml = '';
      if (o.delta !== undefined && o.delta !== null) {
        var cls = o.deltaTone || (o.delta > 0 ? 'up' : o.delta < 0 ? 'down' : 'flat');
        var arrow = o.delta > 0 ? '↑' : o.delta < 0 ? '↓' : '→';
        deltaHtml = '<div class="delta ' + cls + '">' + arrow + ' ' + esc(o.deltaText || GD.fmt.signed(o.delta)) + '</div>';
      }
      return '<div class="stat' + (o.hero ? ' hero' : '') + '"' + (o.act ? ' data-act="' + o.act + '" role="button" tabindex="0" style="cursor:pointer"' : '') + '>' +
        '<div class="lab">' + esc(o.label) + (o.provisional ? '<span class="pill" data-tone="warn" style="font-size:.58rem">est</span>' : '') + '</div>' +
        '<div class="stat-val">' + o.value + (o.unit ? '<small> ' + esc(o.unit) + '</small>' : '') + '</div>' +
        deltaHtml + (o.note ? '<div class="note">' + esc(o.note) + '</div>' : '') +
        '</div>';
    },

    pill: function (text, tone) {
      return '<span class="pill"' + (tone ? ' data-tone="' + tone + '"' : '') + '>' +
        (tone ? '<i class="dot"></i>' : '') + esc(text) + '</span>';
    },

    empty: function (o) {
      return '<div class="empty"><div class="big" aria-hidden="true">' + (o.icon || '○') + '</div>' +
        '<h3>' + esc(o.title) + '</h3><p>' + esc(o.body) + '</p>' +
        (o.actLabel ? '<button class="btn primary" data-act="' + o.act + '"' +
          (o.actData || '') + '>' + esc(o.actLabel) + '</button>' : '') + '</div>';
    },

    /** `flush` removes the body padding so a list can run edge to edge. The
        header keeps its own padding — see .card.flush > .card-head. */
    card: function (o) {
      return '<section class="card' + (o.tone ? ' ' + o.tone : '') + (o.flush ? ' flush' : '') + '"' +
        (o.id ? ' id="' + o.id + '"' : '') + '>' +
        (o.title || o.aside ? '<div class="card-head"><div>' +
          (o.eyebrow ? '<div class="eyebrow' + (o.eyebrowQuiet ? ' quiet' : '') + '">' + esc(o.eyebrow) + '</div>' : '') +
          (o.title ? '<h2>' + esc(o.title) + '</h2>' : '') +
          (o.sub ? '<p>' + esc(o.sub) + '</p>' : '') +
          '</div>' + (o.aside || '') + '</div>' : '') +
        o.body + '</section>';
    },

    /** Reference/target range bar with the patient's marker on it. */
    rangeBar: function (r) {
      var lo = r.ref_low, hi = r.ref_high, v = r.value_numeric;
      var span = (hi - lo) || 1;
      var pad = span * 0.15;
      var min = lo - pad, max = hi + pad;
      function pos(x) { return Math.max(0, Math.min(100, ((x - min) / (max - min)) * 100)); }
      var cls = r.flag === 'critical' ? 'crit' : (r.flag === 'above_ref' || r.flag === 'below_ref') ? 'out' : '';
      return '<div class="rangebar"><div class="track">' +
        '<div class="target" style="left:' + pos(r.target_low).toFixed(1) + '%;width:' +
          (pos(r.target_high) - pos(r.target_low)).toFixed(1) + '%"></div>' +
        '<div class="marker ' + cls + '" style="left:' + pos(v).toFixed(1) + '%" title="' + esc(v) + '"></div>' +
        '</div><div class="ends"><span>' + GD.fmt.num(lo) + '</span>' +
        '<span class="dim">target ' + GD.fmt.num(r.target_low) + '–' + GD.fmt.num(r.target_high) + '</span>' +
        '<span>' + GD.fmt.num(hi) + '</span></div></div>';
    },

    /* --------------------------------------------------------------- overlays -- */

    modal: function (o) {
      ui.closeModal();
      var wrap = document.createElement('div');
      wrap.className = 'scrim';
      wrap.id = 'modal-scrim';
      wrap.innerHTML = '<div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' +
        esc(o.title || 'Dialog') + '">' +
        (o.title ? '<h2>' + esc(o.title) + '</h2>' : '') +
        (o.sub ? '<div class="modal-sub">' + esc(o.sub) + '</div>' : '') +
        o.body +
        (o.actions ? '<div class="modal-actions">' + o.actions + '</div>' : '') +
        '</div>';
      wrap.addEventListener('click', function (e) { if (e.target === wrap) ui.closeModal(); });
      document.body.appendChild(wrap);
      var focusable = wrap.querySelector('input,select,textarea,button');
      if (focusable) focusable.focus();
      if (o.after) o.after(wrap);
      return wrap;
    },

    closeModal: function () {
      var m = document.getElementById('modal-scrim');
      if (m) m.remove();
    },

    confirm: function (o) {
      return new Promise(function (resolve) {
        var wrap = ui.modal({
          title: o.title,
          sub: o.sub,
          body: o.body || '',
          actions: '<button class="btn ghost" data-role="no">' + esc(o.cancelLabel || 'Cancel') + '</button>' +
            '<button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-role="yes">' +
            esc(o.okLabel || 'Confirm') + '</button>'
        });
        wrap.querySelector('[data-role="no"]').addEventListener('click', function () { ui.closeModal(); resolve(false); });
        wrap.querySelector('[data-role="yes"]').addEventListener('click', function () { ui.closeModal(); resolve(true); });
      });
    },

    toast: function (msg, tone) {
      var wrap = document.getElementById('toasts');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'toasts'; wrap.className = 'toast-wrap';
        document.body.appendChild(wrap);
      }
      var t = document.createElement('div');
      t.className = 'toast';
      if (tone) t.dataset.tone = tone;
      t.innerHTML = '<span>' + (tone === 'ok' ? '✓' : tone === 'warn' ? '⚠' : 'ℹ') + '</span><span>' + esc(msg) + '</span>';
      wrap.appendChild(t);
      setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 240); }, 3600);
    },

    /* --------------------------------------------------------------- palette -- */

    paletteItems: function () {
      var items = [];
      ui.staffNav().forEach(function (i) {
        if (i.group) return;
        items.push({ label: i.label, hint: 'Console', to: 'staff/' + i.to.split('/').slice(1).join('/') });
      });
      ui.patientNav().forEach(function (i) {
        items.push({ label: i.label, hint: GD.brand.patientAppName(), to: i.to });
      });
      GD.q.patients().forEach(function (p) {
        items.push({ label: GD.q.name(p), hint: GD.rosterNote[p.id] || GD.fmt.title(p.status), to: 'staff/patient/' + p.id });
      });
      items.push({ label: 'Reset the demo data', hint: 'Command', cmd: 'reset-demo' });
      items.push({ label: 'Brand Kit', hint: 'Command', to: 'staff/settings' });
      items.push({ label: 'Toggle light / dark console', hint: 'Command', cmd: 'toggle-surface' });
      items.push({ label: 'Toggle sports vocabulary', hint: 'Command', cmd: 'toggle-vocab' });
      return items;
    },

    openPalette: function () {
      var all = ui.paletteItems();
      var sel = 0, filtered = all.slice(0, 12);

      var wrap = document.createElement('div');
      wrap.className = 'palette';
      wrap.id = 'palette';
      wrap.innerHTML = '<div class="box"><input type="search" placeholder="Search patients, screens, commands…" ' +
        'aria-label="Search" autocomplete="off"><div class="results"></div></div>';
      document.body.appendChild(wrap);

      var input = wrap.querySelector('input');
      var results = wrap.querySelector('.results');

      function paint() {
        results.innerHTML = filtered.length
          ? filtered.map(function (i, idx) {
              return '<button class="res" aria-selected="' + (idx === sel) + '" data-idx="' + idx + '">' +
                '<span>' + esc(i.label) + '</span>' +
                '<span class="dim" style="font-size:.76rem">' + esc(i.hint || '') + '</span>' +
                '<span class="k">' + (i.cmd ? 'run' : 'go') + '</span></button>';
            }).join('')
          : '<div style="padding:1rem;color:var(--gd-text-dim);font-size:.86rem">Nothing matches that.</div>';
      }

      function filterNow() {
        var term = input.value.trim().toLowerCase();
        filtered = (term
          ? all.filter(function (i) { return (i.label + ' ' + (i.hint || '')).toLowerCase().indexOf(term) > -1; })
          : all).slice(0, 12);
        sel = 0; paint();
      }

      function choose(i) {
        var item = filtered[i];
        if (!item) return;
        close();
        if (item.cmd) { (actions[item.cmd] || function () {})({}); return; }
        if (item.to && item.to.indexOf('staff/patient/') === 0) ui.patientId(item.to.split('/')[2]);
        ui.go(item.to);
      }

      function close() { wrap.remove(); }

      input.addEventListener('input', filterNow);
      wrap.addEventListener('click', function (e) {
        if (e.target === wrap) return close();
        var btn = e.target.closest('.res');
        if (btn) choose(Number(btn.dataset.idx));
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(filtered.length - 1, sel + 1); paint(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
        else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
        else if (e.key === 'Escape') { close(); }
      });
      paint();
      input.focus();
    }
  };

  /* ------------------------------------------------------- global actions -- */

  ui.act('go', function (data) {
    if (data.patient) ui.patientId(data.patient);
    ui.go(data.to);
  });

  ui.act('palette', function () { ui.openPalette(); });

  ui.act('toggle-rail', function () {
    var r = document.getElementById('rail');
    if (r) r.dataset.open = r.dataset.open === '1' ? '0' : '1';
  });

  ui.act('toggle-sensitive', function () { ui.hideSensitive(!ui.hideSensitive()); });

  ui.act('set-role', function (data, el) { ui.role(el.value); });

  ui.act('toggle-surface', function () {
    var order = ['dark', 'light', 'auto'];
    var next = order[(order.indexOf(GD.brand.current().surface) + 1) % order.length];
    GD.brand.save({ surface: next });
    ui.toast('Console surface: ' + next, 'ok');
    ui.refresh();
  });

  ui.act('toggle-vocab', function () {
    var on = !GD.brand.current().sportsVocabulary;
    GD.brand.save({ sportsVocabulary: on });
    ui.toast(on ? 'Sports vocabulary on' : 'Plain clinical vocabulary on', 'ok');
    ui.refresh();
  });

  ui.act('switch-patient', function () {
    var rows = GD.q.patients().map(function (p) {
      var season = GD.q.season(p.id);
      return '<button class="item" data-act="pick-patient" data-id="' + p.id + '">' +
        GD.media.avatarHtml('patient:' + p.id + ':avatar', GD.q.name(p)) +
        '<span class="body"><span class="ttl">' + esc(GD.q.name(p)) +
        (p.id === ui.patientId() ? ' ' + ui.pill('current', 'accent') : '') + '</span>' +
        '<span class="sub">' + esc(GD.rosterNote[p.id] || '') + '</span></span>' +
        '<span class="side">' + (season ? 'wk ' + season.totalWeeks : GD.fmt.title(p.status)) + '</span>' +
        '</button>';
    }).join('');
    ui.modal({
      title: 'Switch patient',
      sub: 'Demo control. Each patient in the roster demonstrates a different situation — the notes say which.',
      body: '<div class="list">' + rows + '</div>',
      actions: '<button class="btn ghost" data-act="close-modal">Close</button>'
    });
  });

  ui.act('pick-patient', function (data) {
    ui.closeModal();
    ui.patientId(data.id);
    ui.toast('Now viewing ' + GD.q.name(GD.q.patient(data.id)), 'ok');
  });

  ui.act('close-modal', function () { ui.closeModal(); });

  ui.act('reset-demo', function () {
    ui.confirm({
      title: 'Reset the demo?',
      sub: 'Clears every check-in, lab panel, booking, and note added during this session. Your Brand Kit and uploaded images are kept.',
      okLabel: 'Reset data',
      danger: true
    }).then(function (yes) {
      if (!yes) return;
      GD.store.reset({ keepBrand: true, keepMedia: true });
      ui.toast('Demo data reset to the seeded roster', 'ok');
      ui.render();
    });
  });

  ui.act('about-pilot', function () {
    ui.modal({
      title: 'Why this banner never goes away',
      body: '<div class="stack">' +
        '<p class="muted">This build has no HIPAA controls yet. No BAAs, no audit logging, no encryption guarantees, ' +
        'no access controls. That is a deliberate decision so the clinic can see and react to the product before ' +
        'paying for compliance infrastructure.</p>' +
        '<div class="note-band critical"><b>Therefore no real patient data goes in here. Not one name.</b> ' +
        'Every patient, lab value, and photo in this demo is fabricated. The banner stays until Phase C is signed off.</div>' +
        '<p class="muted">The full list of what is deferred, and what triggers each item, is in ' +
        '<code>docs/09-compliance-register.md</code>.</p>' +
        '<dl class="kv"><dt>Demo date</dt><dd>' + esc(GD.fmt.date(GD.store.today(), 'long')) + '</dd>' +
        '<dt>Dataset anchor</dt><dd>' + esc(GD.store.raw.anchor_today) + '</dd>' +
        '<dt>Date shift applied</dt><dd>' + GD.store.clock.shiftDays + ' days</dd>' +
        '<dt>Pilot edits</dt><dd>' + GD.store.pilotWrites() + '</dd>' +
        '<dt>Images stored locally</dt><dd>' + GD.media.usage().mb + ' MB</dd></dl>' +
        '</div>',
      actions: '<button class="btn ghost" data-act="reset-demo">Reset demo data</button>' +
        '<button class="btn primary" data-act="close-modal">Got it</button>'
    });
  });

  /* ------------------------------------------------------------ delegation -- */

  function dispatch(e, type) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var name = el.dataset.act;
    var fn = actions[name];
    if (!fn) return;
    // Change-driven controls (select, range, checkbox) fire on change, not click.
    var isInput = /^(SELECT|INPUT|TEXTAREA)$/.test(el.tagName);
    if (type === 'click' && isInput && el.type !== 'button' && el.type !== 'submit') return;
    if (type === 'change' && !isInput) return;
    if (el.tagName === 'A' && !el.dataset.allowDefault) e.preventDefault();
    if (el.tagName === 'BUTTON') e.preventDefault();
    fn(Object.assign({}, el.dataset), el, e);
  }

  document.addEventListener('click', function (e) { dispatch(e, 'click'); });
  document.addEventListener('change', function (e) { dispatch(e, 'change'); });
  document.addEventListener('input', function (e) {
    var el = e.target.closest('[data-act-input]');
    if (!el) return;
    var fn = actions[el.dataset.actInput];
    if (fn) fn(Object.assign({}, el.dataset), el, e);
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (document.getElementById('palette')) document.getElementById('palette').remove();
      else ui.openPalette();
      return;
    }
    if (e.key === 'Escape') {
      var p = document.getElementById('palette');
      if (p) return p.remove();
      ui.closeModal();
    }
  });

  window.addEventListener('hashchange', function () { ui.render(); });

  GD.bus.on('storage-full', function () {
    ui.toast('Browser storage is full — remove an uploaded image before adding another.', 'warn');
  });
})();
