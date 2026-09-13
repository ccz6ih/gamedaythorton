/**
 * db-test.cjs
 * Proves the database's compliance controls actually hold, rather than assuming
 * they do because the SQL looked right.
 *
 * Covers:
 *   - the pilot-mode synthetic-data guard
 *   - no PHI in payment descriptors or metadata
 *   - no clinical content in notification previews
 *   - cross-tenant isolation, by DELIBERATE ATTEMPT (docs/06-architecture.md
 *     requires this test, not an assumption)
 *   - cross-patient isolation inside one tenant
 *   - patients cannot escalate their own record
 *   - double-booking is impossible
 *   - a package cannot be over-redeemed
 *
 * Everything is created in a throwaway tenant pair and removed afterwards.
 *
 * Run:  node scripts/db-test.cjs
 */

const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

let pass = 0, fail = 0;

function ok(label, note) { pass++; console.log(`  ✓ ${label}${note ? '  ' + note : ''}`); }
function bad(label, err) { fail++; console.log(`  ✗ ${label}`); if (err) console.log('      ' + String(err.message || err).split('\n')[0].slice(0, 160)); }

/** Asserts a statement is rejected, and that the message mentions `because`. */
async function mustFail(c, label, sql, params, because) {
  try {
    await c.query('savepoint t');
    await c.query(sql, params);
    await c.query('release savepoint t');
    bad(label, new Error('the write SUCCEEDED and should not have'));
  } catch (err) {
    await c.query('rollback to savepoint t').catch(() => {});
    if (because && !String(err.message).toLowerCase().includes(because.toLowerCase())) {
      bad(label, new Error(`rejected, but for the wrong reason: ${err.message}`));
    } else {
      ok(label, '→ blocked');
    }
  }
}

async function mustPass(c, label, sql, params) {
  try {
    await c.query('savepoint t');
    const r = await c.query(sql, params);
    await c.query('release savepoint t');
    ok(label);
    return r;
  } catch (err) {
    await c.query('rollback to savepoint t').catch(() => {});
    bad(label, err);
    return null;
  }
}

/** Runs fn as the given auth user, with RLS enforced. */
async function asUser(c, authId, fn) {
  await c.query('savepoint role_scope');
  await c.query(`set local role authenticated`);
  await c.query(`select set_config('request.jwt.claims', $1, true)`,
    [JSON.stringify({ sub: authId, role: 'authenticated' })]);
  try {
    return await fn();
  } finally {
    await c.query('rollback to savepoint role_scope').catch(() => {});
    await c.query('reset role').catch(() => {});
  }
}

