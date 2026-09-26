/**
 * calendar-preview.cjs — look at the month grid before shipping it.
 *
 *   node scripts/calendar-preview.cjs
 *
 * WHY THIS EXISTS
 * This calendar has been called "terrible" twice, and both times the fault was
 * CSS that no test could see: once the prototype's `.cal { display: grid }`
 * reaching the rebuilt markup, once a rule that shipped in the bundle and lost
 * the cascade. Both would have been obvious in a browser in five seconds.
 *
 * Running the real page needs a database and a login. This needs neither: it
 * loads the SAME four stylesheets in the SAME order as app/layout.tsx and
 * renders the month markup inside them, at phone width and desktop width side
 * by side.
 *
 * WHAT IT DOES NOT PROVE
 * It is a CSS harness, not the component. The markup below mirrors
 * MonthGrid.tsx by hand, so it can prove the STYLING works and cannot prove
 * the component emits exactly this. Data correctness, the location filter and
 * the links are the page's business, not this file's.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.calendar-preview');

const SHEETS = [
  'prototype/assets/tokens.css',
  'prototype/assets/app.css',
  'prototype/assets/storefront.css',
  'app/app-extras.css'
];

const css = SHEETS.map(f => {
  const p = path.join(ROOT, f);
  return `/* ===== ${f} ===== */\n` + fs.readFileSync(p, 'utf8');
}).join('\n\n');

/* A month with the shape that breaks things: starts mid-week, has a busy run,
   a closed weekend, a day with four+ appointments, and one somewhere else. */
const SELECTED = 15;
const TODAY = 12;
const LOAD = { 2: 1, 3: 3, 5: 2, 9: 4, 10: 1, 12: 2, 15: 3, 16: 7, 18: 1, 23: 2, 24: 1, 30: 2 };
const ELSEWHERE = new Set([16, 23]);
const CLOSED_DOW = new Set([0, 6]);       // Sun, Sat
const FIRST_DOW = 2;                       // month starts on a Tuesday
const DAYS = 30;

function cells() {
  const out = [];
  // leading padding days
  for (let i = 0; i < FIRST_DOW; i++) {
    const n = 30 - FIRST_DOW + i + 1;
    out.push({ n, outside: true, dow: i });
  }
  for (let d = 1; d <= DAYS; d++) {
    out.push({ n: d, dow: (FIRST_DOW + d - 1) % 7, count: LOAD[d] ?? 0, elsewhere: ELSEWHERE.has(d) });
  }
  while (out.length % 7) out.push({ n: out.length - DAYS - FIRST_DOW + 1, outside: true, dow: out.length % 7 });
  return out;
}

function cellHtml(c) {
  const cls = ['cal-cell'];
  if (c.outside) cls.push('is-outside');
  if (!c.outside && c.n === TODAY) cls.push('is-today');
  if (!c.outside && c.n === SELECTED) cls.push('is-selected');
  if (CLOSED_DOW.has(c.dow)) cls.push('is-closed');
  if (!c.outside && c.n < TODAY) cls.push('is-past');

  let load = '';
  if (c.count > 0) {
    // Parenthesised: `.repeat()` binds tighter than `+`, so without these it
    // repeated only the trailing '"></i>' and printed literal `">">` in every
    // cell. Caught by looking at the render.
    const pip = `<i class="cal-pip${c.elsewhere ? ' is-elsewhere' : ''}"></i>`;
    load = c.count <= 3
      ? `<span class="cal-cell-load">${pip.repeat(c.count)}</span>`
      : `<span class="cal-cell-load"><span class="cal-cell-n">${c.count}</span></span>`;
  }
  return `<a class="${cls.join(' ')}" href="#"><span class="n">${c.n}</span>${load}</a>`;
}

const ROWS = [
  ['9', '45 min', 'Carlos Hernandez', 'PRF + Nue Strand Hair Restoration', null, ''],
  ['10:30', '20 min', 'Amanda Flores', 'Frotox | SubZero Cryo Facial', 'Gameday Northglenn', ''],
  ['2pm', '1h 25m', 'Sarah Carda', 'Jeuveau® Neurotoxin Treatment', null, ''],
  ['4pm', '30 min', 'Dana Whitfield', 'SubZero Cryo Sculpt | Small Area', null, 'st-cancelled']
];

function rowHtml([t, d, who, what, where, st]) {
  return `<a class="cal-row ${st}" href="#">
    <span class="cal-row-time"><span class="t">${t}</span><span class="d">${d}</span></span>
    <span class="cal-row-body">
      <span class="cal-row-who">${who}</span>
      <span class="cal-row-what">${what}</span>
      ${where ? `<span class="cal-row-where">${where}</span>` : ''}
      ${st.includes('cancelled') ? '<span class="cal-row-flag">Cancelled</span>' : ''}
    </span>
  </a>`;
}

const month = `
<div class="view wide">
  <section class="card flush">
    <div class="cal-month">
      <div class="cal-month-head">
        <a class="cal-month-nav" href="#">&lsaquo;</a>
        <h2>September 2026</h2>
        <a class="cal-month-nav" href="#">&rsaquo;</a>
      </div>
      <div class="cal-month-dow" aria-hidden="true">
        ${['S','M','T','W','T','F','S'].map(d => `<span>${d}</span>`).join('')}
      </div>
      <div class="cal-month-grid">${cells().map(cellHtml).join('')}</div>
      <section class="cal-month-day">
        <h3>Tuesday, September 15<span class="n">4 booked</span></h3>
        <div class="cal-agenda-list">${ROWS.map(rowHtml).join('')}</div>
      </section>
    </div>
  </section>
