/**
 * lib/db/queries.ts
 * Every derived number in the product, defined exactly once.
 *
 * This is the production counterpart of GD.q in the prototype, and the selector
 * names deliberately match. When the owner asks "where does that number come
 * from", there must be exactly one answer per metric — not one per screen.
 *
 * Every query runs as the signed-in user, so RLS scopes it. None of these
 * functions take a clinic id from the caller for filtering purposes; they take it
 * only where a query needs it for a join or a count. A screen cannot widen its
 * own access by passing a different id, because the policies would reject it.
 */

import { serverClient } from '@/lib/supabase/server';
import { dayKey } from '@/lib/format';

export type Clinic = {
  id: string;
  slug: string;          // addresses the public storefront at /c/<slug>
  name: string;
  location_name: string | null;
  practice_type: 'mens_health' | 'med_spa' | 'other';
  modules: Record<string, boolean>;
  address_line1: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  phone_voice: string | null;
  phone_text: string | null;
  timezone: string;
  hours: { day: string; open: string | null; close: string | null }[];
  brand: Record<string, unknown>;
  visit_facts: Record<string, string>;
};

export async function getClinic(): Promise<Clinic | null> {
  const supabase = await serverClient();
  const { data } = await supabase.from('clinic_public').select('*').maybeSingle();
  return (data as Clinic | null) ?? null;
}

/** Is a clinical module on for this practice? Screens must not assume. */
export function hasModule(clinic: Clinic | null, key: string): boolean {
  return !!clinic?.modules?.[key];
}

/* ---------------------------------------------------------------- scoreboard */

export type Scoreboard = {
  mrrCents: number;
  activeMembers: number;
  pausedMembers: number;
  cancelledMembers: number;
  avgMonthsRetained: number;
  todayCount: number;
  todayMissingIntake: number;
  openTasks: number;
  highPriorityTasks: number;
  unreadMessages: number;
  failedPayments: number;
  revenue30Cents: number;
  revenuePrev30Cents: number;
  packageLiabilityCents: number;
  adverseEvents: number;
};

export async function getScoreboard(clinic: Clinic): Promise<Scoreboard> {
  const supabase = await serverClient();
  const today = dayKey(new Date().toISOString(), clinic.timezone);

  const [memberships, appts, tasks, threads, payments, purchases, redemptions, treatments] =
    await Promise.all([
      supabase.from('membership').select('status, mrr_cents, started_at, cancelled_at'),
      supabase.from('appointment').select('id, starts_at, status, intake_complete')
        .gte('starts_at', today + 'T00:00:00')
        .lte('starts_at', today + 'T23:59:59'),
      supabase.from('task').select('id, priority').eq('done', false),
      supabase.from('message_thread').select('unread_staff'),
      supabase.from('payment').select('amount_cents, status, created_at'),
      supabase.from('package_purchase').select('id, sessions_total, price_paid_cents, status'),
      supabase.from('package_redemption').select('purchase_id, sessions'),
      supabase.from('treatment_record').select('id').eq('adverse_event', true)
    ]);

  const m = memberships.data ?? [];
  const active = m.filter(x => x.status === 'active');

  // Months retained, over every membership that has run: the number that
  // actually governs a membership business.
  const spans = m.map(x => {
    const end = x.cancelled_at ? new Date(x.cancelled_at) : new Date();
    const start = new Date(x.started_at);
    return (end.getTime() - start.getTime()) / (30.44 * 864e5);
  });
  const avgMonths = spans.length
    ? Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 10) / 10
    : 0;

  const paid = (payments.data ?? []).filter(p => p.status === 'succeeded');
  const inWindow = (from: number, to: number) =>
    paid.filter(p => {
      const days = (Date.now() - new Date(p.created_at).getTime()) / 864e5;
      return days >= from && days < to;
    }).reduce((s, p) => s + p.amount_cents, 0);

  // Outstanding package liability: money taken for sessions not yet delivered.
  // Not a vanity metric — it is a real obligation on the practice's books and it
  // has to survive a platform migration.
  const usedByPurchase = new Map<string, number>();
  (redemptions.data ?? []).forEach(r => {
    usedByPurchase.set(r.purchase_id, (usedByPurchase.get(r.purchase_id) ?? 0) + r.sessions);
  });
  const liability = (purchases.data ?? [])
    .filter(p => p.status === 'active')
    .reduce((sum, p) => {
      const used = usedByPurchase.get(p.id) ?? 0;
      const remaining = Math.max(0, p.sessions_total - used);
      const perSession = p.price_paid_cents / p.sessions_total;
      return sum + Math.round(perSession * remaining);
    }, 0);

  const todays = appts.data ?? [];

  return {
    mrrCents: active.reduce((s, x) => s + (x.mrr_cents ?? 0), 0),
    activeMembers: active.length,
    pausedMembers: m.filter(x => x.status === 'paused').length,
    cancelledMembers: m.filter(x => x.status === 'cancelled').length,
    avgMonthsRetained: avgMonths,
    todayCount: todays.length,
    todayMissingIntake: todays.filter(a => !a.intake_complete).length,
    openTasks: (tasks.data ?? []).length,
    highPriorityTasks: (tasks.data ?? []).filter(t => t.priority === 'high').length,
    unreadMessages: (threads.data ?? []).reduce((s, t) => s + (t.unread_staff ?? 0), 0),
    failedPayments: (payments.data ?? []).filter(p => p.status === 'failed').length,
    revenue30Cents: inWindow(0, 35),
    revenuePrev30Cents: inWindow(35, 70),
    packageLiabilityCents: liability,
    adverseEvents: (treatments.data ?? []).length
  };
}

