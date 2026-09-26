/**
 * medbar-cryo-packages.cjs
 * The SubZero cryotherapy multi-session packages.
 *
 *   node scripts/medbar-cryo-packages.cjs           what would change
 *   node scripts/medbar-cryo-packages.cjs --sql     emit SQL (for MCP/psql)
 *   node scripts/medbar-cryo-packages.cjs --write   apply via supabase-js
 *
 * ===========================================================================
 * PROVENANCE — READ THIS BEFORE EDITING
 * ===========================================================================
 * Same rule as scripts/medbar-copy.cjs: nothing clinical is invented, added or
 * strengthened. Each description is built from two sources the practice
 * supplied, and nothing else:
 *
 *   1. The `description` already on the parent service row, which is her own
 *      published copy. The hedged phrasings in it — "designed to",
 *      "temporarily reduce the appearance of", "when appropriate",
 *      "personalized to your contouring goals" — are carried through VERBATIM
 *      rather than tightened into something that sells harder.
 *
 *   2. The pricing sheet Jamie sent on 26 Sept, which carries her own wording
 *      for the acne courses ("designed to address recurring breakouts and
 *      support clearer-looking skin").
 *
 * WHAT IS GENUINELY NEW is search framing, and only the kind that asserts
 * nothing clinical: who a package suits (runners, before an event), where the
 * practice is (Loveland, Northern Colorado), what category a searcher would
 * type (non-surgical body contouring, back acne, cryo facial), and how the
 * per-visit cost compares. None of that is a claim about what the treatment
 * does to a body.
 *
 * IT STILL NEEDS HER SIGN-OFF before it is public. It is her practice making
 * the claims, not us.
 *
 * ===========================================================================
 * THE CLAIMS CHECK IS IN HERE BECAUSE THE REPO'S TEST CANNOT SEE THIS
 * ===========================================================================
 * scripts/claims-test.cjs scans app/c, components and lib. Every service and
 * package description lives in the DATABASE, so none of this copy has ever
 * been checked by it — including the existing rows, one of which says
 * "Series of 3" and would fail if it were scanned.
 *
 * So the same four patterns run here, against the copy below, before anything
 * is written. A description that trips one stops the script. This is a
 * stopgap: the real fix is teaching claims-test to read the catalogue.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const args = process.argv.slice(2);
const emitSql = args.includes('--sql');
const write = args.includes('--write');

const CLINIC_SLUG = 'medbar-loveland';

/* Service ids read from the live catalogue on 26 Sept 2026. Named here so a
   renamed service does not silently attach a package to the wrong treatment. */
const S = {
  recovery: { id: '66f7da69-23e3-434e-ad0d-240d84fbfdad', name: 'SubZero Localized Cryotherapy', single: 50 },
  frotox:   { id: 'a7edb2be-f802-4e9e-b807-4fe73743562e', name: 'Frotox | SubZero Cryo Facial', single: 100 },
  small:    { id: '881796b3-a9f9-401c-bbe4-e71d7959c8b3', name: 'SubZero Cryo Sculpt | Small Area', single: 100 },
  body:     { id: 'ddce6369-84a0-41ae-93d5-ffdafaf49919', name: 'SubZero Cryo Body Sculpting | Single Area', single: 250 },
  acne:     { id: 'd18f3660-29a8-4d44-bed1-1a99e3a64903', name: 'SubZero Acne-Prone Skin Care | Back or Chest', single: 200 }
};

/**
 * `listCents` is sessions x the single price, so the saving the page shows is
 * COMPUTED rather than asserted. `saving` below is what Jamie's sheet says it
 * should come to, and the script refuses to run if the two disagree — that
 * catches a typo in her sheet or in this file, in either direction.
 *
 * The Back + Chest course is the one exception to the arithmetic: it is six
 * appointments covering TWO areas, so its list price is six x the single x 2.
 */
