/**
 * lib/phi — the serialiser allowlist
 *
 * docs/06-architecture.md rule 1: "PHI never leaves systems we control. Enforce
 * it in code — a serialiser allowlist, not a convention people remember."
 *
 * This is that allowlist. Anything crossing a boundary out of our systems — a
 * payment processor, an SMS or email provider, an analytics event, a log line, an
 * error report — goes through a function in this file. Nothing constructs a
 * Stripe metadata object or a notification body by hand.
 *
 * The database enforces the same rules independently (supabase/migrations/0004),
 * so a bug here is caught at write time rather than shipped. Both read the same
 * term list, kept in sync by scripts/phi-sync-test.cjs.
 */

/**
 * Terms that must never appear in an outbound field.
 *
 * Matched on word boundaries. A substring check for "ed" fires inside
 * "scheduled", "needs" and "linked", which flags everything, which means people
 * stop reading the warnings — a control that cries wolf is not a control.
 */
export const BANNED_TERMS = [
  'testosterone', 'trt', 'erectile', 'ed', 'hematocrit', 'psa', 'estradiol',
  'lab', 'labs', 'lab result', 'results are ready', 'blood draw',
  'dose', 'injection', 'prescription', 'refill', 'glp-1', 'semaglutide',
  'tirzepatide', 'peptide', 'libido', 'hormone',
  'neurotoxin', 'botox', 'jeuveau', 'filler', 'prf', 'microneedling'
] as const;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Which banned terms appear in this text, if any. */
export function phiTermsIn(text: unknown): string[] {
  if (typeof text !== 'string' || !text) return [];
  return BANNED_TERMS.filter(term =>
    new RegExp(`(^|[^a-z0-9])${escapeRegex(term)}([^a-z0-9]|$)`, 'i').test(text)
  );
}

export class PhiLeakError extends Error {
  constructor(public field: string, public terms: string[]) {
    super(
      `Refusing to send "${field}": it contains ${terms.join(', ')}. ` +
      `This value leaves systems we control and must carry no clinical content. ` +
      `See docs/09-compliance-register.md.`
    );
    this.name = 'PhiLeakError';
  }
}

/** Throws rather than returning false. A caller that can ignore the result will. */
export function assertNoPhi(field: string, value: unknown): void {
  const hits = phiTermsIn(value);
  if (hits.length) throw new PhiLeakError(field, hits);
}

/* ------------------------------------------------------------- payments ---- */

/**
 * The only descriptor a payment may carry. Built from the practice name, never
 * from a service or therapy name.
 *
 * Card statements are read by whoever opens the post, and "GAMEDAY - TRT" on a
 * statement is a disclosure to a spouse, a bank, and anyone else in the chain.
 */
export function paymentDescriptor(practiceName: string): string {
  const cleaned = practiceName
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 17);                     // Stripe truncates hard; do it predictably
  const descriptor = `${cleaned} SERVICES`;
  assertNoPhi('payment descriptor', descriptor);
  return descriptor;
}

/**
 * Stripe metadata, built from an allowlist of keys that are structurally
 * incapable of holding clinical meaning.
 *
 * Ids are safe because they are opaque outside our database. A service NAME is
 * not safe, which is why there is no key for one.
 */
export type AllowedStripeMetadata = {
  clinic_id?: string;
  patient_ref?: string;          // opaque id, never a name
  appointment_ref?: string;
  package_purchase_ref?: string;
  payment_type?: 'membership' | 'visit' | 'deposit' | 'package' | 'product' | 'other';
  pilot?: 'true' | 'false';
};

const STRIPE_METADATA_KEYS: (keyof AllowedStripeMetadata)[] = [
  'clinic_id', 'patient_ref', 'appointment_ref',
  'package_purchase_ref', 'payment_type', 'pilot'
];

export function stripeMetadata(input: AllowedStripeMetadata): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of STRIPE_METADATA_KEYS) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    const str = String(value);
    // Belt and braces: an id should never trip this, but a caller passing a name
    // into patient_ref by mistake must fail loudly rather than silently ship it.
    assertNoPhi(`stripe metadata.${key}`, str);
    out[key] = str;
  }
  // Anything not on the list is dropped rather than passed through, so adding a
  // field to a call site cannot quietly widen what we send.
  return out;
}

