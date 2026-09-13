/**
 * medbar-bio.cjs
 * Jamie's credentials, card bio and full story, plus the practice intro.
 *
 *   node scripts/medbar-bio.cjs            # show what it would write
 *   node scripts/medbar-bio.cjs --write
 *
 * ------------------------------------------------------------------------
 * WHAT WAS EDITED, AND WHAT WAS NOT
 * ------------------------------------------------------------------------
 * The long version below is condensed from roughly 700 words to about 450. It
 * is HER text: every beat she wrote is still here, in her order — the two
 * family traditions, five children and homeschooling, intuition and her
 * grandmother, her husband's service, phlebotomy and PRF, SkinAlchemy, the
 * laser credentials and Gameday, and the vision at the end. What was cut is
 * repetition, not substance, and no claim has been added.
 *
 * Spelling is American throughout, because the business is in Colorado.
 *
 * ONE PARAGRAPH IS WORTH HER EXPLICIT SIGN-OFF: the one about intuition and
 * mediumship. It is plainly important to her and it is a third of what she
 * sent, so it is included in full rather than quietly dropped — that choice is
 * hers to make, not a developer's. It is flagged here so nobody discovers it on
 * the live page and wonders whether anyone read it.
 *
 * ------------------------------------------------------------------------
 * WHY clinic.intro IS BEING RESET
 * ------------------------------------------------------------------------
 * The biography had been pasted into it, and arrived truncated: the live home
 * page opened with "icensed Esthetician • Certified Phlebotomy Technician…",
 * missing its first letter and cut off mid-sentence. That field is the hero
 * lede — two lines above the fold — and there was nowhere else for a biography
 * to go, so it went in the only box that looked big enough. Migration 0024 adds
 * the field that was missing; this restores the lede.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const WRITE = process.argv.includes('--write');
const slug = 'medbar-loveland';

const CREDENTIALS = 'LE, CPT, CLO, LSO';

const ROLE_LABEL = 'Owner · Licensed Esthetician & Certified Phlebotomy Technician';

/** Beside a portrait, on the home page and in the team list. Three sentences. */
const BIO = [
  'Two traditions shaped Jamie’s work: generations of estheticians on her',
  'father’s side, nursing and healthcare on her mother’s. The Med Bar brings',
  'them together — the artistry of aesthetics and the science of wellness —',
  'with a particular place kept for veterans, first responders and the families',
  'beside them.'
].join(' ');

/** The about page, in full, for a reader who has chosen to open it. */
const STORY = [
  'For Jamie, aesthetics and healing aren’t simply a career. They’re part of her family history, and a connection to the generations who came before her.',

  'She grew up surrounded by two traditions. On her father’s side were generations of estheticians, beauticians and cosmetologists — her grandmother owned a beauty shop where Jamie’s mother and aunts worked, and by around thirteen Jamie was already learning skincare and the art of caring for other people. On her mother’s side, nursing and healthcare ran through the family. Her work today brings those two paths together: the artistry of aesthetics and the science of health and wellness.',

  'A mother of five, including four daughters, she found herself passing many of those same traditions on to the next generation. While homeschooling her children she decided it was finally time to turn a lifetime of hands-on experience into a profession, and became a Licensed Esthetician.',

  'Her interest in healing has always reached beyond traditional aesthetics. From a young age she explored intuition and mediumship, later helping others navigate grief and teaching mediumship herself. Her connection to her ancestors — particularly her continued connection with her grandmother — remains an important part of her life, and shaped her belief that healing can take many forms. She carries that into her work while continuing to build on it through modern education, science and advanced aesthetics.',

  'That belief mattered more through life with her husband of more than two decades, an Army combat veteran. Watching someone she loves navigate the challenges that can follow military service, and the healthcare systems that come with it, deepened her interest in supportive, wellness-focused care. It also left a lasting place in her heart for veterans, first responders, and the families who stand beside them.',

  'Her interest in natural and regenerative approaches led her to become a Certified Phlebotomy Technician and to expand her training into regenerative aesthetics, including platelet-rich fibrin, which uses components derived from a client’s own blood. She is especially drawn to treatments that work with the body’s own processes.',

  'The same thinking led her to create SkinAlchemy, her own natural skincare line. Its Calm Balm grew out of generations of family skincare knowledge and collaboration with her grandmother, alongside her own experience of sensitive skin and her husband’s eczema — a soothing, naturally derived balm for compromised and post-procedure skin, now used in treatments such as microneedling.',

  'Jamie also holds advanced credentials as a Certified Laser Operator and Laser Safety Officer, and has continued her education in injectables and advanced aesthetic procedures. Alongside The Med Bar she works with Gameday Men’s Health, assisting with patient care involving hormone optimization, injections, peptides and wellness-focused treatments.',

  'Her longer vision is bigger than aesthetics alone: to grow The Med Bar into a comprehensive aesthetics and wellness center that brings together the influences that have shaped her life — ancestral knowledge, beauty, healthcare, regenerative therapies, natural wellness and modern aesthetics. To honor where she came from while continuing to learn what comes next.'
].join('\n\n');

/** The hero lede. Two lines about what the practice does, not who runs it. */
const INTRO =
  'Platelet-rich fibrin treatments — under-eyes, microneedling and hair ' +
  'restoration built on your own platelets, drawn and spun in the room. Plus ' +
  'lashes, facials and inkless scar revision.';

const TAGLINE = 'Skin, lashes and regenerative treatments in Loveland.';

function connectionString() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const pw = process.env.SUPABASE_DB_PASSWORD;
  const region = process.env.SUPABASE_REGION || 'us-east-1';
  if (!ref || !pw) {
    console.error('  SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD must be set in .env.local');
    process.exit(1);
  }
  return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
}

async function main() {
  const client = new Client({ connectionString: connectionString() });
  await client.connect();

  const { rows } = await client.query(
    `select c.id as clinic_id, c.intro, pr.id as provider_id, pr.name
       from clinic c
       left join provider pr on pr.clinic_id = c.id and pr.active
      where c.slug = $1
      order by pr.sort_order
      limit 1`, [slug]);

  const row = rows[0];
  if (!row?.provider_id) { console.error(`\n  No active provider for ${slug}.\n`); process.exit(1); }

  console.log(`\n  ${row.name}\n`);
  console.log(`    credentials  ${CREDENTIALS}`);
  console.log(`    role         ${ROLE_LABEL}`);
  console.log(`    bio          ${BIO.length} chars, shown beside her portrait`);
  console.log(`    story        ${STORY.length} chars, ${STORY.split('\n\n').length} paragraphs, about page`);
  console.log('');
  console.log('  The practice intro currently reads:');
  console.log(`    ${JSON.stringify(String(row.intro ?? '').slice(0, 90))}…`);
  console.log('  and will be replaced with:');
  console.log(`    ${JSON.stringify(INTRO.slice(0, 90))}…`);

  if (!WRITE) {
    console.log('\n  Nothing written. Re-run with --write.\n');
    await client.end();
    return;
  }

  await client.query(
    `update provider set credentials = $1, role_label = $2, bio = $3, story = $4 where id = $5`,
    [CREDENTIALS, ROLE_LABEL, BIO, STORY, row.provider_id]);

  await client.query(
    `update clinic set intro = $1, tagline = coalesce(nullif(tagline, ''), $2) where id = $3`,
    [INTRO, TAGLINE, row.clinic_id]);

  console.log('\n  Written. The hero lede is a lede again and the biography has a page.\n');
  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
