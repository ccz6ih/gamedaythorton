/**
 * sitemap-test.cjs
 * The sitemap exists, is where robots.txt says it is, and every URL in it works.
 *
 *   node scripts/sitemap-test.cjs                      # against production
 *   node scripts/sitemap-test.cjs http://localhost:3999
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * The sitemap had never worked. It lived at app/c/[slug]/sitemap.ts with a
 * generateSitemaps() export, which moved it to /c/<slug>/sitemap/0.xml — a path
 * no crawler looks for — and then crashed with 500 anyway, because
 * generateSitemaps() passes `{ id }` rather than `{ params }` and destructuring
 * `slug` off undefined throws.
 *
 * All the while public/robots.txt declared
 * `Sitemap: https://www.medbarco.com/sitemap.xml`, which returned 404.
 *
 * That combination is worse than having no sitemap. A declared sitemap that
 * 404s is a configuration error Search Console reports against the property,
 * and it is invisible from the site itself — every page renders perfectly.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT CHECKS
 * ---------------------------------------------------------------------------
 *   - robots.txt declares a sitemap, and that exact URL answers 200 as XML
 *   - the sitemap parses and is not empty
 *   - every <loc> is absolute, https, and on the practice's own domain
 *   - every <loc> actually resolves (this is the one that catches rot: a page
 *     renamed or removed leaves a sitemap confidently pointing at a 404)
 *
 * The URL fetches are the slow part and the point. A sitemap is a promise to a
 * crawler about what exists.
 */

const BASE = (process.argv.slice(2).find(a => a.startsWith('http')) ?? 'https://www.medbarco.com')
  .replace(/\/$/, '');

let pass = 0;
const fails = [];

function check(ok, label, detail) {
  if (ok) { pass++; console.log(`  ok    ${label}`); }
  else { fails.push({ label, detail }); console.log(`  FAIL  ${label}\n          ${detail}`); }
}

async function main() {
  console.log(`\n  ${BASE}\n`);

  /* ---------------------------------------------------------- robots -- */
  const rRes = await fetch(`${BASE}/robots.txt`);
  const robots = rRes.ok ? await rRes.text() : '';
  check(rRes.ok, 'robots.txt responds', `got ${rRes.status}`);

  const declared = (robots.match(/^\s*Sitemap:\s*(\S+)/im) || [])[1];
  check(Boolean(declared), 'robots.txt declares a Sitemap',
    'without it a crawler has to guess the location');

  /* --------------------------------------------------------- sitemap -- */
  // Checked at the DECLARED url, not at a path this test assumes. The whole
  // failure being guarded against was those two being different.
  const url = declared ?? `${BASE}/sitemap.xml`;
  const sRes = await fetch(url);
  check(sRes.status === 200, `the declared sitemap answers 200`,
    `${url} returned ${sRes.status}`);

  if (sRes.status !== 200) return report();

  const type = sRes.headers.get('content-type') ?? '';
  check(/xml/.test(type), 'it is served as XML', `content-type was ${type}`);

  const xml = await sRes.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());

  check(locs.length > 0, 'it lists at least one page',
    'an empty sitemap tells a crawler the site has nothing on it');

  const host = new URL(BASE).host;
  const offsite = locs.filter(l => {
    try { return new URL(l).host !== host; } catch { return true; }
  });
  check(offsite.length === 0, 'every url is absolute and on this domain',
    `these are not: ${offsite.slice(0, 3).join(', ')}`);

  const insecure = locs.filter(l => l.startsWith('http://'));
  check(insecure.length === 0, 'every url is https',
    `${insecure.length} listed over http`);

  const dupes = locs.length - new Set(locs).size;
  check(dupes === 0, 'no duplicate urls', `${dupes} repeated`);

  /* ------------------------------------------------- do they resolve -- */
  console.log(`\n  fetching all ${locs.length} listed pages…\n`);
  const broken = [];
  for (const loc of locs) {
    let res;
    try { res = await fetch(loc, { redirect: 'manual' }); }
    catch (e) { broken.push(`${loc} — ${e.message}`); continue; }
    // A redirect is a fault here too: a sitemap should list the canonical URL,
    // not one that bounces to it.
    if (res.status !== 200) broken.push(`${res.status} ${loc}`);
  }
  check(broken.length === 0, `all ${locs.length} listed pages return 200`,
    broken.slice(0, 6).join('\n          '));

  report();
}

function report() {
  console.log(`\n  ${pass} passed, ${fails.length} failed.`);
  if (fails.length) {
    console.log('\n  A sitemap is a promise to a crawler about what exists.');
    console.log('  One that lists a page which no longer answers is worse than');
    console.log('  not having one, because the error is attributed to the site.\n');
  } else {
    console.log('');
  }
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
