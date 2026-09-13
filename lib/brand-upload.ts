/**
 * lib/brand-upload.ts
 * One place that puts an image in the `brand` bucket.
 *
 * Shared by the brand screen and the service form so the limits, the accepted
 * types and — most importantly — the path layout cannot drift between them.
 * That layout is what the bucket's RLS policy keys on: brand/<clinic_id>/<file>
 * means a practice writes only inside its own folder. A second copy of this
 * function that built the path slightly differently would be a hole.
 *
 * The bucket is PUBLIC. That is right for a logo or a photograph of a treatment
 * room, and catastrophic for a patient photograph — which is why patient media
 * lives in a different bucket entirely and nothing here can reach it.
 * docs/16-media-pipeline.md.
 */

import { serverClient } from '@/lib/supabase/server';

const MAX_BYTES = 5 * 1024 * 1024;
const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export async function uploadBrandImage(
  file: File,
  clinicId: string,
  prefix: string
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  if (file.size > MAX_BYTES) {
    throw new Error(
      `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB and the limit is 5MB.`
    );
  }
  if (!OK_TYPES.includes(file.type)) {
    throw new Error('Images only — PNG, JPEG, WebP or SVG.');
  }

  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Timestamped rather than overwritten: a replaced image gets a new URL, so a
  // cached copy of the old one can never be served in its place.
  const path = `${clinicId}/${prefix}-${Date.now()}.${ext}`;

  const supabase = await serverClient();
  const { error } = await supabase.storage
    .from('brand')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(error.message);

  return supabase.storage.from('brand').getPublicUrl(path).data.publicUrl;
}