const PACKAGES = [
  {
    key: 'recovery-3', service: S.recovery, sessions: 3, price: 135, saving: 15, sort: 10,
    name: 'SubZero Localized Cryotherapy | 3 Sessions',
    description:
      'Three sessions of targeted cold therapy for muscle recovery, soreness and everyday aches. ' +
      'A practical option for runners, lifters and anyone on their feet all day around Loveland and ' +
      'Northern Colorado. Each visit is quick and noninvasive, designed to support your active lifestyle.'
  },
  {
    key: 'recovery-6', service: S.recovery, sessions: 6, price: 250, saving: 50, sort: 11,
    name: 'SubZero Localized Cryotherapy | 6 Sessions',
    description:
      'Six sessions of targeted cold therapy for recovery, soreness and everyday aches — for athletes ' +
      'and active adults who want cryotherapy as a regular part of training rather than a one-off. ' +
      'The lowest cost per visit in the recovery range, and short enough to fit either side of a workout.'
  },
  {
    key: 'frotox-3', service: S.frotox, sessions: 3, price: 275, saving: 25, sort: 20,
    name: 'Frotox | SubZero Cryo Facial | 3 Sessions',
    description:
      'Three Frotox cryo facial sessions to refresh your complexion, designed to temporarily reduce ' +
      'the appearance of puffiness and leave skin looking revitalized. A popular choice before weddings, ' +
      'photos and events, and short enough to book over a lunch break in Loveland.'
  },
  {
    key: 'frotox-6', service: S.frotox, sessions: 6, price: 500, saving: 100, sort: 21,
    name: 'Frotox | SubZero Cryo Facial | 6 Sessions',
    description:
      'Six facial cryotherapy sessions for clients who want Frotox as a standing part of their skincare ' +
      'routine. A noninvasive option for anyone curious about cryo facials but not ready for injectables, ' +
      'at the lowest cost per visit The Med Bar offers on the treatment.'
  },
  {
    key: 'small-3', service: S.small, sessions: 3, price: 275, saving: 25, sort: 30,
    name: 'SubZero Cryo Sculpt | Small Area | 3 Sessions',
    description:
      'Three focused aesthetic cryotherapy sessions for a small area, such as the chin or a limited ' +
      'upper-arm zone. Treatment is personalized to your contouring goals, with the area confirmed at ' +
      'your assessment. A defined, non-surgical option in Loveland, CO.'
  },
  {
    key: 'small-6', service: S.small, sessions: 6, price: 500, saving: 100, sort: 31,
    name: 'SubZero Cryo Sculpt | Small Area | 6 Sessions',
    description:
      'Six small-area cryo sculpt sessions for clients working on one area over time rather than trying ' +
      'it once. Covers the chin, a limited upper-arm zone and similar compact areas, personalized to ' +
      'your contouring goals throughout.'
  },
  {
    key: 'body-3', service: S.body, sessions: 3, price: 675, saving: 75, sort: 40,
    name: 'SubZero Cryo Body Sculpting | Single Area | 3 Sessions',
    description:
      'Three personalized aesthetic cryotherapy sessions for one body area — abdomen, flanks, thighs, ' +
      'back or arms. Non-surgical body contouring in Loveland, CO, beginning with an assessment of your ' +
      'contouring goals before the first session.'
  },
  {
    key: 'body-6', service: S.body, sessions: 6, price: 1250, saving: 250, sort: 41,
    name: 'SubZero Cryo Body Sculpting | Single Area | 6 Sessions',
    description:
      'Six aesthetic cryotherapy sessions on a single body area, for clients committing to a longer ' +
      'course of non-surgical contouring. The most comprehensive body option at The Med Bar and the ' +
      'lowest cost per visit. Your practitioner maps the area and sets the schedule with you.'
  },
  {
    key: 'acne-3', service: S.acne, sessions: 3, price: 550, saving: 50, sort: 50,
    name: 'SubZero Acne-Prone Skin Care | Back or Chest | 3 Sessions',
    description:
      'A three-treatment course for back or chest acne, designed to address recurring breakouts and ' +
      'support clearer-looking skin. Each visit includes a skin assessment, gentle cleansing and SubZero ' +
      'cooling when appropriate. One area per appointment — choose back or chest at booking.'
  },
  {
    key: 'acne-6', service: S.acne, sessions: 6, price: 950, saving: 250, sort: 51,
    name: 'SubZero Acne-Prone Skin Care | Back or Chest | 6 Sessions',
    description:
      'An extended treatment course for persistent or widespread back or chest acne, for clients who ' +
      'need longer than a short package allows. Covers one area — back or chest — with a skin assessment, ' +
      'gentle cleansing and SubZero cooling when appropriate at every visit.'
  },
  {
    key: 'acne-both', service: S.acne, sessions: 6, price: 1500, saving: 900, sort: 52,
    areas: 2,
    name: 'SubZero Acne-Prone Skin Care | Back + Chest',
    description:
      'A comprehensive treatment course targeting acne on both the back and the chest, covering both ' +
      'areas across six appointments. Priced well below booking the two courses separately — the most ' +
      'complete body acne option at The Med Bar in Loveland, CO.'
  }
];

/* Non-numeric on purpose. "Three sessions spaced two weeks apart" is a course
   of treatment only the practitioner can set, and stating it here would be
   prescribing from a marketing page. */
const INTERVAL_NOTE = 'Appointments are scheduled with your practitioner to suit your skin and your plans.';
const EXPIRY_DAYS = 365;

/* ------------------------------------------------- the claims patterns ---- */
/* Copied from scripts/claims-test.cjs. Duplicated rather than imported because
   that file is a test runner, not a module — if these ever drift, the fix is
   to make it export them, not to soften one of these. */
