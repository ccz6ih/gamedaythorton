/**
 * lib/notify.ts
 * The one place a message leaves this system — or, right now, doesn't.
 *
 * HOW THIS BEHAVES
 * Every send is recorded in `automation_run` first, then delivered only if
 * delivery is switched on. So the record of what the system tried to do exists
 * whether or not anything went out, and turning sending on later does not
 * change what is logged — only what happens after.
 *
 * Delivery needs BOTH:
 *   NOTIFY_EMAIL_ENABLED=true   a deliberate switch, default off
 *   RESEND_API_KEY              the credential
 *
 * Either one missing means log-only. Two conditions rather than one because a
 * key finding its way into an environment should not by itself start sending
 * mail about named people to third parties.
 *
 * WHAT MAY GO IN A NOTIFICATION
 * The preview text is passed through notificationPreview() from lib/phi, which
 * is trigger-checked in the database as well. A lock-screen or an inbox subject
 * line says that something needs attention, never what. That rule does not
 * relax when sending is turned on — it gets more important, because the message
 * then actually travels.
 */

import { notificationPreview } from '@/lib/phi';
import { serverClient } from '@/lib/supabase/server';

export type NotifyResult = {
  logged: boolean;
  delivered: boolean;
  reason: string;
};

export function emailEnabled() {
  return process.env.NOTIFY_EMAIL_ENABLED === 'true' && !!process.env.RESEND_API_KEY;
}

/** Why sending is off, in words a person can act on. */
export function emailStatus(): string {
  if (process.env.NOTIFY_EMAIL_ENABLED !== 'true') {
    return 'Sending is switched off. Messages are recorded and not delivered.';
  }
  if (!process.env.RESEND_API_KEY) {
    return 'Sending is switched on but no email credential is set, so nothing can be delivered.';
  }
  return 'Sending is on. Messages are delivered and recorded.';
}

type EnquiryEmail = {
  clinicId: string;
  to: string | null;
  clinicName: string;
  /** Who enquired. Goes in the body, never the subject. */
  name: string;
  contact: string;
  interest: string | null;
  message: string | null;
  synthetic: boolean;
};

/**
 * Tells a practice that somebody enquired.
 *
 * The subject line names the practice and nothing else. "New enquiry for The
 * Med Bar" is all anyone glancing at a phone needs, and it is all they get:
 * who enquired and what they asked about stay inside the message.
 */
export async function sendEnquiryEmail(e: EnquiryEmail): Promise<NotifyResult> {
  const subject = `New enquiry for ${e.clinicName}`;
  // The stored preview goes through the allowlist, which is trigger-checked in
  // the database too. 'action_needed' rather than anything descriptive: the
  // log line says something needs attention, never what or for whom.
  const preview = notificationPreview(e.clinicName, 'action_needed');

  const body = [
    `${e.name} sent a request through your booking page.`,
    '',
    `Contact: ${e.contact}`,
    e.interest ? `Interested in: ${e.interest}` : null,
    e.message ? `\nWhat they said:\n${e.message}` : null,
    '',
    'The full request is on your clients list in the console.'
  ].filter(v => v !== null).join('\n');

  const supabase = await serverClient();

  // Logged before any attempt to deliver, so a send that fails still leaves a
  // record that it was tried.
  type Row = {
    status: 'logged_not_sent' | 'sent' | 'failed' | 'suppressed';
    suppressed_reason?: string;
    error?: string;
    sent_at?: string;
  };

  const log = async (row: Row) => {
    await supabase.from('automation_run').insert({
      clinic_id: e.clinicId,
      rule_key: 'storefront_enquiry_email',
      channel: 'email',
      payload_preview: preview,
      // consent is not claimed for an operational notice to the practice about
      // its own enquiry; this flag is for messages to a patient.
      consent_verified: false,
      synthetic: e.synthetic,
      ...row
    });
  };

  if (!e.to) {
    await log({ status: 'suppressed', suppressed_reason: 'No destination address set for this practice.' });
    return { logged: true, delivered: false, reason: 'no address configured' };
  }

  if (!emailEnabled()) {
    await log({ status: 'logged_not_sent', suppressed_reason: `Would have emailed ${e.to}. ${emailStatus()}` });
    return { logged: true, delivered: false, reason: emailStatus() };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_EMAIL_FROM ?? 'notifications@example.invalid',
        to: [e.to],
        subject,
        text: body
      })
    });

    if (!res.ok) {
      // The provider's error may quote the address, which is fine, but never
      // the body — so only the status code is recorded.
      await log({ status: 'failed', error: `Provider returned ${res.status}.` });
      return { logged: true, delivered: false, reason: `delivery failed (${res.status})` };
    }

    await log({ status: 'sent', sent_at: new Date().toISOString() });
    return { logged: true, delivered: true, reason: 'delivered' };
  } catch (err) {
    await log({ status: 'failed', error: 'Could not reach the email provider.' });
    return { logged: true, delivered: false, reason: 'provider unreachable' };
  }
}

