/* ==========================================================================
   brand.js — the Brand Kit
   --------------------------------------------------------------------------
   Rebranding this product is a token swap, never a code change. Everything a
   client can change lives in one object, is persisted in the overlay, and is
   applied by writing custom properties onto <html>.

   Two things here are more than cosmetic:

   1. ACCENT CONTRAST IS CHECKED, NOT TRUSTED. A client will paste a brand
      colour that fails WCAG AA against a dark surface. We compute the ratio,
      pick the ink colour that passes, and tell them when their colour is
      unreadable rather than shipping illegible buttons.

   2. THE SPORTS VOCABULARY IS A TOGGLE. "Stat Sheet", "Game Film", "Season"
      are right for Gameday because the brand already handed us that language.
      They are wrong for a clinic that is not Gameday. One switch swaps every
      themed noun for its plain clinical equivalent, which is what makes this
      a product rather than a one-client project (docs/08-roadmap.md, Phase D).

   Instructions are never themed. Dosing, safety, and consent copy stays
   clinically plain in both modes. docs/07-design-system.md.
   ========================================================================== */

(function () {
  'use strict';
  var GD = window.GD = window.GD || {};

  var FONTS = {
    system: { label: 'System (Inter-like)', stack: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
    grotesk: { label: 'Grotesque', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
    serif: { label: 'Serif', stack: 'Georgia, "Times New Roman", serif' },
    rounded: { label: 'Rounded', stack: 'ui-rounded, "Segoe UI Variable", "Trebuchet MS", system-ui, sans-serif' },
    mono: { label: 'Technical', stack: 'ui-monospace, "Cascadia Mono", Consolas, monospace' }
  };

  // Themed noun -> plain clinical equivalent.
  var VOCAB = {
    patientApp:  { themed: 'GAMEPLAN',     plain: 'Patient Portal' },
    staffApp:    { themed: 'PRESS BOX',    plain: 'Clinic Console' },
    scoreboard:  { themed: 'Scoreboard',   plain: 'Dashboard' },
    statSheet:   { themed: 'Stat Sheet',   plain: 'Progress' },
    gameFilm:    { themed: 'Game Film',    plain: 'Progress Photos' },
    gamePlan:    { themed: 'Game Plan',    plain: 'Treatment Plan' },
    season:      { themed: 'Season',       plain: 'Cycle' },
    seasonUnit:  { themed: 'Season',       plain: '12-week block' },
    checkIn:     { themed: 'Check-In',     plain: 'Check-In' },
    labs:        { themed: 'Labs',         plain: 'Lab Results' }
  };

  var DEFAULTS = {
    clinicName: 'Gameday Men’s Health',
    locationName: 'Thornton',
    tagline: 'Built for men who are done guessing.',
    accent: '#d7262f',
    accentInk: 'auto',
    radius: 10,
    font: 'system',
    surface: 'dark',              // dark | light | auto — console only
    logoHeight: 28,
    sportsVocabulary: true,
    showPilotBanner: true         // locked on while PILOT_MODE is true
  };

  /* ------------------------------------------------------------ contrast -- */

  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function luminance(rgb) {
    var a = rgb.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  function ratio(hexA, hexB) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB);
    if (!a || !b) return 0;
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /* --------------------------------------------------------------- brand -- */

  var brand = GD.brand = {
    DEFAULTS: DEFAULTS,
    FONTS: FONTS,
    VOCAB: VOCAB,
    ratio: ratio,

    current: function () {
      return Object.assign({}, DEFAULTS, GD.store.loadBrand() || {});
    },

    /** Ink that actually passes contrast on the accent colour. */
    inkFor: function (accent) {
      var white = ratio(accent, '#ffffff'), dark = ratio(accent, '#141414');
      return white >= dark ? '#ffffff' : '#141414';
    },

    /** What is wrong with this accent colour, in words the client can act on. */
    audit: function (b) {
      b = b || brand.current();
      var out = [];
      var rgb = hexToRgb(b.accent);
      if (!rgb) { out.push({ level: 'error', text: 'That is not a valid hex colour. Use a value like #d7262f.' }); return out; }
      var ink = b.accentInk === 'auto' ? brand.inkFor(b.accent) : b.accentInk;
      var inkRatio = ratio(b.accent, ink);
      if (inkRatio < 4.5) out.push({ level: 'warn',
        text: 'Text on your accent colour hits ' + inkRatio.toFixed(1) + ':1. AA needs 4.5:1. Buttons will be hard to read — try a darker or lighter shade.' });
      var onDark = ratio(b.accent, '#141414');
      if (onDark < 3) out.push({ level: 'warn',
        text: 'Your accent is only ' + onDark.toFixed(1) + ':1 against the dark background, so links and highlights will disappear. 3:1 is the minimum.' });
      var onLight = ratio(b.accent, '#f4f4f5');
      if (b.surface !== 'dark' && onLight < 3) out.push({ level: 'warn',
        text: 'Your accent is only ' + onLight.toFixed(1) + ':1 against the light console background.' });
      return out;
    },

    /** Writes the kit onto <html>. The only place brand values reach the DOM. */
    apply: function (b) {
      b = b || brand.current();
      var root = document.documentElement;
      var ink = b.accentInk === 'auto' ? brand.inkFor(b.accent) : b.accentInk;
      var font = (FONTS[b.font] || FONTS.system).stack;

      root.style.setProperty('--brand-accent', b.accent);
      root.style.setProperty('--brand-accent-ink', ink);
      root.style.setProperty('--brand-radius', b.radius + 'px');
      root.style.setProperty('--brand-font', font);
      root.style.setProperty('--brand-logo-height', b.logoHeight + 'px');
      root.setAttribute('data-surface', b.surface);

      document.title = b.clinicName + ' ' + b.locationName + ' — Pilot';
      var favi = document.querySelector('link[rel="icon"]');
      if (favi) favi.setAttribute('href', brand.faviconDataUrl(b));
      return b;
    },

    save: function (partial) {
      var next = Object.assign({}, brand.current(), partial || {});
      GD.store.saveBrand(next);
      brand.apply(next);
      return next;
    },

    reset: function () {
      GD.store.saveBrand(null);
      brand.apply(DEFAULTS);
      return DEFAULTS;
    },

    /* ---------------------------------------------------------- vocabulary -- */

    /** brand.word('statSheet') -> "Stat Sheet" or "Progress". */
    word: function (key) {
      var entry = VOCAB[key];
      if (!entry) return key;
      return brand.current().sportsVocabulary ? entry.themed : entry.plain;
    },

    patientAppName: function () { return brand.word('patientApp'); },
    staffAppName: function () { return brand.word('staffApp'); },

    /** "Week 6 of 12" framing. Goal gradient: never a bare week number. */
    seasonLabel: function (season) {
      if (!season) return '';
      var b = brand.current();
      return b.sportsVocabulary
        ? 'Season ' + season.seasonNo + ' · Week ' + season.week + ' of ' + season.of
        : 'Week ' + season.week + ' of ' + season.of + ' (block ' + season.seasonNo + ')';
    },

    /* -------------------------------------------------------------- marks -- */

    /** The wordmark block used in both rails. Uses the uploaded logo if there
        is one, otherwise a monogram built from the clinic name. */
    logoHtml: function (opts) {
      opts = opts || {};
      var b = brand.current();
      var logo = GD.media.get('brand:logo');
      var sub = opts.sub || '';
      var inner = logo
        ? '<img src="' + logo + '" alt="' + GD.esc(b.clinicName) + '">'
        : '<span class="mark" aria-hidden="true">' + GD.esc(GD.fmt.initials(b.clinicName)) + '</span>';
      return '<div class="rail-brand">' + inner +
        (opts.hideText ? '' :
          '<div><div class="nm">' + GD.esc(b.locationName) + '</div>' +
          (sub ? '<div class="sub">' + GD.esc(sub) + '</div>' : '') + '</div>') +
        '</div>';
    },

    faviconDataUrl: function (b) {
      b = b || brand.current();
      var ink = b.accentInk === 'auto' ? brand.inkFor(b.accent) : b.accentInk;
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<rect width="32" height="32" rx="' + Math.min(10, b.radius) + '" fill="' + b.accent + '"/>' +
        '<text x="16" y="22" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" ' +
        'font-weight="800" fill="' + ink + '">' + GD.esc(GD.fmt.initials(b.clinicName)) + '</text></svg>';
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    },

    /* ------------------------------------------------------ export/import -- */
    /* So a brand kit can be handed between environments, or to the agent
       building the production app, as one JSON file. */

    export: function () {
      var b = brand.current();
      return JSON.stringify({
        _note: 'Gameday pilot Brand Kit. Import in PRESS BOX -> Settings -> Brand Kit.',
        brand: b,
        images: Object.keys(GD.store.overlay.media).filter(function (k) {
          return k.indexOf('brand:') === 0 || k.indexOf('clinic:') === 0;
        }).reduce(function (acc, k) { acc[k] = GD.store.getMedia(k); return acc; }, {})
      }, null, 2);
    },

    import: function (jsonText) {
      var parsed = JSON.parse(jsonText);
      if (!parsed.brand) throw new Error('That file has no "brand" section.');
      Object.keys(parsed.images || {}).forEach(function (k) { GD.store.putMedia(k, parsed.images[k]); });
      return brand.save(parsed.brand);
    }
  };

  brand.apply();
})();
