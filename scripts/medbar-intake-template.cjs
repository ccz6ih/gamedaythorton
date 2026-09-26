/**
 * medbar-intake-template.cjs
 * The Med Bar's intake form and consents.
 *
 *   node scripts/medbar-intake-template.cjs         show it
 *   node scripts/medbar-intake-template.cjs --sql   emit SQL
 *
 * ===========================================================================
 * THIS IS A DRAFT AND MUST NOT BE USED UNTIL JAMIE HAS APPROVED IT
 * ===========================================================================
 * Every other piece of clinical copy in this repo is condensed from something
 * the practice already published — see the header of medbar-copy.cjs. This is
 * the one place that rule cannot be followed, because she has no published
 * intake form to condense: it is on paper, and we have not seen it.
 *
 * So these are the questions a cash-pay aesthetics practice is generally
 * expected to ask before neurotoxin, PRF and microneedling — contraindication
 * screening, not treatment advice. They are a STARTING POINT for her to cut,
 * correct and add to, and the template is seeded INACTIVE so it cannot reach a
 * client before she has done that.
 *
 * The questions that matter most and are easiest to get wrong:
 *   - pregnancy and breastfeeding, which is an absolute stop for several of
 *     her treatments
 *   - anticoagulants and bleeding disorders, for anything involving a needle
 *   - isotretinoin, which has a recency window she will know and we do not
 *   - cold sore history, which changes how PRF around the mouth is approached
 *   - lidocaine and latex allergies
 *
 * We have deliberately NOT written a recency window into any question — "in
 * the last N weeks" is a clinical threshold and hers to set.
 *
 * ===========================================================================
 * THE CONSENTS ARE REAL RECORDS
 * ===========================================================================
 * Each one writes a consent_record carrying text_snapshot — the exact sentence
 * shown at the time. A tick with no wording next to it is not evidence of
 * anything.
 *
 * `key` must be a value of the consent_type enum. The Gameday template has a
 * consent keyed "telecom", which is NOT in that enum, so it would have thrown
 * on insert the first time anybody submitted it. Checked here rather than
 * discovered later.
 */

const VERSION = 'medbar-v0.1-draft';

const SECTIONS = [
  {
    key: 'about',
    title: 'About you',
    fields: [
      { key: 'dob', type: 'text', label: 'Date of birth' },
      { key: 'pregnant', type: 'choice', label: 'Are you pregnant, trying to conceive, or breastfeeding?',
        options: ['No', 'Pregnant', 'Trying to conceive', 'Breastfeeding', 'Prefer not to say'] },
      { key: 'emergency', type: 'text', label: 'Emergency contact (name and number)' }
    ]
  },
  {
    key: 'history',
    title: 'Medical history',
    fields: [
      { key: 'conditions', type: 'choice', label: 'Do any of these apply to you?', multi: true,
        options: [
          'Bleeding or clotting disorder',
          'Autoimmune condition',
          'Diabetes',
          'Heart condition',
          'Neuromuscular condition',
          'Keloid or raised scarring',
          'Active skin infection or open wound',
          'Cold sores (herpes simplex)',
          'History of skin cancer',
          'None of these'
        ] },
      { key: 'conditions_detail', type: 'text', label: 'Anything you would like to add about the above' },
      { key: 'surgeries', type: 'text', label: 'Recent surgeries or procedures' }
    ]
  },
  {
    key: 'meds',
    title: 'Medications and allergies',
    fields: [
      { key: 'blood_thinners', type: 'yesno', label: 'Are you taking a blood thinner, or aspirin regularly?' },
      { key: 'isotretinoin', type: 'yesno', label: 'Have you taken isotretinoin (Accutane) recently?' },
      { key: 'medications', type: 'text', label: 'Current medications' },
      { key: 'supplements', type: 'text', label: 'Supplements (including fish oil, vitamin E, turmeric)' },
      { key: 'allergies', type: 'text', label: 'Allergies — including lidocaine, latex and topical anaesthetics' }
    ]
  },
  {
    key: 'recent',
    title: 'Recent treatments',
    fields: [
      { key: 'recent_tox', type: 'yesno', label: 'Have you had neurotoxin or filler recently?' },
      { key: 'recent_other', type: 'choice', label: 'Anything else recently?', multi: true,
        options: ['Laser or IPL', 'Chemical peel', 'Microneedling', 'Sun exposure or tanning', 'None of these'] },
      { key: 'recent_detail', type: 'text', label: 'When, and with whom, if you remember' }
    ]
  },
  {
    key: 'today',
    title: 'Today',
    fields: [
      { key: 'goals', type: 'text', label: 'What are you hoping to get out of this visit?' },
      { key: 'concerns', type: 'text', label: 'Anything worrying you, or anything we should know?' }
    ]
  }
];