/* ------------------------------------------------------------------- today */

export type TodayRow = {
  id: string;
  starts_at: string;
  duration_min: number;
  status: string;
  room: string | null;
  intake_complete: boolean;
  patient: { id: string; first_name: string; last_name: string } | null;
  service: { name: string; category: string } | null;
  provider: { name: string } | null;
};

export async function getToday(clinic: Clinic, offsetDays = 0): Promise<TodayRow[]> {
  const supabase = await serverClient();
  const target = new Date(Date.now() + offsetDays * 864e5);
  const day = dayKey(target.toISOString(), clinic.timezone);

  const { data } = await supabase
    .from('appointment')
    .select(`
      id, starts_at, duration_min, status, room, intake_complete,
      patient:patient_id ( id, first_name, last_name ),
      service:service_id ( name, category ),
      provider:provider_id ( name )
    `)
    .gte('starts_at', day + 'T00:00:00')
    .lte('starts_at', day + 'T23:59:59')
    .order('starts_at');

  return (data ?? []) as unknown as TodayRow[];
}

/* ----------------------------------------------------------------- clients */

export type ClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  phone: string | null;
  email: string | null;
  acquisition_source: string | null;
  therapy_start_date: string | null;
  created_at: string;
  /**
   * Object path in the PRIVATE client-media bucket, never a URL. The roster
   * signs them in one batch — see app/console/clients/page.tsx.
   */
  photo_path: string | null;
};

export async function getClients(): Promise<ClientRow[]> {
  const supabase = await serverClient();
  const { data } = await supabase
    .from('patient')
    .select('id, first_name, last_name, status, phone, email, acquisition_source, therapy_start_date, created_at, photo_path')
    .order('last_name');
  return (data ?? []) as ClientRow[];
}

/** Last visit and next visit per patient, for the roster. One query, not N. */
export async function getVisitBookends(): Promise<Map<string, { last: string | null; next: string | null }>> {
  const supabase = await serverClient();
  const nowIso = new Date().toISOString();
  const map = new Map<string, { last: string | null; next: string | null }>();

  const [past, future] = await Promise.all([
    supabase.from('appointment').select('patient_id, starts_at')
      .lt('starts_at', nowIso).in('status', ['complete', 'arrived']).order('starts_at', { ascending: false }),
    supabase.from('appointment').select('patient_id, starts_at')
      .gte('starts_at', nowIso).in('status', ['booked', 'confirmed']).order('starts_at')
  ]);

  (past.data ?? []).forEach(a => {
    if (!map.has(a.patient_id)) map.set(a.patient_id, { last: null, next: null });
    const entry = map.get(a.patient_id)!;
    if (!entry.last) entry.last = a.starts_at;
  });
  (future.data ?? []).forEach(a => {
    if (!map.has(a.patient_id)) map.set(a.patient_id, { last: null, next: null });
    const entry = map.get(a.patient_id)!;
    if (!entry.next) entry.next = a.starts_at;
  });

  return map;
}

