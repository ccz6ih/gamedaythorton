/**
 * nav-test.cjs
 * Drives the real menu in a real browser, at phone and desktop width.
 *
 *   node scripts/nav-test.cjs                      # against the live site
 *   node scripts/nav-test.cjs http://localhost:3000
 *
 * ===========================================================================
 * WHY THIS IS NOT A STATIC CHECK
 * ===========================================================================
 * Everything that makes this menu usable is behaviour, and behaviour is the
 * one thing grepping the source cannot confirm. Whether focus actually lands
 * on the close button, whether Escape actually returns it to the trigger,
 * whether the page behind actually stops scrolling — each of those is a
 * property of the running page, and each is the sort of thing that quietly
 * stops being true during an unrelated refactor.
 *
 * It also checks the two things that are not about pointing devices at all:
 *
 *   THE LINKS ARE IN THE SERVER HTML. A crawler does not click. If the
 *   navigation only exists after React has mounted, the site has no internal
 *   linking as far as Google is concerned.
 *
 *   THE DESKTOP BAR STILL SHOWS ITS LINKS. Hiding them behind the button is
 *   the regression this design exists to avoid, and it is one careless media
 *   query away at any time.
 *
 * Chrome is driven over the DevTools protocol with Node's built-in WebSocket,
 * so there is no browser automation dependency to install or keep current.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = (process.argv[2] || 'https://www.medbarco.com').replace(/\/$/, '');
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].find(p => fs.existsSync(p));

let pass = 0, fail = 0;
const ok = (m, d) => { pass++; console.log(`  ok    ${m}${d ? '  ' + d : ''}`); };
const bad = (m, d) => { fail++; console.log(`  FAIL  ${m}${d ? '  ' + d : ''}`); };
const is = (cond, m, d) => (cond ? ok(m, d) : bad(m, d));

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cdp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'navtest-'));
  const port = 9300 + Math.floor(Math.random() * 400);
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'
  ], { stdio: 'ignore' });

  let targets = null;
  for (let i = 0; i < 60 && !targets; i++) {
    await sleep(250);
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await r.json();
      targets = list.find(t => t.type === 'page');
    } catch { /* not up yet */ }
  }
  if (!targets) { proc.kill(); throw new Error('Chrome did not expose a debugging target.'); }

  const ws = new WebSocket(targets.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const waiting = new Map();
  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise(res => {
    const n = ++id;
    waiting.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true
    });
    return r.result?.result?.value;
  };

  return {
    send, evaluate,
    close: () => { try { ws.close(); } catch {} proc.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
  };
}

