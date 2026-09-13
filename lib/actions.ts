/**
 * lib/actions.ts
 * Shared plumbing for every write in the console.
 *
 * Three things every mutation needs, in one place so no form can forget one:
 *
 *   requireStaff()   who is writing, and which practice they belong to. Never
 *                    trusted from a form field — a hidden clinic_id input is an
 *                    invitation to write into someone else's tenant.
 *
 *   pilotFields()    while the practice is in pilot mode the database refuses any
 *                    patient-facing row not marked synthetic. Setting it here
 *                    rather than per-form means a new screen cannot accidentally
 *                    produce rows the database rejects.
 *
 *   parse helpers    a price typed as "175" means $175.00, and "0" means free —
 *                    which is different from an empty box meaning "not set".
 */

import { redirect } from 'next/navigation';
import { currentViewer, type StaffContext } from '@/lib/supabase/server';

export async function requireStaff(): Promise<StaffContext> {
  const viewer = await currentViewer();
  if (!viewer) redirect('/admin');
  if (viewer.kind !== 'staff') redirect('/portal');
  return viewer;
}

/** Roles allowed to change clinical records and pricing. */
export async function requireRole(roles: StaffContext['role'][]): Promise<StaffContext> {
  const staff = await requireStaff();
  if (!roles.includes(staff.role)) {
    redirect('/console?error=not-allowed');
  }
  return staff;
}

/**
 * Marks a row synthetic while the practice is in pilot mode.
 *
 * Deliberately reads the clinic's own flag rather than the PILOT_MODE env var:
 * the database enforces on the clinic row, so anything else would let the app
 * and the database disagree.
 */
export async function pilotFields(clinicId: string): Promise<{ synthetic: boolean }> {
  const { serverClient } = await import('@/lib/supabase/server');
  const supabase = await serverClient();
  const { data } = await supabase
    .from('clinic')
    .select('pilot_mode')
    .eq('id', clinicId)
    .maybeSingle();
  return { synthetic: data?.pilot_mode !== false };
}

/* --------------------------------------------------------------- parsing -- */

export function text(form: FormData, key: string): string | null {
  const raw = form.get(key);
  if (raw === null) return null;
  const value = String(raw).trim();
  return value === '' ? null : value;
}

export function requiredText(form: FormData, key: string): string {
  const value = text(form, key);
  if (!value) throw new FormError(`${key.replace(/_/g, ' ')} is required.`);
  return value;
}

/** Dollars in the form, cents in the database. Never store a float dollar. */
export function money(form: FormData, key: string): number | null {
  const value = text(form, key);
  if (value === null) return null;
  const cleaned = value.replace(/[$,\s]/g, '');
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars) || dollars < 0) {
    throw new FormError(`"${value}" is not a valid price.`);
  }
  return Math.round(dollars * 100);
}

export function int(form: FormData, key: string, fallback: number | null = null): number | null {
  const value = text(form, key);
  if (value === null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new FormError(`"${value}" is not a number.`);
  return Math.round(n);
}

export function decimal(form: FormData, key: string): number | null {
  const value = text(form, key);
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new FormError(`"${value}" is not a number.`);
  return n;
}

export function bool(form: FormData, key: string): boolean {
  const raw = form.get(key);
  return raw === 'on' || raw === 'true' || raw === '1';
}

/** Thrown by the parsers; caught by each action and shown on the form. */
export class FormError extends Error {}

/**
 * Turns an error into a message safe to show on a form.
 *
 * The database's own guards produce genuinely useful messages — "PILOT MODE:
 * rejected because it is not marked synthetic", "PHI leak blocked in
 * payment.descriptor" — so those are surfaced rather than swallowed behind
 * "something went wrong". A control that fires silently teaches nobody anything.
 */
export function formMessage(err: unknown): string {
  if (err instanceof FormError) return err.message;
  const raw = err instanceof Error ? err.message : String(err);

  if (/PILOT MODE/i.test(raw)) {
    return 'The database refused that row because it is not marked synthetic. ' +
      'That is the pilot guard working — no real patient data may be stored yet.';
  }
  if (/PHI leak blocked/i.test(raw)) {
    return raw.split('.')[0] + '. That field is visible outside our systems, so it ' +
      'cannot contain clinical wording.';
  }
  if (/appointment_no_double_book/i.test(raw)) {
    return 'That provider is already booked across part of that time, including the ' +
      'turnaround after the previous appointment.';
  }
  if (/already redeemed/i.test(raw)) return raw;
  if (/duplicate key|unique/i.test(raw)) {
    return 'Something with that name or value already exists.';
  }
  if (/service_price_present/i.test(raw)) {
    return 'A flat-priced service needs a price. Pick "from" or "quoted" if the price varies.';
  }
  return 'Could not save that. ' + raw.slice(0, 160);
}
