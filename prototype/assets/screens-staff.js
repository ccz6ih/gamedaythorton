/* ==========================================================================
   screens-staff.js — PRESS BOX
   --------------------------------------------------------------------------
   Three users with different jobs (docs/03-owner-journey.md). Designing one
   screen for all three is how clinic software gets hated, so the rail is
   grouped by job and the role switcher changes what leads.

   Every work queue in here carries the REASON on each row. A list of names
   with no reason gets opened once and never again, which is how most "at risk"
   dashboards die.
   ========================================================================== */

(function () {
  'use strict';
  var GD = window.GD, ui = GD.ui, q = GD.q, fmt = GD.fmt, esc = GD.esc;
  function W(k) { return GD.brand.word(k); }

  function patientLink(p, extra) {
    return '<button class="item" data-act="open-patient" data-id="' + p.id + '">' +
      GD.media.avatarHtml('patient:' + p.id + ':avatar', q.name(p)) +
      '<span class="body"><span class="ttl">' + esc(q.name(p)) + '</span>' +
      '<span class="sub">' + (extra || '') + '</span></span><span class="side">›</span></button>';
  }

  ui.act('open-patient', function (data) {
    ui.patientId(data.id);
    ui.go('staff/patient/' + data.id);
  });

  /* ============================================================== scoreboard */

  ui.register('staff/scoreboard', {
    title: function () { return W('scoreboard'); },
    crumb: 'Owner',
    primary: function () {
      return '<button class="btn" data-act="go" data-to="staff/pipeline">Weekly review</button>';
    },
    render: function () {
      var mrr = q.mrr(), nrr = q.nrr(), months = q.avgMonthsOnProtocol();
      var active = q.activeMembers(), paused = q.pausedMembers(), churned = q.cancelledMembers().length;
      var stl = q.speedToLead();
      var todayAppts = q.apptsToday();
      var safety = q.safetyQueue();
      var risk = q.atRisk();
      var due = q.dueForLabs().filter(function (d) { return d.due.overdueDays > 0; });
      var noIntake = todayAppts.filter(function (a) { return !a.intake_complete; });

      /* Top 3 things needing attention, ranked by consequence. If the owner has
         to navigate to find out whether the business is up or down, this screen
         has failed — so the attention list is above the fold, not below it. */
      var attention = [];
      safety.filter(function (s) { return s.severity === 2; }).forEach(function (s) {
        attention.push({ tone: 'critical', text: s.items[0].text, who: q.name(s.patient),
          to: 'staff/patient/' + s.patient.id, act: 'Review' });
      });
      risk.filter(function (r) { return r.severity === 2; }).forEach(function (r) {
        attention.push({ tone: 'critical', text: r.reasons[0].text, who: q.name(r.patient),
          to: 'staff/patient/' + r.patient.id, act: 'Open' });
      });
      if (noIntake.length) attention.push({ tone: 'warn',
        text: noIntake.length + ' patient' + (noIntake.length === 1 ? '' : 's') + ' arriving today without intake done',
        who: 'Front desk', to: 'staff/today', act: 'Chase' });
      if (stl.unanswered) attention.push({ tone: 'warn',
        text: stl.unanswered + ' lead' + (stl.unanswered === 1 ? '' : 's') + ' never got a first response',
        who: 'Pipeline', to: 'staff/pipeline', act: 'See' });
      if (due.length) attention.push({ tone: 'warn', text: due.length + ' members overdue for monitoring labs',
        who: 'Clinical', to: 'staff/due', act: 'Book' });

      return '<div class="grid g4">' +
        ui.stat({ label: 'MRR', value: fmt.money(mrr, { compact: true }), hero: true,
          delta: nrr - 100, deltaText: nrr + '% net revenue retention',
          note: active + ' active · ' + paused + ' paused', provisional: true }) +
        ui.stat({ label: 'Avg months on protocol', value: months, hero: true,
          note: 'The number that actually governs this business', act: 'go-retention' }) +
        ui.stat({ label: 'Active members', value: active,
          delta: -churned, deltaText: churned + ' cancelled all-time', deltaTone: churned ? 'down' : 'flat' }) +
        ui.stat({ label: 'Today', value: todayAppts.length, unit: 'visits',
          note: noIntake.length ? noIntake.length + ' without intake' : 'All intakes done' }) +
        '</div>' +

        (attention.length ? ui.card({
          eyebrow: 'Needs you today',
          title: 'Top ' + Math.min(3, attention.length) + ' by consequence',
          body: '<div class="list">' + attention.slice(0, 3).map(function (a) {
            return '<button class="item" data-tone="' + a.tone + '" data-act="go" data-to="' + a.to + '">' +
              '<span class="body"><span class="ttl">' + esc(a.text) + '</span>' +
              '<span class="sub">' + esc(a.who) + '</span></span>' +
              '<span class="side"><span class="btn sm">' + esc(a.act) + '</span></span></button>';
          }).join('') + '</div>' +
          (attention.length > 3 ? '<p class="dim" style="font-size:.8rem;margin-top:.8rem">' +
            (attention.length - 3) + ' more across the safety and retention queues.</p>' : '')
        }) : '') +

        '<div class="grid g2">' +
        ui.card({
          eyebrow: 'This month',
          title: 'Where people are getting stuck',
          sub: 'Drop-off between stages is the only part of a funnel anyone can act on.',
          body: GD.charts.funnel(q.funnel()) +
            '<p class="dim" style="font-size:.8rem;margin-top:1rem">' +
            '<a href="#/staff/pipeline" style="color:var(--gd-accent);font-weight:600">Full pipeline and attribution →</a></p>'
        }) +
        ui.card({
          eyebrow: 'Speed to lead',
          title: stl.pct + '% of leads got a first response',
          sub: 'While the corporate form is a callback queue, response time is the conversion rate.',
          body: '<div class="bar" style="height:10px"><i style="width:' + stl.pct + '%"></i></div>' +
            '<dl class="kv" style="margin-top:1rem">' +
            '<dt>Leads</dt><dd class="num">' + stl.total + '</dd>' +
            '<dt>Responded to</dt><dd class="num">' + stl.answered + '</dd>' +
            '<dt>Never answered</dt><dd class="num ' + (stl.unanswered ? 'down' : '') + '">' + stl.unanswered + '</dd>' +
            '</dl>' +
            '<div class="note-band" style="margin-top:1rem">Every unanswered row is a man who called ' +
            'the next clinic on the list. Automating the first reply is the cheapest fix in this whole build.</div>'
        }) +
        '</div>' +

        ui.card({
          eyebrow: 'Queues',
          title: 'Everything open right now',
          body: '<div class="grid g4">' +
            [['Safety flags', safety.length, 'staff/safety', safety.some(function (s) { return s.severity === 2; }) ? 'critical' : ''],
             ['At risk', risk.length, 'staff/retention', ''],
             ['Labs overdue', due.length, 'staff/due', ''],
             ['Unread messages', q.unreadStaff(), 'staff/messages', '']].map(function (r) {
              return '<button class="stat" data-act="go" data-to="' + r[2] + '" style="cursor:pointer;text-align:left' +
                (r[3] === 'critical' ? ';border-color:var(--gd-critical)' : '') + '">' +
                '<div class="lab">' + esc(r[0]) + '</div><div class="stat-val">' + r[1] + '</div></button>';
            }).join('') + '</div>'
        });
    }
  });

  ui.act('go-retention', function () { ui.go('staff/retention'); });

  /* =================================================================== today */

  ui.register('staff/today', {
    title: 'Today',
    crumb: function () { return fmt.date(GD.store.today(), 'long'); },
    primary: function () { return '<button class="btn primary" data-act="go" data-to="staff/checkout">Checkout</button>'; },
    render: function () {
      var appts = q.apptsToday();
      if (!appts.length) return ui.empty({ icon: '▦', title: 'Nothing on the books today',
        body: 'Appointments booked from the patient app or the calendar appear here in time order.' });

      var arrived = appts.filter(function (a) { return a.status === 'arrived'; }).length;
      var done = appts.filter(function (a) { return a.status === 'complete'; }).length;

      return '<div class="grid g4">' +
        ui.stat({ label: 'Booked', value: appts.length }) +
        ui.stat({ label: 'Arrived', value: arrived }) +
        ui.stat({ label: 'Complete', value: done }) +
        ui.stat({ label: 'Intake missing', value: appts.filter(function (a) { return !a.intake_complete; }).length,
          note: 'Each one costs clinical minutes' }) +
        '</div>' +

        ui.card({
          flush: true,
          title: 'In time order',
          sub: 'Everything the provider needs before walking into the room, on one line.',
          body: '<div class="list">' + appts.map(function (a) {
            var p = a.patient_id ? q.patient(a.patient_id) : null;
            var flags = [];
            if (!a.intake_complete) flags.push(ui.pill('intake ' + (a.patient_id ? 'incomplete' : 'n/a'), 'warn'));
            if (p) {
              var sq = q.safetyQueue().filter(function (s) { return s.patient.id === p.id; })[0];
              if (sq) flags.push(ui.pill(sq.severity === 2 ? 'safety flag' : 'watch', sq.severity === 2 ? 'critical' : 'warn'));
              var dsc = q.daysSinceCheckin(p.id);
              if (dsc !== null && dsc >= 21) flags.push(ui.pill('silent ' + dsc + 'd', 'warn'));
              var th = q.threadFor(p.id);
              if (th && th.unread_staff) flags.push(ui.pill('message', 'info'));
            }
            var lastPanel = p ? q.latestPanel(p.id) : null;
            return '<div class="item" data-tone="' + (flags.length && !a.intake_complete ? 'warn' : '') + '">' +
              '<span class="side" style="min-width:56px;font-weight:700;color:var(--gd-text)">' + esc(fmt.time(a.starts_at)) + '</span>' +
              (p ? GD.media.avatarHtml('patient:' + p.id + ':avatar', q.name(p)) : '<span class="av">·</span>') +
              '<span class="body"><span class="ttl">' + esc(q.apptPatientName(a)) + ' ' + flags.join(' ') + '</span>' +
              '<span class="sub">' + esc(q.apptLabel(a)) + ' · ' + esc(a.room || '') +
                (lastPanel ? ' · last labs ' + esc(fmt.ago(lastPanel.drawn_at)) : '') + '</span></span>' +
              '<span class="side row tight" style="justify-content:flex-end">' +
              (a.status === 'booked' ? '<button class="btn sm" data-act="mark-arrived" data-id="' + a.id + '">Arrived</button>' : '') +
              (a.status === 'arrived' ? '<button class="btn sm primary" data-act="mark-complete" data-id="' + a.id + '">Complete</button>' : '') +
              (a.status === 'complete' ? ui.pill('done', 'ok') : '') +
              (a.status === 'no_show' ? ui.pill('no-show', 'critical') : '') +
              (p ? '<button class="btn sm ghost" data-act="open-patient" data-id="' + p.id + '">Open</button>' : '') +
              '</span></div>';
          }).join('') + '</div>'
        }) +

        ui.card({
          eyebrow: 'Front desk',
          title: 'Other queues',
          body: '<div class="grid g3">' +
            ui.stat({ label: 'Missed calls', value: q.missedCalls().filter(function (m) { return m.status !== 'booked'; }).length,
              note: 'Auto text-back is logged, not sent' }) +
            ui.stat({ label: 'Waitlist', value: q.waitlist().length, note: 'One tap to fill a cancellation' }) +
            ui.stat({ label: 'Open tasks', value: q.tasks().length }) +
            '</div>' +
            '<div class="list" style="margin-top:1rem">' + q.tasks().slice(0, 5).map(function (t) {
              return '<div class="item" data-tone="' + (t.priority === 'high' ? 'critical' : '') + '">' +
                '<span class="body"><span class="ttl">' + esc(t.title) + '</span>' +
                '<span class="sub">' + esc(fmt.title(t.source)) + ' · due ' + esc(fmt.ago(t.due)) + '</span></span>' +
                '<span class="side"><button class="btn sm" data-act="task-done" data-id="' + t.id + '">Done</button></span></div>';
            }).join('') + '</div>'
        });
    }
  });

  ui.act('mark-arrived', function (data) {
    GD.store.patch('appointments', data.id, { status: 'arrived' });
    ui.toast('Checked in'); ui.refresh();
  });
  ui.act('mark-complete', function (data) {
    var a = GD.store.one('appointments', data.id);
    GD.store.patch('appointments', data.id, { status: 'complete' });
    ui.refresh();
    if (a && a.patient_id) rebookPrompt(a);
  });
  ui.act('task-done', function (data) {
    GD.store.patch('tasks', data.id, { done: true });
    ui.toast('Task closed', 'ok'); ui.refresh();
  });

  /* The single highest-leverage default in the build: the next visit is
     pre-filled with the clinically correct date, because the recheck IS
     indicated. Pre-selecting it is honest, and it converts. */
  function rebookPrompt(appt) {
    var p = q.patient(appt.patient_id);
    var due = q.labsDue(p.id);
    var suggested = due ? due.dueOn : fmt.plusDays(GD.store.today(), 56);
    // Nudge to the next weekday.
    while (['Sat', 'Sun'].indexOf(fmt.dow(suggested)) > -1) suggested = fmt.plusDays(suggested, 1);
    var slots = q.slotsFor(suggested, 'svc_labdraw');
    ui.modal({
      title: 'Book ' + p.first_name + '’s next visit before he leaves',
      sub: due ? due.reason + ' — clinically indicated on ' + fmt.date(suggested, 'long') : 'Next follow-up',
      body: '<div class="note-band"><b>He must not walk out without a next appointment on the books.</b> ' +
        'The date below is already the right one. All the front desk has to do is confirm it.</div>' +
        '<div class="field" style="margin-top:1rem"><label for="rb_date">Date</label>' +
        '<input type="date" id="rb_date" value="' + suggested + '"></div>' +
        '<div class="field" style="margin-top:.8rem"><label>Time</label><div class="opts" id="rb_slots">' +
        (slots.length ? slots.slice(0, 6).map(function (t, i) {
          return '<button class="opt" aria-pressed="' + (i === 0) + '" data-act="rb-slot" data-time="' + t + '">' +
            esc(fmt.time('2020-01-01T' + t + ':00')) + '</button>';
        }).join('') : '<span class="dim">No open slots that day — change the date.</span>') +
        '</div></div>',
      actions: '<button class="btn ghost" data-act="close-modal">Not now</button>' +
        '<button class="btn primary" data-act="rb-confirm" data-patient="' + p.id + '">Book it</button>',
      after: function () { GD.store.pref('rbSlot', slots[0] || '09:00'); }
    });
  }
  ui.act('rb-slot', function (data, el) {
    Array.prototype.forEach.call(el.parentNode.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
    el.setAttribute('aria-pressed', 'true');
    GD.store.pref('rbSlot', data.time);
  });
  ui.act('rb-confirm', function (data) {
    var date = (document.getElementById('rb_date') || {}).value || GD.store.today();
    var appt = GD.store.add('appointments', {
      patient_id: data.patient, service_id: 'svc_labdraw', provider_id: 'prov_01',
      starts_at: date + 'T' + (GD.store.pref('rbSlot') || '09:00') + ':00',
      duration_min: 30, status: 'booked', intake_complete: true,
      booking_channel: 'checkout_rebook', reason_code: 'monitoring', room: 'Room 1'
    });
    ui.closeModal();
    ui.toast('Booked ' + fmt.date(appt.starts_at, 'dow') + ' at ' + fmt.time(appt.starts_at), 'ok');
    ui.refresh();
  });

  /* ================================================================ calendar */

  ui.register('staff/calendar', {
    title: 'Calendar',
    width: 'wide',
    crumb: 'This week',
    primary: function () { return '<button class="btn primary" data-act="new-appt">New appointment</button>'; },
    render: function () {
      var offset = Number(GD.store.pref('calOffset') || 0);
      var monday = fmt.plusDays(GD.store.monday(), offset * 7);
      var days = [0, 1, 2, 3, 4].map(function (i) { return fmt.plusDays(monday, i); });
      var hours = [];
      for (var h = 9; h < 17; h++) { hours.push(h + ':00'); hours.push(h + ':30'); }

      var byDayTime = {};
      days.forEach(function (d) { byDayTime[d] = {}; });
      q.appointments().forEach(function (a) {
        var d = a.starts_at.slice(0, 10);
        if (byDayTime[d]) {
          var slot = a.starts_at.slice(11, 16);
          (byDayTime[d][slot] = byDayTime[d][slot] || []).push(a);
        }
      });

      var grid = ['<div class="cal">', '<div class="hd"></div>'];
      days.forEach(function (d) {
        grid.push('<div class="hd" data-today="' + (d === GD.store.today() ? 1 : 0) + '">' +
          esc(fmt.dow(d)) + '<small>' + esc(fmt.date(d, 'md')) + '</small></div>');
      });
      hours.forEach(function (hm) {
        var pad = hm.length === 4 ? '0' + hm : hm;
        grid.push('<div class="hr">' + (pad.slice(3) === '00' ? esc(fmt.time('2020-01-01T' + pad + ':00')) : '') + '</div>');
        days.forEach(function (d) {
          var evs = (byDayTime[d][pad] || []);
          grid.push('<div class="slot">' + evs.map(function (a) {
            var p = a.patient_id ? q.patient(a.patient_id) : null;
            var flagged = p && q.safetyQueue().some(function (s) { return s.patient.id === p.id; });
            return '<button class="ev" data-status="' + esc(a.status) + '" data-flag="' + (flagged ? 1 : 0) + '" ' +
              'data-act="open-appt" data-id="' + a.id + '">' +
              '<b>' + esc(q.apptPatientName(a)) + '</b>' +
              '<span>' + esc(q.apptLabel(a)) + '</span></button>';
          }).join('') + '</div>');
        });
      });
      grid.push('</div>');

      return '<div class="row between" style="margin-bottom:1rem">' +
        '<div class="row tight">' +
        '<button class="btn sm" data-act="cal-move" data-by="-1">‹ Prev</button>' +
        '<button class="btn sm" data-act="cal-move" data-by="0">This week</button>' +
        '<button class="btn sm" data-act="cal-move" data-by="1">Next ›</button>' +
        '</div>' +
        '<div class="row tight dim" style="font-size:.78rem">' +
        '<span class="pill" data-tone="accent"><i class="dot"></i>booked</span>' +
        '<span class="pill"><i class="dot"></i>complete</span>' +
        '<span class="pill" data-tone="critical"><i class="dot"></i>no-show</span>' +
        '<span class="pill" data-tone="warn"><i class="dot"></i>has a safety flag</span>' +
        '</div></div>' +
        '<div class="table-scroll">' + grid.join('') + '</div>' +
        '<p class="dim" style="font-size:.8rem;margin-top:1rem">Clinic hours are Mon–Fri 9–5 with a lunch block. ' +
        'Narrow hours are exactly why after-hours self-serve booking and a waitlist matter more here than usual.</p>';
    }
  });

  ui.act('cal-move', function (data) {
    var by = Number(data.by);
    GD.store.pref('calOffset', by === 0 ? 0 : Number(GD.store.pref('calOffset') || 0) + by);
    ui.refresh();
  });

  ui.act('open-appt', function (data) {
    var a = GD.store.one('appointments', data.id);
    var p = a.patient_id ? q.patient(a.patient_id) : null;
    ui.modal({
      title: q.apptPatientName(a),
      sub: fmt.date(a.starts_at, 'long') + ' at ' + fmt.time(a.starts_at),
      body: '<dl class="kv">' +
        '<dt>Service</dt><dd>' + esc(q.apptLabel(a)) + '</dd>' +
        '<dt>Provider</dt><dd>' + esc((q.provider(a.provider_id) || {}).name || '—') + '</dd>' +
        '<dt>Room</dt><dd>' + esc(a.room || '—') + '</dd>' +
        '<dt>Status</dt><dd>' + esc(fmt.title(a.status)) + '</dd>' +
        '<dt>Booked via</dt><dd>' + esc(fmt.title(a.booking_channel || '—')) + '</dd>' +
        '<dt>Intake</dt><dd>' + (a.intake_complete ? 'Complete' : 'Incomplete') + '</dd>' +
        '</dl>' +
        (a.reason_code ? '<div class="note-band" style="margin-top:1rem"><b>Reason codes are PHI.</b> ' +
          '“' + esc(fmt.title(a.reason_code)) + '” attached to a named person is a diagnosis disclosure, ' +
          'which is why it never appears in a notification, a calendar invite, or a payment descriptor.</div>' : ''),
      actions: (p ? '<button class="btn" data-act="open-patient" data-id="' + p.id + '">Open chart</button>' : '') +
        (a.status === 'booked' ? '<button class="btn" data-act="mark-arrived" data-id="' + a.id + '">Mark arrived</button>' : '') +
        '<button class="btn primary" data-act="close-modal">Close</button>'
    });
  });

  ui.act('new-appt', function () {
    var patients = q.patients();
    ui.modal({
      title: 'New appointment',
      body: '<div class="field"><label for="na_p">Patient</label><select id="na_p">' +
        patients.map(function (p) { return '<option value="' + p.id + '">' + esc(q.name(p)) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field" style="margin-top:.8rem"><label for="na_s">Service</label><select id="na_s">' +
        q.services().map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field" style="margin-top:.8rem"><label for="na_d">Date</label>' +
        '<input type="date" id="na_d" value="' + GD.store.today() + '"></div>' +
        '<div class="field" style="margin-top:.8rem"><label for="na_t">Time</label>' +
        '<input type="time" id="na_t" value="10:00" step="900"></div>',
      actions: '<button class="btn ghost" data-act="close-modal">Cancel</button>' +
        '<button class="btn primary" data-act="na-save">Book</button>'
    });
  });
  ui.act('na-save', function () {
    var pid = document.getElementById('na_p').value;
    var sid = document.getElementById('na_s').value;
    var svc = q.service(sid);
    var appt = GD.store.add('appointments', {
      patient_id: pid, service_id: sid, provider_id: 'prov_01',
      starts_at: document.getElementById('na_d').value + 'T' + document.getElementById('na_t').value + ':00',
      duration_min: svc.duration_min, status: 'booked', intake_complete: true,
      booking_channel: 'staff', reason_code: 'staff_booked', room: 'Room 1'
    });
    ui.closeModal();
    ui.toast('Booked ' + fmt.date(appt.starts_at, 'dow') + ' ' + fmt.time(appt.starts_at), 'ok');
    ui.refresh();
  });

  /* ================================================================ patients */

  ui.register('staff/patients', {
    title: 'Patients',
    width: 'wide',
    primary: function () { return '<button class="btn" data-act="palette">Search ⌘K</button>'; },
    render: function () {
      var filter = GD.store.pref('patientFilter') || 'all';
      var all = q.patients();
      var counts = {
        all: all.length,
        active: all.filter(function (p) { return p.status === 'active'; }).length,
        at_risk: q.atRisk().length,
        flagged: q.safetyQueue().length,
        inactive: all.filter(function (p) { return ['churned', 'paused'].indexOf(p.status) > -1; }).length
      };
      var riskIds = q.atRisk().map(function (r) { return r.patient.id; });
      var flagIds = q.safetyQueue().map(function (s) { return s.patient.id; });
      var rows = all.filter(function (p) {
        if (filter === 'active') return p.status === 'active';
        if (filter === 'at_risk') return riskIds.indexOf(p.id) > -1;
        if (filter === 'flagged') return flagIds.indexOf(p.id) > -1;
        if (filter === 'inactive') return ['churned', 'paused'].indexOf(p.status) > -1;
        return true;
      });

      return '<div class="tabs">' + [['all', 'All'], ['active', 'Active'], ['at_risk', 'At risk'],
        ['flagged', 'Safety flags'], ['inactive', 'Paused / churned']].map(function (t) {
        return '<button aria-selected="' + (filter === t[0]) + '" data-act="patient-filter" data-f="' + t[0] + '">' +
          esc(t[1]) + ' <span class="dim">' + counts[t[0]] + '</span></button>';
      }).join('') + '</div>' +

      ui.card({ body: '<div class="table-scroll"><table><thead><tr>' +
        '<th>Patient</th><th>Status</th><th>Months</th><th>Last check-in</th><th>Trend</th>' +
        '<th>Last labs</th><th>Next visit</th><th>Flags</th></tr></thead><tbody>' +
        rows.map(function (p) {
          var season = q.season(p.id);
          var cis = q.checkins(p.id);
          var dsc = q.daysSinceCheckin(p.id);
          var panel = q.latestPanel(p.id);
          var next = q.nextAppt(p.id);
          var flags = [];
          if (flagIds.indexOf(p.id) > -1) flags.push(ui.pill('safety', 'critical'));
          if (riskIds.indexOf(p.id) > -1) flags.push(ui.pill('at risk', 'warn'));
          var tone = p.status === 'active' ? 'ok' : p.status === 'churned' ? 'critical' : p.status === 'paused' ? 'warn' : '';
          return '<tr class="clickable" data-act="open-patient" data-id="' + p.id + '">' +
            '<td><div class="row tight">' + GD.media.avatarHtml('patient:' + p.id + ':avatar', q.name(p)) +
              '<span><b>' + esc(q.name(p)) + '</b><br><span class="dim" style="font-size:.74rem">' +
              esc(GD.rosterNote[p.id] || '') + '</span></span></div></td>' +
            '<td>' + ui.pill(fmt.title(p.status), tone) + '</td>' +
            '<td class="num">' + (season ? season.months : '—') + '</td>' +
            '<td class="num' + (dsc !== null && dsc >= 21 ? ' down' : '') + '">' + (dsc === null ? '—' : dsc + 'd') + '</td>' +
            '<td>' + (cis.length > 1 ? GD.charts.spark(cis.map(q.checkinAvg), { color: 'var(--gd-improving)' }) : '—') + '</td>' +
            '<td class="num">' + (panel ? esc(fmt.ago(panel.drawn_at)) : '—') + '</td>' +
            '<td class="num">' + (next ? esc(fmt.date(next.starts_at, 'md')) : '<span class="warnc">none</span>') + '</td>' +
            '<td>' + (flags.join(' ') || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      });
    }
  });

  ui.act('patient-filter', function (data) { GD.store.pref('patientFilter', data.f); ui.refresh(); });

  /* ========================================================== patient detail */

  ui.register('staff/patient/:id', {
    title: function (ctx) {
      var p = q.patient(ctx.params[0]);
      return p ? q.name(p) : 'Patient';
    },
    crumb: 'Chart',
    width: 'wide',
    primary: function (ctx) {
      var id = ctx.params[0];
      return '<button class="btn" data-act="go" data-to="patient/home" data-patient="' + id + '">See his app</button>' +
        '<button class="btn primary" style="margin-left:.5rem" data-act="lab-entry-for" data-id="' + id + '">Enter labs</button>';
    },
    render: function (ctx) {
      var p = q.patient(ctx.params[0] || ui.patientId());
      if (!p) return ui.empty({ title: 'Patient not found', body: 'Pick one from the roster.' });
      ui.patientId(p.id, true);        // silent: we are inside a render

      var tab = GD.store.pref('chartTab') || 'timeline';
      var season = q.season(p.id);
      var m = q.membership(p.id);
      var safety = q.safetyQueue().filter(function (s) { return s.patient.id === p.id; })[0];
      var risk = q.atRisk().filter(function (r) { return r.patient.id === p.id; })[0];

      var header = ui.card({
        tone: safety && safety.severity === 2 ? 'critical' : '',
        body: '<div class="row" style="gap:1rem;align-items:flex-start">' +
          '<span class="av lg"><img src="' + GD.media.personSrc('patient:' + p.id + ':avatar', q.name(p), 7) + '" alt=""></span>' +
          '<div style="flex:1 1 240px;min-width:0">' +
          '<div style="font-size:var(--gd-step-1);font-weight:700">' + esc(q.name(p)) + '</div>' +
          '<div class="muted" style="font-size:.86rem">' + q.age(p) + ' · ' + esc(fmt.phone(p.phone)) +
            ' · ' + esc(p.email) + '</div>' +
          '<div class="row tight" style="margin-top:.5rem">' +
            ui.pill(fmt.title(p.status), p.status === 'active' ? 'ok' : p.status === 'churned' ? 'critical' : 'warn') +
            (season ? ui.pill(GD.brand.seasonLabel(season)) : '') +
            (m ? ui.pill(fmt.money(m.mrr_cents) + '/mo') : '') +
            ui.pill('source: ' + fmt.title(p.acquisition_source)) +
          '</div></div>' +
          '<div class="row tight">' +
          '<button class="btn sm" data-act="avatar-upload" data-id="' + p.id + '">Photo</button>' +
          '<button class="btn sm" data-act="publish-summary" data-id="' + p.id + '">Publish summary</button>' +
          '</div></div>' +
          (safety ? '<div class="note-band ' + (safety.severity === 2 ? 'critical' : 'warn') + '" style="margin-top:1rem">' +
            '<b>Safety:</b> ' + safety.items.map(function (i) { return esc(i.text); }).join(' · ') + '</div>' : '') +
          (risk ? '<div class="note-band warn" style="margin-top:.6rem"><b>Retention:</b> ' +
            risk.reasons.map(function (r) { return esc(r.text); }).join(' · ') + '</div>' : '')
      });

      var tabs = '<div class="tabs">' + [['timeline', 'Timeline'], ['labs', 'Labs'], ['protocol', 'Protocol'],
        ['checkins', 'Check-ins'], ['photos', 'Photos'], ['messages', 'Messages'], ['billing', 'Billing']]
        .map(function (t) {
          return '<button aria-selected="' + (tab === t[0]) + '" data-act="chart-tab" data-t="' + t[0] + '">' + esc(t[1]) + '</button>';
        }).join('') + '</div>';

      return header + tabs + renderChartTab(tab, p);
    }
  });

  ui.act('chart-tab', function (data) { GD.store.pref('chartTab', data.t); ui.refresh(); });

  function renderChartTab(tab, p) {
    if (tab === 'timeline') return chartTimeline(p);
    if (tab === 'labs') return chartLabs(p);
    if (tab === 'protocol') return chartProtocol(p);
    if (tab === 'checkins') return chartCheckins(p);
    if (tab === 'photos') return chartPhotos(p);
    if (tab === 'messages') return chartMessages(p);
    return chartBilling(p);
  }

  /* One axis for everything. This is the screen a provider opens before
     walking into the room, so it has to answer "what happened to this man"
     without any clicking. */
  function chartTimeline(p) {
    var events = [];
    q.apptsForPatient(p.id).forEach(function (a) {
      events.push({ at: a.starts_at, kind: a.status === 'no_show' ? 'flag' : 'visit',
        what: q.apptLabel(a) + (a.status === 'no_show' ? ' — no-show' : ''),
        detail: fmt.title(a.status) + ' · booked via ' + fmt.title(a.booking_channel || 'staff') });
    });
    q.panels(p.id).forEach(function (pl) {
      var tt = q.result(pl.id, 'total_testosterone');
      var hct = q.result(pl.id, 'hematocrit');
      events.push({ at: pl.drawn_at, kind: 'lab', what: 'Lab panel — ' + q.resultsFor(pl.id).length + ' values',
        detail: (tt ? 'Total T ' + tt.value_numeric + ' ng/dL' : '') +
          (hct ? ' · Hct ' + hct.value_numeric + '%' : '') + (pl.note ? ' · ' + pl.note : '') });
    });
    q.protocolChanges(p.id).forEach(function (c) {
      events.push({ at: c.changed_at, kind: 'dose',
        what: (c.old_value ? c.old_value + ' → ' + c.new_value : 'Started ' + c.new_value),
        detail: c.reason_clinical });
    });
    q.checkins(p.id).filter(function (c) { return c.notes_free_text || c.missed_doses_count; }).forEach(function (c) {
      events.push({ at: c.week_of, kind: c.notes_free_text ? 'flag' : 'visit',
        what: 'Check-in · ' + fmt.num(q.checkinAvg(c), 1) + '/10' +
          (c.missed_doses_count ? ' · ' + c.missed_doses_count + ' missed dose' : ''),
        detail: c.notes_free_text ? '“' + c.notes_free_text + '”' : '' });
    });
    var mem = q.membership(p.id);
    if (mem) {
      events.push({ at: mem.started_at, kind: 'visit', what: 'Membership started', detail: fmt.money(24900) + '/month' });
      if (mem.paused_at) events.push({ at: mem.paused_at, kind: 'flag', what: 'Membership paused',
        detail: mem.cancel_reason_text || '' });
      if (mem.cancelled_at) events.push({ at: mem.cancelled_at, kind: 'flag', what: 'Membership cancelled',
        detail: fmt.title(mem.cancel_reason_code || '') + (mem.cancel_reason_text ? ' — ' + mem.cancel_reason_text : '') });
    }
    events.sort(function (a, b) { return b.at.localeCompare(a.at); });

    return ui.card({
      eyebrow: events.length + ' events',
      title: 'Everything, one axis',
      sub: 'Visits, labs, dose changes, check-in scores, membership. Newest first.',
      body: '<div class="timeline">' + events.map(function (e) {
        return '<div class="tl-item" data-kind="' + e.kind + '">' +
          '<div class="when">' + esc(fmt.date(e.at, 'long')) + ' · ' + esc(fmt.ago(e.at)) + '</div>' +
          '<div class="what">' + esc(e.what) + '</div>' +
          (e.detail ? '<div class="detail">' + esc(e.detail) + '</div>' : '') + '</div>';
      }).join('') + '</div>'
    });
  }

  function chartLabs(p) {
    var panels = q.panels(p.id);
    if (!panels.length) return ui.empty({ icon: '⚗', title: 'No panels entered',
      body: 'Enter a baseline panel and every trend in this chart turns on.',
      act: 'lab-entry-for', actData: ' data-id="' + p.id + '"', actLabel: 'Enter a panel' });

    var analytes = q.analytes();
    return ui.card({
      flush: true,
      title: 'All draws side by side',
      sub: 'Out-of-range values are flagged against both the reference range and the clinic target.',
      body: '<div class="table-scroll"><table><thead><tr><th>Analyte</th>' +
        panels.map(function (pl) { return '<th class="num">' + esc(fmt.date(pl.drawn_at, 'md')) + '</th>'; }).join('') +
        '<th>Trend</th><th>Target</th></tr></thead><tbody>' +
        analytes.map(function (a) {
          var series = q.analyteSeries(p.id, a.key);
          if (!series.length) return '';
          return '<tr><td class="an">' + esc(a.label) + (a.safety ? ' ' + ui.pill('safety', 'info') : '') + '</td>' +
            panels.map(function (pl) {
              var r = q.result(pl.id, a.key);
              if (!r) return '<td class="dim">—</td>';
              var cls = r.flag === 'critical' ? 'down' : (r.flag === 'above_ref' || r.flag === 'below_ref') ? 'warnc' : '';
              return '<td class="num ' + cls + '"><b>' + fmt.num(r.value_numeric) + '</b></td>';
            }).join('') +
            '<td>' + GD.charts.spark(series.map(function (s) { return s.value; })) + '</td>' +
            '<td class="rng">' + fmt.num(a.targetLow) + '–' + fmt.num(a.targetHigh) + ' ' + esc(a.unit) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div style="padding:1rem"><div class="note-band warn">Every range in this dataset is a provisional ' +
        'placeholder. Get the clinic’s real target ranges and safety thresholds before production — ' +
        'docs/11-discovery-questions.md §3.</div></div>'
    });
  }

  function chartProtocol(p) {
    var items = q.protocolItems(p.id);
    var changes = q.protocolChanges(p.id);
    return ui.card({
      eyebrow: 'Current',
      title: 'Protocol',
      aside: '<button class="btn sm primary" data-act="protocol-change" data-id="' + p.id + '">Record a change</button>',
      body: (items.length ? '<div class="table-scroll"><table><thead><tr><th>Medication</th><th>Dose</th>' +
        '<th>Route</th><th>Frequency</th><th>Notes</th></tr></thead><tbody>' +
        items.map(function (it) {
          return '<tr><td><b>' + esc(it.medication_name) + '</b></td>' +
            '<td class="num">' + it.dose_amount + ' ' + esc(it.dose_unit) + '</td>' +
            '<td>' + esc(it.route) + '</td><td>' + esc(it.frequency) + '</td>' +
            '<td class="dim">' + esc(it.notes || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="note-band">No protocol recorded.</div>') +
        '<div class="note-band" style="margin-top:1rem"><b>This records what a licensed provider decided elsewhere.</b> ' +
        'There is no prescribing, no e-prescribing, and no pharmacy transmission anywhere in this system. ' +
        'Testosterone is Schedule III and that stays in the clinical system of record.</div>' +
        (changes.length ? '<h3 style="margin:1.5rem 0 .8rem;font-size:.95rem;font-weight:700">Change history</h3>' +
          '<div class="timeline">' + changes.slice().reverse().map(function (c) {
            return '<div class="tl-item" data-kind="dose">' +
              '<div class="when">' + esc(fmt.date(c.changed_at, 'long')) + '</div>' +
              '<div class="what">' + esc((c.old_value ? c.old_value + ' → ' : 'Started ') + c.new_value) + '</div>' +
              '<div class="detail"><b>Clinical:</b> ' + esc(c.reason_clinical || '—') + '</div>' +
              '<div class="detail"><b>Published to patient:</b> ' + esc(c.reason_patient_facing || '—') + '</div>' +
              '</div>';
          }).join('') + '</div>' : '')
    });
  }

  ui.act('protocol-change', function (data) {
    var items = q.protocolItems(data.id);
    var cur = items[0];
    ui.modal({
      title: 'Record a protocol change',
      sub: 'Two reasons on purpose: the clinical note stays internal, the patient-facing one publishes to his app.',
      body: '<div class="field"><label for="pc_field">What changed</label>' +
        '<input type="text" id="pc_field" value="' + esc((cur ? cur.medication_name.toLowerCase().replace(/\s+/g, '_') : 'medication') + '_dose') + '"></div>' +
        '<div class="grid g2" style="margin-top:.8rem">' +
        '<div class="field"><label for="pc_from">From</label><input type="text" id="pc_from" value="' +
          esc(cur ? cur.dose_amount + cur.dose_unit + ' ' + cur.frequency : '') + '"></div>' +
        '<div class="field"><label for="pc_to">To</label><input type="text" id="pc_to" placeholder="e.g. 140mg weekly"></div>' +
        '</div>' +
        '<div class="field" style="margin-top:.8rem"><label for="pc_clin">Clinical reason (internal)</label>' +
        '<textarea id="pc_clin" placeholder="Total T 596 below target, free T 13.4, hematocrit stable at 46.9."></textarea></div>' +
        '<div class="field" style="margin-top:.8rem"><label for="pc_pat">Patient-facing reason (publishes to his app)</label>' +
        '<textarea id="pc_pat" placeholder="Your levels came up well but are still just under where we want them."></textarea>' +
        '<div class="hint">Plain language. Never paste the clinical note here.</div></div>',
      actions: '<button class="btn ghost" data-act="close-modal">Cancel</button>' +
        '<button class="btn primary" data-act="pc-save" data-id="' + data.id + '">Record change</button>'
    });
  });
  ui.act('pc-save', function (data) {
    var to = document.getElementById('pc_to').value.trim();
    if (!to) return ui.toast('The new value is empty.', 'warn');
    var proto = q.protocol(data.id);
    GD.store.add('protocol_changes', {
      protocol_id: proto ? proto.id : null, patient_id: data.id,
      changed_at: GD.store.today(), changed_by: 'stf_prov_01',
      field: document.getElementById('pc_field').value,
      old_value: document.getElementById('pc_from').value || null,
      new_value: to,
      reason_clinical: document.getElementById('pc_clin').value,
      reason_patient_facing: document.getElementById('pc_pat').value
    });
    ui.closeModal();
    ui.toast('Change recorded. It is now a marker on his ' + W('statSheet') + '.', 'ok');
    ui.refresh();
  });

  function chartCheckins(p) {
    var cis = q.checkins(p.id);
    if (cis.length < 2) return ui.empty({ icon: '✓', title: 'Not enough check-ins yet',
      body: 'Two weekly check-ins and the score trend turns on. This is the thing a provider has never had before: how the patient feels between visits.' });
    var series = q.checkinDims.map(function (d) {
      return { key: d, label: q.dimLabel(d), color: GD.charts.dimColor(d),
        points: cis.map(function (c) { return { date: c.week_of, value: c[d] }; }) };
    });
    var notes = cis.filter(function (c) { return c.notes_free_text; });
    return ui.card({
      eyebrow: cis.length + ' check-ins',
      title: 'How he feels between visits',
      sub: 'Same axis as his lab draws and dose changes. Would this change how you titrate?',
      body: '<div class="legend" style="margin-bottom:.8rem">' + q.checkinDims.map(function (d) {
          return '<span class="chip" aria-pressed="true"><i style="background:' + GD.charts.dimColor(d) + '"></i>' +
            esc(q.dimLabel(d)) + '</span>';
        }).join('') + '</div>' +
        '<div class="chart-scroll">' + GD.charts.statSheet({
          series: series, labDates: q.panels(p.id).map(function (x) { return x.drawn_at; }),
          doseChanges: q.protocolChanges(p.id).map(function (c) {
            return { date: c.changed_at, label: String(c.new_value || '').replace(' weekly', '') };
          }),
          baseline: q.checkinAvg(cis[0]), height: 300
        }) + '</div>' +
        (notes.length ? '<h3 style="margin:1.5rem 0 .6rem;font-size:.95rem;font-weight:700">Free-text notes (' +
          notes.length + ')</h3>' +
          '<p class="dim" style="font-size:.8rem;margin-bottom:.8rem">Patients write clinically significant things here. ' +
          'Somebody has to read this field.</p>' +
          notes.slice().reverse().map(function (c) {
            return '<div class="note-band warn" style="margin-bottom:.6rem"><b>' + esc(fmt.date(c.week_of, 'long')) +
              '</b> — “' + esc(c.notes_free_text) + '”</div>';
          }).join('') : '')
    });
  }

  function chartPhotos(p) {
    var allSeries = q.photoSeries(p.id);
    if (!allSeries.length) return ui.empty({ icon: '◰', title: 'No photo series',
      body: 'Photo series are started in the room with a consent on file. Hair and body composition are the two that earn their keep.' });
    return allSeries.map(function (s) {
      var frames = q.photos(s.id);
      var poses = {};
      frames.forEach(function (f) { poses[f.pose_key] = 1; });
      return ui.card({
        eyebrow: fmt.title(s.series_type) + ' · guide ' + s.guide_version,
        title: frames.length + ' frames',
        sub: 'Consent ref ' + (s.consent_ref || 'none') + '. Photos are the highest-sensitivity asset in the whole system.',
        body: '<div class="row tight" style="margin-bottom:.8rem">' + Object.keys(poses).map(function (k) {
            return ui.pill(fmt.title(k));
          }).join('') + '</div>' +
          '<div class="filmstrip">' + frames.map(function (f, i) {
            return '<button data-act="film-frame" data-id="' + f.id + '">' +
              '<img src="' + GD.media.photoSrc(f, frames.length > 1 ? i / (frames.length - 1) : 0) + '" alt="">' +
              '<span class="cap">' + esc(fmt.date(f.captured_at, 'md')) + '</span></button>';
          }).join('') + '</div>' +
          '<div class="note-band" style="margin-top:1rem">In production: private bucket, no CDN cache, ' +
          'short-TTL signed URLs, EXIF stripped on upload. In the pilot they never leave this browser.</div>'
      });
    }).join('');
  }

  function chartMessages(p) {
    var thread = q.threadFor(p.id);
    if (!thread) return ui.empty({ icon: '✉', title: 'No messages', body: 'Threads started by the patient appear here, tagged so they route to the right person.' });
    var msgs = q.messagesIn(thread.id);
    return ui.card({
      eyebrow: fmt.title(thread.triage_tag) + ' · ' + fmt.title(thread.status),
      title: 'Thread',
      aside: '<button class="btn sm" data-act="close-thread" data-id="' + thread.id + '">Mark resolved</button>',
      body: '<div class="stack tight">' + msgs.map(function (m) {
          var staff = m.sender_type === 'staff';
          return '<div style="max-width:82%;' + (staff ? 'margin-left:auto' : '') + '">' +
            '<div class="labcard"' + (staff ? ' style="background:var(--gd-accent-dim);border-color:var(--gd-accent-line)"' : '') + '>' +
            '<div style="font-size:.9rem;line-height:1.5">' + esc(m.body) + '</div></div>' +
            '<div class="dim" style="font-size:.7rem;margin-top:.2rem;' + (staff ? 'text-align:right' : '') + '">' +
            (staff ? 'Clinic' : q.name(p)) + ' · ' + esc(fmt.ago(m.sent_at)) + '</div></div>';
        }).join('') + '</div>' +
        '<div class="field" style="margin-top:1.2rem"><label for="st_reply">Reply</label>' +
        '<textarea id="st_reply" placeholder="Plain language. Nothing clinical goes in the notification preview."></textarea></div>' +
        '<button class="btn primary" style="margin-top:.8rem" data-act="staff-reply" data-thread="' + thread.id + '">Send reply</button>'
    });
  }

  ui.act('staff-reply', function (data) {
    var body = (document.getElementById('st_reply') || {}).value.trim();
    if (!body) return ui.toast('Nothing typed.', 'warn');
    GD.store.add('messages', { thread_id: data.thread, sender_type: 'staff', sender_id: 'stf_prov_01',
      body: body, sent_at: GD.store.today(), read_at: null });
    GD.store.patch('message_threads', data.thread, { last_at: GD.store.today(), unread_staff: 0 });
    ui.toast('Sent. His phone shows “you have an update” and nothing more.', 'ok');
    ui.refresh();
  });
  ui.act('close-thread', function (data) {
    GD.store.patch('message_threads', data.id, { status: 'closed', unread_staff: 0 });
    ui.toast('Resolved', 'ok'); ui.refresh();
  });

  function chartBilling(p) {
    var m = q.membership(p.id);
    var pays = q.payments(p.id);
    return ui.card({
      eyebrow: m ? fmt.title(m.status) : 'No membership',
      title: 'Billing',
      body: (m ? '<dl class="kv" style="margin-bottom:1.2rem">' +
        '<dt>Plan</dt><dd>' + esc(m.plan_id) + '</dd>' +
        '<dt>Started</dt><dd>' + esc(fmt.date(m.started_at, 'long')) + '</dd>' +
        '<dt>MRR</dt><dd class="num">' + fmt.money(m.mrr_cents) + '</dd>' +
        (m.cancelled_at ? '<dt>Cancelled</dt><dd>' + esc(fmt.date(m.cancelled_at, 'long')) + ' — ' +
          esc(fmt.title(m.cancel_reason_code || '')) + '</dd>' : '') +
        (m.cancel_reason_text ? '<dt>In his words</dt><dd style="text-align:left">“' + esc(m.cancel_reason_text) + '”</dd>' : '') +
        '</dl>' : '') +
        '<div class="table-scroll"><table><thead><tr><th>Date</th><th>Amount</th><th>Type</th>' +
        '<th>Descriptor</th><th>Status</th></tr></thead><tbody>' +
        pays.map(function (x) {
          return '<tr><td>' + esc(fmt.date(x.created_at)) + '</td>' +
            '<td class="num">' + fmt.money(x.amount_cents) + '</td><td>' + esc(x.type) + '</td>' +
            '<td class="dim">' + esc(x.descriptor || '') + '</td>' +
            '<td>' + (x.status === 'failed' ? ui.pill('failed', 'critical') : ui.pill('paid', 'ok')) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="note-band" style="margin-top:1rem"><b>No PHI reaches the payment processor.</b> ' +
        'Not metadata, not descriptors, not line items. “Monthly membership”, never a therapy name. ' +
        'Enforced by a serialiser allowlist, not by anyone remembering.</div>'
    });
  }

  ui.act('avatar-upload', function (data) {
    GD.media.pick({ square: true, maxEdge: 400 }).then(function (url) {
      if (!url) return;
      GD.media.set('patient:' + data.id + ':avatar', url);
      ui.toast('Photo added. It stays in this browser.', 'ok');
      ui.refresh();
    }, function (e) { ui.toast(e.message, 'warn'); });
  });

  ui.act('publish-summary', function (data) {
    var p = q.patient(data.id);
    var cis = q.checkins(p.id);
    var first = cis[0], last = cis[cis.length - 1];
    var panels = q.panels(p.id);
    var draft = '';
    if (first && last) {
      draft = 'Since you started, your overall score has gone from ' + fmt.num(q.checkinAvg(first), 1) +
        ' to ' + fmt.num(q.checkinAvg(last), 1) + ' out of 10.';
    }
    if (panels.length > 1) {
      var t0 = q.result(panels[0].id, 'total_testosterone'), t1 = q.result(panels[panels.length - 1].id, 'total_testosterone');
      if (t0 && t1) draft += ' Your total testosterone has moved from ' + t0.value_numeric + ' to ' + t1.value_numeric + ' ng/dL.';
    }
    ui.modal({
      title: 'Publish a plain-language summary',
      sub: 'Goes to his app. He never sees a raw clinical note.',
      body: '<div class="field"><label for="ps_body">Summary</label>' +
        '<textarea id="ps_body" style="min-height:140px">' + esc(draft) + '</textarea>' +
        '<div class="hint">Pre-drafted from his own data. Edit before publishing.</div></div>' +
        '<div class="note-band" style="margin-top:1rem">His notification will read ' +
        '<b>“Gameday: you have an update”</b>. Nothing clinical in the preview, ever.</div>',
      actions: '<button class="btn ghost" data-act="close-modal">Cancel</button>' +
        '<button class="btn primary" data-act="ps-send" data-id="' + data.id + '">Publish</button>'
    });
  });
  ui.act('ps-send', function (data) {
    var body = (document.getElementById('ps_body') || {}).value.trim();
    if (!body) return ui.toast('Nothing to publish.', 'warn');
    var thread = q.threadFor(data.id);
    if (!thread) thread = GD.store.add('message_threads', { patient_id: data.id, triage_tag: 'clinical',
      status: 'open', assigned_to: 'stf_prov_01', last_at: GD.store.today(), unread_staff: 0 });
    GD.store.add('messages', { thread_id: thread.id, sender_type: 'staff', sender_id: 'stf_prov_01',
      body: body, sent_at: GD.store.today(), read_at: null });
    GD.store.add('automation_runs', { rule_key: 'summary_published', patient_id: data.id,
      triggered_at: GD.store.today(), channel: 'push', status: 'logged_not_sent',
      payload_preview: 'Gameday: you have an update.' });
    ui.closeModal();
    ui.toast('Published to his app', 'ok');
    ui.refresh();
  });

  /* =============================================================== lab entry */

  ui.act('lab-entry-for', function (data) {
    GD.store.pref('labPatient', data.id);
    ui.go('staff/labs');
  });

  ui.register('staff/labs', {
    title: 'Lab entry',
    crumb: 'Clinical',
    primary: function () { return '<button class="btn primary" data-act="lab-save">Save panel</button>'; },
    render: function () {
      var pid = GD.store.pref('labPatient') || ui.patientId();
      var p = q.patient(pid) || q.patients()[0];
      var draft = GD.store.pref('labDraft') || {};
      var prev = q.latestPanel(p.id);

      /* Manual structured entry is the design assumption, not a fallback.
         Most projects of this shape die trying to integrate HL7 on day one.
         So the grid has to be genuinely fast: tab across, Enter down, live
         flagging, previous value in view. Time the provider doing this. */
      return ui.card({
        eyebrow: 'Manual structured entry',
        title: 'Enter a panel',
        sub: 'Tab moves down the column. Values flag live against reference and target ranges as you type.',
        aside: '<div class="row tight">' +
          '<select data-act="lab-patient" aria-label="Patient">' +
            q.patients().map(function (x) {
              return '<option value="' + x.id + '"' + (x.id === p.id ? ' selected' : '') + '>' + esc(q.name(x)) + '</option>';
            }).join('') + '</select>' +
          '<input type="date" id="lab_date" value="' + GD.store.today() + '" aria-label="Drawn date">' +
          '</div>',
        body: (prev ? '<div class="note-band" style="margin-bottom:1rem">Previous panel ' +
            esc(fmt.date(prev.drawn_at, 'long')) + ' · shown in the "Last" column for comparison.</div>' : '') +
          '<div class="table-scroll"><table class="labgrid"><thead><tr>' +
          '<th>Analyte</th><th class="num">Last</th><th>Value</th><th>Unit</th><th>Reference</th><th>Target</th><th>Flag</th>' +
          '</tr></thead><tbody>' +
          q.analytes().map(function (a) {
            var last = prev ? q.result(prev.id, a.key) : null;
            var val = draft[a.key];
            var flag = val !== undefined && val !== '' ? q.flagFor(a.key, val) : null;
            return '<tr data-flag="' + (flag || '') + '" id="row_' + a.key + '">' +
              '<td class="an">' + esc(a.label) + (a.safety ? ' ' + ui.pill('safety', 'info') : '') + '</td>' +
              '<td class="num dim">' + (last ? fmt.num(last.value_numeric) : '—') + '</td>' +
              '<td><input type="number" step="any" inputmode="decimal" data-act-input="lab-type" ' +
                'data-an="' + a.key + '" value="' + (val === undefined ? '' : val) + '" ' +
                'aria-label="' + esc(a.label) + '"></td>' +
              '<td class="rng">' + esc(a.unit) + '</td>' +
              '<td class="rng">' + fmt.num(a.refLow) + '–' + fmt.num(a.refHigh) + '</td>' +
              '<td class="rng">' + fmt.num(a.targetLow) + '–' + fmt.num(a.targetHigh) + '</td>' +
              '<td id="flag_' + a.key + '">' + flagPill(flag) + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<div class="field" style="margin-top:1rem"><label for="lab_note">Panel note</label>' +
          '<input type="text" id="lab_note" placeholder="e.g. Week 7 recheck. Dose increased to 120mg weekly."></div>' +
          '<div class="row" style="margin-top:1.2rem">' +
          '<button class="btn primary" data-act="lab-save">Save panel</button>' +
          '<button class="btn ghost" data-act="lab-clear">Clear</button>' +
          '<span class="dim" style="font-size:.8rem">' + Object.keys(draft).filter(function (k) { return draft[k] !== ''; }).length +
          ' of ' + q.analytes().length + ' filled</span></div>' +
          '<div class="note-band warn" style="margin-top:1rem">Ranges here are provisional placeholders. ' +
          'Ask the provider which analytes they actually track and which they never use — that conversation ' +
          'validates or kills this seed list.</div>'
      });
    },
    after: function () {
      // Enter moves down the column, which is how anyone typing a paper panel
      // actually works. Tab still moves across for mouse-free correction.
      var inputs = Array.prototype.slice.call(document.querySelectorAll('.labgrid input'));
      inputs.forEach(function (el, i) {
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); if (inputs[i + 1]) inputs[i + 1].focus(); }
          if (e.key === 'ArrowDown') { e.preventDefault(); if (inputs[i + 1]) inputs[i + 1].focus(); }
          if (e.key === 'ArrowUp') { e.preventDefault(); if (inputs[i - 1]) inputs[i - 1].focus(); }
        });
      });
      if (inputs[0] && !GD.store.pref('labDraft')) inputs[0].focus();
    }
  });

  function flagPill(flag) {
    if (!flag) return '<span class="dim">—</span>';
    var map = {
      in_range: ['in range', 'ok'], below_target: ['below target', 'warn'], above_target: ['above target', 'warn'],
      below_ref: ['below ref', 'warn'], above_ref: ['above ref', 'warn'], critical: ['CRITICAL', 'critical']
    };
    var m = map[flag] || [flag, ''];
    return ui.pill(m[0], m[1]);
  }

  ui.act('lab-type', function (data, el) {
    var draft = Object.assign({}, GD.store.pref('labDraft') || {});
    draft[data.an] = el.value;
    GD.store.pref('labDraft', draft);
    // Update the flag in place rather than re-rendering — re-rendering would
    // steal focus mid-panel, which is how a data-entry grid gets abandoned.
    var flag = el.value === '' ? null : q.flagFor(data.an, el.value);
    var cell = document.getElementById('flag_' + data.an);
    var row = document.getElementById('row_' + data.an);
    if (cell) cell.innerHTML = flagPill(flag);
    if (row) row.setAttribute('data-flag', flag || '');
  });

  ui.act('lab-patient', function (data, el) {
    GD.store.pref('labPatient', el.value);
    GD.store.pref('labDraft', {});
    ui.refresh();
  });
  ui.act('lab-clear', function () { GD.store.pref('labDraft', {}); ui.refresh(); });

  ui.act('lab-save', function () {
    var pid = GD.store.pref('labPatient') || ui.patientId();
    var draft = GD.store.pref('labDraft') || {};
    var filled = Object.keys(draft).filter(function (k) { return draft[k] !== '' && draft[k] !== undefined; });
    if (!filled.length) return ui.toast('No values entered yet.', 'warn');

    var drawn = (document.getElementById('lab_date') || {}).value || GD.store.today();
    var note = (document.getElementById('lab_note') || {}).value || null;
    var panel = GD.store.add('lab_panels', {
      patient_id: pid, drawn_at: drawn, source: 'in_clinic',
      entered_by: 'stf_prov_01', document_ref: null, note: note
    });

    var critical = [];
    filled.forEach(function (key) {
      var a = q.analyte(key);
      var value = Number(draft[key]);
      var flag = q.flagFor(key, value);
      if (flag === 'critical' || flag === 'above_ref' || flag === 'below_ref') critical.push(a.label + ' ' + value + ' ' + a.unit);
      GD.store.add('lab_results', {
        panel_id: panel.id, analyte: key, value_numeric: value, unit: a.unit,
        ref_low: a.refLow, ref_high: a.refHigh, target_low: a.targetLow, target_high: a.targetHigh,
        flag: flag, provisional_ranges: true
      });
    });

    GD.store.pref('labDraft', {});
    ui.toast(filled.length + ' values saved' + (critical.length ? ' · ' + critical.length + ' flagged' : ''),
      critical.length ? 'warn' : 'ok');
    if (critical.length) {
      GD.store.add('tasks', { title: 'Review flagged values — ' + q.name(q.patient(pid)),
        patient_id: pid, assigned_to: 'stf_prov_01', due: GD.store.today(),
        priority: 'high', source: 'lab_entry', done: false });
    }
    ui.go('staff/patient/' + pid);
  });

  /* ============================================================ safety queue */

  ui.register('staff/safety', {
    title: 'Safety queue',
    crumb: 'Clinical',
    render: function () {
      var rows = q.safetyQueue();
      if (!rows.length) return ui.empty({ icon: '✓', title: 'Nothing flagged',
        body: 'Hematocrit, PSA velocity, estradiol, overdue monitoring, and unread check-in notes all surface here automatically.' });
      return '<div class="note-band warn" style="margin-bottom:1.2rem">' +
        '<b>Every threshold below is a provisional placeholder.</b> Hematocrit ceiling 52%, PSA velocity 0.75 ng/mL/yr. ' +
        'Get the clinic’s real numbers before production — do not ship our assumptions.</div>' +
        rows.map(function (r) {
          var p = r.patient;
          return ui.card({
            tone: r.severity === 2 ? 'critical' : 'warn',
            eyebrow: r.severity === 2 ? 'Needs review now' : 'Watch',
            title: q.name(p),
            sub: 'Last panel ' + fmt.date(r.panel.drawn_at, 'long'),
            aside: '<div class="row tight">' +
              '<button class="btn sm" data-act="open-patient" data-id="' + p.id + '">Chart</button>' +
              '<button class="btn sm primary" data-act="safety-task" data-id="' + p.id + '">Create task</button></div>',
            body: '<div class="list">' + r.items.map(function (i) {
              return '<div class="item" data-tone="' + i.tone + '"><span class="body">' +
                '<span class="ttl">' + esc(i.text) + '</span>' +
                (i.note ? '<span class="sub">“' + esc(i.note) + '”</span>' : '') +
                '</span>' + (i.analyte ? '<span class="side">' +
                  GD.charts.spark(q.analyteSeries(p.id, i.analyte).map(function (s) { return s.value; }),
                    { color: 'var(--gd-below)', width: 88 }) + '</span>' : '') + '</div>';
            }).join('') + '</div>'
          });
        }).join('');
    }
  });

  ui.act('safety-task', function (data) {
    var p = q.patient(data.id);
    GD.store.add('tasks', { title: 'Safety review — ' + q.name(p), patient_id: p.id,
      assigned_to: 'stf_prov_01', due: GD.store.today(), priority: 'high', source: 'safety_queue', done: false });
    ui.toast('Task created for the provider', 'ok');
    ui.refresh();
  });

  /* =========================================================== due for labs */

  ui.register('staff/due', {
    title: 'Due for labs',
    crumb: 'Clinical',
    render: function () {
      var rows = q.dueForLabs();
      if (!rows.length) return ui.empty({ icon: '⏱', title: 'Nobody due',
        body: 'Recheck at 7 weeks, then quarterly. Patients appear here two weeks before they are due.' });
      var overdue = rows.filter(function (r) { return r.due.overdueDays > 0; });
      return '<div class="grid g3" style="margin-bottom:1.2rem">' +
        ui.stat({ label: 'Overdue', value: overdue.length, note: 'Clinical necessity and a revenue event at once' }) +
        ui.stat({ label: 'Due soon', value: rows.length - overdue.length }) +
        ui.stat({ label: 'Potential draws', value: fmt.money(rows.length * 0, { compact: true }) === '$0' ? rows.length : rows.length,
          unit: 'visits' }) +
        '</div>' +
        ui.card({ flush: true, title: 'Who and why', body: '<div class="list">' + rows.map(function (r) {
          var od = r.due.overdueDays;
          return '<div class="item" data-tone="' + (od > 14 ? 'critical' : od > 0 ? 'warn' : '') + '">' +
            GD.media.avatarHtml('patient:' + r.patient.id + ':avatar', q.name(r.patient)) +
            '<span class="body"><span class="ttl">' + esc(q.name(r.patient)) + '</span>' +
            '<span class="sub">' + esc(r.due.reason) + ' · due ' + esc(fmt.date(r.due.dueOn, 'long')) +
            (od > 0 ? ' · <b>' + od + ' days overdue</b>' : '') + '</span></span>' +
            '<span class="side row tight">' +
            '<button class="btn sm primary" data-act="book-labs" data-id="' + r.patient.id + '">Book draw</button>' +
            '<button class="btn sm ghost" data-act="open-patient" data-id="' + r.patient.id + '">Chart</button>' +
            '</span></div>';
        }).join('') + '</div>' });
    }
  });

  ui.act('book-labs', function (data) {
    var appt = { patient_id: data.id, status: 'complete' };
    rebookPrompt(appt);
  });

  /* ================================================================ pipeline */

  ui.register('staff/pipeline', {
    title: 'Pipeline',
    crumb: 'Owner',
    width: 'wide',
    render: function () {
      var attribution = q.attribution();
      var stl = q.speedToLead();
      var cohorts = q.churnCohorts();
      var maxRev = Math.max.apply(null, attribution.map(function (a) { return a.revenue_cents; })) || 1;

      return '<div class="grid g2">' +
        ui.card({ eyebrow: 'Funnel', title: 'Lead to active member',
          body: GD.charts.funnel(q.funnel()) }) +
        ui.card({ eyebrow: 'First response', title: stl.pct + '% of leads answered',
          sub: stl.unanswered + ' never got a reply at all.',
          body: GD.charts.bars([
            { label: 'Answered', value: stl.answered, display: stl.answered, color: 'var(--gd-in-range)' },
            { label: 'Never answered', value: stl.unanswered, display: stl.unanswered, color: 'var(--gd-critical)' }
          ]) +
          '<div class="note-band" style="margin-top:1rem">Speed-to-lead SMS under 60 seconds is the highest-ROI ' +
          'single intervention available while the corporate form remains a callback queue.</div>' }) +
        '</div>' +

        /* The 16 form options already exist on the corporate site and the data
           goes nowhere. Wiring source to realised revenue is the first time
           the owner can answer "does the billboard work". */
        ui.card({
          eyebrow: 'Attribution',
          title: 'Which sources actually turn into revenue',
          sub: 'The corporate form has asked "how did you hear about us" across 16 options this whole time. This is that data, finally connected to money.',
          body: '<div class="table-scroll"><table><thead><tr><th>Source</th><th class="num">Leads</th>' +
            '<th class="num">Booked</th><th class="num">Converted</th><th class="num">Conv. rate</th>' +
            '<th class="num">Revenue</th><th>Share</th></tr></thead><tbody>' +
            attribution.map(function (a) {
              var rate = a.leads ? Math.round((a.converted / a.leads) * 100) : 0;
              return '<tr><td><b>' + esc(fmt.title(a.source)) + '</b></td>' +
                '<td class="num">' + a.leads + '</td><td class="num">' + a.booked + '</td>' +
                '<td class="num">' + a.converted + '</td>' +
                '<td class="num ' + (rate >= 50 ? 'up' : rate === 0 ? 'dim' : '') + '">' + rate + '%</td>' +
                '<td class="num"><b>' + fmt.money(a.revenue_cents) + '</b></td>' +
                '<td><div class="bar" style="width:110px"><i style="width:' +
                  ((a.revenue_cents / maxRev) * 100).toFixed(0) + '%"></i></div></td></tr>';
            }).join('') + '</tbody></table></div>' +
            '<div class="note-band" style="margin-top:1rem">Synthetic data, so the ranking is meaningless — ' +
            'the <b>shape of the answer</b> is the point. LTV by source lands in Phase C once there is real history.</div>'
        }) +

        ui.card({
          eyebrow: 'Churn',
          title: 'Why members actually cancel',
          sub: 'Compare this to what you believe the reasons are. The gap between the two is the argument for the whole retention engine.',
          body: (cohorts.length
            ? GD.charts.bars(cohorts.map(function (c) {
                return { label: fmt.title(c.reason), value: c.n, display: c.n + ' · avg ' + c.avgMonths + ' mo' };
              })) +
              cohorts.filter(function (c) { return c.notes.length; }).map(function (c) {
                return '<div class="note-band" style="margin-top:.8rem"><b>' + esc(fmt.title(c.reason)) + ':</b> “' +
                  esc(c.notes[0]) + '”</div>';
              }).join('')
            : '<div class="note-band">No cancellations in the dataset yet.</div>')
        });
    }
  });

  /* =============================================================== retention */

  ui.register('staff/retention', {
    title: 'Retention',
    crumb: 'Owner',
    width: 'wide',
    render: function () {
      var rows = q.atRisk();
      var months = q.avgMonthsOnProtocol();
      var plateaued = q.patients().filter(function (p) { return q.plateauWeeks(p.id) >= 5; });
      var silent = q.patients().filter(function (p) {
        var d = q.daysSinceCheckin(p.id); return d !== null && d >= 21;
      });

      return '<div class="grid g4">' +
        ui.stat({ label: 'Avg months on protocol', value: months, hero: true,
          note: 'Every extra month is pure margin' }) +
        ui.stat({ label: 'At risk now', value: rows.length }) +
        ui.stat({ label: 'Scores plateaued', value: plateaued.length, note: 'Improved, then flat — the cancellation shape' }) +
        ui.stat({ label: 'Silent 21+ days', value: silent.length, note: 'Earliest reliable churn signal' }) +
        '</div>' +

        ui.card({
          eyebrow: 'Monday morning list',
          title: 'At risk, with the reason on every row',
          sub: 'If you would not do anything with a row, the row should not be here. Tell us which ones are noise.',
          body: rows.length ? '<div class="list">' + rows.map(function (r) {
            return '<div class="item" data-tone="' + (r.severity === 2 ? 'critical' : 'warn') + '">' +
              GD.media.avatarHtml('patient:' + r.patient.id + ':avatar', q.name(r.patient)) +
              '<span class="body"><span class="ttl">' + esc(q.name(r.patient)) + ' ' +
              r.reasons.map(function (x) { return ui.pill(x.text, x.tone); }).join(' ') + '</span>' +
              '<span class="sub">' + esc(GD.rosterNote[r.patient.id] || '') + '</span></span>' +
              '<span class="side row tight">' +
              '<button class="btn sm primary" data-act="publish-summary" data-id="' + r.patient.id + '">Send progress</button>' +
              '<button class="btn sm" data-act="open-patient" data-id="' + r.patient.id + '">Chart</button>' +
              '</span></div>';
          }).join('') + '</div>' : '<div class="note-band">Nobody flagged.</div>'
        }) +

        /* The whole product thesis, stated where the owner is looking at churn. */
        ui.card({
          eyebrow: 'Why this works',
          title: 'Month four feels like month one',
          body: '<p class="muted" style="font-size:.9rem;line-height:1.6">Men do not cancel because they forgot to rebook. ' +
            'They cancel because hormone therapy improvements are real but gradual, and the improved state becomes ' +
            'the new normal. He loses the contrast against where he started, concludes it stopped working, and leaves — ' +
            'while his own data says he is substantially better off.</p>' +
            '<p class="muted" style="font-size:.9rem;line-height:1.6;margin-top:.8rem">The counter is evidence: charted scores, ' +
            'charted labs, dose markers on the same axis, and photos. Everything in this build is ranked against ' +
            'whether it makes improvement visible.</p>' +
            '<button class="btn primary" style="margin-top:1rem" data-act="go" data-to="patient/stats" ' +
            'data-patient="p_04_doubter">Open the doubter’s ' + esc(W('statSheet')) + '</button>'
        });
    }
  });

  /* ============================================================= automations */

  ui.register('staff/automations', {
    title: 'Automations',
    crumb: 'Growth',
    width: 'wide',
    render: function () {
      var rules = [
        { key: 'speed_to_lead', name: 'Speed to lead', trigger: 'New lead submitted', action: 'SMS with a booking link within 60 seconds', why: 'Response time is the conversion rate', on: true },
        { key: 'missed_call_textback', name: 'Missed-call text-back', trigger: 'Inbound call unanswered', action: 'Auto text offering to book', why: 'Recovers the caller who would ring the next clinic', on: true },
        { key: 'intake_incomplete_t24', name: 'Intake chase', trigger: 'Intake incomplete at T-24h', action: 'SMS with the intake link', why: 'Protects the 45-minute visit', on: true },
        { key: 'no_show_recovery', name: 'No-show recovery', trigger: 'Marked no-show', action: 'Same-day outreach, then 72h', why: 'No-shows are recoverable and nobody has time to chase manually', on: true },
        { key: 'consulted_no_convert', name: 'Consulted, did not convert', trigger: 'Consult complete, no membership in 3 days', action: '3-touch nurture over 14 days', why: 'Largest untapped pool in the business', on: false },
        { key: 'due_for_labs', name: 'Due for labs', trigger: '7 weeks, then quarterly', action: 'Prompt with one-tap booking', why: 'Clinical necessity and a revenue event at once', on: true },
        { key: 'no_checkin_21d', name: 'Silent 21 days', trigger: 'No check-in for 21 days', action: 'Gentle nudge, then a staff task', why: 'Earliest reliable churn signal', on: true },
        { key: 'month_3_progress', name: 'Month-3 progress push', trigger: 'Membership hits 3 months', action: 'Progress summary to his app', why: 'Intervenes exactly where churn concentrates', on: true },
        { key: 'payment_failed_retry', name: 'Failed-payment retry', trigger: 'Charge declined', action: 'Retry sequence and notify front desk', why: 'Involuntary churn is pure waste', on: true },
        { key: 'post_visit_review', name: 'Review request', trigger: 'Visit complete', action: 'Satisfaction-routed review ask', why: 'Fix the NAP conflict first or reviews land on the wrong listing', on: false }
      ];
      var runs = q.automationRuns();

      return '<div class="note-band critical" style="margin-bottom:1.2rem">' +
        '<b>Nothing here has ever been sent.</b> PILOT_MODE logs every message instead of transmitting it. ' +
        'No SMS credentials, no email credentials, no live Stripe keys exist in this build.</div>' +

        ui.card({
          flush: true,
          title: 'Rules',
          sub: 'Mark the ones you would actually switch on. The ones you would not are as useful to know about.',
          body: '<div class="table-scroll"><table><thead><tr><th>Rule</th><th>Trigger</th><th>Action</th>' +
            '<th>Why it exists</th><th>Pilot</th></tr></thead><tbody>' +
            rules.map(function (r) {
              return '<tr><td><b>' + esc(r.name) + '</b></td><td class="dim">' + esc(r.trigger) + '</td>' +
                '<td>' + esc(r.action) + '</td><td class="dim" style="max-width:26ch">' + esc(r.why) + '</td>' +
                '<td>' + (r.on ? ui.pill('logging', 'ok') : ui.pill('off')) + '</td></tr>';
            }).join('') + '</tbody></table></div>'
        }) +

        /* Every patient-facing preview is checked against the banned-terms list.
           Clinical content on a lock screen is the single biggest privacy risk
           in a product like this, so it is validated, not remembered. */
        ui.card({
          eyebrow: 'Message log',
          title: 'What would have gone out',
          sub: 'Each preview is checked for clinical content. A lock-screen preview naming a therapy is a disclosure.',
          body: '<div class="list">' + runs.map(function (r) {
            var check = q.previewSafe(r.payload_preview);
            var who = r.patient_id ? q.name(q.patient(r.patient_id)) : (r.lead_id || 'Lead');
            return '<div class="item" data-tone="' + (check.safe ? '' : 'critical') + '">' +
              '<span class="body"><span class="ttl">' + esc(fmt.title(r.rule_key)) + ' ' +
                ui.pill(r.channel, 'info') +
                (check.safe ? ui.pill('preview safe', 'ok') : ui.pill('LEAKS: ' + check.offending.join(', '), 'critical')) +
                '</span>' +
              '<span class="sub">' + esc(who) + ' · ' + esc(fmt.ago(r.triggered_at)) +
                (r.latency_seconds ? ' · responded in ' + r.latency_seconds + 's' : '') + '</span>' +
              '<span class="sub" style="color:var(--gd-text);margin-top:.3rem">“' + esc(r.payload_preview) + '”</span>' +
              '</span><span class="side">' + ui.pill('not sent', 'warn') + '</span></div>';
          }).join('') + '</div>'
        }) +

        ui.card({
          eyebrow: 'TCPA',
          title: 'Consent evidence on every message',
          body: '<p class="muted" style="font-size:.88rem;line-height:1.6">Every lead row stores the consent text version ' +
            'shown, the timestamp, and the IP. Marketing SMS and transactional SMS are separate consents, because they ' +
            'legally are. Without this evidence trail, an SMS programme is a liability rather than a growth channel.</p>' +
            '<div class="table-scroll" style="margin-top:1rem"><table><thead><tr><th>Lead</th><th>Source</th>' +
            '<th>Transactional</th><th>Marketing</th><th>Captured</th><th>Text version</th></tr></thead><tbody>' +
            q.leads().slice(0, 6).map(function (l) {
              return '<tr><td>' + esc(l.name) + '</td><td class="dim">' + esc(fmt.title(l.source)) + '</td>' +
                '<td>' + (l.consent_transactional_sms ? ui.pill('yes', 'ok') : ui.pill('no', 'critical')) + '</td>' +
                '<td>' + (l.consent_marketing_sms ? ui.pill('yes', 'ok') : ui.pill('no')) + '</td>' +
                '<td class="dim">' + esc(fmt.date(l.consent_captured_at)) + '</td>' +
                '<td class="dim">' + esc(l.consent_text_shown) + '</td></tr>';
            }).join('') + '</tbody></table></div>'
        });
    }
  });

  /* ================================================================ checkout */

  ui.register('staff/checkout', {
    title: 'Checkout',
    crumb: 'Front desk',
    render: function () {
      var cart = GD.store.pref('cart') || { patient_id: null, lines: [] };
      var p = cart.patient_id ? q.patient(cart.patient_id) : null;
      var subtotal = cart.lines.reduce(function (s, l) { return s + l.price_cents * l.qty; }, 0);

      if (!p) {
        var arrived = q.apptsToday().filter(function (a) { return a.patient_id; });
        return ui.card({
          eyebrow: 'Step 1',
          title: 'Who are you checking out?',
          body: '<div class="list">' + (arrived.length ? arrived.map(function (a) {
            var pt = q.patient(a.patient_id);
            return '<button class="item" data-act="cart-patient" data-id="' + pt.id + '">' +
              GD.media.avatarHtml('patient:' + pt.id + ':avatar', q.name(pt)) +
              '<span class="body"><span class="ttl">' + esc(q.name(pt)) + '</span>' +
              '<span class="sub">' + esc(fmt.time(a.starts_at) + ' · ' + q.apptLabel(a)) + '</span></span>' +
              '<span class="side">' + esc(fmt.title(a.status)) + '</span></button>';
          }).join('') : '') +
          q.patients().map(function (pt) {
            return '<button class="item" data-act="cart-patient" data-id="' + pt.id + '">' +
              GD.media.avatarHtml('patient:' + pt.id + ':avatar', q.name(pt)) +
              '<span class="body"><span class="ttl">' + esc(q.name(pt)) + '</span>' +
              '<span class="sub">' + esc(GD.rosterNote[pt.id] || '') + '</span></span></button>';
          }).join('') + '</div>'
        });
      }

      var services = q.services().filter(function (s) { return s.price_cents > 0; });
      return '<div class="grid g2">' +
        ui.card({
          eyebrow: 'Add to the visit',
          title: 'Services and add-ons',
          body: '<div class="list" style="max-height:460px;overflow-y:auto">' + services.map(function (s) {
            return '<button class="item" data-act="cart-add" data-id="' + s.id + '">' +
              '<span class="body"><span class="ttl">' + esc(s.name) + '</span>' +
              '<span class="sub">' + esc(fmt.title(s.category)) + ' · ' + s.duration_min + ' min</span></span>' +
              '<span class="side"><b>' + fmt.money(s.price_cents) + '</b></span></button>';
          }).join('') + '</div>'
        }) +
        ui.card({
          eyebrow: q.name(p),
          title: 'Cart',
          aside: '<button class="btn sm ghost" data-act="cart-clear">Start over</button>',
          body: (cart.lines.length
            ? '<div class="list">' + cart.lines.map(function (l, i) {
                return '<div class="item"><span class="body"><span class="ttl">' + esc(l.name) + '</span>' +
                  '<span class="sub">' + fmt.money(l.price_cents) + ' × ' + l.qty + '</span></span>' +
                  '<span class="side row tight"><b>' + fmt.money(l.price_cents * l.qty) + '</b>' +
                  '<button class="btn sm ghost" data-act="cart-remove" data-i="' + i + '">×</button></span></div>';
              }).join('') + '</div>'
            : '<div class="note-band">Nothing added yet.</div>') +
            '<dl class="kv" style="margin-top:1.2rem;font-size:1rem">' +
            '<dt>Subtotal</dt><dd class="num"><b>' + fmt.money(subtotal) + '</b></dd></dl>' +
            '<button class="btn primary big block" style="margin-top:1rem" data-act="cart-pay" ' +
              (subtotal ? '' : 'disabled') + '>Take payment</button>' +
            '<div class="note-band" style="margin-top:1rem">Card statement will read ' +
            '<b>GAMEDAY THORNTON - MEMBERSHIP</b>. No service name, no therapy name, no reason code — ' +
            'nothing clinical reaches the processor.</div>'
        }) + '</div>';
    }
  });

  ui.act('cart-patient', function (data) {
    GD.store.pref('cart', { patient_id: data.id, lines: [] }); ui.refresh();
  });
  ui.act('cart-add', function (data) {
    var cart = GD.store.pref('cart') || { lines: [] };
    var s = q.service(data.id);
    var existing = cart.lines.filter(function (l) { return l.service_id === s.id; })[0];
    if (existing) existing.qty++;
    else cart.lines.push({ service_id: s.id, name: s.name, price_cents: s.price_cents, qty: 1 });
    GD.store.pref('cart', cart); ui.refresh();
  });
  ui.act('cart-remove', function (data) {
    var cart = GD.store.pref('cart');
    cart.lines.splice(Number(data.i), 1);
    GD.store.pref('cart', cart); ui.refresh();
  });
  ui.act('cart-clear', function () { GD.store.pref('cart', { patient_id: null, lines: [] }); ui.refresh(); });
  ui.act('cart-pay', function () {
    var cart = GD.store.pref('cart');
    var total = cart.lines.reduce(function (s, l) { return s + l.price_cents * l.qty; }, 0);
    GD.store.add('payments', { patient_id: cart.patient_id, amount_cents: total, type: 'visit',
      processor_ref: 'test_pi_' + Date.now().toString(36),
      descriptor: 'GAMEDAY THORNTON - MEMBERSHIP', status: 'succeeded', created_at: GD.store.today() });
    GD.store.pref('cart', { patient_id: null, lines: [] });
    ui.toast(fmt.money(total) + ' charged (Stripe test mode)', 'ok');
    // Rebook prompt fires immediately, while he is still at the counter.
    rebookPrompt({ patient_id: cart.patient_id, status: 'complete' });
  });

  /* ================================================================ messages */

  ui.register('staff/messages', {
    title: 'Messages',
    crumb: 'Front desk',
    width: 'wide',
    render: function () {
      var threads = q.threads();
      var calls = q.missedCalls();
      var wait = q.waitlist();
      return '<div class="grid g2">' +
        ui.card({
          flush: true,
          title: 'Threads',
          sub: 'Tagged by the patient at send time, so nothing lands in a shared inbox nobody owns.',
          body: '<div class="list">' + threads.map(function (t) {
            var p = q.patient(t.patient_id);
            var msgs = q.messagesIn(t.id);
            var last = msgs[msgs.length - 1];
            return '<button class="item" data-act="open-patient" data-id="' + t.patient_id + '" ' +
              'data-tone="' + (t.unread_staff ? 'warn' : '') + '">' +
              GD.media.avatarHtml('patient:' + t.patient_id + ':avatar', q.name(p)) +
              '<span class="body"><span class="ttl">' + esc(q.name(p)) + ' ' +
                ui.pill(t.triage_tag, t.triage_tag === 'clinical' ? 'critical' : t.triage_tag === 'billing' ? 'warn' : 'info') +
                (t.unread_staff ? ui.pill('unread', 'accent') : '') + '</span>' +
              '<span class="sub">' + esc(last ? last.body.slice(0, 90) : '') + '</span></span>' +
              '<span class="side">' + esc(fmt.ago(t.last_at)) + '</span></button>';
          }).join('') + '</div>'
        }) +
        '<div>' +
        ui.card({
          eyebrow: 'Phones',
          title: 'Missed calls',
          sub: 'Two numbers are already in use — voice and text are separate lines.',
          body: '<div class="list">' + calls.map(function (c) {
            return '<div class="item" data-tone="' + (c.status === 'needs_callback' ? 'critical' : '') + '">' +
              '<span class="body"><span class="ttl">' + esc(fmt.phone(c.from_number)) + '</span>' +
              '<span class="sub">' + esc(fmt.ago(c.received_at)) + ' · ' +
              (c.textback_sent ? 'auto text logged' : 'no text-back') + '</span></span>' +
              '<span class="side">' + ui.pill(fmt.title(c.status), c.status === 'booked' ? 'ok' : 'warn') + '</span></div>';
          }).join('') + '</div>'
        }) +
        ui.card({
          eyebrow: 'Waitlist',
          title: wait.length + ' waiting',
          sub: 'On a cancellation, one tap offers the slot to the next man up.',
          body: '<div class="list">' + wait.map(function (w) {
            var name = w.patient_id ? q.name(q.patient(w.patient_id)) : w.patient_display;
            return '<div class="item"><span class="body"><span class="ttl">' + esc(name) + '</span>' +
              '<span class="sub">' + esc((q.service(w.service_id) || {}).name || '') + ' · ' +
              esc(w.preferred_window) + '</span></span>' +
              '<span class="side"><button class="btn sm primary" data-act="offer-slot" data-id="' + w.id + '">Offer slot</button></span></div>';
          }).join('') + '</div>'
        }) +
        '</div></div>';
    }
  });

  ui.act('offer-slot', function (data) {
    GD.store.patch('waitlist', data.id, { status: 'offered' });
    GD.store.add('automation_runs', { rule_key: 'waitlist_offer', patient_id: null,
      triggered_at: GD.store.today(), channel: 'sms', status: 'logged_not_sent',
      payload_preview: 'Gameday: a slot opened up. Tap to take it: [link]' });
    ui.toast('Offer logged (not sent — pilot mode)', 'ok');
    ui.refresh();
  });

  /* =============================================================== inventory */

  ui.register('staff/inventory', {
    title: 'Inventory',
    crumb: 'Back office',
    width: 'wide',
    render: function () {
      var rows = q.inventory();
      var low = rows.filter(function (r) { return r.low; });
      var exp = rows.filter(function (r) { return r.expiringSoon; });
      return '<div class="note-band critical" style="margin-bottom:1.2rem">' +
        '<b>This is not a DEA-facing record.</b> The controlled-substance log can be built and tested on synthetic ' +
        'data, but it must not become the clinic’s actual regulatory record until Phase C and a legal review. ' +
        'Testosterone is Schedule III and the record-keeping obligations are real.</div>' +

        '<div class="grid g3" style="margin-bottom:1.2rem">' +
        ui.stat({ label: 'Items tracked', value: rows.length }) +
        ui.stat({ label: 'Below reorder point', value: low.length, note: low.length ? 'Reorder list below' : '' }) +
        ui.stat({ label: 'Expiring within 45 days', value: exp.length }) +
        '</div>' +

        ui.card({ flush: true, title: 'On hand', body: '<div class="table-scroll"><table><thead><tr>' +
          '<th>Item</th><th>Schedule</th><th class="num">On hand</th><th class="num">Reorder at</th>' +
          '<th>Soonest expiry</th><th>Lots</th><th>Status</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr><td><b>' + esc(r.item.name) + '</b></td>' +
              '<td>' + (r.item.is_controlled ? ui.pill('C-' + r.item.schedule, 'critical') : '<span class="dim">—</span>') + '</td>' +
              '<td class="num"><b>' + r.onHand + '</b> ' + esc(r.item.unit) + '</td>' +
              '<td class="num dim">' + r.item.reorder_threshold + '</td>' +
              '<td class="num' + (r.expiringSoon ? ' warnc' : '') + '">' +
                (r.soonest ? esc(fmt.date(r.soonest.expiry_date)) + ' (' + r.expiryDays + 'd)' : '—') + '</td>' +
              '<td class="dim">' + r.lots.map(function (l) { return esc(l.lot_number); }).join(', ') + '</td>' +
              '<td>' + (r.low ? ui.pill('reorder', 'critical') : r.expiringSoon ? ui.pill('expiring', 'warn') : ui.pill('ok', 'ok')) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        });
    }
  });
})();
