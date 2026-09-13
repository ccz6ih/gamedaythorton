'use client';

/**
 * components/ClientPhoto.tsx
 * The client's face on their chart.
 *
 * WHY THIS IS WORTH A COMPONENT
 *
 * A practice with thirty-five clients sees some of them twice a year. Knowing
 * who walked through the door before they say their name is the difference
 * between a practice that feels personal and one that feels like a queue, and
 * it is the single most-requested thing in software like this.
 *
 * The upload is deliberately quiet: click the picture, choose a file, done. No
 * separate screen, no save button. It replaces the previous photo and deletes
 * the old file, because keeping every version of somebody's face is storing
 * more of them than the job needs.
 *
 * Falls back to initials, which is what most clients will have. The empty state
 * is the normal state and should not look broken.
 */

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setClientPhoto } from '@/app/console/clients/[id]/actions';

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');
}

export function ClientPhoto({
  patientId, name, url
}: {
  patientId: string;
  name: string;
  url: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function chosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const fd = new FormData();
    fd.set('photo', file);

    startTransition(async () => {
      const result = await setClientPhoto(patientId, fd);
      if (result.ok) router.refresh();
      else setError(result.error);
      if (input.current) input.current.value = '';
    });
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <button
        type="button"
        className="client-photo"
        onClick={() => input.current?.click()}
        disabled={pending}
        title={url ? 'Replace photo' : 'Add a photo'}
        aria-label={url ? `Replace photo of ${name}` : `Add a photo of ${name}`}
      >
        {url
          ? <img src={url} alt="" />
          : <span className="client-photo-initials" aria-hidden="true">{initialsOf(name)}</span>}
        <span className="client-photo-hint">{pending ? 'Uploading…' : url ? 'Replace' : 'Add photo'}</span>
      </button>

      <input
        ref={input}
        type="file"
        accept="image/*"
        onChange={chosen}
        hidden
      />

      {error && <p className="err" style={{ fontSize: '.75rem', maxWidth: '10rem' }} role="alert">{error}</p>}
    </div>
  );
}
