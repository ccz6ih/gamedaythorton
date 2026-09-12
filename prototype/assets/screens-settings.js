/* ==========================================================================
   screens-settings.js — Brand Kit, team, clinic photos, pricing, demo controls
   --------------------------------------------------------------------------
   This is the screen that decides whether the client believes the product is
   theirs. Everything they can see on it is real: change the accent and the
   whole app changes, upload a logo and it appears in both rails, upload a
   clinician headshot and it appears on the patient's pre-visit card.

   Nothing on this screen writes to a server. Images live in this browser only.
   docs/15-branding.md and docs/16-media-pipeline.md.
   ========================================================================== */

(function () {
  'use strict';
  var GD = window.GD, ui = GD.ui, q = GD.q, fmt = GD.fmt, esc = GD.esc;

  var TABS = [['brand', 'Brand Kit'], ['team', 'Team & photos'], ['clinic', 'Clinic & visit card'],
    ['services', 'Services & pricing'], ['data', 'Demo data']];

  ui.register('staff/settings', {
    title: 'Settings',
    crumb: 'Configuration',
    width: 'wide',
    render: function () {
      var tab = GD.store.pref('settingsTab') || 'brand';
      var tabs = '<div class="tabs">' + TABS.map(function (t) {
        return '<button aria-selected="' + (tab === t[0]) + '" data-act="settings-tab" data-t="' + t[0] + '">' +
          esc(t[1]) + '</button>';
      }).join('') + '</div>';
      return tabs + ({ brand: brandTab, team: teamTab, clinic: clinicTab,
        services: servicesTab, data: dataTab }[tab] || brandTab)();
    },
    after: function () {
      var tab = GD.store.pref('settingsTab') || 'brand';
      if (tab === 'brand') GD.media.dropzone(document.getElementById('logo-drop'), { maxEdge: 600 }, function (url) {
        GD.media.set('brand:logo', url);
        ui.toast('Logo added', 'ok'); ui.refresh();
      });
      if (tab === 'clinic') ['exterior', 'parking', 'room', 'lobby'].forEach(function (k) {
        GD.media.dropzone(document.getElementById('clinic-drop-' + k), { maxEdge: 1200 }, function (url) {
          GD.media.set('clinic:' + k, url);
          ui.toast(fmt.title(k) + ' photo added', 'ok'); ui.refresh();
        });
      });
    }
  });

  ui.act('settings-tab', function (data) { GD.store.pref('settingsTab', data.t); ui.refresh(); });

  /* =============================================================== brand kit */

  function brandTab() {
    var b = GD.brand.current();
    var audit = GD.brand.audit(b);
    var logo = GD.media.get('brand:logo');
    var ink = b.accentInk === 'auto' ? GD.brand.inkFor(b.accent) : b.accentInk;

    var swatches = ['#d7262f', '#c8102e', '#e35205', '#f2a900', '#00843d', '#0072ce',
      '#1d3faf', '#5b2c86', '#111111', '#6b7280'];

    return '<div class="grid g2">' +

      ui.card({
        eyebrow: 'Identity',
        title: 'Who this is for',
        body: '<div class="stack">' +
          field('Clinic name', '<input type="text" id="b_name" value="' + esc(b.clinicName) +
            '" data-act-input="brand-live" data-k="clinicName">') +
          field('Location', '<input type="text" id="b_loc" value="' + esc(b.locationName) +
            '" data-act-input="brand-live" data-k="locationName">') +
          field('Tagline', '<input type="text" id="b_tag" value="' + esc(b.tagline) +
            '" data-act-input="brand-live" data-k="tagline">',
            'Appears on the sign-in and booking screens only. Never inside the portal.') +
          '<div class="field"><label>Logo</label>' +
          (logo ? '<div class="row between" style="background:var(--gd-surface-sunken);padding:.8rem;' +
            'border:1px solid var(--gd-border);border-radius:var(--gd-r-md)">' +
            '<img src="' + logo + '" alt="" style="height:34px">' +
            '<button class="btn sm danger" data-act="brand-logo-clear">Remove</button></div>' : '') +
          '<div class="drop" id="logo-drop" style="margin-top:' + (logo ? '.6rem' : '0') + '">' +
          '<span class="big">↑</span><span class="t">' + (logo ? 'Replace logo' : 'Drop a logo, or click to choose') + '</span>' +
          '<span class="s">PNG or SVG-exported PNG. A transparent background works best on dark surfaces.</span></div>' +
          '</div>' +
          field('Logo height', '<input type="range" min="18" max="48" value="' + b.logoHeight +
            '" data-act="brand-set" data-k="logoHeight" data-num="1">', b.logoHeight + 'px') +
          '</div>'
      }) +

      ui.card({
        eyebrow: 'Colour',
        title: 'Accent',
        sub: 'One colour drives every button, highlight, chart accent, and marker in both apps.',
        body: '<div class="row" style="gap:.8rem;align-items:flex-end">' +
          '<div class="field" style="flex:0 0 78px"><label for="b_accent">Pick</label>' +
          '<input type="color" id="b_accent" value="' + esc(b.accent) + '" data-act="brand-set" data-k="accent" ' +
          'style="height:44px;padding:2px"></div>' +
          '<div class="field" style="flex:1 1 140px"><label for="b_accent_hex">Hex</label>' +
          '<input type="text" id="b_accent_hex" value="' + esc(b.accent) + '" data-act="brand-set" data-k="accent" ' +
          'spellcheck="false"></div>' +
          '</div>' +
          '<div class="row tight" style="margin-top:.8rem">' + swatches.map(function (s) {
            return '<button data-act="brand-set" data-k="accent" data-value="' + s + '" ' +
              'aria-label="' + s + '" style="width:30px;height:30px;border-radius:var(--gd-r-sm);' +
              'background:' + s + ';border:2px solid ' + (s.toLowerCase() === b.accent.toLowerCase() ? 'var(--gd-text)' : 'transparent') + ';cursor:pointer"></button>';
          }).join('') + '</div>' +

          '<div style="margin-top:1.2rem;padding:1rem;border-radius:var(--gd-r-md);background:' + b.accent +
            ';color:' + ink + '">' +
          '<div style="font-weight:800;font-size:1.05rem">Primary button and banner</div>' +
          '<div style="font-size:.84rem;opacity:.9">Ink is picked automatically for contrast: ' +
            GD.brand.ratio(b.accent, ink).toFixed(1) + ':1</div></div>' +

          (audit.length
            ? audit.map(function (a) {
                return '<div class="note-band ' + (a.level === 'error' ? 'critical' : 'warn') + '" style="margin-top:.8rem">' +
                  esc(a.text) + '</div>';
              }).join('')
            : '<div class="note-band" style="margin-top:.8rem;border-left-color:var(--gd-in-range)">' +
              '<b>Contrast passes.</b> Readable on dark and light surfaces, and on the accent itself.</div>')
      }) +

      ui.card({
        eyebrow: 'Shape and type',
        title: 'Feel',
        body: '<div class="stack">' +
          field('Corner radius', '<input type="range" min="0" max="20" value="' + b.radius +
            '" data-act="brand-set" data-k="radius" data-num="1">',
            b.radius + 'px — 0 reads corporate, 16+ reads consumer app') +
          field('Typeface', '<select data-act="brand-set" data-k="font">' +
            Object.keys(GD.brand.FONTS).map(function (k) {
              return '<option value="' + k + '"' + (k === b.font ? ' selected' : '') + '>' +
                esc(GD.brand.FONTS[k].label) + '</option>';
            }).join('') + '</select>',
            'Locally available stacks only, so the demo works with no network.') +
          field('Console surface', '<div class="opts">' + ['dark', 'light', 'auto'].map(function (s) {
              return '<button class="opt" aria-pressed="' + (b.surface === s) + '" data-act="brand-set" ' +
                'data-k="surface" data-value="' + s + '">' + esc(fmt.title(s)) + '</button>';
            }).join('') + '</div>',
            'The patient app stays dark regardless — it is used on a phone at 11pm. The front desk works under fluorescent lights, so the console can go light.') +
          '</div>'
      }) +

      /* The toggle that makes this a product rather than one clinic's project. */
      ui.card({
        eyebrow: 'Language',
        title: 'Sports vocabulary',
        sub: 'Gameday handed us this language, so we use it. A clinic that is not Gameday should not have to.',
        body: '<label class="switch"><input type="checkbox"' + (b.sportsVocabulary ? ' checked' : '') +
          ' data-act="brand-vocab"><span class="track"></span>' +
          '<span class="txt">Use the sports metaphor</span></label>' +
          '<div class="table-scroll" style="margin-top:1rem"><table><thead><tr><th>Concept</th>' +
          '<th>Themed</th><th>Plain clinical</th></tr></thead><tbody>' +
          Object.keys(GD.brand.VOCAB).map(function (k) {
            var v = GD.brand.VOCAB[k];
            var on = b.sportsVocabulary;
            return '<tr><td class="dim">' + esc(fmt.title(k)) + '</td>' +
              '<td' + (on ? ' style="font-weight:700"' : ' class="dim"') + '>' + esc(v.themed) + '</td>' +
              '<td' + (!on ? ' style="font-weight:700"' : ' class="dim"') + '>' + esc(v.plain) + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<div class="note-band" style="margin-top:1rem"><b>Only nouns are themed, never instructions.</b> ' +
          'Dosing guidance, safety information, and consent language stay clinically plain in both modes. ' +
          'A man mis-dosing testosterone because the copy was being clever is not an acceptable trade for personality.</div>'
      }) +

      ui.card({
        eyebrow: 'Portability',
        title: 'Hand this kit to someone else',
        sub: 'Exports the settings and the brand images as one JSON file. Import it in another browser or hand it to whoever builds production.',
        body: '<div class="row">' +
          '<button class="btn" data-act="brand-export">Copy Brand Kit JSON</button>' +
          '<button class="btn" data-act="brand-import">Import…</button>' +
          '<button class="btn danger" data-act="brand-reset">Reset to Gameday defaults</button>' +
          '</div>'
      }) +

      '</div>';
  }

  function field(label, control, hint) {
    return '<div class="field"><label>' + esc(label) + '</label>' + control +
      (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') + '</div>';
  }

  // Typed text applies live but does not re-render, so focus is never stolen
  // mid-word. Structural controls re-render because they change layout.
  ui.act('brand-live', function (data, el) {
    var patch = {}; patch[data.k] = el.value;
    GD.brand.save(patch);
  });

  ui.act('brand-set', function (data, el) {
    var val = data.value !== undefined ? data.value : el.value;
    if (data.num) val = Number(val);

    if (data.k === 'accent') {
      // Normalise, and accept 3-digit shorthand since that is how people write
      // hex by hand. A half-typed value is ignored rather than applied, or the
      // whole app flashes through a garbage colour on the way to a valid one.
      var hex = String(val).trim().replace(/^#/, '');
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      if (!/^[0-9a-f]{6}$/i.test(hex)) {
        ui.toast('That is not a hex colour. Try something like #d7262f.', 'warn');
        return;
      }
      val = '#' + hex.toLowerCase();
    }

    var patch = {}; patch[data.k] = val;
    GD.brand.save(patch);
    ui.refresh();
  });

  ui.act('brand-vocab', function (data, el) {
    GD.brand.save({ sportsVocabulary: el.checked });
    ui.toast(el.checked ? 'Sports vocabulary on' : 'Plain clinical vocabulary on', 'ok');
    ui.refresh();
  });

  ui.act('brand-logo-clear', function () {
    GD.media.del('brand:logo'); ui.toast('Logo removed'); ui.refresh();
  });

  ui.act('brand-reset', function () {
    ui.confirm({ title: 'Reset the Brand Kit?', sub: 'Colours, type, radius and vocabulary go back to the Gameday defaults. Uploaded images are kept.',
      okLabel: 'Reset', danger: true }).then(function (yes) {
      if (!yes) return;
      GD.brand.reset(); ui.toast('Brand Kit reset', 'ok'); ui.refresh();
    });
  });

  ui.act('brand-export', function () {
    var json = GD.brand.export();
    ui.modal({
      title: 'Brand Kit JSON',
      sub: 'Select all and copy. Images are embedded, so this file can be large.',
      wide: true,
      body: '<textarea readonly style="min-height:260px;font-family:ui-monospace,monospace;font-size:.76rem">' +
        esc(json) + '</textarea>',
      actions: '<button class="btn primary" data-act="close-modal">Done</button>',
      after: function (wrap) {
        var ta = wrap.querySelector('textarea');
        ta.focus(); ta.select();
        if (navigator.clipboard) navigator.clipboard.writeText(json).then(function () {
          ui.toast('Copied to clipboard', 'ok');
        }, function () {});
      }
    });
  });

  ui.act('brand-import', function () {
    ui.modal({
      title: 'Import a Brand Kit',
      body: '<div class="field"><label for="bi_json">Paste the JSON</label>' +
        '<textarea id="bi_json" style="min-height:180px;font-family:ui-monospace,monospace;font-size:.76rem"></textarea></div>',
      actions: '<button class="btn ghost" data-act="close-modal">Cancel</button>' +
        '<button class="btn primary" data-act="brand-import-go">Import</button>'
    });
  });
  ui.act('brand-import-go', function () {
    try {
      GD.brand.import(document.getElementById('bi_json').value);
      ui.closeModal(); ui.toast('Brand Kit imported', 'ok'); ui.refresh();
    } catch (e) {
      ui.toast('Could not read that: ' + e.message, 'warn');
    }
  });

  /* ==================================================================== team */

  function teamTab() {
    var providers = q.providers();
    var staff = q.staff();

    return ui.card({
      eyebrow: 'Clinicians',
      title: 'Who the patient sees',
      sub: 'A real face is the single most effective anxiety reducer in the pre-visit card. The corporate site currently renders "No items found" here — an empty CMS collection where the clinicians should be.',
      body: '<div class="grid g2">' + providers.map(function (p) {
        var has = GD.media.has('provider:' + p.id);
        return '<div class="labcard"><div class="row" style="gap:1rem;align-items:flex-start">' +
          '<span class="av xl sq"><img src="' + GD.media.personSrc('provider:' + p.id, p.name, 3) + '" alt=""></span>' +
          '<div style="flex:1 1 140px;min-width:0">' +
          '<div style="font-weight:700">' + esc(p.name) + '</div>' +
          '<div class="muted" style="font-size:.82rem">' + esc(p.role || '') + ' · ' + esc(p.credentials || '') + '</div>' +
          '<div class="row tight" style="margin-top:.6rem">' +
          '<button class="btn sm" data-act="prov-photo" data-id="' + p.id + '">' + (has ? 'Replace' : 'Add photo') + '</button>' +
          (has ? '<button class="btn sm ghost" data-act="prov-photo-clear" data-id="' + p.id + '">Remove</button>' : '') +
          '<button class="btn sm ghost" data-act="prov-edit" data-id="' + p.id + '">Edit</button>' +
          '</div></div></div>' +
          (has ? '' : '<div class="note-band warn" style="margin-top:.8rem">Placeholder silhouette. ' +
            'Patients see this on their pre-visit card.</div>') +
          '<div class="dim" style="font-size:.78rem;margin-top:.7rem;line-height:1.5">' + esc(p.bio || '') + '</div>' +
          '</div>';
      }).join('') + '</div>' +
      '<button class="btn" style="margin-top:1rem" data-act="prov-add">Add a clinician</button>'
    }) +

    ui.card({
      eyebrow: 'Console access',
      title: 'Staff accounts',
      sub: 'In the pilot the console sits behind one shared passcode and no real accounts are provisioned. Per-user accounts with mandatory MFA land in Phase C.',
      body: '<div class="table-scroll"><table><thead><tr><th>Name</th><th>Role</th><th>Email</th>' +
        '<th>MFA</th></tr></thead><tbody>' + staff.map(function (s) {
          return '<tr><td><b>' + esc(s.name) + '</b></td><td>' + esc(fmt.title(s.role)) + '</td>' +
            '<td class="dim">' + esc(s.email) + '</td>' +
            '<td>' + (s.mfa_enabled ? ui.pill('on', 'ok') : ui.pill('Phase C', 'warn')) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
    });
  }

  ui.act('prov-photo', function (data) {
    GD.media.pick({ square: true, maxEdge: 600 }).then(function (url) {
      if (!url) return;
      GD.media.set('provider:' + data.id, url);
      GD.store.patch('providers', data.id, { photo_ref: 'local:' + data.id });
      ui.toast('Headshot added. It now appears on the pre-visit card.', 'ok');
      ui.refresh();
    }, function (e) { ui.toast(e.message, 'warn'); });
  });
  ui.act('prov-photo-clear', function (data) {
    GD.media.del('provider:' + data.id);
    GD.store.patch('providers', data.id, { photo_ref: null });
    ui.toast('Photo removed'); ui.refresh();
  });

  ui.act('prov-edit', function (data) {
    var p = q.provider(data.id);
    ui.modal({
      title: 'Edit clinician',
      body: field('Name', '<input type="text" id="pv_name" value="' + esc(p.name) + '">') +
        field('Credentials', '<input type="text" id="pv_cred" value="' + esc(p.credentials || '') + '">') +
        field('Role', '<input type="text" id="pv_role" value="' + esc(p.role || '') + '">') +
        field('Bio', '<textarea id="pv_bio">' + esc(p.bio || '') + '</textarea>',
          'Shown on the booking screen and the pre-visit card.'),
      actions: '<button class="btn ghost" data-act="close-modal">Cancel</button>' +
        '<button class="btn primary" data-act="prov-save" data-id="' + p.id + '">Save</button>'
    });
  });
  ui.act('prov-save', function (data) {
    GD.store.patch('providers', data.id, {
      name: document.getElementById('pv_name').value,
      credentials: document.getElementById('pv_cred').value,
      role: document.getElementById('pv_role').value,
      bio: document.getElementById('pv_bio').value
    });
    ui.closeModal(); ui.toast('Saved', 'ok'); ui.refresh();
  });
  ui.act('prov-add', function () {
    GD.store.add('providers', { name: 'New Clinician', credentials: '', role: 'Provider',
      photo_ref: null, bio: '', active: true });
    ui.toast('Clinician added — edit the details and add a photo', 'ok');
    ui.refresh();
  });

  /* ================================================================== clinic */

  function clinicTab() {
    var c = q.clinic();
    var facts = c.visit_facts || {};
    var kinds = [['exterior', 'The building from the street'], ['parking', 'Where to park'],
      ['room', 'A consult room'], ['lobby', 'The entrance / lobby']];

    return ui.card({
      eyebrow: 'Specificity kills anxiety',
      title: 'Pre-visit photos',
      sub: 'Generic reassurance does nothing. A photo of the actual parking lot does a lot. These appear on the patient’s pre-visit card.',
      body: '<div class="grid g2">' + kinds.map(function (k) {
        var has = GD.media.has('clinic:' + k[0]);
        return '<div><img src="' + GD.media.clinicSrc(k[0]) + '" alt="" ' +
          'style="width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:var(--gd-r-md);border:1px solid var(--gd-border)">' +
          '<div class="row between" style="margin-top:.5rem">' +
          '<span style="font-size:.84rem;font-weight:600">' + esc(k[1]) + '</span>' +
          (has ? '<button class="btn sm ghost" data-act="clinic-photo-clear" data-k="' + k[0] + '">Remove</button>' : '') +
          '</div>' +
          '<div class="drop" id="clinic-drop-' + k[0] + '" style="margin-top:.4rem;padding:.8rem">' +
          '<span class="t" style="font-size:.82rem">' + (has ? 'Replace' : 'Add photo') + '</span></div>' +
          '</div>';
      }).join('') + '</div>'
    }) +

    ui.card({
      eyebrow: 'The questions men actually ask',
      title: 'Visit facts',
      sub: 'The corporate FAQ answers exactly these, which tells us they are the real objections. Answer them concretely and before he asks.',
      body: '<div class="stack">' +
        [['parking', 'Parking'], ['suite', 'Finding the suite'], ['draw', 'The blood draw'],
         ['duration', 'How long it takes'], ['privacy', 'Privacy'], ['cost', 'Cost']].map(function (k) {
          return field(k[1], '<textarea data-act-input="visit-fact" data-k="' + k[0] + '" ' +
            'style="min-height:56px">' + esc(facts[k[0]] || '') + '</textarea>');
        }).join('') + '</div>'
    }) +

    ui.card({
      eyebrow: 'Location',
      title: 'Name, address, phone',
      body: '<div class="grid g2">' +
        field('Address', '<input type="text" data-act-input="clinic-field" data-k="address_line1" value="' + esc(c.address_line1 || '') + '">') +
        field('City', '<input type="text" data-act-input="clinic-field" data-k="address_city" value="' + esc(c.address_city || '') + '">') +
        field('Voice', '<input type="text" data-act-input="clinic-field" data-k="phone_voice" value="' + esc(c.phone_voice || '') + '">') +
        field('Text', '<input type="text" data-act-input="clinic-field" data-k="phone_text" value="' + esc(c.phone_text || '') + '">') +
        '</div>' +
        (c.nap_conflict_note ? '<div class="note-band warn" style="margin-top:1rem">' +
          '<b>NAP conflict, worth fixing before any review automation.</b> ' + esc(c.nap_conflict_note) +
          ' This splits local-SEO authority across three city entities and fragments reviews across listings. ' +
          'Sequence the fix first, or review requests land on the wrong profile.</div>' : '') +
        '<div class="table-scroll" style="margin-top:1.2rem"><table><thead><tr><th>Day</th><th>Open</th><th>Close</th></tr></thead><tbody>' +
        (c.hours || []).map(function (h) {
          return '<tr><td><b>' + esc(h.day) + '</b></td>' +
            '<td>' + (h.open ? esc(h.open) : '<span class="dim">closed</span>') + '</td>' +
            '<td>' + (h.close ? esc(h.close) : '<span class="dim">—</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="dim" style="font-size:.8rem;margin-top:.8rem">Mon–Fri 9–5, closed weekends. ' +
        'Narrow hours are exactly why self-serve booking and a waitlist matter more here than they would elsewhere.</p>'
    });
  }

  ui.act('clinic-photo-clear', function (data) {
    GD.media.del('clinic:' + data.k); ui.toast('Photo removed'); ui.refresh();
  });
  ui.act('visit-fact', function (data, el) {
    var c = q.clinic();
    var facts = Object.assign({}, c.visit_facts || {});
    facts[data.k] = el.value;
    GD.store.patchObj('clinic', { visit_facts: facts });
  });
  ui.act('clinic-field', function (data, el) {
    var patch = {}; patch[data.k] = el.value;
    GD.store.patchObj('clinic', patch);
  });

  /* ================================================================ services */

  function servicesTab() {
    var services = q.services();
    var plans = q.plans();
    var cats = {};
    services.forEach(function (s) { (cats[s.category] = cats[s.category] || []).push(s); });

    return '<div class="note-band warn" style="margin-bottom:1.2rem">' +
      '<b>Every price here is a placeholder.</b> No pricing is published anywhere on the corporate location pages, ' +
      'so these are invented for the demo. Published, accurate pricing is a conversion lever — the men using ' +
      'this want to know the cost without talking to anyone — so getting the real numbers is a discovery ' +
      'priority, not a detail.</div>' +

      ui.card({
        eyebrow: 'Memberships',
        title: 'Plans',
        body: '<div class="grid g3">' + plans.map(function (p) {
          return '<div class="labcard"><div style="font-weight:700">' + esc(p.name) + '</div>' +
            '<div class="lval">' + fmt.money(p.price_cents) + '<small>/' + esc(p.interval) + '</small></div>' +
            '<ul style="padding-left:1.1rem;font-size:.8rem;line-height:1.6;color:var(--gd-text-muted);margin-top:.6rem">' +
            (p.includes || []).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' +
            (p.provisional_price ? '<div style="margin-top:.6rem">' + ui.pill('placeholder price', 'warn') + '</div>' : '') +
            '</div>';
        }).join('') + '</div>'
      }) +

      Object.keys(cats).map(function (cat) {
        return ui.card({
          eyebrow: fmt.title(cat),
          title: cats[cat].length + ' services',
          body: '<div class="table-scroll"><table><thead><tr><th>Service</th><th class="num">Minutes</th>' +
            '<th class="num">Price</th><th>Labs</th><th>Consent</th><th>Active</th></tr></thead><tbody>' +
            cats[cat].map(function (s) {
              return '<tr><td><b>' + esc(s.name) + '</b></td>' +
                '<td class="num">' + s.duration_min + '</td>' +
                '<td><input type="number" value="' + (s.price_cents / 100) + '" step="1" min="0" ' +
                  'data-act-input="svc-price" data-id="' + s.id + '" style="max-width:110px;text-align:right" ' +
                  'aria-label="Price for ' + esc(s.name) + '"></td>' +
                '<td>' + (s.requires_labs ? ui.pill('required', 'info') : '<span class="dim">—</span>') + '</td>' +
                '<td>' + (s.requires_consent ? ui.pill('required', 'warn') : '<span class="dim">—</span>') + '</td>' +
                '<td>' + (s.active ? ui.pill('live', 'ok') : ui.pill('off')) + '</td></tr>';
            }).join('') + '</tbody></table></div>'
        });
      }).join('');
  }

  ui.act('svc-price', function (data, el) {
    GD.store.patch('services', data.id, { price_cents: Math.round(Number(el.value || 0) * 100) });
  });

  /* ==================================================================== data */

  function dataTab() {
    var usage = GD.media.usage();
    var writes = GD.store.pilotWrites();
    var clock = GD.store.clock;
    var mediaKeys = Object.keys(GD.store.overlay.media);

    return ui.card({
      tone: 'critical',
      eyebrow: 'The rule that governs this build',
      title: 'Synthetic data only',
      body: '<p class="muted" style="font-size:.9rem;line-height:1.6">This system has no HIPAA controls. No BAAs are ' +
        'signed, there is no audit logging, no encryption-at-rest guarantee, and no access control worth the name. ' +
        'That is deliberate — it lets the clinic see and argue with the product before anyone pays for ' +
        'compliance infrastructure.</p>' +
        '<p style="font-size:.92rem;line-height:1.6;margin-top:.8rem"><b>No real patient data goes in here. Not one name.</b> ' +
        'If staff ask to "just try it with a couple of real patients", the answer is no, and ' +
        '<code>docs/09-compliance-register.md</code> is the document that explains why.</p>' +
        '<p class="muted" style="font-size:.88rem;line-height:1.6;margin-top:.8rem">A men’s-health clinic holds ' +
        'testosterone prescriptions, ED diagnoses, and lab values. A leak here is a reportable breach with statutory ' +
        'penalties, and the franchisee carries it.</p>'
    }) +

    ui.card({
      eyebrow: 'State',
      title: 'What this browser is holding',
      body: '<div class="grid g3">' +
        ui.stat({ label: 'Seeded patients', value: q.patients().length }) +
        ui.stat({ label: 'Pilot edits this session', value: writes }) +
        ui.stat({ label: 'Images stored locally', value: usage.mb, unit: 'MB',
          note: usage.near ? 'Close to the browser limit' : mediaKeys.length + ' files' }) +
        '</div>' +
        '<dl class="kv" style="margin-top:1.2rem">' +
        '<dt>Demo date</dt><dd>' + esc(fmt.date(GD.store.today(), 'long')) + '</dd>' +
        '<dt>Dataset anchor</dt><dd>' + esc(GD.store.raw.anchor_today) + '</dd>' +
        '<dt>Shift applied</dt><dd class="num">' + clock.shiftDays + ' days' +
          (clock.rolledForward ? ' (rolled to Monday — clinic is closed weekends)' : '') + '</dd>' +
        '<dt>Generated</dt><dd>' + esc((GD.store.raw.generated_at || '').slice(0, 10)) + '</dd>' +
        '</dl>' +
        (mediaKeys.length ? '<div class="list" style="margin-top:1.2rem">' + mediaKeys.map(function (k) {
          return '<div class="item"><span class="body"><span class="ttl" style="font-family:ui-monospace,monospace;font-size:.8rem">' +
            esc(k) + '</span><span class="sub">' + Math.round((GD.store.getMedia(k) || '').length * 0.75 / 1024) + ' KB</span></span>' +
            '<span class="side"><button class="btn sm ghost" data-act="media-del" data-k="' + esc(k) + '">Remove</button></span></div>';
        }).join('') + '</div>' : '')
    }) +

    ui.card({
      eyebrow: 'Controls',
      title: 'Reset between demo sessions',
      sub: 'Run this before each interview so every session starts from the same roster.',
      body: '<div class="row">' +
        '<button class="btn primary" data-act="reset-demo">Reset demo data</button>' +
        '<button class="btn danger" data-act="wipe-all">Wipe everything including images</button>' +
        '</div>' +
        '<p class="dim" style="font-size:.8rem;margin-top:.8rem;line-height:1.5">' +
        'To regenerate the seeded dataset itself, run <code>node scripts/generate-fixtures.cjs</code> and reload. ' +
        'The generator is deterministic, so the roster comes back identical every time.</p>'
    }) +

    ui.card({
      eyebrow: 'Roster',
      title: 'What each synthetic patient demonstrates',
      sub: 'A dataset of happy, improving patients demos beautifully and teaches nothing. These are built around the awkward cases.',
      body: '<div class="list">' + q.patients().map(function (p) {
        return '<button class="item" data-act="open-patient" data-id="' + p.id + '">' +
          '<span class="body"><span class="ttl">' + esc(q.name(p)) + '</span>' +
          '<span class="sub">' + esc(GD.rosterNote[p.id] || '') + '</span></span>' +
          '<span class="side" style="font-family:ui-monospace,monospace;font-size:.74rem">' + esc(p.id) + '</span></button>';
      }).join('') + '</div>'
    });
  }

  ui.act('media-del', function (data) {
    GD.media.del(data.k); ui.toast('Removed'); ui.refresh();
  });

  ui.act('wipe-all', function () {
    ui.confirm({ title: 'Wipe everything?', sub: 'Removes every pilot edit, the Brand Kit, and every uploaded image from this browser. Cannot be undone.',
      okLabel: 'Wipe it all', danger: true }).then(function (yes) {
      if (!yes) return;
      GD.store.reset();
      GD.brand.apply(GD.brand.DEFAULTS);
      ui.toast('Everything cleared', 'ok');
      ui.go('staff/scoreboard');
      ui.render();
    });
  });
})();