/* key MUST be a consent_type enum value:
   treatment, trt_risks, photo, transactional_sms, marketing_sms, email,
   aesthetic_risks, financial_policy */
const CONSENTS = [
  { key: 'treatment', required: true,
    label: 'I consent to assessment and treatment at The Med Bar, and confirm the information above is accurate to the best of my knowledge.' },
  { key: 'aesthetic_risks', required: true,
    label: 'The risks, benefits and alternatives of my treatment have been explained to me, and I have had the chance to ask questions.' },
  { key: 'financial_policy', required: true,
    label: 'I understand the practice’s payment and cancellation policy, and that treatments are paid for at the time of service.' },
  { key: 'photo', required: false,
    label: 'I agree to before-and-after photographs being taken for my own clinical record. Optional, and I can withdraw this at any time.' },
  { key: 'transactional_sms', required: false,
    label: 'I agree to receive appointment reminders and confirmations by text message. Message and data rates may apply; reply STOP to opt out.' }
];

const VALID_CONSENT_KEYS = new Set([
  'treatment', 'trt_risks', 'photo', 'transactional_sms',
  'marketing_sms', 'email', 'aesthetic_risks', 'financial_policy'
]);

function check() {
  const problems = [];
  for (const c of CONSENTS) {
    if (!VALID_CONSENT_KEYS.has(c.key)) {
      problems.push(`consent "${c.key}" is not a consent_type value — it would throw on submit`);
    }
  }
  const keys = new Set();
  for (const s of SECTIONS) {
    for (const f of s.fields) {
      if (keys.has(f.key)) problems.push(`duplicate field key "${f.key}" — one answer would overwrite the other`);
      keys.add(f.key);
      if (f.type === 'choice' && !Array.isArray(f.options)) {
        problems.push(`field "${f.key}" is a choice with no options`);
      }
    }
  }
  return problems;
}

const q = s => `'${String(s).replace(/'/g, "''")}'`;

const SQL = `insert into intake_template (clinic_id, version, name, sections, consents, active)
select c.id, ${q(VERSION)}, ${q('Med Bar intake and consent (DRAFT — needs sign-off)')},
       ${q(JSON.stringify(SECTIONS))}::jsonb,
       ${q(JSON.stringify(CONSENTS))}::jsonb,
       false
from clinic c
where c.slug = 'medbar-loveland'
  and not exists (select 1 from intake_template t
                   where t.clinic_id = c.id and t.version = ${q(VERSION)});`;

const problems = check();
if (problems.length) {
  console.error('\n  Refusing:\n' + problems.map(p => '    ' + p).join('\n') + '\n');
  process.exit(1);
}

if (process.argv.includes('--sql')) {
  console.log(SQL);
} else {
  const fields = SECTIONS.reduce((n, s) => n + s.fields.length, 0);
  console.log(`\n  ${VERSION} — seeded INACTIVE, pending Jamie's approval\n`);
  for (const s of SECTIONS) {
    console.log(`  ${s.title}`);
    for (const f of s.fields) console.log(`      ${f.type.padEnd(7)} ${f.label}`);
    console.log('');
  }
  console.log(`  Consents (${CONSENTS.filter(c => c.required).length} required, ${CONSENTS.filter(c => !c.required).length} optional):`);
  for (const c of CONSENTS) console.log(`      ${c.required ? '[required]' : '[optional]'} ${c.key}`);
  console.log(`\n  ${SECTIONS.length} sections, ${fields} questions, ${CONSENTS.length} consents.`);
  console.log(`  Consent keys all valid against consent_type.\n`);
}
