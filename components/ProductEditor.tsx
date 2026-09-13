'use client';

/**
 * components/ProductEditor.tsx
 * Writing the shop's product copy, all of it, in one sitting.
 *
 * The screen is a list rather than eighteen detail pages because the actual job
 * is "fill in the descriptions", done once. Eighteen navigations is how that job
 * gets abandoned at number four.
 *
 * WHAT IT COUNTS AND SHOWS
 *
 * The number still missing a description, at the top, all the time. A list of
 * eighteen rows where some are done is otherwise impossible to make progress
 * against — you lose your place, and there is no sense of the end.
 *
 * Unsaved changes are marked per row and the save button says how many. The
 * alternative, saving on blur, means a half-typed sentence becomes live copy on
 * a public shop the moment somebody clicks away.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveProducts, type ProductEdit } from '@/app/console/products/actions';

export type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  slug: string | null;
  description: string | null;
  details: string | null;
  price_cents: number;
  online: boolean;
  image_path: string | null;
  imageCount: number;
};

export function ProductEditor({ products, shopBase }: { products: ProductRow[]; shopBase: string }) {
  const [edits, setEdits] = useState<Record<string, ProductEdit>>(() =>
    Object.fromEntries(products.map(p => [p.id, {
      id: p.id,
      description: p.description ?? '',
      details: p.details ?? '',
      priceDollars: (p.price_cents / 100).toFixed(2),
      online: p.online
    }]))
  );
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const original = useMemo(() =>
    Object.fromEntries(products.map(p => [p.id, {
      description: p.description ?? '',
      details: p.details ?? '',
      priceDollars: (p.price_cents / 100).toFixed(2),
      online: p.online
    }])), [products]);

  const dirty = useMemo(() =>
    new Set(products
      .filter(p => {
        const e = edits[p.id], o = original[p.id];
        if (!e || !o) return false;
        return e.description !== o.description || e.details !== o.details
          || e.priceDollars !== o.priceDollars || e.online !== o.online;
      })
      .map(p => p.id)), [edits, original, products]);

  const missing = products.filter(p => !(edits[p.id]?.description ?? '').trim()).length;

  function set(id: string, patch: Partial<ProductEdit>) {
    setEdits(e => ({ ...e, [id]: { ...e[id]!, ...patch } }));
    setSaved(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveProducts(products.map(p => edits[p.id]!));
      if (result.ok) { setSaved(result.changed); router.refresh(); }
      else setError(result.error);
    });
  }

  return (
    <>
      <div className="product-bar">
        <div>
          <b>{products.length}</b> products ·{' '}
          {missing > 0
            ? <><b>{missing}</b> still need a description</>
            : <>every one has a description</>}
        </div>
        <div className="spacer" />
        {saved !== null && (
          <span className="pill" data-tone="ok">
            {saved === 0 ? 'Nothing had changed' : `${saved} saved`}
          </span>
        )}
        <button className="btn primary" onClick={save} disabled={pending || dirty.size === 0}>
          {pending ? 'Saving…' : dirty.size === 0 ? 'Saved' : `Save ${dirty.size} change${dirty.size === 1 ? '' : 's'}`}
        </button>
      </div>

      {error && <p className="err" role="alert">{error}</p>}

      <p className="muted" style={{ maxWidth: '48rem' }}>
        Green Envee publishes its own product copy for stockists — it is written
        to be compliant and it is the right thing to paste in here. Anything
        written from scratch about what a product does to skin is a claim
        somebody has to be able to stand behind.
      </p>

      {products.map(p => {
        const e = edits[p.id]!;
        return (
          <section className={`card product-row${dirty.has(p.id) ? ' is-dirty' : ''}`} key={p.id}>
            <div className="card-body product-row-body">
              <div className="product-row-img">
                {p.image_path
                  ? <img src={p.image_path} alt="" />
                  : <span aria-hidden="true">{p.name.slice(0, 1)}</span>}
                <div className="dim" style={{ fontSize: '.68rem', textAlign: 'center' }}>
                  {p.imageCount === 0 ? 'no photo' : `${p.imageCount} photo${p.imageCount === 1 ? '' : 's'}`}
                </div>
              </div>

              <div className="product-row-main">
                <div className="product-row-head">
                  <div>
                    {p.brand && <div className="lab">{p.brand}</div>}
                    <b>{p.name}</b>
                    {dirty.has(p.id) && <span className="pill" data-tone="warn" style={{ marginLeft: '.5rem' }}>unsaved</span>}
                  </div>
                  <div className="spacer" />
                  {p.slug && (
                    <a className="btn ghost sm" href={`${shopBase}/${p.slug}`} target="_blank" rel="noreferrer">
                      View
                    </a>
                  )}
                </div>

                <label className="field">
                  <span>Description <em>(shown in the shop and on its page)</em></span>
                  <textarea
                    rows={3}
                    value={e.description}
                    onChange={ev => set(p.id, { description: ev.target.value })}
                    placeholder="What it is and who it suits. Paste the supplier's copy."
                  />
                </label>

                <label className="field">
                  <span>Details <em>(optional — how to use it, what is in it)</em></span>
                  <textarea
                    rows={2}
                    value={e.details}
                    onChange={ev => set(p.id, { details: ev.target.value })}
                  />
                </label>

                <div className="product-row-foot">
                  <label className="field narrow">
                    <span>Price</span>
                    <input
                      inputMode="decimal"
                      value={e.priceDollars}
                      onChange={ev => set(p.id, { priceDollars: ev.target.value })}
                    />
                  </label>
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={e.online}
                      onChange={ev => set(p.id, { online: ev.target.checked })}
                    />
                    {' '}In the online shop
                  </label>
                </div>
              </div>
            </div>
          </section>
        );
      })}

      <div className="product-bar bottom">
        <div className="spacer" />
        <button className="btn primary" onClick={save} disabled={pending || dirty.size === 0}>
          {pending ? 'Saving…' : dirty.size === 0 ? 'Saved' : `Save ${dirty.size} change${dirty.size === 1 ? '' : 's'}`}
        </button>
      </div>
    </>
  );
}
