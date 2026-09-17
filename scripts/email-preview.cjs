/**
 * email-preview.cjs — render every notification to a file you can open.
 *
 *   node scripts/email-preview.cjs
 *
 * WHY THIS EXISTS
 * No test can tell you an email looks right. A regex can prove the confirm
 * button is in the markup; it cannot tell you the logo is enormous, the panel
 * is unreadable, or the whole thing is off-brand. So this renders the real
 * templates with realistic content and writes them out to open in a browser.
 *
 * It compiles lib/email-render.ts on the way through, which is the reason that
 * module has no imports — the branded half reaches for Supabase and cannot be
 * loaded outside a request, but the rendering is a pure function and this can
 * run it directly.
 *
 * Nothing is sent. Nothing touches the network or the database.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.email-preview');
const BUILD = fs.mkdtempSync(path.join(os.tmpdir(), 'email-render-'));

/* ------------------------------------------------------------- compile ---- */

/* tsc invoked through node directly rather than through npx: on Windows
   execFileSync('npx.cmd') fails with EINVAL, and going via a shell to work
   around that would mean quoting paths that contain spaces. */
try {
  execFileSync(
    process.execPath,
    [path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'),
     path.join('lib', 'email-render.ts'),
     '--outDir', BUILD, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck'],
    { cwd: ROOT, stdio: 'pipe' }
  );
} catch (error) {
  console.error('\n  Could not compile lib/email-render.ts:\n');
  console.error(String(error.stdout || error.message));
  process.exit(1);
}

const { renderEmail, defaultBrand } = require(path.join(BUILD, 'email-render.js'));

/* --------------------------------------------------------------- brand ---- */

/**
 * The Med Bar as it actually is, so the preview shows what a client receives
 * rather than a grey box. The logo is referenced from the live site because an
 * email cannot load a relative path — which is itself worth seeing here, since
 * a broken logo in the preview means a broken logo in the inbox.
 */
const brand = {
  ...defaultBrand('The Med Bar', 'https://www.medbarco.com'),
  logoUrl: 'https://www.medbarco.com/brand/medbar-logo-black.png',
  addressText: '1436 N Denver Ave · Loveland, CO · 80538',
  phone: '(970) 460-9270'
};

/* ------------------------------------------------------------ samples ----- */

const samples = {
  'booking-confirmation': {
    subject: 'Your appointment at The Med Bar',
    content: {
      preheader: 'Your appointment at The Med Bar is confirmed.',
      greeting: 'Hi Carlos,',
      lines: ["You're booked in at The Med Bar."],
      panel: [
        { label: 'Treatment', value: 'Microneedling with PRF' },
        { label: 'When', value: 'Tuesday, 22 September at 2:00 PM' }
      ],
      note: 'This treatment needs a short assessment and a consent form before we start, so please allow a few extra minutes.',
      footerLines: ['Need to change or cancel? Reply to this email or call (970) 460-9270.']
    }
  },

  'appointment-reminder': {
    subject: 'Tomorrow at The Med Bar',
    content: {
      preheader: 'A reminder about your appointment at The Med Bar.',
      greeting: 'Hi Carlos,',
      lines: ['A reminder about your appointment at The Med Bar.'],
      panel: [
        { label: 'Treatment', value: 'Microneedling with PRF' },
        { label: 'When', value: 'Tomorrow, 2:00 PM' },
        // The partner-clinic case — the one that was silently dropped before.
        { label: 'Where', value: 'Gameday Men’s Health\n1234 E Harmony Rd, Fort Collins, CO' }
      ],
      cta: { label: "Yes, I'll be there", url: 'https://www.medbarco.com/confirm/6f1c2e' },
      note: 'One tap confirms — there is nothing to fill in.',
      footerLines: ['If anything has changed, reply to this email or call (970) 460-9270.']
    }
  },

  'booking-notice': {
    subject: 'New booking for The Med Bar',
    content: {
      preheader: 'A new booking came in for The Med Bar.',
      lines: ['Carlos Hernandez booked online.'],
      panel: [
        { label: 'Treatment', value: 'Microneedling with PRF' },
        { label: 'When', value: 'Tuesday, 22 September at 2:00 PM' },
        { label: 'Contact', value: 'carlos@example.com\n(720) 820-7124' },
        { label: 'They said', value: 'Second session of my package — see you then!' }
      ],
      cta: { label: 'Open the calendar', url: 'https://www.medbarco.com/console/calendar' },
      footerLines: ['It is already on your calendar in the console.']
    }
  },

  'enquiry': {
    subject: 'New enquiry for The Med Bar',
    content: {
      preheader: 'Somebody enquired through your The Med Bar booking page.',
      lines: ['Dana Whitfield sent a request through your booking page.'],
      panel: [
        { label: 'Contact', value: 'dana@example.com' },
        { label: 'Interested in', value: 'Lash extensions' },
        { label: 'What they said', value: 'Do you have anything on a Saturday?\nI work weekdays.' }
      ],
      cta: { label: 'Open the console', url: 'https://www.medbarco.com/console/clients' },
      footerLines: ['The full request is on your clients list in the console.']
    }
  }
};

/* -------------------------------------------------------------- write ----- */

fs.mkdirSync(OUT, { recursive: true });

const index = [];
for (const [name, sample] of Object.entries(samples)) {
  const html = renderEmail(brand, sample.content);
  const file = path.join(OUT, `${name}.html`);
  fs.writeFileSync(file, html);
  index.push({ name, subject: sample.subject, file });
  console.log(`  ${name.padEnd(26)} ${html.length.toLocaleString()} bytes`);
}

/* One page linking the four, so there is a single thing to open. */
const contact = `<!doctype html><meta charset="utf-8"><title>Email previews</title>
<body style="font-family:system-ui;background:#EFE7DA;color:#16201A;margin:0;padding:40px 24px;">
<h1 style="font-family:Georgia,serif;font-weight:400;">Notification previews</h1>
<p style="color:#5C6560;max-width:40rem;">
  Rendered from the real templates. Open each at a phone width too — the card
  drops to 22px side padding below 620px, which is where most of these are read.
</p>
<ul style="line-height:2;padding-left:1.1rem;">
${index.map(i => `  <li><a href="./${i.name}.html" style="color:#16201A;">${i.name}</a>
       <span style="color:#5C6560;"> — subject: “${i.subject}”</span></li>`).join('\n')}
</ul>
</body>`;
fs.writeFileSync(path.join(OUT, 'index.html'), contact);

fs.rmSync(BUILD, { recursive: true, force: true });

console.log(`\n  Open: ${path.join(OUT, 'index.html')}\n`);
