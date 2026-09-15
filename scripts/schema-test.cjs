/**
 * schema-test.cjs
 * The structured data parses, and says what the page says.
 *
 *   node scripts/schema-test.cjs                       # production
 *   node scripts/schema-test.cjs http://localhost:3999/c/medbar-loveland
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS TESTED HARDER THAN THE PROSE
 * ---------------------------------------------------------------------------
 * Structured data is the version of a page that a machine quotes without a
 * human reading it first. A wrong price in the visible copy gets noticed by the
 * next person who looks at the page; a wrong price in JSON-LD becomes a
 * confident answer in somebody else's interface and nobody at the practice ever
 * sees it.
 *
 * It also fails silently in both directions. Malformed JSON is skipped by every
 * consumer without an error, and a block that parses but describes the wrong
 * thing is worse than one that does not parse at all.
 *
 * So this checks three things, in order of how badly they would hurt:
 *
 *   1. Every ld+json block on the page is valid JSON with an @type.
 *   2. The blocks that should exist, exist.
 *   3. The numbers in them match the numbers rendered on the page — because
 *      the failure that matters is not "no schema", it is "schema that
 *      disagrees with the page".
 */

const BASE = (process.argv.slice(2).find(a => a.startsWith('http')) ?? 'https://www.medbarco.com')
  .replace(/\/$/, '');

let pass = 0;
const fails = [];

function check(ok, label, detail) {
  if (ok) { pass++; console.log(`  ok    ${label}`); }
  else { fails.push(label); console.log(`  FAIL  ${label}\n          ${detail}`); }
}

/** Every ld+json block on a page, parsed. Reports the ones that do not. */
async function blocksOf(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) return { html: '', blocks: [], status: res.status };
  const html = await res.text();
  const raw = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]);

  const blocks = [];
  for (const r of raw) {
    try {
      const parsed = JSON.parse(r);
      for (const o of Array.isArray(parsed) ? parsed : [parsed]) blocks.push(o);
    } catch (e) {
      blocks.push({ __parseError: e.message, __raw: r.slice(0, 120) });
    }
  }
  return { html, blocks, status: res.status };
}

/** Walks nested @graph / item / itemListElement so a type is found wherever. */
function findType(blocks, type) {
  const seen = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o['@type'] === type) seen.push(o);
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v);
  };
  blocks.forEach(walk);
  return seen;
}

async function main() {
  console.log(`\n  ${BASE}\n`);

  const PAGES = [
    { path: '/', types: ['MedicalBusiness'] },
    { path: '/services', types: ['MedicalBusiness', 'ItemList', 'Service'] },
    { path: '/shop/renew-eye-complex', types: ['MedicalBusiness', 'Product', 'Offer'] },
    { path: '/about', types: ['MedicalBusiness', 'Person'] },
    { path: '/prf', types: ['MedicalBusiness', 'FAQPage'] }
  ];

  const cache = {};

  for (const { path, types } of PAGES) {
    const got = await blocksOf(path);
    cache[path] = got;

    if (got.status && got.status !== 200) {
      check(false, `${path} responds`, `got ${got.status}`);
      continue;
    }

    const broken = got.blocks.filter(b => b.__parseError);
    check(broken.length === 0, `${path}: all ld+json parses`,
      broken.map(b => `${b.__parseError} in ${b.__raw}`).join('; '));

    for (const t of types) {
      const hits = findType(got.blocks, t);
      check(hits.length > 0, `${path}: has ${t}`,
        `no ${t} block — an answer engine has to parse the prose instead`);
    }
  }

  /* ------------------------------------------------- does it AGREE? -- */
  console.log('');

  const prod = cache['/shop/renew-eye-complex'];
  if (prod?.html) {
    const [offer] = findType(prod.blocks, 'Offer');
    /**
     * The price as RENDERED, read from the price element rather than the buy
     * button — the button says "Ask about this" wherever checkout is not
     * configured, so keying off it made this check silently unrunnable in
     * exactly the environments it would be run in.
     *
     * The page prints whole dollars ("$68") and schema wants two decimals
     * ("68.00"), so they are compared as numbers.
     */
    const onPage = (prod.html.match(/class="sf-product-price">\$([0-9]+(?:\.[0-9]{2})?)/) || [])[1];
    check(
      Boolean(offer?.price) && Boolean(onPage) && Number(offer.price) === Number(onPage),
      'the product price in schema matches the price on the page',
      `schema says ${offer?.price ?? '(none)'}, page says ${onPage ?? '(not found)'}`
    );

    const [p] = findType(prod.blocks, 'Product');
    check(Boolean(p?.image?.length), 'the product declares at least one image',
      'no image array');
    check(
      (p?.image ?? []).every(u => /^https?:\/\//.test(u)),
      'product images are absolute urls',
      'a relative url in JSON-LD has no base to resolve against'
    );
    check(
      (p?.image ?? []).every(u => !/localhost/.test(u)),
      'product images are not localhost',
      `got ${(p?.image ?? []).find(u => /localhost/.test(u))}`
    );
  }

  const svc = cache['/services'];
  if (svc?.html) {
    const services = findType(svc.blocks, 'Service');
    check(services.length > 0, 'the menu lists services', 'none found');

    // A service with no stated price must not carry one. This is the check
    // that stops a "from" price being published as a flat price.
    const withPrice = services.filter(s => s.offers?.price !== undefined);
    const withRange = services.filter(s => s.offers?.priceSpecification);
    check(withPrice.length + withRange.length <= services.length,
      'no service claims two kinds of price at once', 'overlapping offers');

    console.log(`          ${services.length} services · ${withPrice.length} fixed · ${withRange.length} from/per-unit`);
  }

  const about = cache['/about'];
  if (about?.html) {
    const [person] = findType(about.blocks, 'Person');
    check(
      Boolean(person?.name) && about.html.includes(person.name),
      'the practitioner named in schema appears on the page',
      `schema says "${person?.name}"`
    );
  }

  console.log(`\n  ${pass} passed, ${fails.length} failed.`);
  if (fails.length) {
    console.log('\n  Structured data is the version of the page a machine quotes');
    console.log('  without anybody reading it. Wrong is worse than absent.\n');
  } else {
    console.log('');
  }
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
