'use server';

/**
 * Editing the shop's products.
 *
 * Deliberately one save for the whole list rather than a screen per product.
 * The job this exists for is "write descriptions for all eighteen", done once,
 * in a sitting — and eighteen round trips through a detail page is how that job
 * does not get done.
 */

import { revalidatePath } from 'next/cache';
import { serverClient, currentViewer } from '@/lib/supabase/server';

export type SaveResult = { ok: true; changed: number } | { ok: false; error: string };

export type ProductEdit = {
  id: string;
  description: string;
  details: string;
  priceDollars: string;
  online: boolean;
};

function toCents(value: string): number | null {
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export async function saveProducts(edits: ProductEdit[]): Promise<SaveResult> {
  const viewer = await currentViewer();
  if (!viewer || viewer.kind !== 'staff') return { ok: false, error: 'Not signed in as staff.' };

  const supabase = await serverClient();

  // Read current values so only genuine changes are written. Updating all
  // eighteen every save would bump updated_at on rows nobody touched, which
  // makes "what changed recently" useless.
  const { data: current } = await supabase
    .from('product')
    .select('id, description, details, price_cents, online')
    .eq('clinic_id', viewer.clinicId);

  const byId = new Map((current ?? []).map(p => [String(p.id), p]));
  let changed = 0;

  for (const edit of edits) {
    const existing = byId.get(edit.id);
    if (!existing) continue;

    const description = edit.description.trim() || null;
    const details = edit.details.trim() || null;
    const cents = toCents(edit.priceDollars);

    if (cents === null || cents < 0) {
      return { ok: false, error: `That price does not look right on one of the products.` };
    }

    const patch: Record<string, unknown> = {};
    if (description !== (existing.description ?? null)) patch.description = description;
    if (details !== (existing.details ?? null)) patch.details = details;
    if (cents !== existing.price_cents) patch.price_cents = cents;
    if (edit.online !== existing.online) patch.online = edit.online;

    if (Object.keys(patch).length === 0) continue;

    const { error } = await supabase.from('product').update(patch).eq('id', edit.id);
    if (error) return { ok: false, error: error.message };
    changed++;
  }

  revalidatePath('/console/products');
  // The public pages read these directly, so they have to be told too.
  revalidatePath('/c/[slug]/shop', 'page');
  return { ok: true, changed };
}
