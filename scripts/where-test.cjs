/* The sentence both sides read. Same appointment, opposite perspective. */
const { execFileSync } = require('child_process');
const path = require('path'), fs = require('fs'), os = require('os');
const ROOT = 'C:/Projects/gamedaythorton';
const BUILD = fs.mkdtempSync(path.join(os.tmpdir(), 'where-'));
execFileSync(process.execPath, [
  path.join(ROOT,'node_modules','typescript','bin','tsc'),
  path.join('lib','appointment-where.ts'),
  '--outDir', BUILD, '--module','commonjs','--target','es2020','--skipLibCheck'
], { cwd: ROOT, stdio: 'pipe' });
const { whereLine, whereShort } = require(path.join(BUILD,'appointment-where.js'));

const cases = [
  ['consult on the phone', { modality:'phone', clinicName:'The Med Bar', clientPhone:'(720) 820-7124', practicePhone:'(970) 460-9270' }],
  ['video consult, no link yet', { modality:'video', clinicName:'The Med Bar' }],
  ['video consult with link', { modality:'video', clinicName:'The Med Bar', meetingUrl:'https://meet.example/abc' }],
  ['usual room', { modality:'in_person', clinicName:'The Med Bar', clinicAddress:'2362 West 44th Street, Loveland, CO' }],
  ['at Gameday', { modality:'in_person', clinicName:'The Med Bar', locationName:"Gameday Men's Health — Northglenn", locationAddress:'10701 Melody Dr #315, Northglenn, CO' }],
  ['legacy row, no modality', { clinicName:'The Med Bar', clinicAddress:'2362 West 44th Street, Loveland, CO' }]
];
for (const [name, w] of cases) {
  console.log('  ' + name);
  console.log('     practice: ' + whereLine(w, true).replace(/\n/g, ' / '));
  console.log('     client  : ' + whereLine(w, false).replace(/\n/g, ' / '));
  console.log('     short   : ' + whereShort(w));
}
fs.rmSync(BUILD, { recursive:true, force:true });

/*
 * Two screens can now set this, and they must agree.
 *
 * The booking form and the inline editor on Today write the same two columns.
 * If only one of them insists a meeting link is a link, or only one of them
 * clears a leftover link when an appointment moves back to in-person, the
 * difference shows up as a client holding a dead URL — so assert the guards
 * exist in both rather than trusting that they do.
 */
let fails = 0;
const must = (where, ok, what) => {
  if (!ok) { fails++; console.log('  FAIL  ' + where + ' — ' + what); }
};
for (const f of ['app/console/book/page.tsx', 'app/console/today/page.tsx']) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  must(f, /\^https\?:\\\/\\\/\\S\+\$/i.test(src), 'no https:// check on the meeting link');
  must(f, /modality === 'video'/.test(src), 'link is not conditioned on a video call');
  for (const m of ['in_person', 'phone', 'video']) {
    must(f, src.includes(`'${m}'`), `does not know about ${m}`);
  }
}

/* A staff booking must tell the client. It used to send nothing at all. */
const bookSrc = fs.readFileSync(path.join(ROOT, 'app/console/book/page.tsx'), 'utf8');
must('book', bookSrc.includes('sendBookingConfirmation'), 'staff booking sends the client nothing');
must('book', /told=\$\{told\}/.test(bookSrc), 'does not report whether the client was told');
const todaySrc = fs.readFileSync(path.join(ROOT, 'app/console/today/page.tsx'), 'utf8');
for (const t of ['sent', 'no_email', 'unsent']) {
  must('today', todaySrc.includes(`'${t}'`), `no banner for told=${t}`);
}

console.log(fails ? `\n  ${fails} failed` : '\n  both screens agree, and a staff booking is announced');
process.exit(fails ? 1 : 0);
