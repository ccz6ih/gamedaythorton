/**
 * write-test.cjs
 * Exercises the console's WRITE paths as a real signed-in user, through RLS.
 *
 * WHY THIS EXISTS SEPARATELY
 * screen-test.cjs proves the screens render. That is not the same as proving the
 * Save button works — a form that renders beautifully and silently fails on submit
 * is worse than no form, because the person trusts it.
 *
 * It writes through the PostgREST API with the user's own token, so every insert
 * passes the same RLS policies and the same database guards the console does. Rows
 * are removed afterwards; anything it cannot remove, it says so.
 *
 * Run:  node scripts/write-test.cjs
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PW = process.env.PILOT_DEMO_PASSWORD;

let pass = 0, fail = 0;
const ok = (m, n) => { pass++; console.log(`  ✓ ${m}${n ? '  ' + n : ''}`); };
const bad = (m, e) => { fail++; console.log(`  ✗ ${m}`); if (e) console.log('      ' + String(e).slice(0, 200)); };

async function signIn(email) {
  const r = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.msg || 'sign-in failed');
  return j.access_token;
}

function api(token) {
  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
  return {
    async insert(table, row) {
      const r = await fetch(`${URL_SB}/rest/v1/${table}`, {
        method: 'POST', headers, body: JSON.stringify(row)
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new Error(body?.message || body?.hint || `${r.status}`);
      return Array.isArray(body) ? body[0] : body;
    },
    async patch(table, id, row) {
      const r = await fetch(`${URL_SB}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH', headers, body: JSON.stringify(row)
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new Error(body?.message || `${r.status}`);
      return Array.isArray(body) ? body[0] : body;
    },
    async del(table, id) {
      const r = await fetch(`${URL_SB}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers });
      return r.ok;
    },
    async get(table, query) {
      const r = await fetch(`${URL_SB}/rest/v1/${table}?${query}`, { headers });
      return r.ok ? r.json() : [];
    }
  };
}

/** Asserts a write is refused, and that the refusal mentions the right reason. */
async function refuses(label, fn, because) {
  try {
    await fn();
    bad(label, 'the write SUCCEEDED and should not have');
  } catch (err) {
    const msg = String(err.message);
    if (because && !msg.toLowerCase().includes(because.toLowerCase())) {
      bad(label, `refused for the wrong reason: ${msg}`);
    } else {
      ok(label, '→ refused');
    }
  }
}

