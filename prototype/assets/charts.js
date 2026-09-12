/* ==========================================================================
   charts.js — SVG chart primitives, no dependencies
   --------------------------------------------------------------------------
   The production build uses Recharts (docs/06-architecture.md). Recharts needs
   React, and the pilot must run from a double-clicked file with zero install,
   so these are hand-rolled. They are deliberately the same shapes Recharts
   will render later: same axes, same markers, same colour semantics.

   Every function returns an SVG string. Callers inject it and, where the chart
   is interactive, call the matching bind* helper.
   ========================================================================== */

(function () {
  'use strict';
  var GD = window.GD = window.GD || {};

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  GD.esc = esc;

  var DAY = 864e5;
  function t(iso) { return new Date(iso.slice(0, 10) + 'T00:00:00Z').getTime(); }

  // Six dimensions, six distinguishable hues. Ordered so adjacent lines in the
  // legend are not adjacent in hue, which keeps a crowded chart readable.
  var DIM_COLORS = {
    energy: '#e0a33a',
    libido: '#d7607f',
    sleep_quality: '#4a9fd8',
    mood: '#6bbf73',
    gym_performance: '#c98adb',
    mental_clarity: '#63c9c0'
  };

  var charts = GD.charts = {

    dimColor: function (dim) { return DIM_COLORS[dim] || '#8a8a8a'; },

    /* ---------------------------------------------------------------------
       statSheet — the feature the whole retention thesis rests on.
       Subjective scores as lines, lab draws as ticks, dose changes as
       labelled markers, all on one time axis so cause and effect is visible.
       --------------------------------------------------------------------- */
    statSheet: function (o) {
      var series = o.series || [];               // [{key,label,color,points:[{date,value}]}]
      var labDates = o.labDates || [];
      var doseChanges = o.doseChanges || [];     // [{date,label}]
      var W = 760, H = o.height || 300;
      var pad = { l: 30, r: 16, t: 14, b: 42 };
      var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

      var allDates = [];
      series.forEach(function (s) { s.points.forEach(function (p) { allDates.push(t(p.date)); }); });
      labDates.forEach(function (d) { allDates.push(t(d)); });
      doseChanges.forEach(function (d) { allDates.push(t(d.date)); });
      if (!allDates.length) return charts.emptyChart('No timeline yet');

      var x0 = Math.min.apply(null, allDates), x1 = Math.max.apply(null, allDates);
      if (x1 === x0) x1 = x0 + 7 * DAY;
      var yMin = o.yMin === undefined ? 1 : o.yMin, yMax = o.yMax === undefined ? 10 : o.yMax;

      function X(ms) { return pad.l + ((ms - x0) / (x1 - x0)) * iw; }
      function Y(v) { return pad.t + (1 - (v - yMin) / (yMax - yMin)) * ih; }

      var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
        esc(o.ariaLabel || 'Scores over time with lab draws and dose changes marked') + '">'];

      // Baseline band: a faint strip at the starting average, so "then" stays
      // visible behind "now" without a second chart.
      if (o.baseline !== undefined && o.baseline !== null) {
        s.push('<rect x="' + pad.l + '" y="' + Y(o.baseline + 0.18).toFixed(1) + '" width="' + iw +
          '" height="' + Math.max(2, (Y(o.baseline - 0.18) - Y(o.baseline + 0.18))).toFixed(1) +
          '" fill="currentColor" opacity=".08"/>');
        s.push('<text x="' + (pad.l + 4) + '" y="' + (Y(o.baseline) - 5).toFixed(1) +
          '" class="axis-txt" opacity=".8">baseline ' + o.baseline.toFixed(1) + '</text>');
      }

      // Horizontal gridlines + y labels
      for (var v = yMin; v <= yMax; v += (yMax - yMin) / 3) {
        var yy = Y(v).toFixed(1);
        s.push('<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + yy + '" y2="' + yy + '" class="grid-line"/>');
        s.push('<text x="' + (pad.l - 6) + '" y="' + (Number(yy) + 3.5) + '" text-anchor="end" class="axis-txt">' + Math.round(v) + '</text>');
      }

      // Lab draw ticks
      labDates.forEach(function (d) {
        var xx = X(t(d)).toFixed(1);
        s.push('<line x1="' + xx + '" x2="' + xx + '" y1="' + pad.t + '" y2="' + (pad.t + ih) + '" class="lab-tick"/>');
        s.push('<circle cx="' + xx + '" cy="' + (pad.t + ih + 8) + '" r="3" class="lab-dot"/>');
      });

      // Dose-change markers. These are the "why" behind every inflection.
      doseChanges.forEach(function (d, i) {
        var xx = X(t(d.date));
        s.push('<line x1="' + xx.toFixed(1) + '" x2="' + xx.toFixed(1) + '" y1="' + pad.t +
          '" y2="' + (pad.t + ih) + '" class="dose-line"/>');
        var anchor = xx > W - 120 ? 'end' : 'start';
        var tx = anchor === 'end' ? xx - 5 : xx + 5;
        s.push('<text x="' + tx.toFixed(1) + '" y="' + (pad.t + 11 + (i % 2) * 13) +
          '" text-anchor="' + anchor + '" class="marker-txt">' + esc(d.label) + '</text>');
      });

      // Score lines
      series.forEach(function (ser) {
        if (!ser.points.length) return;
        var d = ser.points.map(function (p, i) {
          return (i ? 'L' : 'M') + X(t(p.date)).toFixed(1) + ' ' + Y(p.value).toFixed(1);
        }).join(' ');
        s.push('<path d="' + d + '" fill="none" stroke="' + ser.color + '" stroke-width="2" ' +
          'stroke-linecap="round" stroke-linejoin="round" class="ss-line"/>');
        var last = ser.points[ser.points.length - 1];
        s.push('<circle cx="' + X(t(last.date)).toFixed(1) + '" cy="' + Y(last.value).toFixed(1) +
          '" r="3.2" fill="' + ser.color + '"/>');
      });

      // X axis labels: first, middle, last
      var picks = [x0, x0 + (x1 - x0) / 2, x1];
      picks.forEach(function (ms, i) {
        var iso = new Date(ms).toISOString().slice(0, 10);
        s.push('<text x="' + X(ms).toFixed(1) + '" y="' + (H - 8) + '" class="axis-txt" text-anchor="' +
          (i === 0 ? 'start' : i === 2 ? 'end' : 'middle') + '">' + esc(GD.fmt.date(iso, 'md')) + '</text>');
      });

      s.push('</svg>');
      return s.join('');
    },

    /* ---------------------------------------------------------------------
       trend — one analyte over time against its target band.
       Target band is the filled region; reference range is the outer bound.
       --------------------------------------------------------------------- */
    trend: function (o) {
      var pts = o.points || [];
      if (pts.length < 1) return charts.emptyChart('One draw only — a trend needs two');
      var W = 560, H = o.height || 150;
      var pad = { l: 38, r: 12, t: 12, b: 24 };
      var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

      var vals = pts.map(function (p) { return p.value; });
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      if (o.targetLow !== undefined) { lo = Math.min(lo, o.targetLow); hi = Math.max(hi, o.targetHigh); }
      var span = (hi - lo) || Math.max(1, hi * 0.2);
      lo -= span * 0.18; hi += span * 0.18;

      var x0 = t(pts[0].date), x1 = t(pts[pts.length - 1].date);
      if (x1 === x0) x1 = x0 + 7 * DAY;
      function X(ms) { return pad.l + ((ms - x0) / (x1 - x0)) * iw; }
      function Y(v) { return pad.t + (1 - (v - lo) / (hi - lo)) * ih; }

      var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
        esc((o.label || 'Analyte') + ' trend') + '">'];

      if (o.targetLow !== undefined) {
        var yT = Y(o.targetHigh), yB = Y(o.targetLow);
        s.push('<rect x="' + pad.l + '" y="' + yT.toFixed(1) + '" width="' + iw + '" height="' +
          Math.max(1, yB - yT).toFixed(1) + '" class="target-band"/>');
        s.push('<text x="' + (W - pad.r) + '" y="' + (yT - 4).toFixed(1) +
          '" text-anchor="end" class="axis-txt">target</text>');
      }
      if (o.ceiling !== undefined && o.ceiling !== null && o.ceiling <= hi) {
        s.push('<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + Y(o.ceiling).toFixed(1) +
          '" y2="' + Y(o.ceiling).toFixed(1) + '" class="ceiling-line"/>');
        s.push('<text x="' + (pad.l + 3) + '" y="' + (Y(o.ceiling) - 4).toFixed(1) +
          '" class="axis-txt ceiling-txt">ceiling ' + o.ceiling + '</text>');
      }

      [lo + (hi - lo) * 0.1, hi - (hi - lo) * 0.1].forEach(function (v) {
        s.push('<text x="' + (pad.l - 5) + '" y="' + (Y(v) + 3.5).toFixed(1) +
          '" text-anchor="end" class="axis-txt">' + GD.fmt.num(v) + '</text>');
      });

      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(t(p.date)).toFixed(1) + ' ' + Y(p.value).toFixed(1); }).join(' ');
      s.push('<path d="' + d + '" fill="none" stroke="' + (o.color || 'var(--gd-improving)') +
        '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="ss-line"/>');
      pts.forEach(function (p) {
        var cls = p.flag === 'critical' ? 'pt-crit' : (p.flag === 'above_ref' || p.flag === 'below_ref') ? 'pt-warn' : 'pt-ok';
        s.push('<circle cx="' + X(t(p.date)).toFixed(1) + '" cy="' + Y(p.value).toFixed(1) +
          '" r="4" class="' + cls + '"><title>' + esc(GD.fmt.date(p.date) + ' — ' + p.value) + '</title></circle>');
      });

      s.push('<text x="' + pad.l + '" y="' + (H - 6) + '" class="axis-txt">' + esc(GD.fmt.date(pts[0].date, 'md')) + '</text>');
      s.push('<text x="' + (W - pad.r) + '" y="' + (H - 6) + '" text-anchor="end" class="axis-txt">' +
        esc(GD.fmt.date(pts[pts.length - 1].date, 'md')) + '</text>');
      s.push('</svg>');
      return s.join('');
    },

    /** Inline sparkline, no axes. For list rows. */
    spark: function (values, o) {
      o = o || {};
      if (!values || values.length < 2) return '';
      var W = o.width || 72, H = o.height || 22, p = 2;
      var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
      if (hi === lo) hi = lo + 1;
      var d = values.map(function (v, i) {
        var x = p + (i / (values.length - 1)) * (W - 2 * p);
        var y = p + (1 - (v - lo) / (hi - lo)) * (H - 2 * p);
        return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }).join(' ');
      return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
        '" class="spark" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' +
        (o.color || 'currentColor') + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    },

    /** Horizontal bars with labels. Attribution, churn reasons, service mix. */
    bars: function (rows, o) {
      o = o || {};
      if (!rows.length) return charts.emptyChart(o.emptyText || 'Nothing to chart yet');
      var max = Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1;
      return '<div class="hbars">' + rows.map(function (r) {
        var pct = Math.max(1.5, (r.value / max) * 100);
        return '<div class="hbar">' +
          '<span class="hb-lab">' + esc(r.label) + '</span>' +
          '<span class="hb-track"><i style="width:' + pct.toFixed(1) + '%' +
            (r.color ? ';background:' + r.color : '') + '"></i></span>' +
          '<span class="hb-val num">' + esc(r.display === undefined ? r.value : r.display) + '</span>' +
          '</div>';
      }).join('') + '</div>';
    },

    /** Funnel as stacked proportional bars with drop-off called out, because
        the drop-off is the only part anyone acts on. */
    funnel: function (stages) {
      if (!stages.length) return '';
      var top = stages[0].n || 1;
      return '<div class="funnel">' + stages.map(function (s, i) {
        var pct = (s.n / top) * 100;
        var prev = i ? stages[i - 1].n : null;
        var drop = prev !== null && prev > 0 ? Math.round(((prev - s.n) / prev) * 100) : null;
        return '<div class="fstage">' +
          '<div class="frow"><span class="flab">' + esc(s.label) + '</span>' +
          '<span class="fnum num">' + s.n + '</span>' +
          (drop !== null && drop > 0 ? '<span class="fdrop num">−' + drop + '%</span>' : '<span class="fdrop"></span>') +
          '</div>' +
          '<div class="ftrack"><i style="width:' + Math.max(2, pct).toFixed(1) + '%"></i></div>' +
          '</div>';
      }).join('') + '</div>';
    },

    /** Grouped columns over time. Cohort retention, monthly revenue. */
    columns: function (rows, o) {
      o = o || {};
      if (!rows.length) return charts.emptyChart('No periods yet');
      var W = 560, H = o.height || 160, pad = { l: 34, r: 8, t: 10, b: 26 };
      var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      var max = Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1;
      var bw = Math.min(46, (iw / rows.length) * 0.66);
      var s = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.ariaLabel || 'Columns') + '">'];
      s.push('<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + (pad.t + ih) + '" y2="' + (pad.t + ih) + '" class="grid-line"/>');
      s.push('<text x="' + (pad.l - 5) + '" y="' + (pad.t + 8) + '" text-anchor="end" class="axis-txt">' +
        esc(o.maxLabel || GD.fmt.num(max, 0)) + '</text>');
      rows.forEach(function (r, i) {
        var cx = pad.l + (i + 0.5) * (iw / rows.length);
        var h = Math.max(2, (r.value / max) * ih);
        s.push('<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + (pad.t + ih - h).toFixed(1) +
          '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" class="col' +
          (r.tone ? ' col-' + r.tone : '') + '"><title>' + esc(r.label + ': ' + (r.display || r.value)) + '</title></rect>');
        s.push('<text x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" class="axis-txt">' + esc(r.label) + '</text>');
      });
      s.push('</svg>');
      return s.join('');
    },

    emptyChart: function (msg) {
      return '<div class="chart-empty">' + esc(msg) + '</div>';
    }
  };
})();
