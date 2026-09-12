/* ==========================================================================
   media.js — images in the pilot
   --------------------------------------------------------------------------
   Three jobs:

     1. Let the client put their own images in: logo, clinician headshots,
        clinic exterior / parking / room shots, patient progress photos.
     2. Never let an image leave the browser. Everything is downscaled on a
        canvas and held in localStorage. No upload endpoint exists in the
        pilot, which is what makes it safe to demo before Phase C.
     3. Render a useful placeholder when no image has been added, so every
        screen is legible on first open instead of full of grey boxes.

   Re-encoding through a canvas also strips EXIF, including GPS. That is a
   Phase C requirement (docs/06-architecture.md) that costs nothing to do now,
   so it is done now. See docs/16-media-pipeline.md.

   KEY CONVENTION
     brand:logo                  the clinic's logo
     brand:logo-light            optional variant for light surfaces
     clinic:exterior|parking|room|lobby
     provider:<providerId>       clinician headshot
     patient:<patientId>:avatar  patient photo (staff-side identification)
     photo:<photoId>             a Game Film frame
   ========================================================================== */

(function () {
  'use strict';
  var GD = window.GD = window.GD || {};

  var MAX_EDGE_DEFAULT = 1000;
  var QUALITY = 0.82;
  var SOFT_LIMIT_BYTES = 3.6 * 1024 * 1024;   // localStorage is ~5MB; warn early

  function esc(s) { return GD.esc ? GD.esc(s) : String(s); }

  var media = GD.media = {

    /* ------------------------------------------------------ read / write -- */

    get: function (key) { return GD.store.getMedia(key); },
    set: function (key, dataUrl) { GD.store.putMedia(key, dataUrl); },
    del: function (key) { GD.store.delMedia(key); },
    has: function (key) { return !!GD.store.getMedia(key); },

    usage: function () {
      var bytes = GD.store.mediaBytes();
      return {
        bytes: bytes,
        mb: +(bytes / 1048576).toFixed(2),
        pct: Math.min(100, Math.round((bytes / SOFT_LIMIT_BYTES) * 100)),
        near: bytes > SOFT_LIMIT_BYTES * 0.8
      };
    },

    /* --------------------------------------------------------- ingestion -- */

    /**
     * Downscale and re-encode a File to a data URL.
     * Re-encoding is the point: it caps the size AND drops every EXIF tag,
     * including the GPS coordinates a phone camera writes by default.
     */
    fromFile: function (file, opts) {
      opts = opts || {};
      var maxEdge = opts.maxEdge || MAX_EDGE_DEFAULT;
      return new Promise(function (resolve, reject) {
        if (!file) return reject(new Error('No file given'));
        if (!/^image\//.test(file.type)) return reject(new Error('That file is not an image.'));
        if (file.size > 25 * 1024 * 1024) return reject(new Error('That image is over 25MB. Please pick a smaller one.'));

        var reader = new FileReader();
        reader.onerror = function () { reject(new Error('Could not read that file.')); };
        reader.onload = function () {
          var img = new Image();
          img.onerror = function () { reject(new Error('Could not decode that image.')); };
          img.onload = function () {
            var w = img.naturalWidth, h = img.naturalHeight;
            var scale = Math.min(1, maxEdge / Math.max(w, h));
            var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));

            // Square crop for headshots and avatars, centred.
            if (opts.square) {
              var side = Math.min(cw, ch);
              var canvas = document.createElement('canvas');
              canvas.width = canvas.height = side;
              var ctx = canvas.getContext('2d');
              ctx.imageSmoothingQuality = 'high';
              var sSide = Math.min(w, h);
              ctx.drawImage(img, (w - sSide) / 2, (h - sSide) / 2, sSide, sSide, 0, 0, side, side);
              return resolve(canvas.toDataURL('image/jpeg', opts.quality || QUALITY));
            }

            var c2 = document.createElement('canvas');
            c2.width = cw; c2.height = ch;
            var x2 = c2.getContext('2d');
            x2.imageSmoothingQuality = 'high';
            x2.drawImage(img, 0, 0, cw, ch);
            resolve(c2.toDataURL('image/jpeg', opts.quality || QUALITY));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    },

    /** Opens the OS file picker and returns the processed data URL. */
    pick: function (opts) {
      return new Promise(function (resolve, reject) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.onchange = function () {
          var f = input.files && input.files[0];
          document.body.removeChild(input);
          if (!f) return resolve(null);
          media.fromFile(f, opts).then(resolve, reject);
        };
        input.click();
      });
    },

    /**
     * Wire an element as a click-and-drop upload target.
     * onDone receives the processed data URL.
     */
    dropzone: function (el, opts, onDone) {
      if (!el) return;
      opts = opts || {};
      function handle(file) {
        media.fromFile(file, opts).then(function (url) {
          onDone(url);
        }, function (err) {
          GD.ui && GD.ui.toast(err.message, 'warn');
        });
      }
      el.addEventListener('click', function () {
        media.pick(opts).then(function (url) { if (url) onDone(url); },
          function (err) { GD.ui && GD.ui.toast(err.message, 'warn'); });
      });
      el.addEventListener('dragover', function (e) { e.preventDefault(); el.dataset.over = '1'; });
      el.addEventListener('dragleave', function () { delete el.dataset.over; });
      el.addEventListener('drop', function (e) {
        e.preventDefault(); delete el.dataset.over;
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) handle(f);
      });
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    },

    /* ------------------------------------------------------ placeholders -- */
    /* Generated, not shipped. No image bytes live in this repo. */

    /** Neutral head-and-shoulders mark for a clinician or patient with no photo. */
    personSvg: function (label, seed) {
      var hue = ((seed || 0) * 47) % 360;
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
        '<rect width="120" height="120" fill="hsl(' + hue + ',8%,18%)"/>' +
        '<circle cx="60" cy="46" r="21" fill="hsl(' + hue + ',10%,30%)"/>' +
        '<path d="M20 120c0-24 18-38 40-38s40 14 40 38z" fill="hsl(' + hue + ',10%,30%)"/>' +
        (label ? '<text x="60" y="112" text-anchor="middle" font-family="system-ui,sans-serif" ' +
          'font-size="11" font-weight="700" fill="hsla(0,0%,100%,.55)">' + esc(label) + '</text>' : '') +
        '</svg>';
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    },

    /**
     * Placeholder Game Film frame. `progress` 0..1 subtly narrows the
     * silhouette so the compare slider demonstrates the mechanic before any
     * real photo exists. Clearly watermarked PLACEHOLDER — nobody should ever
     * mistake this for a patient.
     */
    bodySvg: function (opts) {
      opts = opts || {};
      var p = Math.max(0, Math.min(1, opts.progress === undefined ? 0 : opts.progress));
      var pose = opts.pose || 'front';
      var waist = 30 - p * 8;
      var shoulder = 34 + p * 2;
      var body;
      if (pose === 'crown') {
        var density = 0.25 + p * 0.6;
        var dots = '';
        for (var i = 0; i < 90; i++) {
          var a = (i * 137.5) * Math.PI / 180, r = 4 + (i / 90) * 34;
          var cx = 90 + Math.cos(a) * r, cy = 92 + Math.sin(a) * r * 0.92;
          var op = (i / 90 < density ? 0.72 : 0.12);
          dots += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="2.4" fill="hsla(28,18%,62%,' + op.toFixed(2) + ')"/>';
        }
        body = '<ellipse cx="90" cy="92" rx="46" ry="42" fill="#2b2724"/>' + dots;
      } else if (pose === 'left_profile' || pose === 'right_profile') {
        var flip = pose === 'right_profile' ? ' transform="translate(180,0) scale(-1,1)"' : '';
        body = '<g' + flip + '><circle cx="86" cy="42" r="17" fill="#33302d"/>' +
          '<path d="M72 60 q' + (10 + (1 - p) * 10) + ' 34 2 74 h34 q-10 -40 -4 -74z" fill="#33302d"/></g>';
      } else {
        body = '<circle cx="90" cy="40" r="18" fill="#33302d"/>' +
          '<path d="M90 60 l-' + shoulder + ' 10 l' + (shoulder - waist) / 2 + ' 34 l-' + (shoulder - waist) / 4 +
          ' 52 h' + (waist * 2) + ' l-' + (shoulder - waist) / 4 + ' -52 l' + (shoulder - waist) / 2 +
          ' -34 z" fill="#33302d"/>';
      }
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 240">' +
        '<rect width="180" height="240" fill="#1a1a1a"/>' +
        '<g opacity=".95">' + body + '</g>' +
        // Ghost-overlay guide: the thing that makes a series actually comparable.
        '<g stroke="hsla(0,0%,100%,.13)" stroke-width="1" stroke-dasharray="4 4" fill="none">' +
        '<line x1="90" y1="8" x2="90" y2="232"/><line x1="24" y1="60" x2="156" y2="60"/>' +
        '<line x1="24" y1="154" x2="156" y2="154"/><rect x="24" y="14" width="132" height="212" rx="8"/></g>' +
        '<text x="90" y="232" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" ' +
        'font-weight="700" letter-spacing="1.5" fill="hsla(0,0%,100%,.34)">PLACEHOLDER</text>' +
        (opts.caption ? '<text x="90" y="26" text-anchor="middle" font-family="system-ui,sans-serif" ' +
          'font-size="10" font-weight="700" fill="hsla(0,0%,100%,.5)">' + esc(opts.caption) + '</text>' : '') +
        '</svg>';
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    },

    /** Neutral placeholder for a clinic photo (exterior, parking, room). */
    placeSvg: function (kind) {
      var art = {
        exterior: '<rect x="28" y="70" width="184" height="70" fill="#2a2a2a"/><rect x="44" y="86" width="30" height="26" fill="#3a3a3a"/><rect x="90" y="86" width="30" height="26" fill="#3a3a3a"/><rect x="150" y="82" width="40" height="58" fill="#343434"/>',
        parking: '<rect x="0" y="96" width="240" height="64" fill="#262626"/><g stroke="#4a4a4a" stroke-width="3"><line x1="34" y1="100" x2="34" y2="156"/><line x1="94" y1="100" x2="94" y2="156"/><line x1="154" y1="100" x2="154" y2="156"/><line x1="214" y1="100" x2="214" y2="156"/></g>',
        room: '<rect x="30" y="60" width="180" height="84" fill="#272727"/><rect x="52" y="92" width="96" height="34" rx="6" fill="#373737"/><circle cx="176" cy="104" r="14" fill="#333"/>',
        lobby: '<rect x="24" y="64" width="192" height="80" fill="#272727"/><rect x="44" y="96" width="56" height="30" rx="5" fill="#383838"/><rect x="120" y="96" width="56" height="30" rx="5" fill="#383838"/>'
      }[kind] || '<rect x="40" y="70" width="160" height="70" fill="#2a2a2a"/>';
      var svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160">' +
        '<rect width="240" height="160" fill="#1b1b1b"/>' + art +
        '<text x="120" y="150" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" ' +
        'font-weight="700" letter-spacing="1.2" fill="hsla(0,0%,100%,.38)">' +
        esc((kind || 'photo').toUpperCase()) + ' — ADD PHOTO</text></svg>';
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    },

    /* ------------------------------------------------------------ render -- */

    /** <img> or initials for a person, whichever we have. */
    avatarHtml: function (key, name, cls) {
      var url = media.get(key);
      if (url) return '<span class="av ' + (cls || '') + '"><img src="' + url + '" alt=""></span>';
      return '<span class="av ' + (cls || '') + '" aria-hidden="true">' + esc(GD.fmt.initials(name)) + '</span>';
    },

    /** Image source for a person, falling back to a generated silhouette. */
    personSrc: function (key, name, seed) {
      return media.get(key) || media.personSvg(GD.fmt.initials(name), seed || 0);
    },

    /** Image source for a Game Film frame, falling back to a placeholder. */
    photoSrc: function (photo, progress) {
      var url = media.get('photo:' + photo.id);
      if (url) return url;
      return media.bodySvg({ progress: progress, pose: photo.pose_key,
        caption: 'Week ' + (photo.week_index || 0) });
    },

    clinicSrc: function (kind) { return media.get('clinic:' + kind) || media.placeSvg(kind); }
  };
})();
