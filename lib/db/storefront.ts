/**
 * lib/db/storefront.ts
 * Queries for the PUBLIC, unauthenticated storefront at /c/[slug].
 *
 * Separate from lib/db/queries.ts on purpose. Everything in that file resolves
 * the current viewer and relies on RLS keyed to their staff or patient record.
 * Nothing here has a viewer at all — these run as `anon`, and the only reason
 * they return anything is migration 0009, which grants anon named columns on
 * five tables for clinics that have opted in with `listed`.
 *
 * Keeping them apart means a future change to a console query cannot widen the
 * public surface by accident, and a reviewer reading this file knows every line
 * in it is world-readable.
 *
 * Never add a table here without adding it to scripts/storefront-test.cjs.
 */

import { createServerClient } from '@supabase/ssr';

export type StorefrontClinic = {
  id: string;
  slug: string;
  name: string;
  location_name: string | null;
  practice_type: string;
  modules: Record<string, boolean>;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  address_note: string | null;
  phone_voice: string | null;
  phone_text: string | null;
  email: string | null;
  hours: { day: string; open: string | null; close: string | null }[];
  brand: Record<string, unknown>;
  visit_facts: Record<string, string>;
  tagline: string | null;
  intro: string | null;
  booking_note: string | null;
};

export type StorefrontService = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  /** Expanded copy, shown on request. Never in the menu row. */
  details: string | null;
  /** The practice has not written or approved this service's public copy. */
  needs_copy: boolean;
  duration_min: number;
  price_mode: string;
  price_cents: number | null;
  price_from_cents: number | null;
  unit_label: string | null;
  deposit_cents: number | null;
  requires_consent: boolean;
  is_membership: boolean;
  online_bookable: boolean;
  sort_order: number;
};

export type StorefrontProvider = {
  id: string;
  name: string;
  credentials: string | null;
  role_label: string | null;
  bio: string | null;
  /**
   * Two meanings, discriminated by a leading slash:
   *   '/practitioners/x.jpg'  a public marketing asset served from /public
   *   'providers/x.jpg'       a private storage object needing a signed URL
   *
   * A practitioner's headshot on a public storefront is deliberately public and
   * is not PHI. A patient progress photo is the opposite and never appears
   * here. docs/16-media-pipeline.md keeps them apart; this comment keeps the
   * next reader from applying the wrong rule to the wrong one.
   */
  photo_path: string | null;
};

export type StorefrontPackage = {
  id: string;
  name: string;
  description: string | null;
  sessions: number;
  price_cents: number;
  list_price_cents: number | null;
  expiry_days: number | null;
  interval_note: string | null;
};

/**
 * An anonymous client. No cookies are read and none are set — a storefront
 * visitor has no session and must not be given one, because a Set-Cookie on a
 * public marketing page is how a cache ends up serving one visitor's response
 * to the next.
 */
function anonClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

export async function getStorefront(slug: string): Promise<StorefrontClinic | null> {
  const supabase = anonClient();
  const { data } = await supabase
    .from('clinic')
    .select(
      'id, slug, name, location_name, practice_type, modules, ' +
      'address_line1, address_line2, address_city, address_state, address_zip, address_note, ' +
      'phone_voice, phone_text, email, hours, brand, visit_facts, tagline, intro, booking_note'
    )
    .eq('slug', slug)
    .maybeSingle();

  return (data as unknown as StorefrontClinic) ?? null;
}

/** The menu. Active services, ordered the way the practice ordered them. */
export async function getStorefrontServices(clinicId: string): Promise<StorefrontService[]> {
  const supabase = anonClient();
  const { data } = await supabase
    .from('service')
    .select(
      'id, name, category, description, details, needs_copy, duration_min, price_mode, price_cents, ' +
      'price_from_cents, unit_label, deposit_cents, requires_consent, is_membership, ' +
      'online_bookable, sort_order'
    )
    .eq('clinic_id', clinicId)
    .eq('active', true)
    .order('sort_order')
    .order('name');

  return (data as unknown as StorefrontService[]) ?? [];
}

export async function getStorefrontProviders(clinicId: string): Promise<StorefrontProvider[]> {
  const supabase = anonClient();
  const { data } = await supabase
    .from('provider_public')
    .select('id, name, credentials, role_label, bio, photo_path')
    .eq('clinic_id', clinicId)
    .order('sort_order');

  return (data as unknown as StorefrontProvider[]) ?? [];
}

export async function getStorefrontPackages(clinicId: string): Promise<StorefrontPackage[]> {
  const supabase = anonClient();
  const { data } = await supabase
    .from('service_package')
    .select('id, name, description, sessions, price_cents, list_price_cents, expiry_days, interval_note')
    .eq('clinic_id', clinicId)
    .eq('active', true)
    .order('sort_order')
    .order('price_cents');

  return (data as unknown as StorefrontPackage[]) ?? [];
}

/**
 * Group services the way a menu reads rather than the way they are stored.
 * Category order follows first appearance in the practice's own sort order, so
 * the practice controls what a visitor sees first without touching code.
 */
export function groupByCategory(services: StorefrontService[]) {
  const groups = new Map<string, StorefrontService[]>();
  for (const s of services) {
    const key = s.category || 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items }));
}

/** Opening hours collapsed to "Mon, Wed, Fri · 9:00–17:00" style lines. */
export function hoursLines(hours: StorefrontClinic['hours']) {
  const open = (hours ?? []).filter(h => h.open && h.close);
  const byWindow = new Map<string, string[]>();
  for (const h of open) {
    const key = `${h.open}–${h.close}`;
    if (!byWindow.has(key)) byWindow.set(key, []);
    byWindow.get(key)!.push(h.day.slice(0, 3));
  }
  return [...byWindow.entries()].map(([window, days]) => ({ days: days.join(', '), window }));
}
