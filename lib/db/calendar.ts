/**
 * lib/db/calendar.ts
 * The week, and what has just landed in it.
 *
 * Separate from queries.ts because both of these are shaped for one screen and
 * neither is a metric. Everything here runs as the signed-in staff member, so
 * RLS scopes it to their own practice.
 */

import { serverClient } from '@/lib/supabase/server';
import type { Clinic } from '@/lib/db/queries';

export type CalendarEvent = {
  id: string;
  kind: 'appointment' | 'blocked';
  startsAt: string;
  endsAt: string;
  durationMin: number;
  status: string;
  title: string;
  subtitle: string | null;
  patientId: string | null;
  intakeComplete: boolean;
  bookedOnline: boolean;
  /** The location's name, ONLY when it is not the practice's usual one. */
  elsewhere?: string | null;
  /**
   * The location's id, or null for the usual room.
   *
   * Separate from `elsewhere` because that one is deliberately blank for the
   * default location — it exists to be DISPLAYED, and labelling every row with
   * the usual address buries the ones that differ. Filtering needs to know the
   * answer even when there is nothing to show, so it gets its own field.
   */
  locationId?: string | null;
};

export type CalendarWeek = {
  /** Midnight Monday, in the practice's timezone, as YYYY-MM-DD. */
  startDate: string;
  days: { date: string; label: string; dow: string; isToday: boolean; open: boolean }[];
  events: CalendarEvent[];
  /** The hours actually worth drawing, from the practice's own opening times. */
  firstHour: number;
  lastHour: number;
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** YYYY-MM-DD for a Date, read in the practice's timezone. */
function dayKeyIn(d: Date, timeZone: string): string {
  return d.toLocaleDateString('en-CA', { timeZone });
}

/**
 * The Monday of the week containing `anchor`.
 *
 * Monday rather than Sunday because a practice reads its week as working days,
 * and a Sunday-first grid puts the quietest day in the most prominent column.
 */
export function weekStart(anchor: Date, timeZone: string): string {
  const key = dayKeyIn(anchor, timeZone);
  const local = new Date(key + 'T12:00:00');
  const shift = (local.getDay() + 6) % 7;   // Mon=0 … Sun=6
  local.setDate(local.getDate() - shift);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
}

export async function getCalendarWeek(clinic: Clinic, startDate: string): Promise<CalendarWeek> {
  const supabase = await serverClient();
  const tz = clinic.timezone || 'America/Denver';

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const fromIso = `${startDate}T00:00:00`;
  const toIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}T00:00:00`;

  const [{ data: appts }, { data: blocks }] = await Promise.all([
    supabase.from('appointment')
      .select(`
        id, starts_at, duration_min, buffer_min, status, intake_complete, booking_channel,
        patient:patient_id ( id, first_name, last_name ),
        service:service_id ( name ),
        location_id,
        location:location_id ( name, is_default )
      `)
      .gte('starts_at', fromIso)
      .lt('starts_at', toIso)
      .order('starts_at'),
    supabase.from('blocked_time')
      .select('id, starts_at, ends_at, reason')
      .gte('starts_at', fromIso)
      .lt('starts_at', toIso)
      .order('starts_at')
  ]);

  const events: CalendarEvent[] = [];

  for (const a of (appts ?? []) as unknown as {
    id: string; starts_at: string; duration_min: number; status: string;
    location_id: string | null;
    location: { name: string; is_default: boolean } | null;
    intake_complete: boolean; booking_channel: string | null;
    patient: { id: string; first_name: string; last_name: string } | null;
    service: { name: string } | null;
  }[]) {
    const ends = new Date(new Date(a.starts_at).getTime() + a.duration_min * 60000);
    events.push({
      id: a.id,
      kind: 'appointment',
      startsAt: a.starts_at,
      endsAt: ends.toISOString(),
      durationMin: a.duration_min,
      status: a.status,
      title: a.patient ? `${a.patient.first_name} ${a.patient.last_name}` : 'Appointment',
      subtitle: a.service?.name ?? null,
      patientId: a.patient?.id ?? null,
      intakeComplete: a.intake_complete === true,
      bookedOnline: a.booking_channel === 'online',
      /**
       * Only when it is NOT the usual room.
       *
       * The client's confirmation already carries the address; this is the
       * other half, and the half that was missing — Jamie looking at her own
       * week needs to know which afternoon she is somewhere else. Labelling
       * every row "The Med Bar" would bury the two that matter under
       * thirty that do not.
       */
      elsewhere: a.location && !a.location.is_default ? a.location.name : null,
      locationId: a.location_id ?? null
    });
  }

  for (const b of (blocks ?? []) as unknown as {
    id: string; starts_at: string; ends_at: string; reason: string | null;
  }[]) {
    events.push({
      id: b.id,
      kind: 'blocked',
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      durationMin: Math.round(
        (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000),
      status: 'blocked',
      title: b.reason ?? 'Blocked',
      subtitle: null,
      patientId: null,
      intakeComplete: true,
      bookedOnline: false
    });
  }

  /* ------------------------------------------------------------- days -- */
  const todayKey = dayKeyIn(new Date(), tz);
  const openDays = new Set(
    (clinic.hours ?? []).filter(h => h.open && h.close).map(h => h.day));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      date: key,
      label: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      dow: DOW[d.getDay()]!,
      isToday: key === todayKey,
      open: openDays.has(DOW[d.getDay()]!)
    };
  });

  /* ------------------------------------------------------------ hours -- */
  /**
   * Draw only the hours the practice uses, WIDENED to cover anything already on
   * the calendar. A grid that runs midnight to midnight is mostly empty space,
   * and one that stops at closing time hides the appointment that overran.
   */
  let firstHour = 24, lastHour = 0;
  for (const h of clinic.hours ?? []) {
    if (!h.open || !h.close) continue;
    firstHour = Math.min(firstHour, Number(h.open.slice(0, 2)));
    lastHour = Math.max(lastHour, Number(h.close.slice(0, 2)));
  }
  for (const e of events) {
    const s = Number(new Date(e.startsAt).toLocaleString('en-US', { timeZone: tz, hour: '2-digit', hour12: false }));
    const en = Number(new Date(e.endsAt).toLocaleString('en-US', { timeZone: tz, hour: '2-digit', hour12: false }));
    firstHour = Math.min(firstHour, s);
    lastHour = Math.max(lastHour, Math.min(23, en + 1));
  }
  if (firstHour > lastHour) { firstHour = 8; lastHour = 18; }

  return { startDate, days, events, firstHour, lastHour };
}

/* ============================================================================
   WHAT HAS JUST LANDED
   ============================================================================
   The practice's answer to "has anything happened?" — bookings taken while
   nobody was looking, orders paid for, enquiries waiting.

   Deliberately NOT a notification table with a read flag. That would need
   writing on every page view and would drift from the things it describes. It
   is a query over what actually exists, ordered by when it arrived, which
   cannot be wrong.
   ========================================================================== */

export type ActivityItem = {
  id: string;
  at: string;
  kind: 'booking' | 'order' | 'enquiry' | 'cancellation';
  what: string;
  detail: string | null;
  href: string;
  /** Wants doing something about, as opposed to just worth knowing. */
  actionable: boolean;
  /**
   * The item carries something to READ rather than somewhere to go.
   *
   * An enquiry is the only kind where the interesting content is the item
   * itself; a booking or a cancellation is a pointer to a chart. Expandable
   * ones open in place instead of navigating away from the feed.
   */
  expandable?: boolean;
};

export async function getActivity(sinceHours = 72): Promise<ActivityItem[]> {
  const supabase = await serverClient();
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();

  const [{ data: bookings }, { data: orders }, { data: leads }] = await Promise.all([
    supabase.from('appointment')
      .select(`
        id, created_at, starts_at, status, booking_channel,
        patient:patient_id ( id, first_name, last_name ),
        service:service_id ( name )
      `)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase.from('shop_order')
      .select('id, created_at, order_no, contact_name, total_cents, status, kind')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('lead')
      .select('id, created_at, name, message, source')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20)
  ]);

  const items: ActivityItem[] = [];

  for (const b of (bookings ?? []) as unknown as {
    id: string; created_at: string; starts_at: string; status: string;
    booking_channel: string | null;
    patient: { id: string; first_name: string; last_name: string } | null;
    service: { name: string } | null;
  }[]) {
    const who = b.patient ? `${b.patient.first_name} ${b.patient.last_name}` : 'Someone';
    const when = new Date(b.starts_at).toLocaleString('en-US', {
      timeZone: 'America/Denver', weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });

    items.push({
      id: `appt-${b.id}`,
      at: b.created_at,
      kind: b.status === 'cancelled' ? 'cancellation' : 'booking',
      what: b.status === 'cancelled'
        ? `${who} cancelled`
        : `${who} booked${b.booking_channel === 'online' ? ' online' : ''}`,
      detail: `${b.service?.name ?? 'Appointment'} · ${when}`,
      href: b.patient ? `/console/clients/${b.patient.id}` : '/console/calendar',
      actionable: false
    });
  }

  for (const o of (orders ?? []) as unknown as {
    id: string; created_at: string; order_no: string; contact_name: string;
    total_cents: number; status: string; kind: string;
  }[]) {
    // A pending order is a basket somebody abandoned at the payment page, not
    // news. Only money that actually arrived is worth surfacing.
    if (o.status !== 'paid') continue;
    items.push({
      id: `order-${o.id}`,
      at: o.created_at,
      kind: 'order',
      what: `${o.contact_name} paid ${(o.total_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      detail: `Order ${o.order_no}${o.kind === 'custom' ? '' : ' · shop'}`,
      href: '/console/orders',
      // Paid and not yet sent is the one thing here somebody must act on.
      actionable: true
    });
  }

  for (const l of (leads ?? []) as unknown as {
    id: string; created_at: string; name: string; message: string | null; source: string | null;
  }[]) {
    // Notes attached to a booking already appear as the booking itself.
    if (l.source === 'booking') continue;
    items.push({
      id: `lead-${l.id}`,
      at: l.created_at,
      kind: 'enquiry',
      what: `${l.name} got in touch`,
      /**
       * The WHOLE message.
       *
       * It was cut at 90 characters, and the link went to the clients LIST —
       * so the one item in this feed that carries something to read was the
       * one item you could not read, and clicking it took you somewhere that
       * did not contain it either. An enquiry is a few sentences from somebody
       * asking to spend money; there is no version of that worth truncating.
       */
      detail: l.message?.trim() || 'No message',
      href: '/console/clients',
      actionable: true,
      // Marks it as something to READ rather than somewhere to go. The feed
      // renders these expandable in place instead of as a link.
      expandable: true
    });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
}
