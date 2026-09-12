/* ==========================================================================
   boot.js — first render
   --------------------------------------------------------------------------
   Deliberately last and deliberately small. If anything upstream failed, this
   is where the demo says so in plain language instead of showing a blank page
   in front of a client.
   ========================================================================== */

(function () {
  'use strict';

  function fatal(title, detail) {
    document.getElementById('app').innerHTML =
      '<div style="max-width:620px;margin:12vh auto;padding:2rem;font-family:system-ui,sans-serif">' +
      '<div style="color:#e2434c;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;font-weight:800">' +
      'Prototype could not start</div>' +
      '<h1 style="font-size:1.6rem;margin:.4rem 0 1rem">' + title + '</h1>' +
      '<div style="background:#1c1c1c;border:1px solid #323232;border-left:3px solid #e2434c;' +
      'border-radius:8px;padding:1rem;font-size:.9rem;line-height:1.6;color:#a0a0a0">' + detail + '</div></div>';
  }

  try {
    if (!window.GD_DEMO) {
      return fatal('The dataset is missing',
        '<code>prototype/demo-data.js</code> did not load. Generate it with:' +
        '<pre style="margin-top:.8rem;color:#f5f5f5">node scripts/generate-fixtures.cjs</pre>' +
        'then reload this page.');
    }
    if (!window.GD || !window.GD.ui) {
      return fatal('A script did not load',
        'One of the files in <code>prototype/assets/</code> is missing or failed to parse. ' +
        'Open the browser console for the exact error.');
    }

    // Land on the console by default. The role switcher in the rail changes
    // whose view of it you are looking at.
    if (!location.hash || location.hash === '#' || location.hash === '#/') {
      location.replace('#/staff/scoreboard');
    }

    window.GD.ui.render();

    // A quick integrity note in the console for whoever is debugging.
    console.info('%cGAMEDAY PILOT', 'background:#d7262f;color:#fff;padding:2px 6px;border-radius:3px;font-weight:700',
      '\nSynthetic data only — see docs/09-compliance-register.md' +
      '\nDemo date: ' + window.GD.store.today() +
      ' (anchor ' + window.GD_DEMO.anchor_today + ', shifted ' + window.GD.store.clock.shiftDays + ' days)' +
      '\nPatients: ' + window.GD.q.patients().length +
      ' · Check-ins: ' + window.GD.store.all('checkins').length +
      ' · Lab results: ' + window.GD.store.all('lab_results').length +
      '\nCtrl/Cmd+K opens the command palette.');
  } catch (err) {
    console.error(err);
    fatal('Startup threw an error', '<pre style="white-space:pre-wrap;color:#f5f5f5">' +
      (err && err.stack ? err.stack : String(err)) + '</pre>');
  }
})();
