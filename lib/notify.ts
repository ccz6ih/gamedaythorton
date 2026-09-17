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
import { emailBrand, emailOrigin, renderEmail } from '@/lib/email-theme';

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
        text: body,
        html: renderEmail(await emailBrand(e.clinicId, e.clinicName), {
          preheader: `Somebody enquired through your ${e.clinicName} booking page.`,
          lines: [`${e.name} sent a request through your booking page.`],
          panel: [
            { label: 'Contact', value: e.contact },
            ...(e.interest ? [{ label: 'Interested in', value: e.interest }] : []),
            ...(e.message ? [{ label: 'What they said', value: e.message }] : [])
          ],
          cta: { label: 'Open the console', url: `${emailOrigin()}/console/clients` },
          footerLines: ['The full request is on your clients list in the console.']
        })
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

/**
 * The one place a message actually leaves.
 *
 * BOTH PARTS, ALWAYS. `text` is not a legacy courtesy — it is what a screen
 * reader reads, what a watch shows, what a client with images switched off
 * sees, and what lands if the HTML is mangled in transit. An email with only
 * an HTML part is an email that is invisible to some of the people it is for,
 * and it scores worse with spam filters for the same reason.
 */
async function deliver(to: string, subject: string, text: string, html?: string): Promise<Sent> {
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
        text,
        ...(html ? { html } : {})
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

  const brand = await emailBrand(b.clinicId, b.clinicName);
  const html = renderEmail(brand, {
    // Neutral. The treatment is named in the body, never in the line that shows
    // in an inbox list next to the subject.
    preheader: `Your appointment at ${b.clinicName} is confirmed.`,
    greeting: `Hi ${b.clientName.split(' ')[0]},`,
    lines: [`You're booked in at ${b.clinicName}.`],
    panel: [
      { label: 'Treatment', value: b.serviceName },
      { label: 'When', value: b.whenText }
    ],
    note: b.requiresConsent
      ? 'This treatment needs a short assessment and a consent form before we start, so please allow a few extra minutes.'
      : null,
    footerLines: [
      'Need to change or cancel? Reply to this email'
        + (b.practicePhone ? ` or call ${b.practicePhone}.` : '.')
    ]
  });

  const sent = await deliver(b.clientEmail, `Your appointment at ${b.clinicName}`, body, html);

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

  const brand = await emailBrand(b.clinicId, b.clinicName);
  const html = renderEmail(brand, {
    preheader: `A new booking came in for ${b.clinicName}.`,
    lines: [`${b.clientName} booked online.`],
    panel: [
      { label: 'Treatment', value: b.serviceName },
      { label: 'When', value: b.whenText },
      { label: 'Contact', value: `${b.clientEmail}${b.clientPhone ? `\n${b.clientPhone}` : ''}` },
      ...(b.note ? [{ label: 'They said', value: b.note }] : [])
    ],
    cta: { label: 'Open the calendar', url: `${brand.origin}/console/calendar` },
    footerLines: ['It is already on your calendar in the console.']
  });

  const sent = await deliver(b.practiceInbox, `New booking for ${b.clinicName}`, body, html);

  await logRun({
    clinicId: b.clinicId,
    ruleKey: 'booking_notice',
    clinicName: b.clinicName,
    synthetic: b.synthetic,
    sent
  });

  return { logged: true, delivered: sent.ok, reason: sent.reason };
}

/* ----------------------------------------------------------- reminders -- */

export type ReminderEmail = {
  appointmentId: string;
  clinicId: string;
  clinicName: string;
  practicePhone: string | null;
  clientName: string;
  clientEmail: string;
  serviceName: string;
  whenText: string;
  /**
   * WHERE, when it is not the usual room.
   *
   * The practitioner splits her week between her own studio and a partner
   * clinic, and which one is decided appointment by appointment. A reminder
   * that always names the main address sends somebody to the wrong town.
   *
   * Null means the usual place, and the reminder stays quiet about it — a
   * client who has been six times does not need the address they already know
   * repeated at them.
   */
  locationName?: string | null;
  locationAddress?: string | null;
  /** Absolute URL that marks this appointment confirmed in one tap. */
  confirmUrl?: string | null;
};

