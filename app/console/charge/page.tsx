/**
 * app/console/charge/page.tsx — take a payment for anything.
 *
 * The screen that exists because real practice does not fit a menu. A treatment
 * runs long and there is an extra area; a friend gets the friends-and-family
 * price; somebody pays a deposit toward a series not yet decided; the last jar
 * has a dented box.
 *
 * Without this the practitioner takes the money on a card reader or in cash and
 * the system's record of what the business earned quietly stops being true —
 * which is worse than any untidiness the feature introduces.
 */

import { getClinic } from '@/lib/db/queries';
import { serverClient } from '@/lib/supabase/server';
import { shopTaxBps } from '@/lib/db/shop';
import { stripeConfigured } from '@/lib/stripe';
import { ChargeBuilder } from '@/components/ChargeBuilder';

export const dynamic = 'force-dynamic';

export default async function ChargePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const supabase = await serverClient();

  const [{ data: services }, { data: products }, { data: clients }, taxBps] = await Promise.all([
    supabase.from('service').select('id, name, price_cents')
      .eq('clinic_id', clinic.id).eq('active', true).order('name'),
    supabase.from('product').select('id, name, price_cents')
      .eq('clinic_id', clinic.id).eq('active', true).order('name'),
    supabase.from('patient').select('id, first_name, last_name, email, phone')
      .order('last_name').limit(500),
    shopTaxBps(clinic.id)
  ]);

  const catalogue = [
    ...(services ?? []).map(s => ({
      id: String(s.id), name: String(s.name),
      cents: s.price_cents == null ? null : Number(s.price_cents),
      kind: 'service' as const
    })),
    ...(products ?? []).map(p => ({
      id: String(p.id), name: String(p.name),
      cents: p.price_cents == null ? null : Number(p.price_cents),
      kind: 'product' as const
    }))
  ];

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{clinic.name}</div>
          <h1>Take a payment</h1>
        </div>
      </header>

      <div className="view">
        {q.cancelled && (
          <p className="note-band warn">
            Charge <b>{String(q.cancelled)}</b> was not paid — the payment page was
            closed. It is still waiting on the shop orders screen, and the link
            works until it expires.
          </p>
        )}

        <p className="muted" style={{ maxWidth: '46rem' }}>
          For anything that is not on the menu, or is on the menu at a different
          price. Pick an item to fill a line in, then change the description or
          the amount to whatever it actually is.
        </p>

        <ChargeBuilder
          catalogue={catalogue}
          clients={(clients ?? []).map(c => ({
            id: String(c.id),
            name: `${c.first_name} ${c.last_name}`,
            email: c.email ? String(c.email) : null,
            phone: c.phone ? String(c.phone) : null
          }))}
          taxBps={taxBps}
          stripeReady={stripeConfigured()}
        />
      </div>
    </>
  );
}
