'use client';

/**
 * components/ResendOrderButton.tsx
 * Sends the order emails again, and says what actually happened.
 *
 * No confirmation step, unlike CollectButton. Sending a duplicate email is
 * recoverable and mildly annoying; marking the wrong order posted is neither.
 * The cost of a mistake decides whether it is worth an extra click, and here
 * it is not.
 *
 * What it does do is report the OUTCOME rather than the attempt. "Sent" is
 * what every button like this says, and it is a guess — the thing worth
 * knowing is whether the customer's copy actually went, which is usually the
 * question being asked on the phone while somebody clicks it.
 */

import { useState, useTransition } from 'react';
import { resendOrderEmails } from '@/app/console/orders/actions';

export function ResendOrderButton({ orderId, orderNo }: { orderId: string; orderNo: string }) {
  const [said, setSaid] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <span className="row tight">
      <button
        type="button"
        className="btn ghost sm"
        disabled={pending}
        onClick={() => {
          setSaid(null);
          setFailed(false);
          startTransition(async () => {
            const r = await resendOrderEmails(orderId);
            if (r.ok) { setSaid(r.detail); setFailed(false); }
            else { setSaid(r.error); setFailed(true); }
          });
        }}
      >
        {pending ? 'Sending…' : 'Resend emails'}
      </button>
      {said && (
        <span
          className="muted"
          role="status"
          style={{ color: failed ? 'var(--gd-critical)' : undefined }}
        >
          {orderNo}: {said}
        </span>
      )}
    </span>
  );
}
