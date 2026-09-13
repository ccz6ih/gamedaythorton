'use client';

/**
 * components/ChargeBuilder.tsx
 * Building a charge line by line.
 *
 * WHAT THIS IS FOR, in the practitioner's words: "it's different from what I
 * offer", or "they get a discount".
 *
 * So the two things that have to be effortless are typing an amount that is not
 * on the menu, and knocking money off one that is. Picking from the menu fills
 * in a name and a price and then LETS YOU CHANGE BOTH — a picker that locks the
 * price would leave her back where she started.
 *
 * The total is computed here and again in the database, and the database wins.
 * What is shown updates as she types so the number she quotes out loud is the
 * number on the screen.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { raiseCharge, type ChargeResult } from '@/app/console/charge/actions';

type Catalogue = {
  id: string;
  name: string;
  cents: number | null;
  kind: 'service' | 'product';
};

type Client = { id: string; name: string; email: string | null; phone: string | null };

type Line = {
  key: string;
  name: string;
  dollars: string;
  qty: number;
  discountDollars: string;
  productId: string | null;
};

const money = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Dollars typed by a person to whole cents. "12.5" and "$12.50" both work. */
function toCents(value: string): number {
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

let seq = 0;
const blank = (): Line => ({
  key: `l${++seq}`, name: '', dollars: '', qty: 1, discountDollars: '', productId: null
});

export function ChargeBuilder({
  catalogue, clients, taxBps, stripeReady
}: {
  catalogue: Catalogue[];
  clients: Client[];
  taxBps: number;
  stripeReady: boolean;
}) {
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountNote, setDiscountNote] = useState('');
  const [taxable, setTaxable] = useState(true);
  const [note, setNote] = useState('');
  const [settle, setSettle] = useState<'link' | 'in_person'>(stripeReady ? 'link' : 'in_person');
  const [method, setMethod] = useState('card reader');

  const [result, setResult] = useState<ChargeResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (sum, l) => sum + Math.max(0, toCents(l.dollars) * l.qty - toCents(l.discountDollars)), 0);
    const afterDiscount = Math.max(0, subtotal - toCents(discount));
    const tax = taxable ? Math.round((afterDiscount * taxBps) / 10000) : 0;
    return { subtotal, afterDiscount, tax, total: afterDiscount + tax };
  }, [lines, discount, taxable, taxBps]);

  function setLine(key: string, patch: Partial<Line>) {
    setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)));
  }

  /** Picking from the menu fills the line in; both fields stay editable. */
  function pick(key: string, id: string) {
    const item = catalogue.find(c => c.id === id);
    if (!item) return setLine(key, { productId: null });
    setLine(key, {
      name: item.name,
      dollars: item.cents != null ? (item.cents / 100).toFixed(2) : '',
      productId: item.kind === 'product' ? item.id : null
    });
  }

  function pickClient(id: string) {
    setClientId(id);
    const c = clients.find(x => x.id === id);
    if (!c) return;
    setName(c.name);
    if (c.email) setEmail(c.email);
    if (c.phone) setPhone(c.phone);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    const usable = lines.filter(l => l.name.trim() && toCents(l.dollars) > 0);
    if (usable.length === 0) {
      setResult({ ok: false, error: 'Add at least one line with a description and an amount.' });
      return;
    }

    startTransition(async () => {
      const r = await raiseCharge({
        lines: usable.map(l => ({
          name: l.name.trim(),
          amountCents: toCents(l.dollars),
          qty: l.qty,
          discountCents: toCents(l.discountDollars),
          productId: l.productId
        })),
        name, email, phone: phone || undefined,
        patientId: clientId || null,
        discountCents: toCents(discount),
        discountNote: discountNote || undefined,
        taxable,
        note: note || undefined,
        settle,
        method,
        origin: window.location.origin
      });

      setResult(r);
      if (r.ok) {
        setLines([blank()]);
        setDiscount(''); setDiscountNote(''); setNote('');
        router.refresh();
      }
    });
  }

  /* ------------------------------------------------------------- done -- */
  if (result?.ok) {
    return (
      <div className="card">
        <div className="card-body">
          <h2 style={{ marginTop: 0 }}>Charge {result.orderNo} raised</h2>

          {result.paid && (
            <p>Recorded as paid. It is on the <a href="/console/orders">shop orders</a> screen.</p>
          )}

          {result.url && (
            <>
              <p>Send this to them, or open it on your own device to take the card:</p>
              <div className="charge-link">
                <input readOnly value={result.url} onFocus={e => e.currentTarget.select()} />
                <button type="button" className="btn sm"
                        onClick={() => navigator.clipboard?.writeText(result.url!)}>
                  Copy
                </button>
                <a className="btn sm primary" href={result.url} target="_blank" rel="noreferrer">Open</a>
              </div>
              <p className="dim" style={{ fontSize: '.8rem' }}>
                The link stays good for seven days. Nothing is recorded as paid
                until the payment actually goes through.
              </p>
            </>
          )}

          <button type="button" className="btn" onClick={() => setResult(null)}>
            Raise another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      {/* ------------------------------------------------------- who -- */}
      <section className="card">
        <header className="card-head"><h2 style={{ margin: 0 }}>Who</h2></header>
        <div className="card-body">
          <div className="grid g2">
            <label className="field">
              <span>Existing client</span>
              <select value={clientId} onChange={e => pickClient(e.target.value)}>
                <option value="">— someone not on the books —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={e => setName(e.target.value)} required />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              <small>The receipt and the payment link go here.</small>
            </label>
            <label className="field">
              <span>Phone <em>(optional)</em></span>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            </label>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ what -- */}
      <section className="card" style={{ marginTop: 'var(--gd-5)' }}>
        <header className="card-head">
          <h2 style={{ margin: 0 }}>What for</h2>
          <div className="spacer" />
          <button type="button" className="btn sm" onClick={() => setLines(ls => [...ls, blank()])}>
            Add line
          </button>
        </header>

        <div className="card-body">
          {lines.map((l, i) => (
            <div className="charge-line" key={l.key}>
              <label className="field">
                <span>From the menu <em>(optional)</em></span>
                <select value="" onChange={e => pick(l.key, e.target.value)}>
                  <option value="">— pick to fill in, then edit —</option>
                  <optgroup label="Services">
                    {catalogue.filter(c => c.kind === 'service').map(c =>
                      <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                  <optgroup label="Products">
                    {catalogue.filter(c => c.kind === 'product').map(c =>
                      <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                </select>
              </label>

              <label className="field grow">
                <span>Description</span>
                <input value={l.name} onChange={e => setLine(l.key, { name: e.target.value })}
                       placeholder="e.g. Extra area, touch-up" />
              </label>

              <label className="field narrow">
                <span>Amount</span>
                <input inputMode="decimal" value={l.dollars}
                       onChange={e => setLine(l.key, { dollars: e.target.value })}
                       placeholder="0.00" />
              </label>

              <label className="field tiny">
                <span>Qty</span>
                <input type="number" min={1} max={99} value={l.qty}
                       onChange={e => setLine(l.key, { qty: Math.max(1, Number(e.target.value) || 1) })} />
              </label>

              <label className="field narrow">
                <span>Less</span>
                <input inputMode="decimal" value={l.discountDollars}
                       onChange={e => setLine(l.key, { discountDollars: e.target.value })}
                       placeholder="0.00" />
              </label>

              <div className="charge-line-total">
                {money(Math.max(0, toCents(l.dollars) * l.qty - toCents(l.discountDollars)))}
                {lines.length > 1 && (
                  <button type="button" className="linkish"
                          onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))}
                          aria-label={`Remove line ${i + 1}`}>remove</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------- how much -- */}
      <section className="card" style={{ marginTop: 'var(--gd-5)' }}>
        <header className="card-head"><h2 style={{ margin: 0 }}>Total</h2></header>
        <div className="card-body">
          <div className="grid g2">
            <label className="field">
              <span>Discount off the whole charge</span>
              <input inputMode="decimal" value={discount}
                     onChange={e => setDiscount(e.target.value)} placeholder="0.00" />
            </label>
            <label className="field">
              <span>Why <em>(worth recording)</em></span>
              <input value={discountNote} onChange={e => setDiscountNote(e.target.value)}
                     placeholder="Friends and family" />
            </label>
          </div>

          <label className="inline" style={{ marginTop: '.5rem' }}>
            <input type="checkbox" checked={taxable} onChange={e => setTaxable(e.target.checked)} />
            {' '}Add sales tax{taxBps > 0 ? ` (${(taxBps / 100).toFixed(2)}%)` : ''}
          </label>
          {taxBps === 0 && taxable && (
            <p className="dim" style={{ fontSize: '.78rem' }}>
              No tax rate is set for the practice, so nothing will be added.
            </p>
          )}

          <dl className="charge-totals">
            <div><dt>Lines</dt><dd>{money(totals.subtotal)}</dd></div>
            {toCents(discount) > 0 && (
              <div><dt>Discount</dt><dd>&minus;{money(toCents(discount))}</dd></div>
            )}
            {totals.tax > 0 && <div><dt>Sales tax</dt><dd>{money(totals.tax)}</dd></div>}
            <div className="grand"><dt>Total</dt><dd>{money(totals.total)}</dd></div>
          </dl>

          <label className="field">
            <span>Note on the charge <em>(optional)</em></span>
            <input value={note} onChange={e => setNote(e.target.value)} />
          </label>
        </div>
      </section>

      {/* ----------------------------------------------------- settle -- */}
      <section className="card" style={{ marginTop: 'var(--gd-5)' }}>
        <header className="card-head"><h2 style={{ margin: 0 }}>How they pay</h2></header>
        <div className="card-body">
          <label className="inline" style={{ display: 'flex', marginBottom: '.5rem' }}>
            <input type="radio" name="settle" checked={settle === 'link'}
                   disabled={!stripeReady}
                   onChange={() => setSettle('link')} />
            {' '}Send a payment link
            {!stripeReady && <span className="dim"> — card payment is not configured yet</span>}
          </label>

          <label className="inline" style={{ display: 'flex' }}>
            <input type="radio" name="settle" checked={settle === 'in_person'}
                   onChange={() => setSettle('in_person')} />
            {' '}Already paid, in the room
          </label>

          {settle === 'in_person' && (
            <label className="field" style={{ maxWidth: '18rem', marginTop: '.5rem' }}>
              <span>How</span>
              <select value={method} onChange={e => setMethod(e.target.value)}>
                <option value="card reader">Card reader</option>
                <option value="cash">Cash</option>
                <option value="transfer">Bank transfer</option>
                <option value="other">Other</option>
              </select>
              <small>Recorded so the takings add up, even though it did not go through Stripe.</small>
            </label>
          )}

          {result && !result.ok && <p className="err" role="alert">{result.error}</p>}

          <button className="btn primary" type="submit" disabled={pending}
                  style={{ marginTop: 'var(--gd-4)' }}>
            {pending ? 'Working…'
              : settle === 'link' ? `Create a link for ${money(totals.total)}`
              : `Record ${money(totals.total)} as paid`}
          </button>
        </div>
      </section>
    </form>
  );
}
