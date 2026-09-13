'use client';

/**
 * components/CollectButton.tsx
 * Marks a paid order as handed over or posted.
 *
 * Asks first. Not because the action is dangerous — it is not, and it can be
 * corrected — but because it is a one-click action on a list of cards where the
 * cards are all the same shape, and the failure mode is marking the wrong
 * person's order as sent and then never seeing it again. The order number in
 * the confirmation is what makes that catchable.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markCollected } from '@/app/console/orders/actions';

export function CollectButton({ orderId, orderNo }: { orderId: string; orderNo: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (error) {
    return (
      <span className="muted" role="alert">
        {error}{' '}
        <button type="button" className="btn ghost sm" onClick={() => setError(null)}>Try again</button>
      </span>
    );
  }

  if (!confirming) {
    return (
      <button type="button" className="btn ghost sm" onClick={() => setConfirming(true)}>
        Mark sent
      </button>
    );
  }

  return (
    <span style={{ display: 'inline-flex', gap: '.5rem', alignItems: 'center' }}>
      <span className="muted">Mark {orderNo} as sent?</span>
      <button
        type="button"
        className="btn primary sm"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await markCollected(orderId);
            if (result.ok) router.refresh();
            else setError(result.error);
          });
        }}
      >
        {pending ? 'Saving…' : 'Yes'}
      </button>
      <button type="button" className="btn ghost sm" disabled={pending}
              onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  );
}
