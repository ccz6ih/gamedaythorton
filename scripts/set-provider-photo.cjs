/**
 * set-provider-photo.cjs
 * Points a provider record at a public marketing headshot.
 *
 *   node scripts/set-provider-photo.cjs "Jamie Salazar" /practitioners/jamie-salazar.jpg
 *
 * A leading slash means /public — a marketing asset, deliberately world
 * readable. Anything else is a private storage object needing a signed URL.
 * A practitioner headshot is the first; a patient photo is always the second
 * and never goes through this script. docs/16-media-pipeline.md.
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

let [name, photo] = process.argv.slice(2);

/**
 * Git Bash on Windows rewrites a leading-slash argument into a Windows path, so
 * "/practitioners/x.jpg" arrives as "C:/Program Files/Git/practitioners/x.jpg".
 * The script then appears to succeed and stores a path that resolves nowhere —
 * the worst kind of failure, because nothing reports it. Undo it here rather
 * than relying on everyone remembering to set MSYS_NO_PATHCONV=1.
 */
function unmangle(p) {
  if (!p || !/^[A-Za-z]:/.test(p)) return p;
  const norm = p.split('\\').join('/');
  const at = norm.toLowerCase().lastIndexOf('/git/');
  if (at === -1) return p;
  const fixed = norm.slice(at + 4);
  console.log(`  (un-mangled Git Bash path: ${p} -> ${fixed})`);
  return fixed;
}

photo = unmangle(photo);

if (!name || !photo) {
  console.error('\n  usage: node scripts/set-provider-photo.cjs "<provider name>" <path>\n');
  process.exit(1);
}

if (photo.startsWith('/')) {
  const onDisk = path.resolve(__dirname, '..', 'public', photo.slice(1));
  if (!fs.existsSync(onDisk)) {
    console.error(`\n  ${photo} is not in public/. Put the file there first.\n`);
    process.exit(1);
  }
}

(async () => {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const client = new Client({
    host: process.env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`,
    port: Number(process.env.SUPABASE_DB_PORT || 5432),
    user: process.env.SUPABASE_DB_USER || 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  const { rows } = await client.query(
    'update provider set photo_path = $1 where name = $2 returning name, photo_path',
    [photo, name]
  );

  if (!rows.length) console.error(`  no provider named "${name}"`);
  else rows.forEach(r => console.log(`  ${r.name} -> ${r.photo_path}`));

  await client.end();
})().catch(err => { console.error('  ' + err.message); process.exit(1); });