/* -------------------------------------------------------------- one client */

export async function getChart(patientId: string) {
  const supabase = await serverClient();

  const [patient, appts, treatments, details, labs, results, checkins, protocolItems,
    protocolChanges, membership, payments, purchases, redemptions, photos, series, threads] =
    await Promise.all([
      supabase.from('patient').select('*').eq('id', patientId).maybeSingle(),
      supabase.from('appointment')
        .select('id, starts_at, status, duration_min, reason_code, service:service_id (name, category)')
        .eq('patient_id', patientId).order('starts_at', { ascending: false }),
      supabase.from('treatment_record').select('*').eq('patient_id', patientId)
        .order('performed_at', { ascending: false }),
      supabase.from('treatment_detail').select('*').eq('patient_id', patientId).order('sort_order'),
      supabase.from('lab_panel').select('*').eq('patient_id', patientId).order('drawn_at'),
      supabase.from('lab_result').select('*').eq('patient_id', patientId),
      supabase.from('checkin').select('*').eq('patient_id', patientId).order('week_of'),
      supabase.from('protocol_item').select('*').eq('patient_id', patientId).order('sort_order'),
      supabase.from('protocol_change').select('*').eq('patient_id', patientId).order('changed_at'),
      supabase.from('membership').select('*').eq('patient_id', patientId).maybeSingle(),
      supabase.from('payment').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
      supabase.from('package_purchase').select('*').eq('patient_id', patientId).order('purchased_at', { ascending: false }),
      supabase.from('package_redemption').select('*').eq('patient_id', patientId),
      supabase.from('photo').select('*').eq('patient_id', patientId).order('captured_at'),
      supabase.from('photo_series').select('*').eq('patient_id', patientId),
      supabase.from('message_thread').select('*').eq('patient_id', patientId)
    ]);

  const usedByPurchase = new Map<string, number>();
  (redemptions.data ?? []).forEach(r => {
    usedByPurchase.set(r.purchase_id, (usedByPurchase.get(r.purchase_id) ?? 0) + r.sessions);
  });

  return {
    patient: patient.data,
    appointments: appts.data ?? [],
    treatments: treatments.data ?? [],
    treatmentDetails: details.data ?? [],
    labPanels: labs.data ?? [],
    labResults: results.data ?? [],
    checkins: checkins.data ?? [],
    protocolItems: protocolItems.data ?? [],
    protocolChanges: protocolChanges.data ?? [],
    membership: membership.data,
    payments: payments.data ?? [],
    packages: (purchases.data ?? []).map(p => ({
      ...p,
      sessionsUsed: usedByPurchase.get(p.id) ?? 0,
      sessionsRemaining: Math.max(0, p.sessions_total - (usedByPurchase.get(p.id) ?? 0))
    })),
    photos: photos.data ?? [],
    photoSeries: series.data ?? [],
    threads: threads.data ?? []
  };
}

/* --------------------------------------------------------------- work queues */

export type AttentionItem = {
  tone: 'critical' | 'warn';
  text: string;
  who: string;
  href: string;
};

/**
 * What needs a human today, ranked by consequence.
 *
 * Practice-type aware: a men's-health clinic's most consequential queue is
 * hematocrit and PSA; a med spa's is an adverse event and an expiring package
 * somebody has already paid for.
 */
