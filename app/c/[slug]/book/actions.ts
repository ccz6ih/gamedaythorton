'use server';

/**
 * The two things the booking page asks the server for.
 *
 * Both go through security-definer functions rather than table reads, because
 * the page must not be able to see the diary. `slotsFor` returns free times and
 * nothing else; an unavailable slot is simply absent, indistinguishable from
 * the practice being closed or fully booked. See migration 0026.
 */

import { createServerClient } from '@supabase/ssr';
import { sendBookingConfirmation, sendBookingNotice } from '@/lib/notify';

function anonClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function slotsFor(
  slug: string, serviceId: string, date: string
): Promise<string[]> {
  const supabase = anonClient();
  const { data, error } = await supabase.rpc('public_slots', {
    p_clinic_slug: slug,
    p_service_id: serviceId,
    p_date: date
  });
  if (error) return [];
  return (data as string[]) ?? [];
}

export type BookingResult =
  | {
      ok: true;
      when: string;
      serviceName: string;
      requiresConsent: boolean;
      /**
       * Whether a confirmation actually went. The page used to promise one
       * unconditionally, which was untrue whenever sending was switched off —
       * and somebody waiting for an email that is never coming will assume the
       * booking failed and book again.
       */
      emailed: boolean;
      practicePhone: string | null;
    }
  | { ok: false; error: string };

/** Messages we raised on purpose, and are safe to show a stranger. */
const OURS = [
  'not taking online bookings', 'not available to book online',
  'first and last name', 'email address does not look right', 'Pick a time',
  'just been taken', 'several bookings for this email',
  'already on file for someone else'
];

export async function book(input: {
  slug: string;
  serviceId: string;
  date: string;
  time: string;
  first: string;
  last: string;
  email: string;
  phone?: string;
  note?: string;
  smsConsent: boolean;
}): Promise<BookingResult> {
  const supabase = anonClient();

  const { data, error } = await supabase.rpc('book_appointment', {
    p_clinic_slug: input.slug,
    p_service_id: input.serviceId,
    p_date: input.date,
    p_time: input.time,
    p_first: input.first,
    p_last: input.last,
    p_email: input.email,
    p_phone: input.phone ?? null,
    p_note: input.note ?? null,
    p_sms_consent: input.smsConsent
  });

  if (error || !data) {
    const message = error?.message ?? '';
    return {
      ok: false,
      error: OURS.some(f => message.includes(f))
        ? message
        : 'Something went wrong taking that booking. Please try again, or call us.'
    };
  }

  const result = data as {
    clinic_id: string; service_name: string; practice_name: string;
    practice_phone: string | null; notify_email: string | null;
    starts_at: string; requires_consent: boolean; synthetic: boolean;
  };

  const whenText = new Date(result.starts_at).toLocaleString('en-US', {
    timeZone: 'America/Denver', dateStyle: 'full', timeStyle: 'short'
  });

  /**
   * Both emails, after the booking is already committed.
   *
   * The practice's inbox comes back from the RPC rather than being read here.
   * Reading it here was the bug: `lead_email` is not granted to anon, a
   * column-level denial takes out the whole select, `clinic` came back null,
   * and the notification block was skipped in silence. The booking worked; the
   * email never even logged.
   *
   * Neither send can affect the appointment. It exists either way.
   */
  const common = {
    clinicId: result.clinic_id,
    clinicName: result.practice_name,
    practicePhone: result.practice_phone,
    practiceInbox: result.notify_email,
    clientName: `${input.first} ${input.last}`,
    clientEmail: input.email,
    clientPhone: input.phone ?? null,
    serviceName: result.service_name,
    whenText,
    note: input.note ?? null,
    requiresConsent: result.requires_consent === true,
    synthetic: result.synthetic === true
  };

  let emailed = false;
  try {
    const [confirmation] = await Promise.all([
      sendBookingConfirmation(common),
      sendBookingNotice(common)
    ]);
    emailed = confirmation.delivered;
  } catch {
    // Both log their own failures. The booking stands.
  }

  return {
    ok: true,
    when: result.starts_at,
    serviceName: result.service_name,
    requiresConsent: result.requires_consent === true,
    emailed,
    practicePhone: result.practice_phone
  };
}