/**
 * The day-before reminder.
 *
 * THE LOG ROW IS WRITTEN FIRST, and that ordering is the whole anti-duplicate
 * mechanism. app/api/cron/reminders skips any appointment that already has a
 * row for this rule, so if the send crashes half way the appointment is marked
 * as attempted and is not retried.
 *
 * That trade is deliberate: a missed reminder costs one person a nudge they
 * would probably have survived without, and their confirmation email still
 * exists. Four reminders at three in the morning costs the practice a client.
 */
export async function sendAppointmentReminder(r: ReminderEmail): Promise<NotifyResult> {
  const supabase = await serverClient();

  // Claim it before attempting anything.
  const { error: claimError } = await supabase.from('automation_run').insert({
    clinic_id: r.clinicId,
    rule_key: 'appointment_reminder',
    channel: 'email',
    payload_preview: notificationPreview(r.clinicName, 'appointment_reminder'),
    payload_ref: r.appointmentId,
    consent_verified: false,
    synthetic: false,
    status: 'logged_not_sent'
  });

  if (claimError) {
    // Most likely somebody else claimed it a moment ago. Not an error worth
    // shouting about, and definitely not a reason to send anyway.
    return { logged: false, delivered: false, reason: 'already claimed' };
  }

  /**
   * WHERE, and the one-tap confirm.
   *
   * Both of these were on ReminderEmail and passed by the cron, and neither was
   * ever read here — so the confirm link the /confirm route exists to serve has
   * never reached a client, and a reminder for an appointment at the partner
   * clinic has been sending people to the usual address. Optional fields do not
   * fail a typecheck when nothing reads them, which is exactly how this
   * survived: every layer was correct except the last one.
   */
  const elsewhere = r.locationName
    ? `${r.locationName}${r.locationAddress ? `\n${r.locationAddress}` : ''}`
    : null;

  const body = [
    `Hi ${r.clientName.split(' ')[0]},`,
    '',
    `A reminder about your appointment at ${r.clinicName}:`,
    '',
    `  ${r.serviceName}`,
    `  ${r.whenText}`,
    // Only when it is NOT the usual room. Repeating the address somebody has
    // driven to six times is noise; omitting it the one time it changed sends
    // them to the wrong town.
    ...(elsewhere ? ['', '  Where:', ...elsewhere.split('\n').map(l => `  ${l}`)] : []),
    ...(r.confirmUrl ? ['', 'Please confirm you are coming:', r.confirmUrl] : []),
    '',
    'If anything has changed, reply to this email'
      + (r.practicePhone ? ` or call ${r.practicePhone}.` : '.'),
    '',
    `— ${r.clinicName}`
  ].join('\n');

  const brand = await emailBrand(r.clinicId, r.clinicName);
  const html = renderEmail(brand, {
    preheader: `A reminder about your appointment at ${r.clinicName}.`,
    greeting: `Hi ${r.clientName.split(' ')[0]},`,
    lines: [`A reminder about your appointment at ${r.clinicName}.`],
    panel: [
      { label: 'Treatment', value: r.serviceName },
      { label: 'When', value: r.whenText },
      ...(elsewhere ? [{ label: 'Where', value: elsewhere }] : [])
    ],
    cta: r.confirmUrl ? { label: "Yes, I'll be there", url: r.confirmUrl } : null,
    note: r.confirmUrl ? 'One tap confirms — there is nothing to fill in.' : null,
    footerLines: [
      'If anything has changed, reply to this email'
        + (r.practicePhone ? ` or call ${r.practicePhone}.` : '.')
    ]
  });

  const sent = await deliver(r.clientEmail, `Tomorrow at ${r.clinicName}`, body, html);

  // Update the claim with what actually happened.
  await supabase
    .from('automation_run')
    .update({
      status: sent.ok ? 'sent' : 'failed',
      ...(sent.ok ? { sent_at: new Date().toISOString() } : { error: sent.reason })
    })
    .eq('rule_key', 'appointment_reminder')
    .eq('payload_ref', r.appointmentId);

  return { logged: true, delivered: sent.ok, reason: sent.reason };
}
