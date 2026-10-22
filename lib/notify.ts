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

import { notificationPreview, checkoutLineLabel } from '@/lib/phi';
import { serverClient } from '@/lib/supabase/server';
import { emailBrand, emailOrigin, renderEmail } from '@/lib/email-theme';
import { whereLine, type Modality } from '@/lib/appointment-where';

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
    // Captured, not discarded: Supabase returns a refused insert as an error
    // VALUE rather than throwing, so ignoring the result is how this failed
    // silently for every webhook-sent email.
    const { error } = await supabase.from('automation_run').insert({
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
    if (error) throw new Error(error.message);
  } catch (err) {
    /**
     * A booking must not fail because its audit line did not write — but it
     * must not write NOTHING either, which is what used to happen.
     *
     * logRun goes through serverClient(), a session-scoped client. The Stripe
     * webhook has no session, so RLS refuses the insert, and the silent catch
     * meant two order emails were genuinely sent and left no trace at all.
     * Looking at automation_run afterwards, I concluded the emails had not
     * fired and said so — the log being empty looked exactly like the work
     * not happening.
     *
     * Still swallowed, because an audit line is not worth a payment. Now
     * loud, so the next person reading the logs can tell "did not send" from
     * "sent, could not record".
     */
    console.error('[notify] could not record the run', {
      rule: row.ruleKey,
      delivered: row.sent.ok,
      reason: err instanceof Error ? err.message : String(err)
    });
  }
}

/**
 * The client's intake link, but only if there is a form to open.
 *
 * ASKS THE SAME FUNCTION THE CLIENT'S BROWSER WILL ASK. The template is seeded
 * inactive pending sign-off, so intake_for_token answers "no_form" until the
 * practice approves it — and a confirmation email carrying a link to a page
 * that says "this form is not available" is worse than one carrying no link.
 *
 * Never throws. A confirmation email must go out whether or not this resolves.
 */
export async function intakeLinkFor(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const supabase = await serverClient();
    const { data } = await supabase.rpc('intake_for_token', { p_token: token });
    const status = (data as { status?: string } | null)?.status;
    if (status !== 'open') return null;
    return `${emailOrigin()}/intake/${token}`;
  } catch {
    return null;
  }
}