export async function getAttention(clinic: Clinic): Promise<AttentionItem[]> {
  const supabase = await serverClient();
  const items: AttentionItem[] = [];

  if (hasModule(clinic, 'safety_queue')) {
    const { data } = await supabase
      .from('lab_result')
      .select('patient_id, analyte_key, value_numeric, flag, patient:patient_id (first_name, last_name)')
      .in('flag', ['critical', 'above_ref'])
      .in('analyte_key', ['hematocrit', 'psa', 'estradiol_sensitive']);

    (data ?? []).forEach(r => {
      const p = r.patient as unknown as { first_name: string; last_name: string } | null;
      items.push({
        tone: r.flag === 'critical' ? 'critical' : 'warn',
        text: `${r.analyte_key.replace(/_/g, ' ')} ${r.value_numeric} — ${r.flag === 'critical' ? 'at or above the safety ceiling' : 'above reference'}`,
        who: p ? `${p.first_name} ${p.last_name}` : 'Patient',
        href: `/console/clients/${r.patient_id}`
      });
    });
  }

  if (hasModule(clinic, 'treatment_records')) {
    const { data } = await supabase
      .from('treatment_record')
      .select('patient_id, adverse_event_note, follow_up_due, patient:patient_id (first_name, last_name)')
      .eq('adverse_event', true);

    (data ?? []).forEach(t => {
      const p = t.patient as unknown as { first_name: string; last_name: string } | null;
      items.push({
        tone: 'critical',
        text: t.follow_up_due ? 'Adverse event with a follow-up due' : 'Adverse event recorded',
        who: p ? `${p.first_name} ${p.last_name}` : 'Client',
        href: `/console/clients/${t.patient_id}`
      });
    });
  }

  if (hasModule(clinic, 'packages')) {
    const [purchases, redemptions] = await Promise.all([
      supabase.from('package_purchase')
        .select('id, patient_id, package_name, sessions_total, expires_on, status, patient:patient_id (first_name, last_name)')
        .eq('status', 'active'),
      supabase.from('package_redemption').select('purchase_id, sessions')
    ]);
    const used = new Map<string, number>();
    (redemptions.data ?? []).forEach(r => used.set(r.purchase_id, (used.get(r.purchase_id) ?? 0) + r.sessions));

    (purchases.data ?? []).forEach(p => {
      const remaining = p.sessions_total - (used.get(p.id) ?? 0);
      if (remaining <= 0 || !p.expires_on) return;
      const days = Math.round((new Date(p.expires_on).getTime() - Date.now()) / 864e5);
      if (days > 90) return;
      const who = p.patient as unknown as { first_name: string; last_name: string } | null;
      items.push({
        tone: days <= 60 ? 'critical' : 'warn',
        text: `${remaining} prepaid session${remaining === 1 ? '' : 's'} unused, expiring in ${days} days`,
        who: who ? `${who.first_name} ${who.last_name}` : 'Client',
        href: `/console/clients/${p.patient_id}`
      });
    });
  }

  // Unread check-in notes. Patients write clinically significant things in that
  // field and somebody has to read it.
  if (hasModule(clinic, 'checkins')) {
    const { data } = await supabase
      .from('checkin')
      .select('patient_id, notes_free_text, week_of, patient:patient_id (first_name, last_name)')
      .not('notes_free_text', 'is', null)
      .is('reviewed_at', null);

    (data ?? []).forEach(c => {
      const p = c.patient as unknown as { first_name: string; last_name: string } | null;
      items.push({
        tone: 'warn',
        text: 'Check-in note nobody has read yet',
        who: p ? `${p.first_name} ${p.last_name}` : 'Patient',
        href: `/console/clients/${c.patient_id}`
      });
    });
  }

  const { data: failed } = await supabase
    .from('payment')
    .select('patient_id, amount_cents, patient:patient_id (first_name, last_name)')
    .eq('status', 'failed');

  (failed ?? []).forEach(p => {
    const who = p.patient as unknown as { first_name: string; last_name: string } | null;
    items.push({
      tone: 'warn',
      text: 'Payment declined — involuntary churn if nobody calls',
      who: who ? `${who.first_name} ${who.last_name}` : 'Client',
      href: p.patient_id ? `/console/clients/${p.patient_id}` : '/console'
    });
  });

  return items.sort((a, b) => (a.tone === 'critical' ? -1 : 1) - (b.tone === 'critical' ? -1 : 1));
}

