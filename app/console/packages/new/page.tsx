import Link from 'next/link';
import { getClinic, getClients, getPackageCatalogue } from '@/lib/db/queries';
import { sellPackage } from '@/app/console/packages/actions';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function NewPackagePage({
  searchParams
}: {
  searchParams: Promise<{ patient?: string; error?: string }>;
}) {
  const params = await searchParams;
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const [clients, packages] = await Promise.all([getClients(), getPackageCatalogue()]);

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb"><Link href="/console/packages" className="banner-link">Prepaid packages</Link></div>
          <h1>Sell a package</h1>
        </div>
      </header>
      <div className="view narrow">
        {params.error && <div className="note-band critical" style={{ marginBottom: 'var(--gd-5)' }}>{params.error}</div>}
        <form action={sellPackage}>
          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">New prepaid balance</div>
                <h2>Choose the client and package</h2>
                <p>This records the package and its payment together. The client owes the sessions until they are redeemed.</p>
              </div>
            </div>
            <div className="stack">
              <div className="field">
                <label htmlFor="patient_id">Client</label>
                <select id="patient_id" name="patient_id" required defaultValue={params.patient ?? ''}>
                  <option value="">Choose…</option>
                  {clients.map(c => <option value={c.id} key={c.id}>{c.last_name}, {c.first_name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="package_id">Package</label>
                <select id="package_id" name="package_id" required>
                  <option value="">Choose…</option>
                  {packages.map((p: Record<string, unknown>) => (
                    <option value={String(p.id)} key={String(p.id)}>
                      {String(p.name)} — {String(p.sessions)} sessions, {money(Number(p.price_cents))}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="processor">Payment method</label>
                <select id="processor" name="processor" defaultValue="manual">
                  <option value="manual">Manual / card reader</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                </select>
                <div className="hint">This is a staff-side record. No clinical details are sent to a payment processor.</div>
              </div>
            </div>
          </section>
          <div className="actions"><button className="btn primary" type="submit">Record package sale</button></div>
        </form>
      </div>
    </>
  );
}
