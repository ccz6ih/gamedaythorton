'use client';

/**
 * components/PhotoInput.tsx
 * Shrinks photos in the browser before they are submitted.
 *
 * ===========================================================================
 * WHY THIS EXISTS
 * ===========================================================================
 * Jamie tried to save a treatment note with photos from her phone and got
 * "Application error: a server-side exception has occurred". The real error,
 * from the logs, was:
 *
 *     Error: Body exceeded 1 MB limit.   digest 1693395248   413
 *
 * Server Actions cap the request body at 1MB by default, and a single iPhone
 * photo is 2–5MB. So the note never reached the database — and the app's own
 * friendly "that photo is 6.2MB and the limit is 15MB" message could never
 * fire, because the request was rejected a layer above it.
 *
 * Raising the limit alone would be the lazy half of the fix. A practitioner on
 * clinic wifi between clients does not want to upload 15MB of camera JPEG to
 * store a before-and-after, and the server does not want to hold it in memory.
 *
 * ===========================================================================
 * WHAT IT DOES
 * ===========================================================================
 * Decodes each image, draws it onto a canvas at a sane maximum edge, and
 * re-encodes as JPEG. A 4MB phone photo lands around 250–400KB with no visible
 * difference at the size these are ever viewed.
 *
 * It also solves HEIC for free. iOS hands over .heic files that most tooling
 * cannot read; Safari decodes them natively into a canvas, and what comes out
 * the other side is an ordinary JPEG.
 *
 * ===========================================================================
 * IT NEVER BLOCKS THE SAVE
 * ===========================================================================
 * If the canvas fails, the browser is old, or a file is not really an image,
 * the originals are left exactly as chosen and the raised body limit catches
 * them. Compression is an optimisation; losing a clinical note because an
 * optimisation threw would be a far worse bug than the one it fixes.
 */

import { useRef, useState } from 'react';

/** Long edge in pixels. Clinical before-and-afters are viewed on a phone or a
 *  laptop, never printed, so beyond this is bytes nobody sees. */
const MAX_EDGE = 1800;
const QUALITY = 0.82;

/** Anything already small enough is left alone rather than re-encoded. */
const SKIP_UNDER = 400 * 1024;

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
  if (!blob || blob.size >= file.size) return file;   // no gain, keep the original

  const name = file.name.replace(/\.(heic|heif|png|webp|jpe?g)$/i, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
}

export function PhotoInput({ name = 'photos' }: { name?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onChange() {
    const input = ref.current;
    if (!input?.files?.length) { setStatus(null); return; }

    const chosen = Array.from(input.files);
    setStatus(chosen.length === 1 ? 'Preparing photo…' : `Preparing ${chosen.length} photos…`);

    try {
      const out = await Promise.all(chosen.map(f => shrink(f).catch(() => f)));

      /**
       * Writing back to input.files needs a DataTransfer — it is the only way
       * to construct a FileList. Supported everywhere this runs, and wrapped
       * anyway: if it throws, the originals are still on the input and the
       * save proceeds.
       */
      const dt = new DataTransfer();
      for (const f of out) dt.items.add(f);
      input.files = dt.files;

      const before = chosen.reduce((n, f) => n + f.size, 0);
      const after = out.reduce((n, f) => n + f.size, 0);
      const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

      setStatus(
        after < before
          ? `Ready — ${out.length} photo${out.length === 1 ? '' : 's'}, ${mb(before)}MB down to ${mb(after)}MB.`
          : `Ready — ${out.length} photo${out.length === 1 ? '' : 's'}.`
      );
    } catch {
      setStatus(`Ready — ${chosen.length} photo${chosen.length === 1 ? '' : 's'}.`);
    }
  }

  return (
    <>
      <input
        ref={ref}
        name={name}
        type="file"
        accept="image/*"
        multiple
        onChange={onChange}
      />
      {status && <small className="photo-status">{status}</small>}
    </>
  );
}