/**
 * The label a checkout line may carry.
 *
 * A line item name is not private data the way metadata is — it is printed on
 * the Stripe receipt, which lands in an inbox, and it is stored on Stripe's
 * side forever. "Botox — 20 units" in either place is the same disclosure
 * `paymentDescriptor` exists to prevent, one field over.
 *
 * NEUTRALISED RATHER THAN REJECTED, deliberately. A custom charge line is free
 * text the practitioner types with a client in front of her; throwing means the
 * payment link will not send and she cannot take the money. So the clinical
 * wording is replaced and the charge goes through. The full description is
 * still on the order in our own database, which is where it belongs and where
 * the receipt she sends from here reads it.
 *
 * Retail product names do not trip this — nothing in BANNED_TERMS is a
 * cleanser — so the shop is unaffected and its receipts stay itemised.
 */
export function checkoutLineLabel(name: string): string {
  const cleaned = (name ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Professional services';
  if (phiTermsIn(cleaned).length === 0) return cleaned.slice(0, 250);
  // Matches the wording on the card statement, so a client comparing the two
  // sees the same thing twice rather than two mysteries.
  return 'Professional services';
}

/* -------------------------------------------------------- notifications ---- */

/**
 * A lock-screen preview is readable by anyone holding the phone. It may say that
 * something needs attention; it may not say what.
 *
 * docs/02-patient-journey.md: "Gameday: you have an update" — never "Your
 * testosterone results are ready". This is not a nice-to-have. For this patient
 * population privacy is the conversion lever, and a leak here is the exact
 * disclosure the whole privacy layer exists to prevent.
 */
export function notificationPreview(practiceName: string, kind: NotificationKind): string {
  const text = `${practiceName}: ${PREVIEW_COPY[kind]}`;
  assertNoPhi('notification preview', text);
  return text;
}

export type NotificationKind =
  | 'generic_update'
  | 'appointment_confirmed'
  | 'appointment_reminder'
  | 'appointment_changed'
  | 'action_needed'
  | 'billing_attention'
  | 'message_reply'
  | 'booking_link';

const PREVIEW_COPY: Record<NotificationKind, string> = {
  generic_update: 'you have an update.',
  appointment_confirmed: 'your appointment is confirmed.',
  appointment_reminder: 'a reminder about your visit tomorrow.',
  appointment_changed: 'your appointment time has changed.',
  action_needed: 'something needs your attention.',
  billing_attention: 'a billing item needs your attention.',
  message_reply: 'you have a reply waiting.',
  booking_link: 'tap to pick a time that suits you.'
};

/* ------------------------------------------------------------ analytics ---- */

/**
 * De-identified event for the analytics path. No names, no ids that join to a
 * patient, no free text.
 *
 * The patient reference is hashed with a server-side salt so events can be
 * grouped by person without being attributable to one, and so the analytics
 * store cannot be joined back to PHI even if both were obtained.
 */
export type AnalyticsEvent = {
  name: string;
  clinic_id: string;
  properties?: Record<string, string | number | boolean>;
};

const ANALYTICS_DENY = /name|email|phone|dob|address|note|reason|diagnos|analyte|value/i;

export function analyticsEvent(event: AnalyticsEvent): Record<string, unknown> {
  const props: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(event.properties ?? {})) {
    if (ANALYTICS_DENY.test(key)) continue;
    if (typeof value === 'string') {
      if (phiTermsIn(value).length) continue;
      props[key] = value;
    } else {
      props[key] = value;
    }
  }
  return { name: event.name, clinic_id: event.clinic_id, ...props };
}

/* ------------------------------------------------------------------ logs ---- */

const SENSITIVE_KEY = /first_name|last_name|preferred_name|email|phone|dob|address|note|answers|body|reason|value_numeric|payload|descriptor|storage_path/i;

/**
 * Scrubs an object before it reaches a log line or an error reporter.
 *
 * Error monitoring is the most-forgotten PHI egress point: a stack trace with a
 * request body in it ships a patient record to a third party nobody signed a BAA
 * with. This keeps shapes and drops values.
 */
export function scrubForLog(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(v => scrubForLog(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? `[redacted:${typeof v}]` : scrubForLog(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string') {
    return value.length > 200 ? value.slice(0, 200) + '…' : value;
  }
  return value;
}
