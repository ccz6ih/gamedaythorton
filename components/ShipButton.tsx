'use client';

/**
 * components/ShipButton.tsx
 * Records a dispatch: who carried it, under what reference, and emails the
 * customer that it has gone.
 *
 * ===========================================================================
 * WHY THIS IS NOT JUST A SECOND "MARK SENT" BUTTON
 * ===========================================================================
 * CollectButton answers "has this left the building". That is the whole
 * question for a collection, and it was the only question the system could
 * ask, which is why a posted parcel ended up marked `collected` — a word
 * nobody would use about something that went in the mail.
 *
 * A posted parcel has two more facts attached: who is carrying it and under
 * what number. Without them the practice cannot answer "where is it", and
 * neither can the customer, so the question comes back as a phone call.
 *
 * ===========================================================================
 * BOTH FIELDS ARE OPTIONAL, ON PURPOSE
 * ===========================================================================
 * Jamie hand-delivers things. A form that insists on a tracking number for a
 * parcel she is dropping off herself teaches people to type "n/a", and then
 * the column holds "n/a" forever. Empty is stored as null and the email
 * simply omits the line.
 */

import { useState, useTransition } from 'react';
import { markShipped } from '@/app/console/orders/actions';

export function ShipButton({ orderId, orderNo }: { orderId: string; orderNo: string }) {
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (said && !failed) {
    return <span className="muted" role="status">{said}</span>;
  }

  if (!open) {
    return (
      <span className="row tight">
        <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
          Mark posted…
        </button>
        {said && failed && (
          <span className="muted" role="alert" style={{ color: 'var(--gd-critical)' }}>{said}</span>
        )}
      </span>
    );
  }

  return (
    <div className="stack" style={{ gap: 'var(--gd-2)', width: '100%' }}>
      <div className="row tight">
        <input
          type="text" value={carrier} onChange={e => setCarrier(e.target.value)}
          placeholder="Carrier (USPS, UPS…)" aria-label={`Carrier for ${orderNo}`}
          style={{ maxWidth: '12rem' }}
        />
        <input
          type="text" value={tracking} onChange={e => setTracking(e.target.value)}
          placeholder="Tracking number" aria-label={`Tracking number for ${orderNo}`}
          style={{ maxWidth: '14rem' }}
        />
      </div>
      <div className="row tight">
        <button
          type="button" className="btn primary sm" disabled={pending}
          onClick={() => {
            setSaid(null); setFailed(false);
            startTransition(async () => {
              const r = await markShipped(orderId, carrier, tracking);
              if (r.ok) { setSaid(r.detail); setFailed(false); setOpen(false); }
              else { setSaid(r.error); setFailed(true); }
            });
          }}
        >
          {pending ? 'Saving…' : 'Posted'}
        </button>
        <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </button>
        {/* Said before they commit, not after. Somebody who does not want the
            customer emailed needs to know that before clicking, not from a
            confirmation message afterwards. */}
        <span className="muted">Emails the customer that it is on its way.</span>
      </div>
      {said && failed && (
        <span className="muted" role="alert" style={{ color: 'var(--gd-critical)' }}>{said}</span>
      )}
    </div>
  );
}
