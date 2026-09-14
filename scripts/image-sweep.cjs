/**
 * image-sweep.cjs
 * Fetches every product image from the LIVE site and checks what comes back.
 *
 *   node scripts/image-sweep.cjs
 *   node scripts/image-sweep.cjs https://medbarco.com
 *
 * ------------------------------------------------------------------------
 * WHY A 200 IS NOT ENOUGH
 * ------------------------------------------------------------------------
 * Every product image on this shop once answered 307 to /admin, because the
 * middleware matcher listed the public folders that existed when it was written
 * and public/products/ was added later. A naive checker following redirects
 * would have reported 200 for all of them and been perfectly happy — the
 * sign-in page is a 200.
 *
 * So this does not follow redirects, and it asserts the content-type is an
 * image. A photograph has to come back as a photograph.
 *
 * It also uses a mobile user agent by default. The bug was reported as
 * "products do not work on mobile", and it looked that way for a real reason:
 * a desktop browser that had loaded the images before the redirect appeared
 * kept serving them from its own cache, so the only people seeing the truth
 * were people arriving fresh — which on this business is mostly phones.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const BASE = (process.argv.slice(2).find(a => a.startsWith('http')) ?? 'https://www.medbarco.com')
  .replace(/\/$/, '');

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
  + '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function connectionString() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const pw = process.env.SUPABASE_DB_PASSWORD;
  const region = process.env.SUPABASE_REGION || 'us-east-1';
  if (!ref || !pw) {
    console.log('\n  SKIPPED: SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD are not set.\n');
    process.exit(0);
  }
  return `postgresql://postgres.${ref}:${encodeURIComponent(pw)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
}

async function main() {
  const client = new Client({ connectionString: connectionString() });
  await client.connect();

  const { rows } = await client.query(`
    select distinct url from (
      select p.image_path as url
        from product p join clinic c on c.id = p.clinic_id
       where c.slug = 'medbar-loveland' and p.image_path is not null
      union all
      select i.path as url
        from product_image i join clinic c on c.id = i.clinic_id
       where c.slug = 'medbar-loveland'
    ) t order by url
  `);
  await client.end();

  console.log(`\n  ${BASE} — ${rows.length} image(s), mobile user agent, redirects NOT followed\n`);

  const bad = [];
  for (const { url } of rows) {
    let res;
    try {
      res = await fetch(BASE + url, {
        redirect: 'manual',
        headers: { 'user-agent': MOBILE_UA, accept: 'image/webp,image/*,*/*' }
      });
    } catch (e) {
      bad.push({ url, why: `request failed: ${e.message}` });
      continue;
    }

    const type = res.headers.get('content-type') ?? '(none)';

    if (res.status >= 300 && res.status < 400) {
      bad.push({ url, why: `${res.status} redirect to ${res.headers.get('location')}` });
    } else if (res.status !== 200) {
      bad.push({ url, why: `${res.status}` });
    } else if (!type.startsWith('image/')) {
      bad.push({ url, why: `200 but content-type is ${type} — that is not a photograph` });
    }
  }

  if (bad.length) {
    console.log(`  ${bad.length} BROKEN:\n`);
    for (const b of bad) console.log(`    ${b.url}\n      ${b.why}\n`);
  }

  console.log(`  ${rows.length - bad.length} of ${rows.length} images serve correctly.\n`);
  process.exit(bad.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
