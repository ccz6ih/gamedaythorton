import { getClinic } from '@/lib/db/queries';
import { serverClient } from '@/lib/supabase/server';
import { createInventoryItem, receiveLot, adjustLot } from './actions';
import { dateLabel, daysUntil, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function InventoryPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const feedback = await searchParams;
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;
  const supabase = await serverClient();
  const [{ data: items }, { data: lots }] = await Promise.all([
    supabase.from('inventory_item').select('*').eq('clinic_id', clinic.id).eq('active', true).order('name'),
    supabase.from('inventory_lot').select('*, item:item_id ( name, unit, unit_label, reorder_threshold )').eq('clinic_id', clinic.id).order('expiry_date', { ascending: true })
  ]);
  const rows = lots ?? [];
  const low = rows.filter(l => Number(l.qty_remaining) <= Number((l.item as Record<string, unknown> | null)?.reorder_threshold ?? 0));
  const expiring = rows.filter(l => { const d = daysUntil(l.expiry_date); return d !== null && d <= 60 && d >= 0 && Number(l.qty_remaining) > 0; });

  return (
    <>
      <header className="topbar"><div><div className="crumb">{clinic.name}</div><h1>Inventory &amp; lots</h1></div><div className="spacer" /></header>
      <div className="view wide">
        {feedback.saved && <div className="note-band" style={{ marginBottom: 'var(--gd-5)' }}>Inventory {feedback.saved} recorded.</div>}
        {feedback.error && <div className="note-band critical" style={{ marginBottom: 'var(--gd-5)' }}>{feedback.error}</div>}
        <div className="grid g4"><div className="stat"><div className="lab">Items</div><div className="stat-val">{items?.length ?? 0}</div></div><div className="stat"><div className="lab">Active lots</div><div className="stat-val">{rows.filter(l => Number(l.qty_remaining) > 0).length}</div></div><div className="stat" style={low.length ? { borderColor: 'var(--gd-below)' } : undefined}><div className="lab">At reorder level</div><div className="stat-val">{low.length}</div></div><div className="stat" style={expiring.length ? { borderColor: 'var(--gd-below)' } : undefined}><div className="lab">Expiring soon</div><div className="stat-val">{expiring.length}</div></div></div>
        <div className="grid g2" style={{ marginTop: 'var(--gd-5)' }}>
          <section className="card"><div className="card-head"><div><div className="eyebrow">Setup</div><h2>Add an item</h2><p>Create the reusable product record before receiving a lot.</p></div></div><form action={createInventoryItem} className="stack"><div className="field"><label htmlFor="name">Item name</label><input id="name" name="name" required placeholder="e.g. Jeuveau" /></div><div className="grid g2"><div className="field"><label htmlFor="category">Category</label><input id="category" name="category" placeholder="Injectable" /></div><div className="field"><label htmlFor="unit">Container unit</label><input id="unit" name="unit" required placeholder="vial" /></div></div><div className="grid g2"><div className="field"><label htmlFor="unit_label">Treatment unit</label><input id="unit_label" name="unit_label" placeholder="unit" /></div><div className="field"><label htmlFor="reorder_threshold">Reorder at</label><input id="reorder_threshold" name="reorder_threshold" type="number" step="any" min="0" defaultValue="0" /></div></div><button className="btn primary" type="submit">Add item</button></form></section>
          <section className="card"><div className="card-head"><div><div className="eyebrow">Receiving</div><h2>Receive a lot</h2><p>Every lot gets its own expiry and remaining quantity.</p></div></div><form action={receiveLot} className="stack"><div className="field"><label htmlFor="item_id">Item</label><select id="item_id" name="item_id" required><option value="">Choose…</option>{(items ?? []).map(i => <option value={i.id} key={i.id}>{i.name}</option>)}</select></div><div className="grid g2"><div className="field"><label htmlFor="lot_number">Lot number</label><input id="lot_number" name="lot_number" required /></div><div className="field"><label htmlFor="qty_received">Quantity</label><input id="qty_received" name="qty_received" type="number" min="0.01" step="any" required /></div></div><div className="grid g2"><div className="field"><label htmlFor="received_at">Received on</label><input id="received_at" name="received_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div><div className="field"><label htmlFor="expiry_date">Expires</label><input id="expiry_date" name="expiry_date" type="date" /></div></div><div className="field"><label htmlFor="note">Note</label><input id="note" name="note" /></div><button className="btn primary" type="submit">Receive lot</button></form></section>
        </div>
        <section className="card flush" style={{ marginTop: 'var(--gd-5)' }}><div className="card-head"><div><div className="eyebrow">Stock ledger</div><h2>Lots on hand</h2><p>Adjustments are recorded separately so the stock history remains explainable.</p></div></div><div className="table-scroll"><table><thead><tr><th>Item</th><th>Lot</th><th className="num">Remaining</th><th>Expires</th><th>Adjust</th></tr></thead><tbody>{rows.map(l => { const item = l.item as Record<string, unknown> | null; const days = daysUntil(l.expiry_date); return <tr key={l.id}><td><b>{String(item?.name ?? 'Item')}</b><br /><span className="muted">{String(item?.unit_label ?? item?.unit ?? '')}</span></td><td className="mono">{l.lot_number}</td><td className="num">{num(Number(l.qty_remaining), 2)}</td><td className={days !== null && days <= 60 ? 'warnc' : undefined}>{l.expiry_date ? dateLabel(l.expiry_date, 'md') : '—'}</td><td><form action={adjustLot} className="row tight"><input type="hidden" name="lot_id" value={l.id} /><input name="quantity" type="number" min="0.01" max={l.qty_remaining} step="any" placeholder="qty" aria-label={`Quantity to adjust for lot ${l.lot_number}`} style={{ width: '5rem' }} /><select name="type" aria-label="Adjustment type"><option value="wasted">Wasted</option><option value="expired">Expired</option><option value="adjusted">Correction</option></select><button className="btn sm" type="submit">Save</button></form></td></tr>; })}</tbody></table></div></section>
      </div>
    </>
  );
}
