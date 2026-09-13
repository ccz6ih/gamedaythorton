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
import { sendEnquiryEmail } from '@/lib/notify';

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
  | { ok: true; when: string; serviceName: string; requiresConsent: boolean }
  | { ok: false; error: string };

/** Messages we raised on purpose, and are safe to show a stranger. */
const OURS = [
  'not taking online bookings', 'not available to book online',
  'first and last name', 'email address does not look right', 'Pick a time',
  'just been taken', 'several bookings for this email'
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
    service_name: string; practice_name: string;
    starts_at: string; requires_consent: boolean;
  };

  /**
   * Tell the practice. Best-effort and deliberately after the booking is
   * already committed — a notification that fails must never cost somebody
   * their appointment. The subject line names the practice and nothing else;
   * who booked and for what stay inside the message. lib/notify enforces that.
   */
  try {
    const { data: clinic } = await supabase
      .from('clinic').select('id, name, lead_email').eq('slug', input.slug).maybeSingle();

    if (clinic) {
      await sendEnquiryEmail({
        clinicId: String(clinic.id),
        to: (clinic as { lead_email?: string | null }).lead_email ?? null,
        clinicName: String(clinic.name),
        name: `${input.first} ${input.last}`,
        contact: input.phone ? `${input.email} · ${input.phone}` : input.email,
        interest: `${result.service_name} — ${new Date(result.starts_at).toLocaleString('en-US', {
          timeZone: 'America/Denver', dateStyle: 'full', timeStyle: 'short'
        })}`,
        message: input.note ?? null,
        synthetic: false
      });
    }
  } catch {
    // Logged inside sendEnquiryEmail. The booking stands either way.
  }

  return {
    ok: true,
    when: result.starts_at,
    serviceName: result.service_name,
    requiresConsent: result.requires_consent === true
  };
}
