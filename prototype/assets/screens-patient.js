/* ==========================================================================
   screens-patient.js — GAMEPLAN
   --------------------------------------------------------------------------
   The patient app. Its job in month four is to show him month one.

   Ordering rule for every screen here: the contrast against baseline comes
   before the current value, never after. Hedonic adaptation is the churn
   mechanism, so restoring the contrast is the product, and a screen that
   leads with "your energy is 7" has already failed.
   ========================================================================== */

(function () {
  'use strict';
  var GD = window.GD, ui = GD.ui, q = GD.q, fmt = GD.fmt, esc = GD.esc;

  function W(key) { return GD.brand.word(key); }

  /* ==================================================================== home */

  ui.register('patient/home', {
    app: 'patient',
    render: function () {
      var p = ui.patient();
      var season = q.season(p.id);
      var last = q.lastCheckin(p.id);
      var daysSince = q.daysSinceCheckin(p.id);
      var contrast = q.thenVsNow(p.id);
      var next = q.nextAppt(p.id);
      var dose = q.nextDose(p.id);
      var membership = q.membership(p.id);
      var out = [];

      /* Season progress. Goal gradient: a bounded block with a visible finish
         sustains effort in a way an open-ended subscription does not. */
      if (season) {
        out.push('<section class="card accent"><div class="row between">' +
          '<div><div class="eyebrow">' + esc(GD.brand.seasonLabel(season)) + '</div>' +
          '<div style="font-size:var(--gd-step-1);font-weight:700">' +
            esc(season.months) + ' months in</div></div>' +
          '<div style="text-align:right"><div class="dim" style="font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;font-weight:700">Week</div>' +
          '<div class="num" style="font-size:var(--gd-step-2);font-weight:800;line-height:1">' +
            season.week + '<span class="dim" style="font-size:.5em">/' + season.of + '</span></div></div>' +
          '</div><div class="bar" style="margin-top:.9rem"><i style="width:' +
            ((season.week / season.of) * 100).toFixed(0) + '%"></i></div></section>');
      }

      /* The check-in ask. One screen, sixty seconds, and the only thing on the
         home screen allowed to shout. */
      if (daysSince === null || daysSince >= 6) {
        out.push('<section class="card" style="margin-top:1rem">' +
          '<div class="eyebrow">This week</div>' +
          '<h2 style="font-size:var(--gd-step-1);font-weight:700;margin-bottom:.35rem">How was your week?</h2>' +
          '<p class="muted" style="font-size:.86rem;margin-bottom:1rem">Six sliders, about sixty seconds. ' +
            'This is what puts the lines on your ' + esc(W('statSheet')) + '.</p>' +
          '<button class="btn primary big block" data-act="go" data-to="patient/checkin">Start check-in</button>' +
          (daysSince !== null && daysSince >= 21
            ? '<p class="dim" style="font-size:.78rem;margin-top:.7rem">It has been ' + daysSince +
              ' days since your last one. No judgement — the chart just has a gap in it.</p>' : '') +
          '</section>');
      } else {
        out.push('<section class="card" style="margin-top:1rem"><div class="row between">' +
          '<div><div class="eyebrow quiet">Checked in ' + esc(fmt.ago(last.week_of)) + '</div>' +
          '<div style="font-weight:700">Overall ' + fmt.num(q.checkinAvg(last), 1) + ' / 10</div></div>' +
          '<button class="btn sm" data-act="go" data-to="patient/checkin">Update</button>' +
          '</div></section>');
      }

      /* Then vs now. The whole thesis, above everything operational. */
      if (contrast) {
        var improved = contrast.filter(function (c) { return c.delta > 0; }).length;
        out.push('<section class="contrast" style="margin-top:1rem">' +
          '<h2>Where you started → where you are</h2>' +
          '<div class="cgrid">' + contrast.map(function (c) {
            var cls = c.delta > 0 ? 'up' : c.delta < 0 ? 'down' : 'flat';
            return '<div class="cell"><div class="name">' + esc(c.label) + '</div>' +
              '<div class="vals"><span class="then num">' + c.then + '</span>' +
              '<span class="arrow">→</span><span class="now num ' + cls + '">' + c.now + '</span></div>' +
              '<div class="delta ' + cls + '">' + fmt.signed(c.delta, 0) + ' points</div></div>';
          }).join('') + '</div>' +
          '<p class="dim" style="font-size:.8rem;margin-top:1rem;line-height:1.5">' +
            improved + ' of 6 are up from your first week. ' +
            '<a href="#/patient/stats" style="color:var(--gd-accent);font-weight:600">See the full ' +
            esc(W('statSheet')) + ' →</a></p>' +
          '</section>');
      }

      /* Operational cards below the emotional payload, never above it. */
      var ops = [];
      if (dose) {
        ops.push('<div class="stat"><div class="lab">Next dose</div>' +
          '<div class="stat-val">' + (dose.inDays === 0 ? 'Today' : dose.inDays + '<small> days</small>') + '</div>' +
          '<div class="note">' + esc(dose.item.medication_name + ' ' + dose.item.dose_amount + dose.item.dose_unit) + '</div></div>');
      }
      if (next) {
        ops.push('<div class="stat" data-act="go" data-to="patient/visit" role="button" tabindex="0" style="cursor:pointer">' +
          '<div class="lab">Next visit</div>' +
          '<div class="stat-val" style="font-size:var(--gd-step-1)">' + esc(fmt.date(next.starts_at, 'dow')) + '</div>' +
          '<div class="note">' + esc(fmt.time(next.starts_at) + ' · ' + q.apptLabel(next)) + '</div></div>');
      } else {
        ops.push('<div class="stat" data-act="go" data-to="patient/book" role="button" tabindex="0" style="cursor:pointer">' +
          '<div class="lab">Next visit</div><div class="stat-val" style="font-size:var(--gd-step-1)">Not booked</div>' +
          '<div class="note">Tap to pick a time</div></div>');
      }
      var due = q.labsDue(p.id);
      if (due) {
        ops.push('<div class="stat"><div class="lab">Next labs</div>' +
          '<div class="stat-val" style="font-size:var(--gd-step-1)">' + esc(fmt.date(due.dueOn, 'md')) + '</div>' +
          '<div class="note">' + esc(due.reason) + (due.overdueDays > 0 ? ' · overdue' : '') + '</div></div>');
      }
      out.push('<div class="grid g3" style="margin-top:1rem">' + ops.join('') + '</div>');

      /* A safety item the patient can see. Authority through transparency:
         a clinic that volunteers what it watches for reads as more competent. */
      var safety = q.safetyQueue().filter(function (s) { return s.patient.id === p.id; })[0];
      if (safety) {
        var top = safety.items[0];
        out.push('<section class="card ' + (top.tone === 'critical' ? 'critical' : 'warn') + '" style="margin-top:1rem">' +
          '<div class="eyebrow">Your clinic is watching this</div>' +
          '<p style="font-size:.9rem;line-height:1.55">' + esc(top.text) + '</p>' +
          '<p class="muted" style="font-size:.82rem;margin-top:.6rem">Your provider has already seen this and it is on their list. ' +
          'Monitoring for exactly this is part of what your membership is for.</p>' +
          '<button class="btn sm" style="margin-top:.9rem" data-act="go" data-to="patient/labs">See the trend</button>' +
          '</section>');
      }

      if (membership && membership.status === 'paused') {
        out.push('<section class="card" style="margin-top:1rem"><div class="eyebrow quiet">Membership</div>' +
          '<p class="muted" style="font-size:.88rem">Paused since ' + esc(fmt.date(membership.paused_at)) +
          '. Your history and your chart are all still here.</p>' +
          '<button class="btn sm" style="margin-top:.8rem" data-act="go" data-to="patient/membership">Manage membership</button></section>');
      }

      return out.join('');
    }
  });

  /* ================================================================ check-in */

  ui.register('patient/checkin', {
    app: 'patient',
    render: function () {
      var p = ui.patient();
      var last = q.lastCheckin(p.id);
      var prev = last || {};
      var rows = q.checkinDims.map(function (d) {
        var start = prev[d] || 5;
        return '<div class="slider-row">' +
          '<div class="top"><span class="nm">' + esc(q.dimLabel(d)) + '</span>' +
          '<span><span class="vl" id="v_' + d + '">' + start + '</span>' +
          (prev[d] ? '<span class="lastweek">was ' + prev[d] + '</span>' : '') + '</span></div>' +
          '<input type="range" min="1" max="10" step="1" value="' + start + '" id="in_' + d + '" ' +
          'data-act-input="ci-slide" data-dim="' + d + '" aria-label="' + esc(q.dimLabel(d)) + ' 1 to 10">' +
          '</div>';
      }).join('');

      return ui.card({
        eyebrow: 'Week of ' + fmt.date(GD.store.today(), 'md'),
        title: 'How was your week?',
        sub: '1 is the worst it has been, 10 is the best. Go on instinct — the trend matters far more than any single week.',
        body: rows +
          '<div class="field" style="margin-top:1.2rem">' +
          '<label for="ci_notes">Anything your provider should know? (optional)</label>' +
          '<textarea id="ci_notes" placeholder="Side effects, a question, a bad week — whatever it is." ' +
            'maxlength="600"></textarea>' +
          '<div class="hint">Someone reads this. If it is urgent, call the clinic instead.</div></div>' +
          '<div class="field" style="margin-top:1rem"><label for="ci_missed">Doses missed this week</label>' +
          '<select id="ci_missed"><option value="0">None</option><option value="1">1</option>' +
          '<option value="2">2</option><option value="3">3 or more</option></select></div>' +
          '<button class="btn primary big block" style="margin-top:1.4rem" data-act="ci-submit">Submit check-in</button>' +
          '<p class="dim" style="font-size:.78rem;margin-top:.7rem;text-align:center">Goes straight onto your ' +
            esc(W('statSheet')) + '.</p>'
      });
    }
  });

  ui.act('ci-slide', function (data, el) {
    var out = document.getElementById('v_' + data.dim);
    if (out) out.textContent = el.value;
  });

  ui.act('ci-submit', function () {
    var p = ui.patient();
    var today = GD.store.today();
    var row = {
      patient_id: p.id,
      week_of: today,
      submitted_at: today,
      week_index: q.checkins(p.id).length,
      missed_doses_count: Number((document.getElementById('ci_missed') || {}).value || 0),
      notes_free_text: ((document.getElementById('ci_notes') || {}).value || '').trim() || null
    };
    q.checkinDims.forEach(function (d) {
      var el = document.getElementById('in_' + d);
      row[d] = el ? Number(el.value) : 5;
    });

    // Same-week re-submission replaces rather than duplicates: a man who
    // fixes a slider should not put two points on his own chart.
    var existing = q.checkins(p.id).filter(function (c) { return c.week_of === today; })[0];
    if (existing && existing.created_in_pilot) GD.store.patch('checkins', existing.id, row);
    else GD.store.add('checkins', row);

    var avg = q.checkinAvg(row);
    var first = q.checkins(p.id)[0];
    var baseline = first ? q.checkinAvg(first) : null;
    ui.toast('Check-in saved' + (baseline ? ' · ' + fmt.signed(avg - baseline, 1) + ' vs your first week' : ''), 'ok');
    ui.go('patient/stats');
  });

  /* =============================================================== stat sheet */

  ui.register('patient/stats', {
    app: 'patient',
    render: function () {
      var p = ui.patient();
      var checkins = q.checkins(p.id);
      if (checkins.length < 2) {
        return ui.card({
          title: W('statSheet'),
          body: ui.empty({
            icon: '↗',
            title: 'Two check-ins and this chart turns on',
            body: 'Each weekly check-in adds a point. Once there are a few, this becomes the picture of whether your protocol is working — with your lab draws and every dose change marked on the same timeline.',
            act: 'go', actData: ' data-to="patient/checkin"', actLabel: 'Do this week’s check-in'
          })
        });
      }

      var hidden = GD.store.pref('hiddenDims') || [];
      var series = q.checkinDims.filter(function (d) { return hidden.indexOf(d) === -1; }).map(function (d) {
        return { key: d, label: q.dimLabel(d), color: GD.charts.dimColor(d),
          points: checkins.map(function (c) { return { date: c.week_of, value: c[d] }; }) };
      });
      var baseline = q.checkinAvg(checkins[0]);
      var doseChanges = q.protocolChanges(p.id).map(function (c) {
        return { date: c.changed_at, label: String(c.new_value || '').replace(' weekly', '') };
      });

      var legend = q.checkinDims.map(function (d) {
        var on = hidden.indexOf(d) === -1;
        return '<button class="chip" aria-pressed="' + on + '" data-act="toggle-dim" data-dim="' + d + '">' +
          '<i style="background:' + GD.charts.dimColor(d) + '"></i>' + esc(q.dimLabel(d)) + '</button>';
      }).join('');

      var chart = ui.card({
        eyebrow: 'Every week since you started',
        title: W('statSheet'),
        sub: 'Your scores, your lab draws (blue ticks) and every dose change (red lines) on one timeline — so you can see what actually moved when.',
        body: '<div class="legend" style="margin-bottom:.9rem">' + legend + '</div>' +
          '<div class="chart-scroll animate-in">' + GD.charts.statSheet({
            series: series, labDates: q.panels(p.id).map(function (x) { return x.drawn_at; }),
            doseChanges: doseChanges, baseline: baseline, height: 320
          }) + '</div>' +
          '<p class="dim" style="font-size:.78rem;margin-top:.8rem;line-height:1.5">' +
          'The shaded band is your first week’s average (' + fmt.num(baseline, 1) + '). ' +
          'Everything above it is ground you have gained.</p>'
      });

      var contrast = q.thenVsNow(p.id);
      var band = contrast ? '<section class="contrast" style="margin-top:1rem"><h2>Then → now</h2><div class="cgrid">' +
        contrast.map(function (c) {
          var cls = c.delta > 0 ? 'up' : c.delta < 0 ? 'down' : 'flat';
          return '<div class="cell"><div class="name">' + esc(c.label) + '</div>' +
            '<div class="vals"><span class="then num">' + c.then + '</span><span class="arrow">→</span>' +
            '<span class="now num ' + cls + '">' + c.now + '</span></div>' +
            '<div class="delta ' + cls + '">' + fmt.signed(c.delta, 0) + '</div></div>';
        }).join('') + '</div></section>' : '';

      /* The plateau conversation, had honestly and before he has it alone.
         A flat stretch is real; pretending otherwise loses the trust that the
         whole product runs on. */
      var plateau = q.plateauWeeks(p.id);
      var note = '';
      if (plateau >= 5) {
        var avgNow = q.checkinAvg(checkins[checkins.length - 1]);
        note = '<section class="card" style="margin-top:1rem"><div class="eyebrow quiet">Reading your own chart</div>' +
          '<p style="font-size:.92rem;line-height:1.6">Your scores have been roughly flat for about ' + plateau +
          ' weeks. That is worth saying out loud rather than leaving you to notice it on your own.</p>' +
          '<p class="muted" style="font-size:.88rem;line-height:1.6;margin-top:.6rem">Flat is not the same as back where you started. ' +
          'You are at ' + fmt.num(avgNow, 1) + ' against ' + fmt.num(baseline, 1) + ' in week one. ' +
          'A plateau after an early climb is the normal shape of this, and it is exactly what a lab recheck is for — ' +
          'it tells your provider whether there is room to adjust.</p>' +
          '<div class="row" style="margin-top:1rem">' +
          '<button class="btn primary" data-act="go" data-to="patient/book">Book a recheck</button>' +
          '<button class="btn" data-act="go" data-to="patient/messages">Message the clinic</button></div></section>';
      }

      var body = q.bodyComp(p.id);
      var bc = '';
      if (body.length > 1) {
        bc = ui.card({
          eyebrow: 'Body composition',
          title: 'Weight and body fat',
          body: '<div class="chart-scroll">' + GD.charts.trend({
            points: body.map(function (r) { return { date: r.measured_at, value: r.weight_lbs }; }),
            label: 'Weight', color: 'var(--gd-improving)', height: 150
          }) + '</div>' +
          '<dl class="kv" style="margin-top:1rem">' +
          '<dt>Weight</dt><dd class="num">' + body[0].weight_lbs + ' → <b>' + body[body.length - 1].weight_lbs + ' lb</b></dd>' +
          '<dt>Body fat</dt><dd class="num">' + body[0].body_fat_pct + '% → <b>' + body[body.length - 1].body_fat_pct + '%</b></dd>' +
          '<dt>Lean mass</dt><dd class="num">' + body[0].lean_mass_lbs + ' → <b>' + body[body.length - 1].lean_mass_lbs + ' lb</b></dd>' +
          '</dl>'
        });
      }

      return band + chart + note + bc +
        '<div class="row" style="margin-top:1rem"><button class="btn block" data-act="go" data-to="patient/labs">' +
        'See your lab numbers →</button></div>';
    }
  });

  ui.act('toggle-dim', function (data) {
    var hidden = (GD.store.pref('hiddenDims') || []).slice();
    var i = hidden.indexOf(data.dim);
    if (i > -1) hidden.splice(i, 1); else hidden.push(data.dim);
    if (hidden.length === q.checkinDims.length) hidden.pop();      // never all off
    GD.store.pref('hiddenDims', hidden);
    ui.refresh();
  });

  /* ===================================================================== labs */

  ui.register('patient/labs', {
    app: 'patient',
    render: function () {
      var p = ui.patient();
      var panels = q.panels(p.id);
      if (!panels.length) {
        return ui.card({ title: W('labs'), body: ui.empty({
          icon: '⚗', title: 'No draws yet',
          body: 'Your baseline panel is drawn at your first visit. From then on every value here gets a trend line and a plain-language read.'
        })});
      }
      var latest = panels[panels.length - 1];
      var prevPanel = panels.length > 1 ? panels[panels.length - 2] : null;
      var results = q.resultsFor(latest.id);

      // Safety analytes first. He should not have to hunt for them.
      var order = ['total_testosterone', 'free_testosterone', 'hematocrit', 'psa', 'estradiol_sensitive'];
      results.sort(function (a, b) {
        var ia = order.indexOf(a.analyte), ib = order.indexOf(b.analyte);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });

      var cards = results.map(function (r) {
        var a = q.analyte(r.analyte);
        if (!a) return '';
        var prev = prevPanel ? q.result(prevPanel.id, r.analyte) : null;
        var delta = prev ? r.value_numeric - prev.value_numeric : null;
        var series = q.analyteSeries(p.id, r.analyte);
        var arrow = delta === null ? '' : delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
        var good = a.higherBetter === null || a.higherBetter === undefined ? 'flat'
          : (delta > 0) === !!a.higherBetter ? 'up' : 'down';
        return '<div class="labcard" data-flag="' + esc(r.flag) + '">' +
          '<div class="lname"><span>' + esc(a.label) + '</span>' +
          (a.safety ? ui.pill('monitored', 'info') : '') + '</div>' +
          '<div class="lval sensitive num">' + fmt.num(r.value_numeric) + '<small>' + esc(a.unit) + '</small></div>' +
          (delta !== null ? '<div class="delta ' + good + '" style="font-size:.78rem;font-weight:700">' + arrow + ' ' +
            fmt.signed(delta) + ' since ' + esc(fmt.date(prevPanel.drawn_at, 'md')) + '</div>' : '') +
          ui.rangeBar(r) +
          '<div class="read">' + esc(q.interpret(r.analyte, r.value_numeric, prev ? prev.value_numeric : null)) + '</div>' +
          (series.length > 1 ? '<div style="margin-top:.7rem">' + GD.charts.trend({
            points: series, label: a.label, targetLow: a.targetLow, targetHigh: a.targetHigh,
            ceiling: a.ceiling, height: 120,
            color: a.safety ? 'var(--gd-below)' : 'var(--gd-improving)'
          }) + '</div>' : '') +
          '</div>';
      }).join('');

      var draws = panels.slice().reverse().map(function (pl) {
        return '<button class="item" data-act="noop"><span class="body">' +
          '<span class="ttl">' + esc(fmt.date(pl.drawn_at, 'long')) + '</span>' +
          '<span class="sub">' + esc(pl.note || 'Panel') + '</span></span>' +
          '<span class="side">' + q.resultsFor(pl.id).length + ' values</span></button>';
      }).join('');

      return ui.card({
        eyebrow: 'Drawn ' + fmt.date(latest.drawn_at, 'long'),
        title: W('labs'),
        sub: 'The filled green band is what your clinic aims for. The numbers at each end are the lab’s own reference range — they are not the same thing, and the difference matters.',
        aside: '<button class="btn sm" data-act="toggle-sensitive">' + (ui.hideSensitive() ? 'Show values' : 'Hide values') + '</button>',
        body: '<div class="grid g2">' + cards + '</div>'
      }) +
      ui.card({ title: 'Every draw', body: '<div class="list">' + draws + '</div>' }) +
      '<p class="dim" style="font-size:.76rem;margin-top:1rem;line-height:1.5">Target ranges shown here are provisional pilot placeholders, not this clinic’s published values.</p>';
    }
  });

  ui.act('noop', function () {});

  /* ================================================================ the plan */

  ui.register('patient/plan', {
    app: 'patient',
    render: function () {
      var p = ui.patient();
      var items = q.protocolItems(p.id);
      var changes = q.protocolChanges(p.id);
      var dose = q.nextDose(p.id);
      var season = q.season(p.id);

      if (!items.length) {
        return ui.card({ title: 'The ' + W('gamePlan'), body: ui.empty({
          icon: '◈', title: 'Your plan publishes after your first visit',
          body: 'Your provider builds it in the room and it appears here before you leave the building — dose, schedule, and what to expect week by week.'
        })});
      }

      var out = [];

      out.push(ui.card({
        eyebrow: season ? GD.brand.seasonLabel(season) : 'Current',
        title: 'The ' + W('gamePlan'),
        aside: dose ? '<div style="text-align:right"><div class="lab dim" style="font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700">Next dose</div>' +
          '<div style="font-weight:800;font-size:1.1rem">' + (dose.inDays === 0 ? 'Today' : 'in ' + dose.inDays + ' days') + '</div></div>' : '',
        body: '<div class="stack tight">' + items.map(function (it) {
          return '<div class="labcard"><div class="row between">' +
            '<div><div style="font-weight:700;font-size:1rem">' + esc(it.medication_name) + '</div>' +
            '<div class="muted" style="font-size:.84rem;margin-top:.15rem">' +
              esc(it.dose_amount + ' ' + it.dose_unit + ' · ' + it.route + ' · ' + it.frequency) + '</div></div>' +
            '</div>' + (it.notes ? '<div class="note-band" style="margin-top:.7rem">' + esc(it.notes) + '</div>' : '') +
            '</div>';
        }).join('') + '</div>' +
        '<p class="dim" style="font-size:.78rem;margin-top:1rem;line-height:1.5">' +
        'This is a record of what your provider prescribed. Dosing questions go to the clinic, not to this app.</p>'
      }));

      /* Expectation timeline. Unmanaged expectations in week 3 are a
         cancellation in week 6, so the curve gets set before he rides it. */
      var weeks = season ? season.totalWeeks : 0;
      var phases = [
        { range: [0, 4], label: 'Weeks 1–4', text: 'Often very little, and that is normal. Some men notice sleep or mood first. Your levels are still climbing toward steady state.' },
        { range: [4, 8], label: 'Weeks 4–8', text: 'Energy and libido usually start moving. Your first recheck lands in here and tells your provider whether the dose is right.' },
        { range: [8, 12], label: 'Weeks 8–12', text: 'Strength, body composition, and gym recovery tend to follow the earlier changes. This is where the chart usually looks convincing.' },
        { range: [12, 999], label: 'Beyond 12 weeks', text: 'Gains flatten out and that is the point — you are maintaining a new normal rather than chasing a climb. This is where your own chart matters most.' }
      ];
      out.push(ui.card({
        eyebrow: 'What to expect',
        title: 'The shape of this',
        body: '<div class="timeline">' + phases.map(function (ph) {
          var now = weeks >= ph.range[0] && weeks < ph.range[1];
          return '<div class="tl-item"' + (now ? ' data-kind="dose"' : '') + '>' +
            '<div class="when">' + esc(ph.label) + (now ? ' · you are here' : '') + '</div>' +
            '<div class="detail">' + esc(ph.text) + '</div></div>';
        }).join('') + '</div>'
      }));

      if (changes.length) {
        out.push(ui.card({
          eyebrow: 'Every change and why',
          title: 'Plan history',
          sub: 'Unexplained changes read as guesswork, so each one carries its reason.',
          body: '<div class="timeline">' + changes.slice().reverse().map(function (c) {
            return '<div class="tl-item" data-kind="dose">' +
              '<div class="when">' + esc(fmt.date(c.changed_at, 'long')) + '</div>' +
              '<div class="what">' + esc((c.old_value ? c.old_value + ' → ' : 'Started ') + c.new_value) + '</div>' +
              '<div class="detail">' + esc(c.reason_patient_facing || '') + '</div></div>';
          }).join('') + '</div>'
        }));
      }

      /* Injection-site rotation. Practical, and one of the few things a man
         will actually open this app mid-task to check. */
      if (items.some(function (i) { return i.route === 'IM' || i.route === 'SubQ'; })) {
        var sites = ['Left glute', 'Right glute', 'Left thigh', 'Right thigh', 'Left delt', 'Right delt'];
        var used = GD.store.pref('lastSite') || null;
        var nextSite = sites[(sites.indexOf(used) + 1) % sites.length];
        out.push(ui.card({
          eyebrow: 'Rotation',
          title: 'Where to inject next',
          body: '<div class="row" style="gap:.5rem">' + sites.map(function (s) {
            return '<button class="opt" aria-pressed="' + (s === nextSite) + '" data-act="pick-site" data-site="' + esc(s) + '">' +
              esc(s) + '</button>';
          }).join('') + '</div>' +
          '<p class="muted" style="font-size:.82rem;margin-top:.8rem">' +
          (used ? 'Last logged: ' + esc(used) + '. Suggested next: ' + esc(nextSite) + '.'
                : 'Tap the site you use and this will suggest the next one each week.') + '</p>'
        }));
      }

      return out.join('');
    }
  });

  ui.act('pick-site', function (data) {
    GD.store.pref('lastSite', data.site);
    ui.toast('Logged ' + data.site, 'ok');
    ui.refresh();
  });

  /* ================================================================ game film */

  ui.register('patient/film', {
    app: 'patient',
    render: function () {
      var p = ui.patient();
      var allSeries = q.photoSeries(p.id);
      if (!allSeries.length) {
        return ui.card({ title: W('gameFilm'), body: ui.empty({
          icon: '◰', title: 'No photo series yet',
          body: 'Ask the clinic to start one. With the capture guide, angle and distance match every time, which is the difference between a real series and a pile of unusable selfies.'
        })});
      }

      var seriesId = GD.store.pref('filmSeries') || allSeries[0].id;
      var series = allSeries.filter(function (s) { return s.id === seriesId; })[0] || allSeries[0];
      var poses = {};
      q.photos(series.id).forEach(function (ph) { poses[ph.pose_key] = 1; });
      var poseList = Object.keys(poses);
      var pose = GD.store.pref('filmPose');
      if (poseList.indexOf(pose) === -1) pose = poseList[0];
      var frames = q.photos(series.id, pose);
      var split = GD.store.pref('filmSplit');
      if (split === undefined || split === null) split = 50;

      var first = frames[0], last = frames[frames.length - 1];
      var tabs = allSeries.length > 1 ? '<div class="tabs">' + allSeries.map(function (s) {
        return '<button aria-selected="' + (s.id === series.id) + '" data-act="film-series" data-id="' + s.id + '">' +
          esc(fmt.title(s.series_type)) + '</button>';
      }).join('') + '</div>' : '';

      var poseChips = poseList.length > 1 ? '<div class="row tight" style="margin-bottom:.9rem">' +
        poseList.map(function (k) {
          return '<button class="chip" aria-pressed="' + (k === pose) + '" data-act="film-pose" data-pose="' + k + '">' +
            esc(fmt.title(k)) + '</button>';
        }).join('') + '</div>' : '';

      /* Slider, not a toggle. A slider makes the change feel continuous and
         controllable; a toggle makes it feel like a before/after ad. */
      var compare = frames.length > 1
        ? '<div class="compare" style="--split:' + split + '%">' +
            '<div class="lay"><img src="' + GD.media.photoSrc(first, 0) + '" alt="Earliest frame"></div>' +
            '<div class="lay after"><img src="' + GD.media.photoSrc(last, 1) + '" alt="Latest frame"></div>' +
            '<div class="handle"></div>' +
            '<span class="tag l">' + esc(fmt.date(first.captured_at, 'md')) + '</span>' +
            '<span class="tag r">' + esc(fmt.date(last.captured_at, 'md')) + '</span>' +
            '<input type="range" min="0" max="100" value="' + split + '" data-act-input="film-split" ' +
              'aria-label="Compare earliest and latest">' +
          '</div>'
        : '<div class="note-band">One frame so far. The compare slider turns on at two.</div>';

      var strip = frames.map(function (ph, i) {
        return '<button aria-pressed="false" data-act="film-frame" data-id="' + ph.id + '">' +
          '<img src="' + GD.media.photoSrc(ph, frames.length > 1 ? i / (frames.length - 1) : 0) + '" alt="">' +
          '<span class="cap">' + esc(fmt.date(ph.captured_at, 'md')) + '</span></button>';
      }).join('');

      var anyReal = frames.some(function (f) { return GD.media.has('photo:' + f.id); });

      return tabs + ui.card({
        eyebrow: frames.length + ' frames · ' + fmt.title(series.series_type),
        title: W('gameFilm'),
        sub: 'Drag across the image. Left is your first frame, right is your most recent.',
        body: poseChips + compare +
          '<div class="filmstrip" style="margin-top:.9rem">' + strip + '</div>' +
          (anyReal ? '' : '<div class="note-band warn" style="margin-top:.9rem">These are generated placeholders, ' +
            'not photographs. Tap a frame to replace one with a real photo — it stays on this device only.</div>')
      }) +
      ui.card({
        eyebrow: 'Capture guide',
        title: 'How to take the next one',
        body: '<ol class="stack tight" style="padding-left:1.2rem;font-size:.88rem;line-height:1.6">' +
          '<li>Same room, same light, same time of day if you can.</li>' +
          '<li>Phone at chest height, about six feet back. Line yourself up with the dashed guides.</li>' +
          '<li>Relaxed posture. Do not flex — a flexed photo compared against a relaxed one tells you nothing.</li>' +
          '<li>Same clothing each time. Shorts work.</li></ol>' +
          '<button class="btn primary block" style="margin-top:1rem" data-act="film-add" data-series="' + series.id +
            '" data-pose="' + pose + '">Add a frame</button>' +
          '<p class="dim" style="font-size:.76rem;margin-top:.7rem;line-height:1.5">Photos never leave this browser in the pilot. ' +
          'There is no upload endpoint. In production they go to private storage with short-lived signed links and EXIF stripped.</p>'
      });
    }
  });

  ui.act('film-series', function (data) { GD.store.pref('filmSeries', data.id); GD.store.pref('filmPose', null); ui.refresh(); });
  ui.act('film-pose', function (data) { GD.store.pref('filmPose', data.pose); ui.refresh(); });
  ui.act('film-split', function (data, el) {
    var box = el.closest('.compare');
    if (box) box.style.setProperty('--split', el.value + '%');
    GD.store.pref('filmSplit', Number(el.value));
  });

  ui.act('film-frame', function (data) {
    var photo = GD.store.one('photos', data.id);
    if (!photo) return;
    var existing = GD.media.get('photo:' + data.id);
    ui.modal({
      title: 'Frame — ' + fmt.date(photo.captured_at, 'long'),
      sub: fmt.title(photo.pose_key) + ' · guide ' + photo.guide_version,
      body: '<img src="' + (existing || GD.media.photoSrc(photo, 0.5)) + '" alt="" ' +
        'style="width:100%;max-width:300px;border-radius:var(--gd-r-md);margin:0 auto;display:block">' +
        '<div class="drop" id="frame-drop" style="margin-top:1rem">' +
        '<span class="big">↑</span><span class="t">Replace with a real photo</span>' +
        '<span class="s">Stays in this browser. Resized and stripped of location data.</span></div>',
      actions: (existing ? '<button class="btn danger" data-act="film-clear" data-id="' + data.id + '">Remove photo</button>' : '') +
        '<button class="btn primary" data-act="close-modal">Done</button>',
      after: function (wrap) {
        GD.media.dropzone(wrap.querySelector('#frame-drop'), { maxEdge: 900 }, function (url) {
          GD.media.set('photo:' + data.id, url);
          GD.store.patch('photos', data.id, { placeholder: false, storage_ref: 'local:' + data.id });
          ui.closeModal();
          ui.toast('Frame updated', 'ok');
          ui.refresh();
        });
      }
    });
  });

  ui.act('film-clear', function (data) {
    GD.media.del('photo:' + data.id);
    GD.store.patch('photos', data.id, { placeholder: true, storage_ref: null });
    ui.closeModal(); ui.toast('Photo removed'); ui.refresh();
  });

  ui.act('film-add', function (data) {
    GD.media.pick({ maxEdge: 900 }).then(function (url) {
      if (!url) return;
      var frames = q.photos(data.series);
      var row = GD.store.add('photos', {
        series_id: data.series,
        patient_id: ui.patientId(),
        captured_at: GD.store.today(),
        week_index: frames.length ? frames[frames.length - 1].week_index + 1 : 0,
        pose_key: data.pose, guide_version: 'v1',
        storage_ref: 'local', placeholder: false, reviewed_by: null
      });
      GD.media.set('photo:' + row.id, url);
      ui.toast('Frame added', 'ok');
      ui.refresh();
    }, function (err) { ui.toast(err.message, 'warn'); });
  });

  /* ================================================================= booking */

  ui.register('patient/book', {
    app: 'patient',
    render: function () {
      var draft = GD.store.pref('bookDraft') || {};
      var services = q.services().filter(function (s) { return s.active; });
      var step = !draft.service_id ? 1 : !draft.provider_id ? 2 : !draft.slot ? 3 : 4;

      var out = ['<div class="row between" style="margin-bottom:1rem">' +
        '<div><div class="eyebrow">Book a visit</div>' +
        '<div class="dim" style="font-size:.8rem">Step ' + step + ' of 4</div></div>' +
        (step > 1 ? '<button class="btn ghost sm" data-act="book-back">Back</button>' : '') +
        '</div><div class="bar" style="margin-bottom:1.2rem"><i style="width:' + (step * 25) + '%"></i></div>'];

      if (step === 1) {
        var cats = {};
        services.forEach(function (s) { (cats[s.category] = cats[s.category] || []).push(s); });
        out.push(Object.keys(cats).map(function (cat) {
          return ui.card({
            eyebrow: fmt.title(cat), title: '', body: '<div class="list">' + cats[cat].map(function (s) {
              return '<button class="item" data-act="book-service" data-id="' + s.id + '">' +
                '<span class="body"><span class="ttl">' + esc(s.name) + '</span>' +
                '<span class="sub">' + s.duration_min + ' min' +
                (s.requires_labs ? ' · labs required' : '') + '</span></span>' +
                '<span class="side">' + (s.price_cents ? fmt.money(s.price_cents) : 'Included / quoted') + '</span></button>';
            }).join('') + '</div>'
          });
        }).join(''));
        out.push('<p class="dim" style="font-size:.78rem;margin-top:1rem">Pricing shown is provisional pilot data. ' +
          'Published pricing is confirmed with the clinic before this goes live.</p>');
      }

      if (step === 2) {
        var svc = q.service(draft.service_id);
        out.push(ui.card({
          eyebrow: svc.name, title: 'Who would you like to see?',
          body: '<div class="list">' +
            '<button class="item" data-act="book-provider" data-id="any">' +
            '<span class="av" aria-hidden="true">★</span><span class="body">' +
            '<span class="ttl">First available</span><span class="sub">Usually the soonest appointment</span></span></button>' +
            q.providers().map(function (pv) {
              return '<button class="item" data-act="book-provider" data-id="' + pv.id + '">' +
                '<span class="av"><img src="' + GD.media.personSrc('provider:' + pv.id, pv.name, 3) + '" alt=""></span>' +
                '<span class="body"><span class="ttl">' + esc(pv.name) + '</span>' +
                '<span class="sub">' + esc(pv.role || pv.credentials) + '</span></span></button>';
            }).join('') + '</div>'
        }));
      }

      if (step === 3) {
        var days = [];
        for (var d = 0; d < 12 && days.length < 5; d++) {
          var iso = fmt.plusDays(GD.store.today(), d);
          var slots = q.slotsFor(iso, draft.service_id);
          if (slots.length) days.push({ iso: iso, slots: slots.slice(0, 8) });
        }
        out.push(ui.card({
          eyebrow: 'Pick a time', title: 'Real availability',
          sub: 'Every slot here is genuinely open. No callback, no waiting for someone to ring you back.',
          body: days.map(function (day) {
            return '<div style="margin-bottom:1.1rem"><div class="lbl" style="margin-bottom:.45rem">' +
              esc(fmt.date(day.iso, 'dow')) + '</div><div class="row tight">' +
              day.slots.map(function (t) {
                return '<button class="opt" data-act="book-slot" data-iso="' + day.iso + '" data-time="' + t + '">' +
                  esc(fmt.time('2020-01-01T' + t + ':00')) + '</button>';
              }).join('') + '</div></div>';
          }).join('') +
          '<button class="btn ghost block" data-act="book-waitlist">None of these work — add me to the waitlist</button>'
        }));
      }

      if (step === 4) {
        var svc4 = q.service(draft.service_id);
        var prov = draft.provider_id === 'any' ? null : q.provider(draft.provider_id);
        out.push(ui.card({
          eyebrow: 'Confirm', title: 'Check this over',
          body: '<dl class="kv" style="font-size:.95rem">' +
            '<dt>Service</dt><dd>' + esc(svc4.name) + '</dd>' +
            '<dt>When</dt><dd>' + esc(fmt.date(draft.iso, 'long')) + ' at ' + esc(fmt.time('2020-01-01T' + draft.slot + ':00')) + '</dd>' +
            '<dt>Who</dt><dd>' + esc(prov ? prov.name : 'First available') + '</dd>' +
            '<dt>How long</dt><dd>' + svc4.duration_min + ' minutes</dd>' +
            '<dt>Cost</dt><dd>' + (svc4.price_cents ? fmt.money(svc4.price_cents) : 'Included in membership') + '</dd>' +
            '</dl>' +
            '<div class="note-band" style="margin-top:1rem">Your confirmation text will say ' +
            '<b>“Gameday: your appointment is confirmed”</b> and nothing more. No service name, no reason for the visit. ' +
            'Nobody glancing at your phone learns anything.</div>' +
            '<button class="btn primary big block" style="margin-top:1.2rem" data-act="book-confirm">Confirm booking</button>' +
            '<p class="dim" style="font-size:.78rem;margin-top:.7rem;text-align:center">No account needed. ' +
            'We already have your details.</p>'
        }));
      }

      return out.join('');
    }
  });

  function bookDraft(patch) {
    var d = Object.assign({}, GD.store.pref('bookDraft') || {}, patch);
    GD.store.pref('bookDraft', d);
    ui.refresh();
  }
  ui.act('book-service', function (data) { bookDraft({ service_id: data.id }); });
  ui.act('book-provider', function (data) { bookDraft({ provider_id: data.id }); });
  ui.act('book-slot', function (data) { bookDraft({ iso: data.iso, slot: data.time }); });
  ui.act('book-back', function () {
    var d = GD.store.pref('bookDraft') || {};
    if (d.slot) delete d.slot, delete d.iso;
    else if (d.provider_id) delete d.provider_id;
    else delete d.service_id;
    GD.store.pref('bookDraft', d); ui.refresh();
  });
  ui.act('book-waitlist', function () {
    var d = GD.store.pref('bookDraft') || {};
    GD.store.add('waitlist', { patient_id: ui.patientId(), service_id: d.service_id,
      preferred_window: 'Added from the app', added_at: GD.store.today(), status: 'waiting' });
    GD.store.pref('bookDraft', {});
    ui.toast('Added to the waitlist. The clinic offers cancellations to the list first.', 'ok');
    ui.go('patient/home');
  });
  ui.act('book-confirm', function () {
    var d = GD.store.pref('bookDraft') || {};
    var svc = q.service(d.service_id);
    var appt = GD.store.add('appointments', {
      patient_id: ui.patientId(),
      service_id: d.service_id,
      provider_id: d.provider_id === 'any' ? 'prov_01' : d.provider_id,
      starts_at: d.iso + 'T' + d.slot + ':00',
      duration_min: svc.duration_min,
      status: 'booked',
      intake_complete: !!q.protocol(ui.patientId()),
      booking_channel: 'app',
      reason_code: 'self_booked',
      room: 'Room 1'
    });
    GD.store.pref('bookDraft', {});
    ui.toast('Booked for ' + fmt.date(appt.starts_at, 'dow') + ' at ' + fmt.time(appt.starts_at), 'ok');
    ui.go('patient/visit');
  });

  /* ============================================================ pre-visit card */

  ui.register('patient/visit', {
    app: 'patient',
    render: function () {
      var p = ui.patient();
      var appt = q.nextAppt(p.id);
      var clinic = q.clinic();
      var facts = clinic.visit_facts || {};
      if (!appt) {
        return ui.card({ title: 'Your next visit', body: ui.empty({
          icon: '◳', title: 'Nothing booked',
          body: 'Pick a time and this becomes your pre-visit card — who you are seeing, where to park, and exactly what happens.',
          act: 'go', actData: ' data-to="patient/book"', actLabel: 'Book a visit'
        })});
      }
      var prov = q.provider(appt.provider_id);
      var intake = GD.store.all('intake_submissions').filter(function (i) { return i.patient_id === p.id; })[0];

      /* Specificity kills anxiety. A photo of the parking lot does more than
         any amount of "we're private and professional". */
      return ui.card({
        eyebrow: fmt.date(appt.starts_at, 'long') + ' at ' + fmt.time(appt.starts_at),
        title: q.apptLabel(appt),
        body: '<div class="row" style="gap:1rem;margin-bottom:1.2rem">' +
          '<span class="av xl"><img src="' + GD.media.personSrc('provider:' + prov.id, prov.name, 3) + '" alt=""></span>' +
          '<div><div style="font-weight:700;font-size:1.05rem">' + esc(prov.name) + '</div>' +
          '<div class="muted" style="font-size:.86rem">' + esc(prov.role || '') + ' · ' + esc(prov.credentials || '') + '</div>' +
          '<div class="dim" style="font-size:.82rem;margin-top:.3rem">This is who you will actually see.</div></div></div>' +

          '<div class="grid g2">' +
          ['exterior', 'parking'].map(function (k) {
            return '<figure><img src="' + GD.media.clinicSrc(k) + '" alt="" ' +
              'style="border-radius:var(--gd-r-md);width:100%;aspect-ratio:3/2;object-fit:cover">' +
              '<figcaption class="dim" style="font-size:.74rem;margin-top:.35rem">' + esc(fmt.title(k)) + '</figcaption></figure>';
          }).join('') + '</div>' +

          '<dl class="kv" style="margin-top:1.2rem;text-align:left">' +
          [['Where', clinic.address_line1 + ', ' + clinic.address_city + ' ' + clinic.address_state],
           ['Suite', facts.suite], ['Parking', facts.parking], ['How long', facts.duration],
           ['The blood draw', facts.draw], ['Privacy', facts.privacy], ['Cost', facts.cost]]
          .filter(function (r) { return r[1]; })
          .map(function (r) {
            return '<dt>' + esc(r[0]) + '</dt><dd style="text-align:left">' + esc(r[1]) + '</dd>';
          }).join('') + '</dl>' +

          (intake && intake.percent_complete < 100
            ? '<div class="note-band warn" style="margin-top:1.2rem"><b>Your intake is ' + intake.percent_complete +
              '% done.</b> Finishing it before you arrive gives you about fifteen more minutes with the clinician ' +
              'instead of a clipboard.</div>' +
              '<button class="btn primary block" style="margin-top:.8rem" data-act="go" data-to="patient/intake">Finish intake</button>'
            : '') +

          '<div class="row" style="margin-top:1.2rem">' +
          '<button class="btn" data-act="resched">Reschedule</button>' +
          '<button class="btn ghost" data-act="cancel-appt" data-id="' + appt.id + '">Cancel</button></div>'
      });
    }
  });

  ui.act('resched', function () { GD.store.pref('bookDraft', {}); ui.go('patient/book'); });
  ui.act('cancel-appt', function (data) {
    ui.confirm({ title: 'Cancel this appointment?', sub: 'You can rebook straight away, and the slot gets offered to the waitlist.',
      okLabel: 'Cancel it', danger: true }).then(function (yes) {
      if (!yes) return;
      GD.store.patch('appointments', data.id, { status: 'cancelled' });
      ui.toast('Cancelled. The slot went to the waitlist.', 'ok');
      ui.go('patient/home');
    });
  });

  /* ================================================================== intake */

  ui.register('patient/intake', {
    app: 'patient',
    render: function () {
      var p = ui.patient();
      var tpl = GD.store.obj('intake_template');
      var saved = GD.store.pref('intakeAnswers') || {};
      var total = 0, done = 0;
      (tpl.sections || []).forEach(function (s) {
        (s.fields || []).forEach(function (f) {
          total++;
          if (saved[f.key] !== undefined && saved[f.key] !== '' ) done++;
        });
      });
      /* Endowed progress: the bar starts part-full because booking already
         gave us his name, email, and phone. A bar that starts at 0 gets
         abandoned far more often than one that starts at 30%. */
      var prefilled = 3;
      var pct = Math.round(((done + prefilled) / (total + prefilled)) * 100);

      var sections = (tpl.sections || []).map(function (s) {
        return ui.card({
          eyebrow: s.instrument ? 'Questionnaire · ' + s.instrument : '',
          title: s.title,
          body: '<div class="stack">' + (s.fields || []).map(function (f) {
            var val = saved[f.key];
            if (f.type === 'choice') {
              return '<div class="field"><label>' + esc(f.label) + '</label><div class="opts">' +
                f.options.map(function (o) {
                  var on = f.multi ? (val || []).indexOf(o) > -1 : val === o;
                  return '<button class="opt" aria-pressed="' + on + '" data-act="intake-choice" ' +
                    'data-key="' + f.key + '" data-val="' + esc(o) + '" data-multi="' + (f.multi ? 1 : 0) + '">' +
                    esc(o) + '</button>';
                }).join('') + '</div></div>';
            }
            if (f.type === 'yesno') {
              return '<div class="row between" style="border-bottom:1px solid var(--gd-border);padding:.5rem 0">' +
                '<span style="font-size:.9rem;flex:1 1 auto">' + esc(f.label) + '</span>' +
                '<span class="row tight">' + ['Yes', 'No'].map(function (o) {
                  return '<button class="opt" aria-pressed="' + (val === o) + '" data-act="intake-choice" ' +
                    'data-key="' + f.key + '" data-val="' + o + '" data-multi="0">' + o + '</button>';
                }).join('') + '</span></div>';
            }
            return '<div class="field"><label for="ik_' + f.key + '">' + esc(f.label) + '</label>' +
              '<textarea id="ik_' + f.key + '" data-act-input="intake-text" data-key="' + f.key + '" ' +
              'placeholder="Type here, or leave blank">' + esc(val || '') + '</textarea></div>';
          }).join('') + '</div>'
        });
      }).join('');

      var consents = ui.card({
        eyebrow: 'Consents',
        title: 'Before your visit',
        sub: 'Plain language on purpose. Ask about anything here at your visit.',
        body: '<div class="stack tight">' + (tpl.consents || []).map(function (c) {
          var on = !!saved['consent_' + c.key];
          return '<label class="switch"><input type="checkbox"' + (on ? ' checked' : '') +
            ' data-act="intake-consent" data-key="' + c.key + '"><span class="track"></span>' +
            '<span class="txt">' + esc(c.label) + (c.required ? ' <span class="dim">(required)</span>' : ' <span class="dim">(optional)</span>') +
            '</span></label>';
        }).join('') + '</div>' +
        '<div class="note-band" style="margin-top:1rem">In the pilot nothing is legally signed. E-signature, ' +
        'template versioning, and a reproducible audit trail land in Phase B.</div>'
      });

      return '<section class="card accent"><div class="row between">' +
        '<div><div class="eyebrow">Intake</div><div style="font-weight:700">' + pct + '% complete</div></div>' +
        '<div class="dim" style="font-size:.8rem;text-align:right">Name, email and phone<br>already filled from booking</div>' +
        '</div><div class="bar" style="margin-top:.8rem"><i style="width:' + pct + '%"></i></div></section>' +
        sections + consents +
        '<button class="btn primary big block" style="margin-top:1rem" data-act="intake-submit">Submit intake</button>';
    }
  });

  ui.act('intake-choice', function (data) {
    var saved = Object.assign({}, GD.store.pref('intakeAnswers') || {});
    if (data.multi === '1') {
      var arr = (saved[data.key] || []).slice();
      var i = arr.indexOf(data.val);
      if (i > -1) arr.splice(i, 1); else arr.push(data.val);
      saved[data.key] = arr;
    } else {
      saved[data.key] = saved[data.key] === data.val ? undefined : data.val;
    }
    GD.store.pref('intakeAnswers', saved);
    ui.refresh();
  });
  ui.act('intake-text', function (data, el) {
    var saved = Object.assign({}, GD.store.pref('intakeAnswers') || {});
    saved[data.key] = el.value;
    GD.store.pref('intakeAnswers', saved);            // no re-render: keeps focus
  });
  ui.act('intake-consent', function (data, el) {
    var saved = Object.assign({}, GD.store.pref('intakeAnswers') || {});
    saved['consent_' + data.key] = el.checked;
    GD.store.pref('intakeAnswers', saved);
  });
  ui.act('intake-submit', function () {
    var p = ui.patient();
    var answers = GD.store.pref('intakeAnswers') || {};
    var tpl = GD.store.obj('intake_template');
    var missing = (tpl.consents || []).filter(function (c) { return c.required && !answers['consent_' + c.key]; });
    if (missing.length) return ui.toast('The required consents are not ticked yet.', 'warn');

    var existing = GD.store.all('intake_submissions').filter(function (i) { return i.patient_id === p.id; })[0];
    var fields = { submitted_at: GD.store.today(), percent_complete: 100, answers: answers, template_version: 'v1.0' };
    if (existing) GD.store.patch('intake_submissions', existing.id, fields);
    else GD.store.add('intake_submissions', Object.assign({ patient_id: p.id, appointment_id: null }, fields));

    var appt = q.nextAppt(p.id);
    if (appt) GD.store.patch('appointments', appt.id, { intake_complete: true });
    ui.toast('Intake submitted. That is about fifteen minutes back at your visit.', 'ok');
    ui.go('patient/visit');
  });

  /* ============================================================== membership */

  ui.register('patient/membership', {
    app: 'patient',
    render: function () {
      var p = ui.patient();
      var m = q.membership(p.id);
      if (!m) return ui.card({ title: 'Membership', body: ui.empty({
        icon: '◎', title: 'No membership yet', body: 'Membership starts at your first visit.' })});
      var plan = q.plans().filter(function (x) { return x.id === m.plan_id; })[0] || {};
      var pays = q.payments(p.id);
      var failed = pays.filter(function (x) { return x.status === 'failed'; });

      return (failed.length ? ui.card({ tone: 'warn', eyebrow: 'Needs attention',
        title: 'A payment did not go through',
        body: '<p class="muted" style="font-size:.9rem;line-height:1.55">Your card was declined on ' +
          esc(fmt.date(failed[0].created_at, 'long')) + '. Nothing about your therapy changes today — ' +
          'we just need a working card when you get a minute.</p>' +
          '<button class="btn primary block" style="margin-top:1rem" data-act="update-card">Update card</button>'
      }) : '') +
      ui.card({
        eyebrow: fmt.title(m.status),
        title: plan.name || 'Membership',
        body: '<dl class="kv" style="font-size:.95rem">' +
          '<dt>Status</dt><dd>' + esc(fmt.title(m.status)) + '</dd>' +
          '<dt>Started</dt><dd>' + esc(fmt.date(m.started_at, 'long')) + '</dd>' +
          '<dt>Monthly</dt><dd>' + fmt.money(plan.price_cents || m.mrr_cents) + '</dd>' +
          (m.paused_at ? '<dt>Paused</dt><dd>' + esc(fmt.date(m.paused_at, 'long')) + '</dd>' : '') +
          '</dl>' +
          (plan.includes ? '<div style="margin-top:1rem"><div class="lbl" style="margin-bottom:.4rem">Included</div>' +
            '<ul style="padding-left:1.1rem;font-size:.88rem;line-height:1.7;color:var(--gd-text-muted)">' +
            plan.includes.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>' : '')
      }) +
      ui.card({
        title: 'Invoices',
        body: '<div class="list">' + pays.slice(0, 8).map(function (x) {
          return '<div class="item"><span class="body"><span class="ttl">' + fmt.money(x.amount_cents) +
            ' ' + (x.status === 'failed' ? ui.pill('declined', 'critical') : '') + '</span>' +
            '<span class="sub">' + esc(fmt.date(x.created_at, 'long')) + ' · ' + esc(x.descriptor || '') + '</span></span>' +
            '<span class="side"><button class="btn sm" data-act="receipt" data-id="' + x.id + '">Receipt</button></span></div>';
        }).join('') + '</div>' +
        '<p class="dim" style="font-size:.76rem;margin-top:.8rem">Your card statement shows ' +
        '<b>GAMEDAY THORNTON - MEMBERSHIP</b> and never anything clinical.</p>'
      }) +
      /* Pause offered prominently, cancel findable and honest. A pause you own
         beats a cancellation you obstructed, and men who feel trapped leave
         permanently and tell people. */
      ui.card({
        eyebrow: 'Changes',
        title: 'Need to change something?',
        body: (m.status === 'active'
          ? '<button class="btn block" data-act="pause-membership" data-id="' + m.id + '">Pause for up to 3 months</button>' +
            '<p class="dim" style="font-size:.8rem;margin:.6rem 0 1.2rem;line-height:1.5">Keeps your history and your chart. ' +
            'Restart whenever — no new intake, no new baseline.</p>'
          : m.status === 'paused'
          ? '<button class="btn primary block" data-act="resume-membership" data-id="' + m.id + '">Resume membership</button>'
          : '') +
          '<button class="btn ghost block" data-act="cancel-membership" data-id="' + m.id + '">Cancel membership</button>' +
          '<p class="dim" style="font-size:.78rem;margin-top:.6rem;line-height:1.5">Cancelling is two taps and we will ask why once. ' +
          'No phone call required.</p>'
      });
    }
  });

  ui.act('update-card', function () {
    ui.modal({ title: 'Update card', sub: 'Pilot mode — Stripe is in test mode and no real card is accepted.',
      body: '<div class="note-band">In production this is a Stripe Elements form. No card data ever touches our servers, ' +
        'and no clinical information is ever sent to Stripe — not in metadata, not in the descriptor, not in line items.</div>',
      actions: '<button class="btn primary" data-act="close-modal">Close</button>' });
  });
  ui.act('receipt', function (data) {
    var pay = GD.store.one('payments', data.id);
    ui.modal({ title: fmt.money(pay.amount_cents), sub: fmt.date(pay.created_at, 'long'),
      body: '<dl class="kv"><dt>Descriptor</dt><dd>' + esc(pay.descriptor) + '</dd>' +
        '<dt>Status</dt><dd>' + esc(fmt.title(pay.status)) + '</dd>' +
        '<dt>Reference</dt><dd>' + esc(pay.processor_ref) + '</dd></dl>' +
        '<div class="note-band" style="margin-top:1rem">HSA/FSA-formatted receipts are Phase C. ' +
        'They need the service categories to be finalised first.</div>',
      actions: '<button class="btn primary" data-act="close-modal">Close</button>' });
  });
  ui.act('pause-membership', function (data) {
    ui.confirm({ title: 'Pause your membership?', sub: 'Up to three months. Your chart, labs and photos all stay exactly as they are.',
      okLabel: 'Pause it' }).then(function (yes) {
      if (!yes) return;
      GD.store.patch('memberships', data.id, { status: 'paused', paused_at: GD.store.today(), mrr_cents: 0 });
      ui.toast('Paused. Nothing is lost.', 'ok'); ui.refresh();
    });
  });
  ui.act('resume-membership', function (data) {
    GD.store.patch('memberships', data.id, { status: 'active', paused_at: null, mrr_cents: 24900 });
    ui.toast('Welcome back.', 'ok'); ui.refresh();
  });
  ui.act('cancel-membership', function (data) {
    var reasons = [['cost', 'Too expensive'], ['no_perceived_benefit', 'I am not feeling a difference'],
      ['side_effects', 'Side effects'], ['moved', 'I moved'], ['went_elsewhere', 'Going somewhere else'],
      ['life_event', 'Something came up'], ['other', 'Other']];
    ui.modal({
      title: 'Cancel membership',
      sub: 'One question, then it is done. Your answer goes to the clinic owner, not to a retention script.',
      body: '<div class="stack tight">' + reasons.map(function (r) {
        return '<button class="btn block" data-act="do-cancel" data-id="' + data.id + '" data-reason="' + r[0] + '">' +
          esc(r[1]) + '</button>';
      }).join('') + '</div>' +
      '<div class="note-band" style="margin-top:1rem">If the issue is cost, <b>pausing</b> keeps everything and costs nothing. ' +
      'Worth a look before you cancel.</div>',
      actions: '<button class="btn ghost" data-act="close-modal">Never mind</button>'
    });
  });
  ui.act('do-cancel', function (data) {
    GD.store.patch('memberships', data.id, { status: 'cancelled', cancelled_at: GD.store.today(),
      cancel_reason_code: data.reason, mrr_cents: 0 });
    GD.store.patch('patients', ui.patientId(), { status: 'churned' });
    ui.closeModal();
    ui.toast('Cancelled. Your records stay available to you.', 'ok');
    ui.refresh();
  });

  /* ================================================================ messages */

  ui.register('patient/messages', {
    app: 'patient',
    render: function () {
      var p = ui.patient();
      var thread = q.threadFor(p.id);
      var msgs = thread ? q.messagesIn(thread.id) : [];
      return ui.card({
        eyebrow: 'Secure message',
        title: 'Message the clinic',
        sub: 'Not for emergencies. Replies usually land within a business day.',
        body: (msgs.length ? '<div class="stack tight" style="margin-bottom:1.2rem">' + msgs.map(function (m) {
            var mine = m.sender_type === 'patient';
            return '<div style="max-width:86%;' + (mine ? 'margin-left:auto;' : '') + '">' +
              '<div class="labcard" style="' + (mine ? 'background:var(--gd-accent-dim);border-color:var(--gd-accent-line)' : '') + '">' +
              '<div style="font-size:.9rem;line-height:1.5">' + esc(m.body) + '</div></div>' +
              '<div class="dim" style="font-size:.7rem;margin-top:.25rem;' + (mine ? 'text-align:right' : '') + '">' +
              (mine ? 'You' : 'Clinic') + ' · ' + esc(fmt.ago(m.sent_at)) + '</div></div>';
          }).join('') + '</div>'
          : '<div class="note-band" style="margin-bottom:1.2rem">No messages yet.</div>') +
          '<div class="field"><label for="msg_body">Your message</label>' +
          '<textarea id="msg_body" placeholder="What do you want to ask?"></textarea></div>' +
          '<div class="field" style="margin-top:.8rem"><label for="msg_tag">What is it about?</label>' +
          '<select id="msg_tag"><option value="clinical">Something clinical</option>' +
          '<option value="scheduling">Scheduling</option><option value="billing">Billing</option>' +
          '<option value="other">Something else</option></select>' +
          '<div class="hint">This routes it to the right person instead of a shared inbox.</div></div>' +
          '<button class="btn primary block" style="margin-top:1rem" data-act="msg-send">Send</button>'
      });
    }
  });

  ui.act('msg-send', function () {
    var p = ui.patient();
    var body = ((document.getElementById('msg_body') || {}).value || '').trim();
    if (!body) return ui.toast('Nothing typed yet.', 'warn');
    var tag = (document.getElementById('msg_tag') || {}).value || 'other';
    var thread = q.threadFor(p.id);
    if (!thread) {
      thread = GD.store.add('message_threads', { patient_id: p.id, triage_tag: tag, status: 'open',
        assigned_to: tag === 'billing' ? 'stf_front' : 'stf_prov_01', last_at: GD.store.today(), unread_staff: 1 });
    } else {
      GD.store.patch('message_threads', thread.id, { last_at: GD.store.today(),
        unread_staff: (thread.unread_staff || 0) + 1, status: 'open', triage_tag: tag });
    }
    GD.store.add('messages', { thread_id: thread.id, sender_type: 'patient', sender_id: p.id,
      body: body, sent_at: GD.store.today(), read_at: null });
    ui.toast('Sent. It is tagged ' + tag + ' so it reaches the right person.', 'ok');
    ui.refresh();
  });

  /* ==================================================================== more */

  ui.register('patient/more', {
    app: 'patient',
    render: function () {
      var p = ui.patient();
      var items = [
        { to: 'patient/labs', label: W('labs'), sub: 'Every value, every trend, in plain language' },
        { to: 'patient/visit', label: 'Your next visit', sub: 'Who, where, parking, what it costs' },
        { to: 'patient/book', label: 'Book a visit', sub: 'Real availability, no phone call' },
        { to: 'patient/intake', label: 'Intake & consents', sub: 'Finish it before you arrive' },
        { to: 'patient/messages', label: 'Message the clinic', sub: 'Routed to the right person' },
        { to: 'patient/membership', label: 'Membership & invoices', sub: 'Status, card, pause, cancel' }
      ];
      return ui.card({
        title: 'Everything else',
        body: '<div class="list">' + items.map(function (i) {
          return '<button class="item" data-act="go" data-to="' + i.to + '">' +
            '<span class="body"><span class="ttl">' + esc(i.label) + '</span>' +
            '<span class="sub">' + esc(i.sub) + '</span></span><span class="side">›</span></button>';
        }).join('') + '</div>'
      }) +
      ui.card({
        eyebrow: 'Privacy',
        title: 'What this app does about being seen',
        body: '<div class="stack tight">' +
          '<label class="switch"><input type="checkbox"' + (ui.hideSensitive() ? ' checked' : '') +
            ' data-act="toggle-sensitive"><span class="track"></span>' +
            '<span class="txt">Blur values on screen<br><span class="dim" style="font-size:.78rem">' +
            'For when someone is sitting next to you. Press and hold to peek.</span></span></label>' +
          '<label class="switch"><input type="checkbox" checked disabled><span class="track"></span>' +
            '<span class="txt">Nothing clinical in notifications<br><span class="dim" style="font-size:.78rem">' +
            'Always on. Every alert says “you have an update” and nothing else.</span></span></label>' +
          '<label class="switch"><input type="checkbox" ' + (p.privacy_flags && p.privacy_flags.biometric_lock ? 'checked' : '') +
            ' data-act="toggle-biometric"><span class="track"></span>' +
            '<span class="txt">Face ID / PIN on open<br><span class="dim" style="font-size:.78rem">Phase B.</span></span></label>' +
          '</div>' +
          '<div class="note-band" style="margin-top:1rem">The app icon on your home screen is deliberately plain. ' +
          'Nobody scrolling past your phone learns where you are a patient.</div>'
      }) +
      '<button class="btn ghost block" style="margin-top:1rem" data-act="go" data-to="staff/scoreboard">' +
      '← Back to ' + esc(GD.brand.staffAppName()) + '</button>';
    }
  });

  ui.act('toggle-biometric', function (data, el) {
    var p = ui.patient();
    GD.store.patch('patients', p.id, {
      privacy_flags: Object.assign({}, p.privacy_flags, { biometric_lock: el.checked })
    });
    ui.toast(el.checked ? 'Lock on (Phase B)' : 'Lock off');
  });
})();