(async () => {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const c = new Client({
    host: `db.${ref}.supabase.co`, port: 5432, user: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD, database: 'postgres',
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000
  });
  await c.connect();

  const ids = {};
  try {
    await c.query('begin');

    // ------------------------------------------------------------ setup --
    console.log('\nSETUP  (throwaway tenants, rolled back at the end)');

    const clinicA = await c.query(`
      insert into clinic (slug, name, practice_type, pilot_mode)
      values ('test-a', 'Test Clinic A', 'mens_health', true) returning id`);
    const clinicB = await c.query(`
      insert into clinic (slug, name, practice_type, pilot_mode)
      values ('test-b', 'Test Clinic B', 'med_spa', true) returning id`);
    ids.a = clinicA.rows[0].id;
    ids.b = clinicB.rows[0].id;
    ok('two tenants created', `A=mens_health  B=med_spa`);

    const mods = await c.query('select modules from clinic where id = $1', [ids.a]);
    if (mods.rows[0].modules.labs === true) ok('practice_type set module defaults', 'A.labs = true');
    else bad('practice_type set module defaults');
    const modsB = await c.query('select modules from clinic where id = $1', [ids.b]);
    if (modsB.rows[0].modules.labs === false && modsB.rows[0].modules.packages === true)
      ok('med spa gets packages, not labs', 'B.labs = false, B.packages = true');
    else bad('med spa gets packages, not labs');

    // Auth users for the RLS tests.
    async function mkAuthUser(email) {
      const r = await c.query(`
        insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
        values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
                'authenticated', 'authenticated', $1, now(), now())
        returning id`, [email]);
      return r.rows[0].id;
    }
    ids.staffAuthA = await mkAuthUser('staff-a@test.invalid');
    ids.staffAuthB = await mkAuthUser('staff-b@test.invalid');
    ids.patAuthA1 = await mkAuthUser('pat-a1@test.invalid');
    ids.patAuthA2 = await mkAuthUser('pat-a2@test.invalid');

    await c.query(`insert into staff_user (clinic_id, auth_user_id, name, email, role)
                   values ($1, $2, 'Staff A', 'staff-a@test.invalid', 'owner')`, [ids.a, ids.staffAuthA]);
    await c.query(`insert into staff_user (clinic_id, auth_user_id, name, email, role)
                   values ($1, $2, 'Staff B', 'staff-b@test.invalid', 'owner')`, [ids.b, ids.staffAuthB]);
    ok('one owner per tenant');

    // ------------------------------------------- pilot-mode data guard --
    console.log('\nPILOT-MODE GUARD  (THE RULE, enforced in the database)');

    await mustFail(c, 'a patient not marked synthetic is rejected',
      `insert into patient (clinic_id, first_name, last_name, synthetic)
       values ($1, 'Real', 'Person', false)`, [ids.a], 'PILOT MODE');

    const pA1 = await mustPass(c, 'a synthetic patient is accepted',
      `insert into patient (clinic_id, auth_user_id, first_name, last_name, email, synthetic, status, therapy_start_date)
       values ($1, $2, 'Synth', 'PatientOne', 'pat-a1@test.invalid', true, 'active', current_date - 120) returning id`,
      [ids.a, ids.patAuthA1]);
    ids.pA1 = pA1.rows[0].id;

    const pA2 = await c.query(
      `insert into patient (clinic_id, auth_user_id, first_name, last_name, synthetic, status)
       values ($1, $2, 'Synth', 'PatientTwo', true, 'active') returning id`, [ids.a, ids.patAuthA2]);
    ids.pA2 = pA2.rows[0].id;

    const pB1 = await c.query(
      `insert into patient (clinic_id, first_name, last_name, synthetic, status)
       values ($1, 'Other', 'Tenant', true, 'active') returning id`, [ids.b]);
    ids.pB1 = pB1.rows[0].id;

    await mustFail(c, 'a lab panel not marked synthetic is rejected',
      `insert into lab_panel (clinic_id, patient_id, drawn_at, synthetic)
       values ($1, $2, current_date, false)`, [ids.a, ids.pA1], 'PILOT MODE');

    await c.query(`update clinic set pilot_mode = false where id = $1`, [ids.b]);
    await mustPass(c, 'guard lifts when pilot_mode is false',
      `insert into lab_panel (clinic_id, patient_id, drawn_at, synthetic)
       values ($1, $2, current_date, false)`, [ids.b, ids.pB1]);
    await c.query(`update clinic set pilot_mode = true where id = $1`, [ids.b]);

    // ------------------------------------------------- no PHI outbound --
    console.log('\nNO PHI WHERE IT CAN BE SEEN');

    await mustFail(c, 'payment descriptor naming a therapy is rejected',
      `insert into payment (clinic_id, patient_id, amount_cents, descriptor, synthetic)
       values ($1, $2, 24900, 'GAMEDAY - TESTOSTERONE THERAPY', true)`,
      [ids.a, ids.pA1], 'PHI leak blocked');

    await mustFail(c, 'payment metadata naming a therapy is rejected',
      `insert into payment (clinic_id, patient_id, amount_cents, descriptor, metadata, synthetic)
       values ($1, $2, 24900, 'GAMEDAY THORNTON - MEMBERSHIP', '{"service":"PRF microneedling"}'::jsonb, true)`,
      [ids.a, ids.pA1], 'PHI leak blocked');

    await mustPass(c, 'a neutral descriptor is accepted',
      `insert into payment (clinic_id, patient_id, amount_cents, descriptor, status, synthetic)
       values ($1, $2, 24900, 'GAMEDAY THORNTON - MEMBERSHIP', 'succeeded', true)`,
      [ids.a, ids.pA1]);

    await mustFail(c, 'notification preview naming lab results is rejected',
      `insert into automation_run (clinic_id, patient_id, rule_key, channel, payload_preview, synthetic)
       values ($1, $2, 'labs_ready', 'sms', 'Your lab results are ready to view', true)`,
      [ids.a, ids.pA1], 'PHI leak blocked');

    await mustPass(c, 'a content-free preview is accepted',
      `insert into automation_run (clinic_id, patient_id, rule_key, channel, payload_preview, synthetic)
       values ($1, $2, 'update', 'push', 'Gameday: you have an update.', true)`,
      [ids.a, ids.pA1]);

    await mustPass(c, 'word-boundary matching does not flag "scheduled"',
      `insert into automation_run (clinic_id, patient_id, rule_key, channel, payload_preview, synthetic)
       values ($1, $2, 'reminder', 'sms', 'Gameday: your visit is scheduled for tomorrow. Needs a change? Tap here.', true)`,
      [ids.a, ids.pA1]);

    // --------------------------------------------------- booking guards --
    console.log('\nBOOKING INTEGRITY');

    const prov = await c.query(
      `insert into provider (clinic_id, name) values ($1, 'Test Provider') returning id`, [ids.a]);
    ids.prov = prov.rows[0].id;
    const svc = await c.query(
      `insert into service (clinic_id, name, duration_min, buffer_after_min, price_mode, price_cents)
       values ($1, 'Test Visit', 60, 15, 'flat', 15000) returning id`, [ids.a]);
    ids.svc = svc.rows[0].id;

    await mustPass(c, 'first booking at 10:00 accepted',
      `insert into appointment (clinic_id, patient_id, provider_id, service_id, starts_at, duration_min, buffer_min, synthetic)
       values ($1, $2, $3, $4, date_trunc('day', now()) + interval '10 hours', 60, 15, true)`,
      [ids.a, ids.pA1, ids.prov, ids.svc]);

    await mustFail(c, 'overlapping booking for the same provider is rejected',
      `insert into appointment (clinic_id, patient_id, provider_id, service_id, starts_at, duration_min, buffer_min, synthetic)
       values ($1, $2, $3, $4, date_trunc('day', now()) + interval '10 hours 30 minutes', 60, 15, true)`,
      [ids.a, ids.pA2, ids.prov, ids.svc], 'appointment_no_double_book');

    await mustFail(c, 'booking inside the turnaround buffer is rejected',
      `insert into appointment (clinic_id, patient_id, provider_id, service_id, starts_at, duration_min, buffer_min, synthetic)
       values ($1, $2, $3, $4, date_trunc('day', now()) + interval '11 hours 5 minutes', 60, 15, true)`,
      [ids.a, ids.pA2, ids.prov, ids.svc], 'appointment_no_double_book');

    await mustPass(c, 'booking after the buffer is accepted',
      `insert into appointment (clinic_id, patient_id, provider_id, service_id, starts_at, duration_min, buffer_min, synthetic)
       values ($1, $2, $3, $4, date_trunc('day', now()) + interval '11 hours 15 minutes', 60, 15, true)`,
      [ids.a, ids.pA2, ids.prov, ids.svc]);

    // Ask Postgres for minutes rather than comparing interval objects: node-pg
    // normalises 60 minutes to {hours:1}, so a naive .minutes check reads 0.
    const endCheck = await c.query(
      `select extract(epoch from (ends_at - starts_at)) / 60 as dur_min,
              extract(epoch from (blocks_until - starts_at)) / 60 as blk_min
       from appointment where patient_id = $1 limit 1`, [ids.pA1]);
    const { dur_min, blk_min } = endCheck.rows[0];
    if (Number(dur_min) === 60 && Number(blk_min) === 75)
      ok('ends_at and blocks_until maintained by trigger', '60min visit + 15min buffer');
    else bad('ends_at and blocks_until maintained by trigger',
      new Error(`got ${dur_min}min / ${blk_min}min`));

    // --------------------------------------------------------- packages --
    console.log('\nPACKAGE LIABILITY');

    const pkg = await c.query(
      `insert into service_package (clinic_id, name, sessions, price_cents, list_price_cents)
       values ($1, 'PRF Microneedling | 3 treatments', 3, 210000, 240000) returning id`, [ids.b]);
    const purch = await c.query(
      `insert into package_purchase (clinic_id, patient_id, package_id, package_name, sessions_total, price_paid_cents, synthetic)
       values ($1, $2, $3, 'PRF Microneedling | 3 treatments', 3, 210000, true) returning id`,
      [ids.b, ids.pB1, pkg.rows[0].id]);
    ids.purch = purch.rows[0].id;

    for (let i = 1; i <= 3; i++) {
      await c.query(`insert into package_redemption (clinic_id, purchase_id, patient_id, sessions, synthetic)
                     values ($1, $2, $3, 1, true)`, [ids.b, ids.purch, ids.pB1]);
    }
    ok('3 of 3 sessions redeemed');

    await mustFail(c, 'a 4th redemption is rejected',
      `insert into package_redemption (clinic_id, purchase_id, patient_id, sessions, synthetic)
       values ($1, $2, $3, 1, true)`, [ids.b, ids.purch, ids.pB1], 'already redeemed');

    // ------------------------------------------------------------- RLS --
    console.log('\nCROSS-TENANT ISOLATION  (deliberate attempt)');

    await asUser(c, ids.staffAuthA, async () => {
      const mine = await c.query('select count(*)::int n from patient');
      if (mine.rows[0].n === 2) ok('tenant A owner sees exactly their 2 patients');
      else bad('tenant A owner sees exactly their 2 patients', new Error(`saw ${mine.rows[0].n}`));

      const other = await c.query('select count(*)::int n from patient where clinic_id = $1', [ids.b]);
      if (other.rows[0].n === 0) ok('tenant A owner CANNOT see tenant B patients');
      else bad('tenant A owner CANNOT see tenant B patients', new Error(`LEAK: saw ${other.rows[0].n}`));

      const byId = await c.query('select count(*)::int n from patient where id = $1', [ids.pB1]);
      if (byId.rows[0].n === 0) ok('naming tenant B patient id directly returns nothing');
      else bad('naming tenant B patient id directly returns nothing', new Error('LEAK'));

      const labs = await c.query('select count(*)::int n from lab_panel where clinic_id = $1', [ids.b]);
      if (labs.rows[0].n === 0) ok('tenant B lab panels invisible to tenant A');
      else bad('tenant B lab panels invisible to tenant A', new Error('LEAK'));
    });

    await asUser(c, ids.staffAuthA, async () => {
      try {
        await c.query('savepoint w');
        await c.query(`insert into patient (clinic_id, first_name, last_name, synthetic)
                       values ($1, 'Injected', 'Row', true)`, [ids.b]);
        await c.query('release savepoint w');
        bad('tenant A cannot WRITE into tenant B', new Error('LEAK: write succeeded'));
      } catch {
        await c.query('rollback to savepoint w').catch(() => {});
        ok('tenant A cannot WRITE into tenant B', '→ blocked');
      }
    });

    console.log('\nCROSS-PATIENT ISOLATION  (same tenant)');

    await asUser(c, ids.patAuthA1, async () => {
      const self = await c.query('select count(*)::int n from patient');
      if (self.rows[0].n === 1) ok('a patient sees exactly one record: his own');
      else bad('a patient sees exactly one record: his own', new Error(`saw ${self.rows[0].n}`));

      const sibling = await c.query('select count(*)::int n from patient where id = $1', [ids.pA2]);
      if (sibling.rows[0].n === 0) ok('a patient cannot see another patient at the same clinic');
      else bad('a patient cannot see another patient at the same clinic', new Error('LEAK'));

      const audit = await c.query('select count(*)::int n from audit_log');
      if (audit.rows[0].n === 0) ok('a patient cannot read the audit log');
      else bad('a patient cannot read the audit log', new Error('LEAK'));

      const staff = await c.query('select count(*)::int n from staff_user');
      if (staff.rows[0].n === 0) ok('a patient cannot enumerate staff');
      else bad('a patient cannot enumerate staff', new Error('LEAK'));
    });

    await asUser(c, ids.patAuthA1, async () => {
      try {
        await c.query('savepoint e');
        await c.query(`update patient set status = 'active', notes_internal = 'x' where id = $1`, [ids.pA1]);
        await c.query('release savepoint e');
        bad('a patient cannot change protected columns', new Error('escalation succeeded'));
      } catch (err) {
        await c.query('rollback to savepoint e').catch(() => {});
        ok('a patient cannot change protected columns', '→ blocked');
      }
      try {
        await c.query('savepoint e2');
        await c.query(`update patient set phone = '+17205550000' where id = $1`, [ids.pA1]);
        await c.query('release savepoint e2');
        ok('a patient CAN update his own phone number');
      } catch (err) {
        await c.query('rollback to savepoint e2').catch(() => {});
        bad('a patient CAN update his own phone number', err);
      }
    });

    // ----------------------------------------------------------- audit --
    console.log('\nAUDIT LOG');

    const auditRows = await c.query(
      `select action, entity_type from audit_log where clinic_id = $1 order by id`, [ids.a]);
    if (auditRows.rows.length > 0) ok('writes produced audit rows', `${auditRows.rows.length} entries`);
    else bad('writes produced audit rows');

    const hasValues = await c.query(
      `select count(*)::int n from audit_log
       where changed::text ilike '%PatientOne%' or changed::text ilike '%7205550000%'`);
    if (hasValues.rows[0].n === 0) ok('audit log records column names, not PHI values');
    else bad('audit log records column names, not PHI values', new Error('PHI found in audit rows'));

    await asUser(c, ids.staffAuthA, async () => {
      try {
        await c.query('savepoint a');
        await c.query('delete from audit_log where clinic_id = $1', [ids.a]);
        await c.query('release savepoint a');
        bad('the audit log cannot be deleted', new Error('delete succeeded'));
      } catch {
        await c.query('rollback to savepoint a').catch(() => {});
        ok('the audit log cannot be deleted', '→ blocked');
      }
    });

  } catch (err) {
    console.error('\n  Harness error:', err.message);
    fail++;
  } finally {
    await c.query('rollback').catch(() => {});
    await c.end().catch(() => {});
  }

  console.log('\n' + '─'.repeat(64));
  if (fail) {
    console.log(`${fail} of ${pass + fail} database control checks FAILED\n`);
    process.exit(1);
  }
  console.log(`All ${pass} database control checks passed. Nothing was left behind.\n`);
})();