</div>`;

/**
 * THE PAGE GOES IN AN IFRAME, AND THAT IS THE WHOLE POINT.
 *
 * Two earlier attempts measured the wrong thing:
 *
 *   1. A `.frame { width: 390px; margin: 0 auto }` wrapper. A centred
 *      fixed-width box whose content is wider overflows symmetrically, so the
 *      capture showed a card clipped on both sides — a layout the product does
 *      not have, and a bug that did not exist.
 *
 *   2. No wrapper, relying on `--window-size=390`. Headless Chrome refuses to
 *      go that narrow: window.innerWidth came back 500. So the page laid out
 *      at 500px while the screenshot cropped to 390, which looks exactly like
 *      a column overflowing and is not.
 *
 * An iframe establishes its own viewport, so media queries inside it resolve
 * against ITS width. 390px in an iframe is a real 390px phone as far as the
 * CSS is concerned, whatever the browser window is doing.
 */
const doc = `<!doctype html>
<html lang="en" data-surface="light"><head><meta charset="utf-8">
<title>month</title><style>${css}</style>
<style>body { margin:0; background:var(--gd-bg); }</style></head>
<body>${month}</body></html>`;

const frame = (title, width, height) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { margin:0; background:#555; font-family:system-ui; }
  iframe { width:${width}px; height:${height}px; border:0; display:block; background:#fff; }
</style></head>
<body><iframe src="./month.html" scrolling="no"></iframe></body></html>`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'month.html'), doc);
fs.writeFileSync(path.join(OUT, 'phone.html'), frame('Month — 390px', 390, 1150));
fs.writeFileSync(path.join(OUT, 'desktop.html'), frame('Month — 1100px', 1100, 980));
fs.writeFileSync(path.join(OUT, 'index.html'),
`<!doctype html><meta charset="utf-8"><title>Calendar preview</title>
<body style="font-family:system-ui;padding:2rem;background:#EFE7DA;color:#16201A">
<h1 style="font-family:Georgia,serif;font-weight:400">Month grid</h1>
<p>Real stylesheets, same order as app/layout.tsx. Styling only — not the component.</p>
<ul style="line-height:2">
  <li><a href="./phone.html">phone — 390px</a></li>
  <li><a href="./desktop.html">desktop — 1100px</a></li>
</ul></body>`);

console.log(`  phone.html + desktop.html written`);
console.log(`  ${path.join(OUT, 'index.html')}\n`);