/* -------------------------------------------------------------- catalogue */

export type ServiceRow = {
  id: string;
  name: string;
  category: string;
  duration_min: number;
  buffer_after_min: number;
  price_mode: string;
  price_cents: number | null;
  price_from_cents: number | null;
  unit_label: string | null;
  requires_consent: boolean;
  requires_labs: boolean;
  online_bookable: boolean;
  active: boolean;
};

export async function getServices(): Promise<ServiceRow[]> {
  const supabase = await serverClient();
  const { data } = await supabase
    .from('service')
    .select('id, name, category, duration_min, buffer_after_min, price_mode, price_cents, price_from_cents, unit_label, requires_consent, requires_labs, online_bookable, active')
    .order('category')
    .order('sort_order');
  return (data ?? []) as ServiceRow[];
}

export async function getPlans() {
  const supabase = await serverClient();
  const { data } = await supabase.from('plan').select('*').order('sort_order');
  return data ?? [];
}

export async function getPackageCatalogue() {
  const supabase = await serverClient();
  const { data } = await supabase
    .from('service_package')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  return data ?? [];
}

/* ------------------------------------------------------------ treatments */

export async function getTreatments() {
  const supabase = await serverClient();
  const [records, details] = await Promise.all([
    supabase.from('treatment_record')
      .select(`
        id, performed_at, total_units, adverse_event, adverse_event_note, follow_up_due,
        notes_clinical,
        patient:patient_id ( id, first_name, last_name ),
        service:service_id ( name, category ),
        provider:provider_id ( name )
      `)
      .order('performed_at', { ascending: false }),
    supabase.from('treatment_detail').select('*').order('sort_order')
  ]);

  const byRecord = new Map<string, Record<string, unknown>[]>();
  (details.data ?? []).forEach(d => {
    const key = String(d.treatment_record_id);
    if (!byRecord.has(key)) byRecord.set(key, []);
    byRecord.get(key)!.push(d);
  });

  return (records.data ?? []).map(r => ({
    ...r,
    details: byRecord.get(String(r.id)) ?? []
  }));
}

/* --------------------------------------------------------------- packages */

/**
 * Every prepaid package with what is still owed on it.
 *
 * The remaining-sessions figure is the practice's liability, so it is computed
 * from redemptions rather than stored — a stored counter drifts, and a drifted
 * counter here means either giving treatments away or refusing ones somebody
 * paid for.
 */
export async function getPackageLedger() {
  const supabase = await serverClient();
  const [purchases, redemptions] = await Promise.all([
    supabase.from('package_purchase')
      .select('*, patient:patient_id ( id, first_name, last_name )')
      .order('purchased_at', { ascending: false }),
    supabase.from('package_redemption').select('purchase_id, sessions, redeemed_at')
  ]);

  const used = new Map<string, number>();
  (redemptions.data ?? []).forEach(r => {
    used.set(r.purchase_id, (used.get(r.purchase_id) ?? 0) + r.sessions);
  });

  return (purchases.data ?? []).map(p => {
    const sessionsUsed = used.get(p.id) ?? 0;
    const remaining = Math.max(0, p.sessions_total - sessionsUsed);
    const perSession = p.sessions_total ? p.price_paid_cents / p.sessions_total : 0;
    return {
      ...p,
      sessionsUsed,
      sessionsRemaining: remaining,
      liabilityCents: Math.round(perSession * remaining)
    };
  });
}

/* --------------------------------------------------------------- payments */

