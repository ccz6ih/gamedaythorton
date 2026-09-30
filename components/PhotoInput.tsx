'use client';

/**
 * components/PhotoInput.tsx
 * Pick photos on a phone, all at once, and label each one.
 *
 * ===========================================================================
 * WHY IT IS NOT JUST <input multiple>
 * ===========================================================================
 * It already was. The problems were the two things a file input does by
 * default that nobody wants here:
 *
 *   1. A SECOND PICK REPLACES THE FIRST. Choose three photos, remember a
 *      fourth, pick again — and the first three are silently gone. On a phone,
 *      where the picker shows a handful of thumbnails at a time, that is the
 *      normal way to use it. Picks now accumulate.
 *
 *   2. ONE Before/After RADIO FOR THE WHOLE BATCH. A med spa visit produces
 *      before AND after photos, and pose_key is what drives the comparison
 *      view — so uploading both in one note labelled them all the same and
 *      quietly broke the thing the photos exist for. Each photo carries its
 *      own label now.
 *
 * Making multi-select "easy" without the second fix would have made the data
 * worse: more photos, all mislabelled.
 *
 * ===========================================================================
 * SHRINKING, AND WHY IT NEVER BLOCKS A SAVE
 * ===========================================================================
 * Each image is drawn to a canvas at a sane maximum edge and re-encoded as
 * JPEG. A 4MB phone photo lands around 300KB — verified in a browser at 78%
 * smaller — which is what stopped "Body exceeded 1 MB limit" from killing the
 * whole note. It solves HEIC for free: Safari decodes it and what comes out is
 * an ordinary JPEG.
 *
 * If the canvas fails, the browser is old, or a file is not really an image,
 * the original goes as chosen. Losing a clinical note because an optimisation
 * threw would be worse than the bug it fixes.
 */

import { useEffect, useRef, useState } from 'react';

const MAX_EDGE = 1800;
const QUALITY = 0.82;
const SKIP_UNDER = 400 * 1024;

type Pose = 'before' | 'after';
type Picked = { file: File; url: string; pose: Pose; key: string };

function readAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    img.src = url;
  });
}

async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= SKIP_UNDER) return file;

  const img = await readAsImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', QUALITY));
  if (!blob || blob.size >= file.size) return file;

  const name = file.name.replace(/\.(heic|heif|png|webp|jpe?g)$/i, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
}

export function PhotoInput({ name = 'photos' }: { name?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ before: number; after: number } | null>(null);

  /**
   * The real <input name="photos"> is written to from state, because a
   * FileList cannot be built any other way. The one the practitioner taps is a
   * separate, throwaway input — so choosing again never clears what is already
   * there.
   */
  useEffect(() => {
    const input = fileRef.current;
    if (!input) return;
    try {
      const dt = new DataTransfer();
      for (const p of picked) dt.items.add(p.file);
      input.files = dt.files;
    } catch {
      // Nothing to do: the form still submits whatever the browser allows.
    }
  }, [picked]);

  // Thumbnails hold object URLs; they leak if nobody lets them go.
  useEffect(() => () => { for (const p of picked) URL.revokeObjectURL(p.url); }, [picked]);

  async function onPick() {
    const input = pickRef.current;
    if (!input?.files?.length) return;

    const chosen = Array.from(input.files);
    setBusy(true);

    const before = chosen.reduce((n, f) => n + f.size, 0);
    const out = await Promise.all(chosen.map(f => shrink(f).catch(() => f)));
    const after = out.reduce((n, f) => n + f.size, 0);

    setPicked(prev => [
      ...prev,
      ...out.map((file, i) => ({
        file,
        url: URL.createObjectURL(file),
        // Defaults to before, because that is the one taken first and the one
        // most often forgotten.
        pose: 'before' as Pose,
        key: `${Date.now()}-${i}-${file.name}`
      }))
    ]);

    setSaved(s => ({ before: (s?.before ?? 0) + before, after: (s?.after ?? 0) + after }));
    setBusy(false);
    // Cleared so picking the SAME photo again still fires a change event.
    input.value = '';
  }

  function remove(key: string) {
    setPicked(prev => {
      const gone = prev.find(p => p.key === key);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter(p => p.key !== key);
    });
  }

  function setPose(key: string, pose: Pose) {
    setPicked(prev => prev.map(p => (p.key === key ? { ...p, pose } : p)));
  }

  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

  return (
    <div className="photo-pick">
      {/* Submitted. Never tapped. */}
      <input ref={fileRef} name={name} type="file" accept="image/*" multiple hidden />
      {/* One value per file, in the same order, read by the save action. */}
      <input type="hidden" name="photo_poses" value={picked.map(p => p.pose).join(',')} />

      {/* Tapped. Never submitted. */}
      <input
        ref={pickRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onPick}
        className="photo-pick-native"
        id="photo-pick-native"
      />
      <label className="btn sm photo-pick-btn" htmlFor="photo-pick-native">
        {picked.length ? 'Add more photos' : 'Choose photos'}
      </label>

      {busy && <small className="photo-status">Preparing photos…</small>}

      {picked.length > 0 && (
        <>
          <ul className="photo-thumbs">
            {picked.map(p => (
              <li className="photo-thumb" key={p.key}>
                <img src={p.url} alt="" />
                <div className="photo-thumb-poses" role="group" aria-label="Before or after">
                  {(['before', 'after'] as Pose[]).map(v => (
                    <button
                      key={v}
                      type="button"
                      className={p.pose === v ? 'is-on' : ''}
                      onClick={() => setPose(p.key, v)}
                    >
                      {v === 'before' ? 'Before' : 'After'}
                    </button>
                  ))}
                </div>
                <button type="button" className="photo-thumb-x"
                        onClick={() => remove(p.key)} aria-label="Remove this photo">
                  &times;
                </button>
              </li>
            ))}
          </ul>

          {saved && saved.after < saved.before && (
            <small className="photo-status">
              {picked.length} photo{picked.length === 1 ? '' : 's'} ready — {mb(saved.before)}MB
              {' '}down to {mb(saved.after)}MB.
            </small>
          )}
        </>
      )}
    </div>
  );
}