/* ============================================================================
   BOOKINGS
   ============================================================================
   Two messages come out of one booking, and they are not the same message.

   The CLIENT gets the treatment, the date and the time, because it is their own
   appointment, they just chose it, and a confirmation that withholds what was
   booked is useless. This is not a lock-screen preview — it is the body of an
   email to the person concerned.

   The PRACTICE gets a nudge that something was booked. The subject names the
   practice and nothing else, same as an enquiry.

   Either can fail without the other, and NEITHER can affect the booking. It is
   already in the database by the time any of this runs.
   ========================================================================== */

type Sent = { ok: boolean; reason: string };

/** The one place a message actually leaves. */
async function deliver(to: string, subject: string, text: string): Promise<Sent> {
  if (!emailEnabled()) return { ok: false, reason: emailStatus() };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_EMAIL_FROM ?? 'notifications@example.invalid',
        to: [to],
        subject,
        text
      })
    });

    if (!res.ok) {
      // The provider's message can quote the address, which is fine, but never
      // the body — so only the status travels into a log.
      return { ok: false, reason: `delivery failed (${res.status})` };
    }
    return { ok: true, reason: 'delivered' };
  } catch {
    return { ok: false, reason: 'provider unreachable' };
  }
}

/** Records the attempt, whatever came of it. Never throws. */
async function logRun(row: {
  clinicId: string;
  ruleKey: string;
  clinicName: string;
  synthetic: boolean;
  sent: Sent;
  suppressed?: string;
}) {
  try {
    const supabase = await serverClient();
    await supabase.from('automation_run').insert({
      clinic_id: row.clinicId,
      rule_key: row.ruleKey,
      channel: 'email',
      // Trigger-checked in the database. A log line says something happened,
      // never what or for whom — that rule does not relax for a booking.
      payload_preview: notificationPreview(row.clinicName, 'action_needed'),
      consent_verified: false,
      synthetic: row.synthetic,
      status: row.sent.ok ? 'sent' : (row.suppressed ? 'suppressed' : 'logged_not_sent'),
      ...(row.sent.ok ? { sent_at: new Date().toISOString() } : {}),
      ...(row.sent.ok ? {} : { suppressed_reason: row.suppressed ?? row.sent.reason })
    });
  } catch {
    // A booking must not fail because its audit line did not write.
  }
}

export type BookingEmail = {
  clinicId: string;
  clinicName: string;
  practicePhone: string | null;
  /** Where the practice wants to hear about bookings. */
  practiceInbox: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  serviceName: string;
  /** Already formatted in the practice's timezone. */
  whenText: string;
  note: string | null;
  requiresConsent: boolean;
  synthetic: boolean;
};

/**
 * Confirms the appointment to the person who booked it.
 *
 * Returns whether it actually went, so the page can say something true. The
 * booking succeeded either way, and the page should not claim an email is on
 * its way when sending is switched off.
 */
export async function sendBookingConfirmation(b: BookingEmail): Promise<NotifyResult> {
  const body = [
    `Hi ${b.clientName.split(' ')[0]},`,
    '',
    `You're booked in at ${b.clinicName}.`,
    '',
    `  ${b.serviceName}`,
    `  ${b.whenText}`,
    '',
    b.requiresConsent
      ? 'This treatment needs a short assessment and a consent form before we start, so please allow a few extra minutes.'
      : null,
    b.requiresConsent ? '' : null,
    'If you need to change or cancel, reply to this email'
      + (b.practicePhone ? ` or call ${b.practicePhone}.` : '.'),
    '',
    `— ${b.clinicName}`
  ].filter(v => v !== null).join('\n');

  const sent = await deliver(b.clientEmail, `Your appointment at ${b.clinicName}`, body);

  await logRun({
    clinicId: b.clinicId,
    ruleKey: 'booking_confirmation',
    clinicName: b.clinicName,
    synthetic: b.synthetic,
    sent
  });

  return { logged: true, delivered: sent.ok, reason: sent.reason };
}

/** Tells the practice somebody booked. */
export async function sendBookingNotice(b: BookingEmail): Promise<NotifyResult> {
  if (!b.practiceInbox) {
    await logRun({
      clinicId: b.clinicId,
      ruleKey: 'booking_notice',
      clinicName: b.clinicName,
      synthetic: b.synthetic,
      sent: { ok: false, reason: 'no address' },
      suppressed: 'No destination address set for this practice.'
    });
    return { logged: true, delivered: false, reason: 'no address configured' };
  }

  const body = [
    `${b.clientName} booked online.`,
    '',
    `  ${b.serviceName}`,
    `  ${b.whenText}`,
    '',
    `Contact: ${b.clientEmail}${b.clientPhone ? ` · ${b.clientPhone}` : ''}`,
    b.note ? `\nThey said:\n${b.note}` : null,
    '',
    'It is on your calendar in the console.'
  ].filter(v => v !== null).join('\n');

  const sent = await deliver(b.practiceInbox, `New booking for ${b.clinicName}`, body);

  await logRun({
    clinicId: b.clinicId,
    ruleKey: 'booking_notice',
    clinicName: b.clinicName,
    synthetic: b.synthetic,
    sent
  });

  return { logged: true, delivered: sent.ok, reason: sent.reason };
}