export async function getPayments(limit = 200) {
  const supabase = await serverClient();
  const { data } = await supabase
    .from('payment')
    .select('*, patient:patient_id ( id, first_name, last_name )')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/* ----------------------------------------------------------- safety queue */

export type SafetyRow = {
  patientId: string;
  patientName: string;
  tone: 'critical' | 'warn';
  what: string;
  detail: string | null;
  when: string | null;
};

/**
 * The clinically important queue. Thresholds are PROVISIONAL placeholders —
 * hematocrit ceiling 52, PSA velocity 0.75 ng/mL/yr — and the screen says so.
 * docs/11-discovery-questions.md §3.
 */
export async function getSafetyQueue(clinic: Clinic): Promise<SafetyRow[]> {
  const supabase = await serverClient();
  const rows: SafetyRow[] = [];

  if (hasModule(clinic, 'labs')) {
    const { data } = await supabase
      .from('lab_result')
      .select(`
        patient_id, analyte_key, value_numeric, unit, flag, target_high, ref_high,
        patient:patient_id ( first_name, last_name ),
        panel:panel_id ( drawn_at )
      `)
      .in('flag', ['critical', 'above_ref', 'below_ref']);

    (data ?? []).forEach(r => {
      const p = r.patient as unknown as { first_name: string; last_name: string } | null;
      const panel = r.panel as unknown as { drawn_at: string } | null;
      rows.push({
        patientId: r.patient_id,
        patientName: p ? `${p.first_name} ${p.last_name}` : 'Patient',
        tone: r.flag === 'critical' ? 'critical' : 'warn',
        what: `${titleWords(r.analyte_key)} ${r.value_numeric}${r.unit ?? ''}`,
        detail: r.flag === 'critical'
          ? 'At or above the safety ceiling. Provider review required.'
          : `Outside the lab reference range (up to ${r.ref_high ?? '—'}${r.unit ?? ''}).`,
        when: panel?.drawn_at ?? null
      });
    });
  }

  if (hasModule(clinic, 'treatment_records')) {
    const { data } = await supabase
      .from('treatment_record')
      .select('patient_id, performed_at, adverse_event_note, follow_up_due, patient:patient_id ( first_name, last_name )')
      .eq('adverse_event', true);

    (data ?? []).forEach(t => {
      const p = t.patient as unknown as { first_name: string; last_name: string } | null;
      rows.push({
        patientId: t.patient_id,
        patientName: p ? `${p.first_name} ${p.last_name}` : 'Client',
        tone: 'critical',
        what: 'Adverse event',
        detail: [t.adverse_event_note, t.follow_up_due ? `Follow-up due ${t.follow_up_due}.` : null]
          .filter(Boolean).join(' '),
        when: t.performed_at
      });
    });
  }

  // Unread free-text notes. Patients write clinically significant things there.
  const { data: notes } = await supabase
    .from('checkin')
    .select('patient_id, week_of, notes_free_text, patient:patient_id ( first_name, last_name )')
    .not('notes_free_text', 'is', null)
    .is('reviewed_at', null);

  (notes ?? []).forEach(c => {
    const p = c.patient as unknown as { first_name: string; last_name: string } | null;
    rows.push({
      patientId: c.patient_id,
      patientName: p ? `${p.first_name} ${p.last_name}` : 'Patient',
      tone: 'warn',
      what: 'Check-in note nobody has read',
      detail: `“${c.notes_free_text}”`,
      when: c.week_of
    });
  });

  return rows.sort((a, b) => {
    if (a.tone !== b.tone) return a.tone === 'critical' ? -1 : 1;
    return (b.when ?? '').localeCompare(a.when ?? '');
  });
}

function titleWords(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* --------------------------------------------------------------- lab entry */

export async function getAnalytes() {
  const supabase = await serverClient();
  const { data } = await supabase
    .from('analyte')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  return data ?? [];
}

export async function getRecentPanels(limit = 25) {
  const supabase = await serverClient();
  const { data } = await supabase
    .from('lab_panel')
    .select('id, drawn_at, note, source, patient:patient_id ( id, first_name, last_name )')
    .order('drawn_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Flag a typed value the same way the seeded data was flagged. One rule. */
export function flagFor(
  analyte: { ref_low: number | null; ref_high: number | null; target_low: number | null; target_high: number | null; ceiling: number | null },
  value: number
): string {
  if (analyte.ceiling !== null && value >= analyte.ceiling) return 'critical';
  if (analyte.ref_low !== null && value < analyte.ref_low) return 'below_ref';
  if (analyte.ref_high !== null && value > analyte.ref_high) return 'above_ref';
  if (analyte.target_low !== null && value < analyte.target_low) return 'below_target';
  if (analyte.target_high !== null && value > analyte.target_high) return 'above_target';
  return 'in_range';
}

/* ----------------------------------------------------------------- team */

export async function getTeam() {
  const supabase = await serverClient();
  const [staff, providers] = await Promise.all([
    supabase.from('staff_user').select('id, name, email, role, mfa_enabled, active').order('name'),
    supabase.from('provider_public').select('*').order('sort_order')
  ]);
  return { staff: staff.data ?? [], providers: providers.data ?? [] };
}

/* ------------------------------------------------------------------- portal */

export async function getPortalHome(patientId: string) {
  const supabase = await serverClient();
  const nowIso = new Date().toISOString();

  const [patient, nextAppt, checkins, labs, results, protocolItems, membership,
    packages, redemptions, treatments, photos, threads] = await Promise.all([
    supabase.from('patient').select('*').eq('id', patientId).maybeSingle(),
    supabase.from('appointment')
      .select('id, starts_at, duration_min, service:service_id (name), provider:provider_id (name, credentials, photo_path)')
      .gte('starts_at', nowIso).in('status', ['booked', 'confirmed'])
      .order('starts_at').limit(1).maybeSingle(),
    supabase.from('checkin').select('*').eq('patient_id', patientId).order('week_of'),
    supabase.from('lab_panel').select('*').eq('patient_id', patientId).order('drawn_at'),
    supabase.from('lab_result').select('*').eq('patient_id', patientId),
    supabase.from('protocol_item').select('*').eq('patient_id', patientId).order('sort_order'),
    supabase.from('membership').select('*').eq('patient_id', patientId).maybeSingle(),
    supabase.from('package_purchase').select('*').eq('patient_id', patientId).eq('status', 'active'),
    supabase.from('package_redemption').select('purchase_id, sessions').eq('patient_id', patientId),
    supabase.from('treatment_record')
      .select('id, performed_at, notes_patient_facing, service:service_id (name)')
      .eq('patient_id', patientId).order('performed_at', { ascending: false }).limit(5),
    supabase.from('photo').select('*').eq('patient_id', patientId).order('captured_at'),
    supabase.from('message_thread').select('*').eq('patient_id', patientId)
  ]);

  const used = new Map<string, number>();
  (redemptions.data ?? []).forEach(r => used.set(r.purchase_id, (used.get(r.purchase_id) ?? 0) + r.sessions));

  return {
    patient: patient.data,
    nextAppointment: nextAppt.data,
    checkins: checkins.data ?? [],
    labPanels: labs.data ?? [],
    labResults: results.data ?? [],
    protocolItems: protocolItems.data ?? [],
    membership: membership.data,
    packages: (packages.data ?? []).map(p => ({
      ...p,
      sessionsRemaining: Math.max(0, p.sessions_total - (used.get(p.id) ?? 0))
    })),
    treatments: treatments.data ?? [],
    photos: photos.data ?? [],
    threads: threads.data ?? []
  };
}

/** Baseline vs now across the six check-in dimensions. The contrast band. */
export const CHECKIN_DIMS = [
  ['energy', 'Energy'],
  ['libido', 'Libido'],
  ['sleep_quality', 'Sleep'],
  ['mood', 'Mood'],
  ['gym_performance', 'Gym'],
  ['mental_clarity', 'Clarity']
] as const;

export function thenVsNow(checkins: Record<string, unknown>[]) {
  if (checkins.length < 2) return null;
  const first = checkins[0]!;
  const last = checkins[checkins.length - 1]!;
  return CHECKIN_DIMS.map(([key, label]) => {
    const then = Number(first[key] ?? 0);
    const now = Number(last[key] ?? 0);
    return { key, label, then, now, delta: now - then };
  });
}

export function checkinAverage(row: Record<string, unknown> | undefined) {
  if (!row) return null;
  const values = CHECKIN_DIMS.map(([k]) => Number(row[k])).filter(v => !Number.isNaN(v));
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