const CLAIMS = [
  { kind: 'EFFICACY', re: /(?:by |up to |increases?|boosts?|improves?|reduces?|\+)\s*[0-9]{1,3}\s*%|[0-9]{1,3}\s*%\s*(?:more|faster|greater|increase|improvement|absorption|uptake|reduction)/i },
  { kind: 'SAFETY',   re: /(?<!little to )(?<!minimal )(?<!usually )(?<!typically )\b(?:zero|no|0%?)\s+(?:pain|downtime|redness|irritation|recovery|side ?effects?|scratching|needles)\b|\bpainless\b/i },
  { kind: 'PROTOCOL', re: /\b[0-9]+\s*(?:to|–|-|and)\s*[0-9]+\s+(?:sessions?|treatments?|visits?)\b|\b[0-9]+\s*(?:sessions?|treatments?)\s+spaced\b|\bseries of\s+[0-9]|\blasts?\s+[0-9]+\s*(?:to|–|-)\s*[0-9]+\s+(?:months?|years?)\b/i },
  { kind: 'MECHANISM',re: /\b(?:penetrat\w+|trigger\w*|stimulat\w+|activat\w+|synthesi\w+)\b[^.]{0,60}\b(?:dermis|epidermis|mitochondri\w+|cellular|collagen|ATP|fibroblast\w*|stratum corneum|cytochrome)\b/i }
];

function check() {
  const problems = [];
  for (const p of PACKAGES) {
    const listCents = p.service.single * p.sessions * (p.areas ?? 1) * 100;
    const actualSaving = listCents / 100 - p.price;
    if (actualSaving !== p.saving) {
      problems.push(`${p.key}: saving is $${actualSaving}, sheet says $${p.saving}`);
    }
    for (const text of [p.name, p.description, INTERVAL_NOTE]) {
      for (const c of CLAIMS) {
        const hit = text.match(c.re);
        if (hit) problems.push(`${p.key}: ${c.kind} — "${hit[0]}"`);
      }
    }
    p.listCents = listCents;
  }
  // Duplicate copy is an SEO penalty and reads as a template. Each must differ.
  const seen = new Map();
  for (const p of PACKAGES) {
    if (seen.has(p.description)) problems.push(`${p.key}: description identical to ${seen.get(p.description)}`);
    seen.set(p.description, p.key);
  }
  return problems;
}

function sqlFor(p) {
  const q = s => `'${String(s).replace(/'/g, "''")}'`;
  return `insert into service_package
  (clinic_id, service_id, name, description, sessions, price_cents, list_price_cents,
   interval_note, expiry_days, active, sort_order)
select c.id, ${q(p.service.id)}::uuid, ${q(p.name)}, ${q(p.description)},
       ${p.sessions}, ${p.price * 100}, ${p.listCents},
       ${q(INTERVAL_NOTE)}, ${EXPIRY_DAYS}, true, ${p.sort}
from clinic c
where c.slug = ${q(CLINIC_SLUG)}
  and not exists (select 1 from service_package x
                   where x.clinic_id = c.id and x.name = ${q(p.name)});`;
}

async function main() {
  const problems = check();
  if (problems.length) {
    console.error('\n  Refusing to continue:\n');
    for (const p of problems) console.error('    ' + p);
    console.error('');
    process.exit(1);
  }

  if (emitSql) {
    console.log(PACKAGES.map(sqlFor).join('\n\n'));
    return;
  }

  console.log(`\n  ${PACKAGES.length} cryotherapy packages — claims clean, savings reconcile\n`);
  for (const p of PACKAGES) {
    const per = (p.price / p.sessions).toFixed(2);
    console.log(
      `  ${p.name}\n` +
      `      $${p.price} (was $${p.listCents / 100}, save $${p.saving}) · ` +
      `${p.sessions} sessions · $${per} each · ${p.description.split(' ').length} words\n`
    );
  }

  if (!write) {
    console.log('  Nothing written. Re-run with --write, or --sql to emit SQL.\n');
    return;
  }

  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local.');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: clinic } = await db.from('clinic').select('id').eq('slug', CLINIC_SLUG).maybeSingle();
  if (!clinic) throw new Error(`No clinic ${CLINIC_SLUG}.`);

  for (const p of PACKAGES) {
    const { data: existing } = await db.from('service_package')
      .select('id').eq('clinic_id', clinic.id).eq('name', p.name).maybeSingle();
    if (existing) { console.log(`  skip (exists)  ${p.name}`); continue; }
    const { error } = await db.from('service_package').insert({
      clinic_id: clinic.id, service_id: p.service.id, name: p.name,
      description: p.description, sessions: p.sessions, price_cents: p.price * 100,
      list_price_cents: p.listCents, interval_note: INTERVAL_NOTE,
      expiry_days: EXPIRY_DAYS, active: true, sort_order: p.sort
    });
    if (error) throw new Error(`${p.name}: ${error.message}`);
    console.log(`  created        ${p.name}`);
  }
  console.log('');
}

main().catch(e => { console.error('\n  ' + e.message + '\n'); process.exit(1); });