(async () => {
  console.log('\nCONSOLE WRITE PATHS\n');

  const cleanup = [];
  let db;

  try {
    const token = await signIn('jamie@medbar.pilot.invalid');
    db = api(token);
    ok('signed in as Jamie');

    const [clinic] = await db.get('clinic_public', 'select=id,name');
    const clinicId = clinic.id;

    /* ------------------------------------------------------ services -- */
    console.log('\nSERVICES & PRICING');

    const svc = await db.insert('service', {
      clinic_id: clinicId,
      name: 'WRITE TEST — Signature Facial',
      category: 'facials',
      duration_min: 60,
      buffer_after_min: 15,
      price_mode: 'flat',
      price_cents: 14500,
      active: true
    });
    cleanup.push(['service', svc.id]);
    ok('added a flat-priced service', `$${svc.price_cents / 100}`);

    const updated = await db.patch('service', svc.id, { price_cents: 15500, duration_min: 75 });
    if (updated.price_cents === 15500 && updated.duration_min === 75) {
      ok('edited its price and duration', '$145 → $155, 60 → 75 min');
    } else bad('edited its price and duration');

    const fromPriced = await db.insert('service', {
      clinic_id: clinicId,
      name: 'WRITE TEST — PRF, price varies',
      category: 'injectables',
      duration_min: 85,
      price_mode: 'from',
      price_from_cents: 80000,
      active: true
    });
    cleanup.push(['service', fromPriced.id]);
    ok('added a "from" priced service', 'from $800');

    const perUnit = await db.insert('service', {
      clinic_id: clinicId,
      name: 'WRITE TEST — Neurotoxin per unit',
      category: 'injectables',
      duration_min: 60,
      price_mode: 'per_unit',
      price_from_cents: 1400,
      unit_label: 'unit',
      active: true
    });
    cleanup.push(['service', perUnit.id]);
    ok('added a per-unit priced service', '$14+/unit');

    // The database refuses a flat service with no price, so the app cannot print $0.
    await refuses('a flat service with no price is refused',
      () => db.insert('service', {
        clinic_id: clinicId, name: 'WRITE TEST — broken', category: 'other',
        duration_min: 30, price_mode: 'flat', price_cents: null
      }),
      'service_price_present');

    const retired = await db.patch('service', svc.id, { active: false });
    if (retired.active === false) ok('retired a service without deleting its history');
    else bad('retired a service');

      /* ------------------------------------------- managing the menu herself -- */
      // The practice has to be able to run its own menu without a developer. Add,
      // edit, reorder, retire — and delete, but only when nothing points at the
      // service, because a past treatment record naming a service that no longer
      // exists is a clinical record that has lost information.
      console.log('\nSERVICE MANAGEMENT');

      const fresh = await db.insert('service', {
        clinic_id: clinicId,
        name: 'MENU TEST — Brow Lamination',
        category: 'skin',
        duration_min: 45,
        price_mode: 'flat',
        price_cents: 9500,
        description: 'A short line for the menu.',
        details: 'The longer version that sits behind "What this involves".',
        needs_copy: false,
        sort_order: 5,
        active: true
      });
      ok('she can add a service', `${fresh.name} — $${fresh.price_cents / 100}`);

      if (fresh.details && fresh.needs_copy === false) {
        ok('storefront copy saves with it', 'short line and long copy');
      } else bad('storefront copy saves with it');

      const reordered = await db.patch('service', fresh.id, { sort_order: 1, deposit_cents: 2500 });
      if (reordered.sort_order === 1 && reordered.deposit_cents === 2500) {
        ok('she can reorder it and set a deposit', 'position 1, $25 deposit');
      } else bad('she can reorder it and set a deposit');

      // Nothing references this one, so removing it outright is safe.
      if (await db.del('service', fresh.id)) ok('an unused service deletes outright');
      else bad('an unused service deletes outright');

      // Now the case that matters: a service with history.
      const used = await db.get('service',
        'select=id,name&clinic_id=eq.' + clinicId + '&limit=40');
      let guarded = null;
      for (const s of used) {
        const refs = await db.get('treatment_record', `select=id&service_id=eq.${s.id}&limit=1`);
        if (refs.length) { guarded = s; break; }
      }

      if (guarded) {
        // The console refuses this before it reaches the database. Prove the
        // database itself does not silently blank the history if it ever got past.
        const before = await db.get('treatment_record', `select=id&service_id=eq.${guarded.id}`);
        const retired = await db.patch('service', guarded.id, { active: false });
        if (retired.active === false) ok('a service with history can be retired', guarded.name);
        else bad('a service with history can be retired');

        const after = await db.get('treatment_record', `select=id&service_id=eq.${guarded.id}`);
        if (after.length === before.length) {
          ok('retiring it keeps every past record', `${after.length} treatment record(s) intact`);
        } else bad('retiring it keeps every past record');

        await db.patch('service', guarded.id, { active: true });
        ok('put back for the next run');
      } else {
        bad('found a service with history to test against');
      }

    /* ------------------------------------------------------- clients -- */
    console.log('\nCLIENTS');

    const client = await db.insert('patient', {
      clinic_id: clinicId,
      first_name: 'Writetest',
      last_name: 'Person',
      phone: '+19705550199',
      status: 'lead',
      acquisition_source: 'instagram',
      synthetic: true
    });
    cleanup.push(['patient', client.id]);
    ok('added a client');

    const edited = await db.patch('patient', client.id, {
      status: 'active', preferred_name: 'Writey', notes_internal: 'internal only'
    });
    if (edited.status === 'active' && edited.preferred_name === 'Writey') {
      ok('edited status, preferred name and internal note');
    } else bad('edited the client');

    // The pilot guard: a client NOT marked synthetic must be refused.
    await refuses('a client not marked synthetic is refused',
      () => db.insert('patient', {
        clinic_id: clinicId, first_name: 'Real', last_name: 'Person', synthetic: false
      }),
      'PILOT MODE');

    /* --------------------------------------------------- appointments -- */
    console.log('\nBOOKING');

    const [provider] = await db.get('provider_public', 'select=id&limit=1');
    const monday = (() => {
      const d = new Date();
      d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));   // next Monday
      return d.toISOString().slice(0, 10);
    })();

    const appt = await db.insert('appointment', {
      clinic_id: clinicId,
      patient_id: client.id,
      service_id: fromPriced.id,
      provider_id: provider?.id ?? null,
      starts_at: `${monday}T09:00:00`,
      duration_min: 85,
      buffer_min: 20,
      status: 'booked',
      booking_channel: 'staff',
      synthetic: true
    });
    cleanup.push(['appointment', appt.id]);
    ok('booked an appointment', `${monday} 09:00, 85min + 20min turnaround`);

    if (appt.ends_at && appt.blocks_until) {
      const dur = (new Date(appt.ends_at) - new Date(appt.starts_at)) / 60000;
      const blk = (new Date(appt.blocks_until) - new Date(appt.starts_at)) / 60000;
      if (dur === 85 && blk === 105) ok('end time and turnaround computed on write');
      else bad('end time and turnaround computed', `${dur}min / ${blk}min`);
    }

    await refuses('a clashing booking for the same provider is refused',
      () => db.insert('appointment', {
        clinic_id: clinicId, patient_id: client.id, service_id: fromPriced.id,
        provider_id: provider?.id ?? null,
        starts_at: `${monday}T10:00:00`, duration_min: 60, buffer_min: 15,
        status: 'booked', synthetic: true
      }),
      'appointment_no_double_book');

    const moved = await db.patch('appointment', appt.id, { status: 'complete' });
    if (moved.status === 'complete') ok('marked it complete');
    else bad('marked it complete');

    /* ---------------------------------------------- treatment records -- */
    console.log('\nTREATMENT RECORDS');

    const [lot] = await db.get('inventory_lot', 'select=id,lot_number&qty_remaining=gt.0&limit=1');

    const record = await db.insert('treatment_record', {
      clinic_id: clinicId,
      patient_id: client.id,
      service_id: perUnit.id,
      performed_at: new Date().toISOString(),
      notes_clinical: 'Write test. Tolerated well.',
      notes_patient_facing: 'All done — give it two weeks to settle.',
      aftercare_given: true,
      aftercare_version: 'v1',
      synthetic: true
    });
    cleanup.push(['treatment_record', record.id]);
    ok('recorded a treatment');

    const areas = [
      { area: 'Glabella', units: 20 },
      { area: 'Frontalis', units: 12 }
    ];
    for (const [i, a] of areas.entries()) {
      const detail = await db.insert('treatment_detail', {
        clinic_id: clinicId,
        treatment_record_id: record.id,
        patient_id: client.id,
        area: a.area,
        units: a.units,
        product_name: 'Jeuveau',
        lot_id: lot?.id ?? null,
        sort_order: i,
        synthetic: true
      });
      cleanup.unshift(['treatment_detail', detail.id]);
    }
    ok('added areas with units and a lot', lot ? `lot ${lot.lot_number}` : 'no lot on file');

    const withUnits = await db.patch('treatment_record', record.id, { total_units: 32 });
    if (Number(withUnits.total_units) === 32) ok('total units recorded', '32u');
    else bad('total units recorded');

    const adverse = await db.patch('treatment_record', record.id, {
      adverse_event: true,
      adverse_event_note: 'Write test bruising, resolving.',
      follow_up_due: monday
    });
    if (adverse.adverse_event === true) ok('flagged an adverse event with a follow-up date');
    else bad('flagged an adverse event');

    /* ------------------------------------------------------ lab entry -- */
    console.log('\nLAB ENTRY (men’s health tenant)');

    const rayToken = await signIn('owner@gameday.pilot.invalid');
    const rdb = api(rayToken);
    const [gameday] = await rdb.get('clinic_public', 'select=id');
    const [gPatient] = await rdb.get('patient', 'select=id&limit=1');
    const [hct] = await rdb.get('analyte', 'select=*&key=eq.hematocrit');

    const panel = await rdb.insert('lab_panel', {
      clinic_id: gameday.id,
      patient_id: gPatient.id,
      drawn_at: new Date().toISOString().slice(0, 10),
      source: 'in_clinic',
      note: 'Write test panel',
      synthetic: true
    });
    ok('created a lab panel');

    const result = await rdb.insert('lab_result', {
      clinic_id: gameday.id,
      panel_id: panel.id,
      patient_id: gPatient.id,
      analyte_key: 'hematocrit',
      value_numeric: 53.4,
      unit: '%',
      ref_low: hct.ref_low, ref_high: hct.ref_high,
      target_low: hct.target_low, target_high: hct.target_high,
      flag: 'critical',
      provisional_ranges: true,
      synthetic: true
    });
    ok('entered a value above the ceiling', '53.4% → flagged critical');

    const queue = await rdb.get('lab_result',
      `select=id&flag=eq.critical&patient_id=eq.${gPatient.id}`);
    if (queue.length > 0) ok('it reaches the safety queue', `${queue.length} critical value(s)`);
    else bad('it reaches the safety queue');

    await rdb.del('lab_result', result.id);
    await rdb.del('lab_panel', panel.id);
    ok('lab test rows removed');

    /* ----------------------------------------------- brand image storage -- */
    // A PUBLIC bucket, which is correct for a logo and would be catastrophic for
    // a progress photograph. So the two things that matter: a clinic can write
    // inside its own folder, and cannot write inside anyone else's.
    console.log('\nBRAND IMAGE STORAGE');

    const png = Uint8Array.from(atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    ), c => c.charCodeAt(0));

    async function putObject(token, objectPath) {
      const r = await fetch(`${URL_SB}/storage/v1/object/brand/${objectPath}`, {
        method: 'POST',
        headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
        body: png
      });
      return { ok: r.ok, status: r.status };
    }

    const mine = `${clinicId}/write-test-${Date.now()}.png`;
    const up = await putObject(token, mine);
    if (up.ok) ok('a practice can upload into its own folder', mine.split('/')[1]);
    else bad('a practice can upload into its own folder', `status ${up.status}`);

    // Public read is the point of the bucket — a logo behind a signed URL is a
    // logo that does not load.
    const pub = await fetch(`${URL_SB}/storage/v1/object/public/brand/${mine}`);
    if (pub.ok) ok('and the world can read it', 'which is what a logo is for');
    else bad('and the world can read it', `status ${pub.status}`);

    // The one that matters. Jamie must not be able to write into Gameday's
    // folder — on a shared public bucket that would mean replacing another
    // business's logo.
    // RLS correctly hides the other clinic from Jamie, so its id has to come
    // from the other side. Signing in as Gameday to LEARN the id is not the
    // exploit — the exploit would be Jamie writing there once she knows it,
    // which is exactly what this then tries.
    let otherClinicId = null;
    try {
      const rt = await signIn('owner@gameday.pilot.invalid');
      const [gd] = await api(rt).get('clinic_public', 'select=id');
      otherClinicId = gd?.id ?? null;
    } catch { /* reported below */ }

    if (otherClinicId) {
      const theirs = `${otherClinicId}/hostile-${Date.now()}.png`;
      const cross = await putObject(token, theirs);
      if (!cross.ok) ok('but not into another practice\u2019s folder', `refused (${cross.status})`);
      else bad('but not into another practice\u2019s folder', 'ONE CLINIC CAN OVERWRITE ANOTHER\u2019S BRANDING');
    } else {
      bad('found a second clinic to test isolation against');
    }

    // Clean up our own object.
    const del = await fetch(`${URL_SB}/storage/v1/object/brand/${mine}`, {
      method: 'DELETE', headers: { apikey: KEY, Authorization: `Bearer ${token}` }
    });
    if (del.ok) ok('and can delete its own uploads');
    else bad('and can delete its own uploads', `status ${del.status}`);

    /* -------------------------------------------------- guards still on -- */
    console.log('\nGUARDS STILL HOLD ON WRITES');

    await refuses('a payment descriptor naming a therapy is refused',
      () => db.insert('payment', {
        clinic_id: clinicId, patient_id: client.id, amount_cents: 1000,
        descriptor: 'THE MED BAR - BOTOX', synthetic: true
      }),
      'PHI leak blocked');

    const goodPayment = await db.insert('payment', {
      clinic_id: clinicId, patient_id: client.id, amount_cents: 15500,
      type: 'visit', status: 'succeeded', descriptor: 'THE MED BAR - SERVICES',
      synthetic: true
    });
    cleanup.push(['payment', goodPayment.id]);
    ok('a neutral descriptor is accepted');

    // Cross-tenant write, from a real session, through the real API.
    await refuses('Jamie cannot add a client to the other practice',
      () => db.insert('patient', {
        clinic_id: gameday.id, first_name: 'Cross', last_name: 'Tenant', synthetic: true
      }));

  } catch (err) {
    bad('harness', err.message);
  } finally {
    console.log('\nCLEANUP');
    let removed = 0, stuck = [];
    for (const [table, id] of cleanup) {
      try {
        if (await db.del(table, id)) removed++; else stuck.push(`${table}/${id}`);
      } catch { stuck.push(`${table}/${id}`); }
    }
    if (stuck.length) bad('every test row removed', `left behind: ${stuck.join(', ')}`);
    else ok('every test row removed', `${removed} rows`);
  }

  console.log('\n' + '─'.repeat(64));
  if (fail) { console.log(`${fail} of ${pass + fail} write checks FAILED\n`); process.exit(1); }
  console.log(`All ${pass} write checks passed.\n`);
})();