export type BookingEmail = {
  /** How this appointment happens. Absent means in person, which is what
   *  every appointment made before 0044 actually was. */
  modality?: Modality | null;
  /** Set ONLY when it is not the usual room. */
  locationName?: string | null;
  locationAddress?: string | null;
  meetingUrl?: string | null;
  /** The practice's own address, for the usual room. */
  clinicAddress?: string | null;
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
  /**
   * The client's own intake form, when the practice has one switched on.
   *
   * Sent with the confirmation rather than the reminder because the day before
   * is too late to be useful: a form filled the night before still means the
   * practitioner reads it for the first time with the client in the chair.
   */
  intakeUrl?: string | null;
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
  const brand = await emailBrand(b.clinicId, b.clinicName);
  const where = whereLine({ modality: b.modality, clinicName: b.clinicName, clinicAddress: b.clinicAddress ?? brand.addressText, locationName: b.locationName, locationAddress: b.locationAddress, clientPhone: b.clientPhone, practicePhone: b.practicePhone, meetingUrl: b.meetingUrl }, false);
  const clientWhere = where;
  const body = [
    `Hi ${b.clientName.split(' ')[0]},`,
    '',
    `You're booked in at ${b.clinicName}.`,
    '',
    `  ${b.serviceName}`,
    `  ${b.whenText}`,
    // Kept in step with the HTML panel. A text part that omits where to be
    // while the HTML carries it is the mismatch nobody notices until somebody
    // drives to the wrong town.
    ...clientWhere.split('\n').map(l => `  ${l}`),
    '',
    // Same three states as the HTML half, kept in step deliberately: the text
    // part is what a screen reader and a watch get, and it saying "a form is
    // needed" with no link while the HTML carries a button is the sort of
    // mismatch nobody notices until a client complains they never got one.
    b.intakeUrl
      ? 'Your booking includes a short health form and consent. It takes about three '
        + 'minutes and covers everything booked for that day:'
      : null,
    b.intakeUrl ?? null,
    b.intakeUrl ? '' : null,
    !b.intakeUrl && b.requiresConsent
      ? 'This treatment needs a short assessment and a consent form before we start, so please allow a few extra minutes.'
      : null,
    !b.intakeUrl && b.requiresConsent ? '' : null,
    'If you need to change or cancel, reply to this email'
      + (b.practicePhone ? ` or call ${b.practicePhone}.` : '.'),
    '',
    `— ${b.clinicName}`
  ].filter(v => v !== null).join('\n');

  const html = renderEmail(brand, {
    // Neutral. The treatment is named in the body, never in the line that shows
    // in an inbox list next to the subject.
    preheader: `Your appointment at ${b.clinicName} is confirmed.`,
    greeting: `Hi ${b.clientName.split(' ')[0]},`,
    lines: [`You're booked in at ${b.clinicName}.`],
    panel: [
      { label: 'Treatment', value: b.serviceName },
      { label: 'When', value: b.whenText },
      { label: 'Where', value: clientWhere }
    ],
    /**
     * The form becomes the action when there is one.
     *
     * Until now this email said a consent form was needed and gave no way to
     * do it, which is how the whole thing ended up on paper in the treatment
     * room. One button, and the visit starts with it already read.
     */
    cta: b.intakeUrl ? { label: 'Complete your form' , url: b.intakeUrl } : null,
    note: b.intakeUrl
      ? 'Your booking includes a short health form and consent to complete before you come in. '
        + 'It takes about three minutes, covers everything booked for that day, and only your '
        + 'practitioner sees it.'
      : b.requiresConsent
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
  const brand = await emailBrand(b.clinicId, b.clinicName);
  const where = whereLine({ modality: b.modality, clinicName: b.clinicName, clinicAddress: b.clinicAddress ?? brand.addressText, locationName: b.locationName, locationAddress: b.locationAddress, clientPhone: b.clientPhone, practicePhone: b.practicePhone, meetingUrl: b.meetingUrl }, true);
  const noticeWhere = where;
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
    // Kept in step with the HTML panel deliberately. A text part that omits
    // where to be, while the HTML carries it, is the mismatch nobody notices
    // until somebody drives to the wrong town.
    ...noticeWhere.split('\n').map(l => `  ${l}`),
    '',
    `Contact: ${b.clientEmail}${b.clientPhone ? ` · ${b.clientPhone}` : ''}`,
    b.note ? `\nThey said:\n${b.note}` : null,
    '',
    'It is on your calendar in the console.'
  ].filter(v => v !== null).join('\n');

  const html = renderEmail(brand, {
    preheader: `A new booking came in for ${b.clinicName}.`,
    lines: [`${b.clientName} booked online.`],
    panel: [
      { label: 'Treatment', value: b.serviceName },
      { label: 'When', value: b.whenText },
      // The row that was missing entirely, and the reason she could not tell a
      // phone consult from a visit. Always present, never conditional — the
      // absence of a Where line is what made every booking look the same.
      { label: 'Where', value: noticeWhere },
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

/* -------------------------------------------------------------- intake -- */

export type IntakeInviteEmail = {
  clinicId: string;
  clinicName: string;
  practicePhone: string | null;
  clientName: string;
  clientEmail: string;
  serviceName: string | null;
  whenText: string;
  intakeUrl: string;
  synthetic: boolean;
};

/**
 * "Here is your form" — sent on its own, after the fact.
 *
 * The confirmation already carries this link for anything booked since the
 * form went live. This is for the rest: appointments made before it existed,
 * and the ordinary case of somebody who deleted the email or cannot find it.
 *
 * Deliberately a SEPARATE message rather than re-sending the confirmation. A
 * second "you're booked in" three weeks after booking reads like a duplicate
 * charge or a booking error, and the practice gets a worried phone call.
 */
export async function sendIntakeInvite(i: IntakeInviteEmail): Promise<NotifyResult> {
  const first = i.clientName.split(' ')[0];

  const body = [
    `Hi ${first},`,
    '',
    `Before your visit to ${i.clinicName}, please fill in your form — it takes about three minutes.`,
    '',
    i.intakeUrl,
    '',
    ...(i.serviceName ? [`  ${i.serviceName}`] : []),
    `  ${i.whenText}`,
    '',
    'Only your practitioner sees it.',
    '',
    i.practicePhone ? `Any questions, call ${i.practicePhone} or reply to this email.` : 'Any questions, just reply to this email.',
    '',
    `— ${i.clinicName}`
  ].join('\n');

  const brand = await emailBrand(i.clinicId, i.clinicName);
  const html = renderEmail(brand, {
    // Neutral, like every other preheader here: the treatment is named in the
    // body, not in the line that sits in an inbox list.
    preheader: `A short form to fill in before your visit to ${i.clinicName}.`,
    greeting: `Hi ${first},`,
    lines: [
      `Before your visit to ${i.clinicName}, please fill in your form. It takes about ` +
      `three minutes, and only your practitioner sees it.`
    ],
    panel: [
      ...(i.serviceName ? [{ label: 'Treatment', value: i.serviceName }] : []),
      { label: 'When', value: i.whenText }
    ],
    cta: { label: 'Fill in your form', url: i.intakeUrl },
    footerLines: [
      i.practicePhone
        ? `Any questions, call ${i.practicePhone} or reply to this email.`
        : 'Any questions, just reply to this email.'
    ]
  });

  const sent = await deliver(i.clientEmail, `Your form for ${i.clinicName}`, body, html);

  await logRun({
    clinicId: i.clinicId,
    ruleKey: 'intake_invite',
    clinicName: i.clinicName,
    synthetic: i.synthetic,
    sent
  });

  return { logged: true, delivered: sent.ok, reason: sent.reason };
}

/* ------------------------------------------------------------ invoices -- */

export type PaymentLinkEmail = {
  clinicId: string;
  clinicName: string;
  practicePhone: string | null;
  toName: string;
  toEmail: string;
  orderNo: string;
  /** The Stripe Checkout page. Expires; the copy below says so. */
  payUrl: string;
  lines: { name: string; qty: number; lineTotalCents: number }[];
  totalCents: number;
  synthetic: boolean;
};

/**
 * The invoice — a branded email whose button is the Stripe checkout.
 *
 * WHY THIS WAS MISSING AND MATTERED. The charge screen has always built a
 * payment link and shown it with a Copy button, under a radio labelled "Send a
 * payment link". Nothing sent it. The practice copied the URL into their own
 * email or a text, which works, and means the one message a client receives
 * about money arrives with no letterhead, from a personal address, containing
 * a bare stripe.com link — which is indistinguishable from a phishing attempt
 * and gets treated as one.
 *
 * EVERY LINE NAME GOES THROUGH checkoutLineLabel. These are the same free-text
 * descriptions the practitioner typed into the charge builder, so the same
 * rule applies as when they reach Stripe: an emailed invoice sits in an inbox
 * and gets forwarded, and "Botox — 20 units" in a subject-adjacent body is the
 * disclosure lib/phi exists to prevent.
 */
export async function sendPaymentLink(p: PaymentLinkEmail): Promise<NotifyResult> {
  const safe = p.lines.map(l => ({
    label: checkoutLineLabel(l.qty > 1 ? `${l.name} (${l.qty})` : l.name),
    amount: l.lineTotalCents
  }));

  const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

  const body = [
    `Hi ${p.toName.split(' ')[0]},`,
    '',
    `Here is your invoice from ${p.clinicName}.`,
    '',
    ...safe.map(l => `  ${l.label} — ${dollars(l.amount)}`),
    '',
    `  Total: ${dollars(p.totalCents)}`,
    '',
    'Pay securely here:',
    p.payUrl,
    '',
    'The link is good for seven days. Nothing is charged until you complete it.',
    '',
    p.practicePhone ? `Questions? Call ${p.practicePhone} or reply to this email.` : 'Questions? Reply to this email.',
    '',
    `— ${p.clinicName}`
  ].join('\n');

  const brand = await emailBrand(p.clinicId, p.clinicName);
  const html = renderEmail(brand, {
    // Neutral: an invoice preview that names the treatment is the same leak as
    // a confirmation that does.
    preheader: `Your invoice from ${p.clinicName} — ${dollars(p.totalCents)}.`,
    greeting: `Hi ${p.toName.split(' ')[0]},`,
    lines: [`Here is your invoice from ${p.clinicName}.`],
    panel: [
      ...safe.map(l => ({ label: l.label, value: dollars(l.amount) })),
      { label: 'Total', value: dollars(p.totalCents) }
    ],
    panelLayout: 'ledger',
    cta: { label: `Pay ${dollars(p.totalCents)}`, url: p.payUrl },
    note: 'The link is good for seven days, and nothing is charged until you complete it.',
    footerLines: [
      p.practicePhone
        ? `Questions? Call ${p.practicePhone} or reply to this email.`
        : 'Questions? Just reply to this email.',
      `Reference ${p.orderNo}.`
    ]
  });

  const sent = await deliver(p.toEmail, `Your invoice from ${p.clinicName}`, body, html);

  await logRun({
    clinicId: p.clinicId,
    ruleKey: 'payment_link',
    clinicName: p.clinicName,
    synthetic: p.synthetic,
    sent
  });

  return { logged: true, delivered: sent.ok, reason: sent.reason };
}

/* ----------------------------------------------------------- reminders -- */

export type ReminderEmail = {
  /** The same three the other messages carry, so a video link actually
   *  reaches the person who needs to click it. */
  modality?: Modality | null;
  meetingUrl?: string | null;
  clinicAddress?: string | null;
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
  /**
   * The same sentence the confirmation uses, not a second version of it.
   *
   * This only ever knew about a location, so a consult that became a video
   * call had its link pasted into the console and then told nobody. The
   * reminder is the last message before the appointment and the one most
   * likely to be read standing up — it is exactly where the link belongs.
   */
  const elsewhere = whereLine({
    modality: r.modality,
    clinicName: r.clinicName,
    clinicAddress: r.clinicAddress,
    locationName: r.locationName,
    locationAddress: r.locationAddress,
    clientPhone: null,
    practicePhone: r.practicePhone,
    meetingUrl: r.meetingUrl
  }, false);

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

/* --------------------------------------------------------------- orders -- */

export type OrderNoticeEmail = {
  clinicId: string;
  clinicName: string;
  /** Where the practice wants to hear about orders. */
  practiceInbox: string | null;
  orderNo: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  note: string | null;
  lines: { name: string; qty: number; unitPriceCents: number }[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  /** 'ship' or 'pickup'. Decides whether an address is expected at all. */
  fulfilment: string;
  /** Already formatted, one line per part. Null for a collection. */
  shipTo: string | null;
  /**
   * 'custom' for an invoice the practice raised, anything else for a basket
   * somebody bought from the shop.
   *
   * It decides whether delivery is mentioned AT ALL. An invoice for a lash
   * set that has already been done has nothing to post and nothing to
   * collect, and the notice told the practitioner "Collection — they are
   * picking this up, do not post it" about an appointment the client had
   * already sat through. Shop language on a service invoice.
   */
  kind: string;
  /**
   * The practice's own reduction, which the ledger has to show.
   *
   * Line totals are GROSS and the subtotal is NET, so an invoice with $35 off
   * read "1 × UV Classic Lashes $175.00" then "Subtotal $140.00" with
   * nothing between them to explain where $35 went. Arithmetic a client
   * cannot follow on a receipt is worse than no receipt.
   */
  discountCents: number;
  synthetic: boolean;
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Tell the practice somebody bought something.
 *
 * NOTHING TOLD HER AT ALL BEFORE THIS. The webhook recorded the payment, the
 * console showed it under "To send", and that was the entire notification
 * path — she had to think to go and look. For a practice taking a handful of
 * orders a month that is exactly how a parcel sits unposted for a week while
 * somebody waits for it.
 *
 * Sent from the webhook rather than the checkout action, because an order is
 * not a sale until Stripe says it is paid. Firing when the session is created
 * would announce every abandoned basket.
 *
 * The address is included because the whole point is that she can act on this
 * without opening anything — but it is a postal address and an order, never
 * anything clinical, so no PHI rule is in play and none of the trigger-checked
 * builders are needed here.
 */
export async function sendOrderNotice(o: OrderNoticeEmail): Promise<NotifyResult> {
  const brand = await emailBrand(o.clinicId, o.clinicName);

  if (!o.practiceInbox) {
    await logRun({
      clinicId: o.clinicId,
      ruleKey: 'order_notice',
      clinicName: o.clinicName,
      synthetic: o.synthetic,
      sent: { ok: false, reason: 'no address' },
      suppressed: 'No destination address set for this practice.'
    });
    return { logged: true, delivered: false, reason: 'no address configured' };
  }

  const itemLines = o.lines.map(l => `  ${l.qty} x ${l.name} — ${money(l.unitPriceCents * l.qty)}`);

  // Said the same way in both halves. A practice reading the text part on a
  // watch must not get a different instruction from the one in the HTML.
  const how = o.fulfilment === 'pickup'
    ? 'Collection — they are picking this up, do not post it.'
    : o.shipTo
      ? `Post to:\n${o.shipTo}`
      : 'To post, but no address came through. Check the order in the console before sending.';

  const body = [
    `${o.customerName} ordered ${o.lines.reduce((n, l) => n + l.qty, 0)} item(s).`,
    '',
    ...itemLines,
    '',
    `  Subtotal ${money(o.subtotalCents)}`,
    `  Tax      ${money(o.taxCents)}`,
    `  Paid     ${money(o.totalCents)}`,
    '',
    how,
    '',
    `Contact: ${o.customerEmail}${o.customerPhone ? ` · ${o.customerPhone}` : ''}`,
    o.note ? `\nThey said:\n${o.note}` : null,
    '',
    `Order ${o.orderNo}. It is in the console under To send.`
  ].filter(v => v !== null).join('\n');

  const html = renderEmail(brand, {
    // Neutral on the lock screen: an order number and nothing about what was
    // bought or by whom.
    preheader: `Order ${o.orderNo} has been paid.`,
    lines: [`${o.customerName} ordered and has paid.`],
    panel: [
      /*
        Delivery, only when there is something to deliver.
        An invoice the practice raised for a treatment already given has
        nothing to post and nothing to collect, and saying "Collection — they
        are picking this up" about a finished lash appointment is shop
        language on a service receipt.
      */
      ...(o.kind === 'custom' ? [] : [{
        label: o.fulfilment === 'pickup' ? 'Collection' : 'Post to',
        value: how,
        // Only the posting case is an address worth protecting from the mail
        // client's own linkifier. The collection line is a sentence.
        asAddress: o.fulfilment !== 'pickup' && Boolean(o.shipTo)
      }]),
      { label: 'Contact', value: `${o.customerEmail}${o.customerPhone ? `\n${o.customerPhone}` : ''}` },
      ...(o.note ? [{ label: 'They said', value: o.note }] : [])
    ],
    // Same ledger the customer gets, so the two emails about one order agree
    // line for line rather than summarising it differently.
    ledger: [
      ...o.lines.map(l => ({
        label: `${l.qty} × ${l.name}`,
        value: money(l.unitPriceCents * l.qty)
      })),
      /*
        The reduction, spelled out. Line totals above are GROSS and the
        subtotal is NET, so without this row an invoice with money off reads
        as arithmetic that does not add up.
      */
      ...(o.discountCents > 0
        ? [{ label: 'Discount', value: `-${money(o.discountCents)}` }]
        : []),
      { label: 'Subtotal', value: money(o.subtotalCents) },
      ...(o.taxCents > 0 ? [{ label: 'Tax', value: money(o.taxCents) }] : []),
      { label: 'Paid', value: money(o.totalCents) }
    ],
    cta: { label: 'Open the order', url: `${brand.origin}/console/orders` },
    footerLines: [`Order ${o.orderNo}.`]
  });

  const sent = await deliver(
    o.practiceInbox,
    `Order ${o.orderNo} — ${money(o.totalCents)}`,
    body,
    html
  );

  await logRun({
    clinicId: o.clinicId,
    ruleKey: 'order_notice',
    clinicName: o.clinicName,
    synthetic: o.synthetic,
    sent
  });

  return { logged: true, delivered: sent.ok, reason: sent.reason };
}

/**
 * The customer's own copy of what they just bought.
 *
 * THE PAGE WAS ALREADY PROMISING THIS. /shop/thanks says "A receipt is on its
 * way to the email address you used at checkout" — unconditionally, and
 * nothing sent one. Stripe's own receipt is a dashboard toggle rather than
 * anything this code controls, so on a practice that has not switched it on,
 * somebody pays and hears nothing at all. The first real order placed through
 * this shop went exactly that way.
 *
 * Deliberately an ORDER CONFIRMATION rather than a payment receipt. Stripe's
 * receipt is the authoritative record of the card transaction and should stay
 * switched on for that; this one answers the different question a customer
 * actually has, which is what is coming and where it is going.
 *
 * Reuses the same branded renderer as every other email here, so a receipt
 * does not arrive looking like it came from somewhere else.
 */
export async function sendOrderConfirmation(o: OrderNoticeEmail): Promise<NotifyResult> {
  const brand = await emailBrand(o.clinicId, o.clinicName);

  const itemLines = o.lines.map(l => `  ${l.qty} x ${l.name} — ${money(l.unitPriceCents * l.qty)}`);

  /**
   * Said twice, two ways, on purpose.
   *
   * The plain-text part needs a sentence, because there is no label beside it
   * to give it context. The HTML panel already has a label in the left
   * column, so repeating the lead-in there produced "GOING TO — It is going
   * to: Craig Carda", which is how the first real confirmation read.
   */
  const nextSentence = o.fulfilment === 'pickup'
    ? `You are collecting this one. ${o.clinicName} will be in touch when it is ready.`
    : o.shipTo
      ? `It is going to:\n${o.shipTo}`
      : `${o.clinicName} will be in touch to confirm delivery.`;

  const nextPanel = o.fulfilment === 'pickup'
    ? `${o.clinicName} will be in touch when it is ready.`
    : o.shipTo ?? `${o.clinicName} will be in touch to confirm delivery.`;

  const body = [
    `Hi ${o.customerName.split(' ')[0]},`,
    '',
    `Thank you — your order is confirmed.`,
    '',
    ...itemLines,
    '',
    `  Subtotal ${money(o.subtotalCents)}`,
    `  Tax      ${money(o.taxCents)}`,
    `  Paid     ${money(o.totalCents)}`,
    '',
    nextSentence,
    '',
    `Your order number is ${o.orderNo}. Reply to this email if anything looks wrong.`
  ].join('\n');

  const html = renderEmail(brand, {
    // Neutral on a lock screen: an order number, not a shopping list.
    preheader: `Your order ${o.orderNo} is confirmed.`,
    lines: [`Thank you — your order is confirmed.`],
    panel: [
      { label: 'Order', value: o.orderNo },
      {
        label: o.fulfilment === 'pickup' ? 'Collection' : 'Going to',
        value: nextPanel,
        // Only when it IS an address. Gmail and iOS linkify one into blue
        // underlined navigation otherwise; "we will be in touch" needs no
        // such protection and should not become a map link.
        asAddress: o.fulfilment !== 'pickup' && Boolean(o.shipTo)
      }
    ],
    /**
     * The money as a ledger rather than a sentence.
     *
     * These used to be two panel rows — an items list joined with newlines,
     * and a "Paid" line with the tax in brackets — which rendered as prose
     * and gave the total nowhere to stand out. A receipt should let somebody
     * check the arithmetic at a glance.
     */
    ledger: [
      ...o.lines.map(l => ({
        label: `${l.qty} × ${l.name}`,
        value: money(l.unitPriceCents * l.qty)
      })),
      /*
        The reduction, spelled out. Line totals above are GROSS and the
        subtotal is NET, so without this row an invoice with money off reads
        as arithmetic that does not add up.
      */
      ...(o.discountCents > 0
        ? [{ label: 'Discount', value: `-${money(o.discountCents)}` }]
        : []),
      { label: 'Subtotal', value: money(o.subtotalCents) },
      ...(o.taxCents > 0 ? [{ label: 'Tax', value: money(o.taxCents) }] : []),
      { label: 'Paid', value: money(o.totalCents) }
    ],
    footerLines: [`Reply to this email if anything looks wrong.`]
  });

  const sent = await deliver(
    o.customerEmail,
    `Your order ${o.orderNo} — ${o.clinicName}`,
    body,
    html
  );

  await logRun({
    clinicId: o.clinicId,
    ruleKey: 'order_confirmation',
    clinicName: o.clinicName,
    synthetic: o.synthetic,
    sent
  });

  return { logged: true, delivered: sent.ok, reason: sent.reason };
}

export type OrderShippedEmail = {
  clinicId: string;
  clinicName: string;
  orderNo: string;
  customerName: string;
  customerEmail: string;
  carrier: string | null;
  trackingCode: string | null;
  shipTo: string | null;
  synthetic: boolean;
};

/**
 * "It is on its way."
 *
 * The gap this closes is not sentimental. Between paying and a parcel landing
 * there was no message of any kind, so the only way for a customer to find out
 * what had happened was to ask — and the practice's answer was whatever it
 * could remember, because nothing recorded a dispatch either.
 *
 * Carrier and tracking are shown only when they exist. A hand-delivered
 * parcel has neither, and an email with an empty "Tracking:" label on it
 * reads as broken rather than as considerate.
 *
 * No link is built for the tracking code. Guessing a carrier's URL format
 * produces a dead link often enough that the number itself, copyable, is more
 * useful than a link that 404s — and this code does not know which carrier
 * somebody typed.
 */
export async function sendOrderShipped(o: OrderShippedEmail): Promise<NotifyResult> {
  const brand = await emailBrand(o.clinicId, o.clinicName);

  const how = o.carrier && o.trackingCode
    ? `Sent with ${o.carrier}. Tracking: ${o.trackingCode}`
    : o.carrier
      ? `Sent with ${o.carrier}.`
      : o.trackingCode
        ? `Tracking: ${o.trackingCode}`
        : 'It is on its way.';

  const body = [
    `Hi ${o.customerName.split(' ')[0]},`,
    '',
    `Your order ${o.orderNo} has been sent.`,
    '',
    `  ${how}`,
    ...(o.shipTo ? ['', 'Going to:', ...o.shipTo.split('\n').map(l => `  ${l}`)] : []),
    '',
    `Reply to this email if anything looks wrong.`
  ].join('\n');

  const html = renderEmail(brand, {
    preheader: `Order ${o.orderNo} is on its way.`,
    lines: [`Your order has been sent.`],
    panel: [
      { label: 'Order', value: o.orderNo },
      ...(o.carrier ? [{ label: 'Carrier', value: o.carrier }] : []),
      ...(o.trackingCode ? [{ label: 'Tracking', value: o.trackingCode }] : []),
      ...(o.shipTo ? [{ label: "Going to", value: o.shipTo, asAddress: true }] : [])
    ],
    footerLines: ['Reply to this email if anything looks wrong.']
  });

  const sent = await deliver(
    o.customerEmail,
    `Your order ${o.orderNo} is on its way`,
    body,
    html
  );

  await logRun({
    clinicId: o.clinicId,
    ruleKey: 'order_shipped',
    clinicName: o.clinicName,
    synthetic: o.synthetic,
    sent
  });

  return { logged: true, delivered: sent.ok, reason: sent.reason };
}
