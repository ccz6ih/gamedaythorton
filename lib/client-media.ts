/**
 * lib/client-media.ts
 * Client photographs. The private counterpart to lib/brand-upload.ts.
 *
 * ===========================================================================
 * THE DIFFERENCE FROM brand-upload, AND WHY IT IS A SEPARATE FILE
 * ===========================================================================
 * brand-upload writes to a PUBLIC bucket and returns a permanent URL. That is
 * exactly right for a logo and catastrophic for a client's face.
 *
 * Everything here writes to the PRIVATE `client-media` bucket and returns an
 * object path, never a URL. A URL is minted only on demand, signed, and
 * short-lived. The two are kept in separate modules with no shared helper so
 * that there is no function anywhere that could be pointed at the wrong bucket
 * by changing one argument.
 *
 * If you find yourself adding a `bucket` parameter to either of them, stop.
 * That parameter is the bug.
 *
 * ===========================================================================
 * WHY SIGNED URLS EXPIRE QUICKLY
 * ===========================================================================
 * A signed URL is a bearer token in a query string. It ends up in browser
 * history, in a screenshot, in a support email. Ten minutes is long enough to
 * load a page and short enough that a leaked link is worthless by the time
 * anybody finds it.
 */

import { serverClient } from '@/lib/supabase/server';

const BUCKET = 'client-media';
const MAX_BYTES = 15 * 1024 * 1024;
const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic'];
const SIGNED_URL_SECONDS = 600;

/**
 * Stores one photograph and returns its object PATH.
 *
 * The path layout is clinic/patient/file, which is what the bucket's RLS keys
 * on — a practice can reach only its own folder. The patient segment is not a
 * security boundary (any staff member of the clinic may see any client of that
 * clinic, which is correct for a two-person practice) but it makes the store
 * browsable and makes deleting everything for one client a prefix operation.
 */
export async function uploadClientPhoto(
  file: File,
  clinicId: string,
  patientId: string,
  prefix: string
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  if (file.size > MAX_BYTES) {
    throw new Error(
      `That photo is ${(file.size / 1024 / 1024).toFixed(1)}MB and the limit is 15MB. ` +
      'A photo taken on a phone is usually well under that.'
    );
  }
  if (!OK_TYPES.includes(file.type)) {
    throw new Error('Photos only — JPEG, PNG, WebP or HEIC.');
  }

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${clinicId}/${patientId}/${prefix}-${Date.now()}.${ext}`;

  const supabase = await serverClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(error.message);

  // The PATH, not a URL. Callers that need something to put in an <img> ask for
  // a signed URL explicitly, which is the moment the decision gets made.
  return path;
}

/** A short-lived URL for one stored photograph, or null if it cannot be signed. */
export async function signedPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;

  // A value that already looks like a URL is not ours and must not be signed —
  // it would silently succeed at nothing. Returning it unchanged keeps any
  // legacy row rendering while making the mistake visible in the data.
  if (/^https?:/i.test(path)) return path;

  const supabase = await serverClient();
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);

  return data?.signedUrl ?? null;
}

/** Signs many at once. One round trip instead of one per photograph. */
export async function signedPhotoUrls(paths: (string | null)[]): Promise<Map<string, string>> {
  const real = [...new Set(paths.filter((p): p is string => !!p && !/^https?:/i.test(p)))];
  const out = new Map<string, string>();
  if (real.length === 0) return out;

  const supabase = await serverClient();
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(real, SIGNED_URL_SECONDS);

  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}

/**
 * Removes a photograph from storage.
 *
 * Deliberately possible, unlike editing a note. A client asking for their
 * photographs to be deleted should get that without an argument, and an
 * accidental upload of the wrong person's face has to be removable now rather
 * than after a support ticket.
 */
export async function deleteClientPhoto(path: string): Promise<void> {
  if (!path || /^https?:/i.test(path)) return;
  const supabase = await serverClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}