(async () => {
  console.log(`\nMENU — driven in a real browser against ${BASE}\n`);

  if (!CHROME) {
    console.log('  — skipped: Chrome not found at a known path.\n');
    process.exit(0);
  }

  const b = await cdp();
  try {
    /* ===================================================================
       1. WHAT A CRAWLER SEES. No JavaScript involved.
       =================================================================== */
    console.log('IN THE SERVER HTML, BEFORE ANY SCRIPT RUNS');
    const html = await (await fetch(`${BASE}/?navtest=${Date.now()}`)).text();

    const sheetLinks = (html.match(/class="sf-sheet-link"/g) || []).length;
    is(sheetLinks >= 5, 'the sheet\'s links are server-rendered', `${sheetLinks} found`);

    const trigger = html.includes('sf-nav-trigger');
    is(trigger, 'the menu control is server-rendered');

    // The bar's own links must be there too — they are what a crawler walks.
    const barLinks = (html.match(/class="sf-link"/g) || []).length;
    is(barLinks >= 5, 'the bar\'s links are server-rendered', `${barLinks} found`);

    /* ===================================================================
       2. PHONE. The sheet is the whole navigation here.
       =================================================================== */
    console.log('\nPHONE, 390 WIDE');
    await b.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: true
    });
    await b.send('Page.enable');
    await b.send('Runtime.enable');
    await b.send('Page.navigate', { url: `${BASE}/?navtest=${Date.now()}` });
    await sleep(5000);

    const mounted = await b.evaluate(`document.querySelector('.sf-nav')?.classList.contains('is-enhanced')`);
    is(mounted === true, 'the component mounted (is-enhanced applied)');

    const barHidden = await b.evaluate(
      `getComputedStyle(document.querySelector('.sf-nav-links')).display`
    );
    is(barHidden === 'none', 'the bar\'s links are collapsed on a phone', barHidden);

    let sheetVisible = await b.evaluate(
      `getComputedStyle(document.querySelector('.sf-sheet')).visibility`
    );
    is(sheetVisible === 'hidden', 'the sheet starts closed', sheetVisible);

    // Open it the way a person does.
    await b.evaluate(`document.querySelector('.sf-nav-trigger').click()`);
    await sleep(700);

    sheetVisible = await b.evaluate(
      `getComputedStyle(document.querySelector('.sf-sheet')).visibility`
    );
    is(sheetVisible === 'visible', 'tapping Menu opens the sheet', sheetVisible);

    const focused = await b.evaluate(`document.activeElement?.className || ''`);
    is(String(focused).includes('sf-sheet-close'),
       'focus moves into the sheet, onto Close', String(focused).slice(0, 40));

    const locked = await b.evaluate(`document.body.style.overflow`);
    is(locked === 'hidden', 'the page behind cannot scroll', locked || '(empty)');

    const expanded = await b.evaluate(
      `document.querySelector('.sf-nav-trigger').getAttribute('aria-expanded')`
    );
    is(expanded === 'true', 'aria-expanded says it is open', expanded);

    const modal = await b.evaluate(
      `document.querySelector('.sf-sheet').getAttribute('aria-modal')`
    );
    is(modal === 'true', 'the sheet announces itself as a dialog', modal);

    // Tap targets. 44px is the smallest reliable one.
    const smallest = await b.evaluate(
      `Math.min(...[...document.querySelectorAll('.sf-sheet-link')].map(a => a.getBoundingClientRect().height))`
    );
    is(smallest >= 44, 'every row is at least 44px tall', `${Math.round(smallest)}px`);

    /* ===================================================================
       3. ESCAPE, AND WHERE FOCUS GOES AFTERWARDS.
       =================================================================== */
    console.log('\nCLOSING IT');
    await b.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27
    });
    await sleep(700);

    sheetVisible = await b.evaluate(
      `getComputedStyle(document.querySelector('.sf-sheet')).visibility`
    );
    is(sheetVisible === 'hidden', 'Escape closes it', sheetVisible);

    const back = await b.evaluate(`document.activeElement?.className || ''`);
    is(String(back).includes('sf-nav-trigger'),
       'focus returns to the button that opened it', String(back).slice(0, 40));

    const unlocked = await b.evaluate(`document.body.style.overflow`);
    is(unlocked !== 'hidden', 'the page can scroll again', unlocked || '(empty)');

    /* ===================================================================
       4. DESKTOP. The links must NOT be hidden behind the button.
       =================================================================== */
    console.log('\nDESKTOP, 1280 WIDE');
    await b.send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 900, deviceScaleFactor: 1, mobile: false
    });
    await b.send('Page.navigate', { url: `${BASE}/?navtest=${Date.now()}` });
    await sleep(5000);

    const barShown = await b.evaluate(
      `getComputedStyle(document.querySelector('.sf-nav-links')).display`
    );
    is(barShown !== 'none',
       'THE BAR KEEPS ITS LINKS — not hidden behind the button', barShown);

    const visibleLinks = await b.evaluate(
      `[...document.querySelectorAll('.sf-nav-links .sf-link')].filter(a => a.getBoundingClientRect().width > 0).length`
    );
    is(visibleLinks >= 5, 'they are actually on screen', `${visibleLinks} visible`);

    await b.evaluate(`document.querySelector('.sf-nav-trigger').click()`);
    await sleep(700);
    const deskOpen = await b.evaluate(
      `getComputedStyle(document.querySelector('.sf-sheet')).visibility`
    );
    is(deskOpen === 'visible', 'the sheet still opens on desktop, as an addition', deskOpen);

  } finally {
    b.close();
  }

  console.log(`\n  ${pass} passed, ${fail} failed.\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('\n  nav-test could not run:', e.message, '\n');
  process.exit(1);
});
