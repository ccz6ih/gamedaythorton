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
