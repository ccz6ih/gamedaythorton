/**
 * app/console/services/[id]/page.tsx
 * Add or edit a service. `id` of "new" creates one.
 *
 * The price-mode choice is the substance of this form. A practice that quotes
 * "from $800" must not be forced to type a single flat number, because the app
 * would then print that number on the booking screen as if it were the price.
 * The database enforces the same rule (service_price_present), so a flat service
 * with no price is rejected rather than silently shown as "$0".
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { getClinic } from '@/lib/db/queries';
import {
  requireRole, pilotFields, text, requiredText, money, int, bool, formMessage
} from '@/lib/actions';
import { uploadBrandImage } from '@/lib/brand-upload';

export const dynamic = 'force-dynamic';

const PRICE_MODES: { value: string; label: string; hint: string }[] = [
  { value: 'flat', label: 'Flat price', hint: 'One fixed price. Needs a price below.' },
  { value: 'from', label: 'From price', hint: 'Shown as "from $X". Use when the price depends on the work.' },
  { value: 'per_unit', label: 'Per unit', hint: 'Shown as "$X+ / unit". Set the unit name below.' },
  { value: 'free', label: 'Complimentary', hint: 'Free, and shown as such. A free consult is a real offer, not a $0.' },
  { value: 'quoted', label: 'Quoted', hint: 'Priced in conversation. Nothing is shown to clients.' }
];

async function save(formData: FormData) {
  'use server';

  const staff = await requireRole(['owner', 'admin', 'provider']);
  const id = String(formData.get('id') ?? 'new');
  const back = id === 'new' ? '/console/services/new' : `/console/services/${id}`;

  try {
    const mode = requiredText(formData, 'price_mode');
    const priceCents = money(formData, 'price_cents');
    const fromCents = money(formData, 'price_from_cents');

    // Caught here as well as by the database, so the person typing gets told what
    // to do rather than seeing a constraint name.
    if (mode === 'flat' && priceCents === null) {
      throw new Error('service_price_present');
    }
    if ((mode === 'from' || mode === 'per_unit') && fromCents === null) {
      throw new Error('service_price_present');
    }

    /**
     * Optional menu image. Three outcomes, kept explicit rather than folded
     * into the row literal: a new upload sets it, "remove" clears it, and doing
     * neither leaves whatever is already there — which matters, because an
     * edit that silently wiped the image every time you changed a price would
     * be maddening and hard to attribute.
     */
    let imagePath: string | null | undefined;
    if (text(formData, 'remove_image') === '1') {
      imagePath = null;
    } else {
      const file = formData.get('image') as File | null;
      const url = file ? await uploadBrandImage(file, staff.clinicId, 'service') : null;
      if (url) imagePath = url;
    }

    const row: Record<string, unknown> = {
      clinic_id: staff.clinicId,
      name: requiredText(formData, 'name'),
      category: requiredText(formData, 'category').toLowerCase(),
      description: text(formData, 'description'),
      duration_min: int(formData, 'duration_min', 30)!,
      buffer_after_min: int(formData, 'buffer_after_min', 0)!,
      price_mode: mode,
      price_cents: mode === 'flat' ? priceCents : mode === 'free' ? 0 : null,
      price_from_cents: mode === 'from' || mode === 'per_unit' ? fromCents : null,
      unit_label: mode === 'per_unit' ? text(formData, 'unit_label') : null,
      requires_consent: bool(formData, 'requires_consent'),
      requires_labs: bool(formData, 'requires_labs'),
      online_bookable: bool(formData, 'online_bookable'),
      is_membership: bool(formData, 'is_membership'),
      deposit_cents: money(formData, 'deposit_cents'),
      // Storefront copy. `details` is the long version behind "What this
      // involves"; needs_copy is cleared automatically once a description
      // exists, so nobody has to remember to untick a box.
      details: text(formData, 'details'),
      needs_copy: !text(formData, 'description'),
      sort_order: int(formData, 'sort_order', 0)!,
      active: bool(formData, 'active')
    };
    if (imagePath !== undefined) row.image_path = imagePath;

    const supabase = await serverClient();
    if (id === 'new') {
      const { error } = await supabase.from('service').insert(row);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('service').update(row).eq('id', id);
      if (error) throw new Error(error.message);
    }
  } catch (err) {
    redirect(`${back}?error=${encodeURIComponent(formMessage(err))}`);
  }

  revalidatePath('/console/services');
  redirect('/console/services?saved=1');
}

/**
 * Permanently removes a service — but only when nothing points at it.
 *
 * A service that has been booked or performed is referenced by appointments and
 * treatment records. Deleting it would either orphan that history or, worse,
 * quietly blank the service name on a past treatment record, which is a
 * clinical record losing information. So history wins: anything with a past
 * gets retired instead, and the form only offers this button when the count is
 * genuinely zero.
 */
async function destroy(formData: FormData) {
  'use server';

  const staff = await requireRole(['owner', 'admin']);
  const id = requiredText(formData, 'id');
  const supabase = await serverClient();

  try {
    const [appts, treatments, packages, items] = await Promise.all([
      supabase.from('appointment').select('id', { count: 'exact', head: true }).eq('service_id', id),
      supabase.from('treatment_record').select('id', { count: 'exact', head: true }).eq('service_id', id),
      supabase.from('service_package').select('id', { count: 'exact', head: true }).eq('service_id', id),
      supabase.from('package_item').select('id', { count: 'exact', head: true }).eq('service_id', id)
    ]);

    const used =
      (appts.count ?? 0) + (treatments.count ?? 0) + (packages.count ?? 0) + (items.count ?? 0);

    if (used > 0) {
      throw new Error(
        `This service is used by ${used} existing record${used === 1 ? '' : 's'}. ` +
        'Retire it instead — untick Active — so the history stays readable.'
      );
    }

    const { error } = await supabase
      .from('service').delete().eq('id', id).eq('clinic_id', staff.clinicId);
    if (error) throw new Error(error.message);
  } catch (err) {
    redirect(`/console/services/${id}?error=${encodeURIComponent(formMessage(err))}`);
  }

  revalidatePath('/console/services');
  redirect('/console/services?deleted=1');
}

export default async function ServiceFormPage({
  params, searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const isNew = id === 'new';
  let service: Record<string, unknown> | null = null;

  if (!isNew) {
    const supabase = await serverClient();
    const { data } = await supabase.from('service').select('*').eq('id', id).maybeSingle();
    if (!data) notFound();
    service = data;
  }

  // Existing categories, so a practice reuses its own grouping rather than
  // inventing a near-duplicate every time.
  const supabase = await serverClient();
  const { data: existing } = await supabase.from('service').select('category');
  const categories = [...new Set((existing ?? []).map(s => String(s.category)))].sort();

  const mode = String(service?.price_mode ?? 'flat');

  // How many records point at this service. Drives whether delete is offered,
  // and — more useful — tells her WHY it is not.
  let usedBy = 0;
  if (!isNew) {
    const [a, t, pk, pi] = await Promise.all([
      supabase.from('appointment').select('id', { count: 'exact', head: true }).eq('service_id', id),
      supabase.from('treatment_record').select('id', { count: 'exact', head: true }).eq('service_id', id),
      supabase.from('service_package').select('id', { count: 'exact', head: true }).eq('service_id', id),
      supabase.from('package_item').select('id', { count: 'exact', head: true }).eq('service_id', id)
    ]);
    usedBy = (a.count ?? 0) + (t.count ?? 0) + (pk.count ?? 0) + (pi.count ?? 0);
  }

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">
            <Link href="/console/services" className="banner-link">Services</Link>
          </div>
          <h1>{isNew ? 'Add a service' : String(service?.name)}</h1>
        </div>
      </header>

      <div className="view narrow">
        {error && <div className="note-band critical" style={{ marginBottom: 'var(--gd-5)' }}>{error}</div>}

        <form action={save} encType="multipart/form-data">
          <input type="hidden" name="id" value={id} />

          <section className="card">
            <div className="card-head"><div><h2>What it is</h2></div></div>

            <div className="stack">
              <div className="field">
                <label htmlFor="name">Name</label>
                <input
                  id="name" name="name" type="text" required
                  defaultValue={String(service?.name ?? '')}
                  placeholder="e.g. PRF Microneedling Treatment"
                />
                <div className="hint">Exactly as a client should see it.</div>
              </div>

              <div className="grid g2">
                <div className="field">
                  <label htmlFor="category">Category</label>
                  <input
                    id="category" name="category" type="text" required list="categories"
                    defaultValue={String(service?.category ?? '')}
                    placeholder="e.g. injectables"
                  />
                  <datalist id="categories">
                    {categories.map(c => <option value={c} key={c} />)}
                  </datalist>
                </div>
                <div className="field">
                  <label htmlFor="duration_min">Minutes</label>
                  <input
                    id="duration_min" name="duration_min" type="number" min="5" step="5" required
                    defaultValue={String(service?.duration_min ?? 60)}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="buffer_after_min">Turnaround after (minutes)</label>
                <input
                  id="buffer_after_min" name="buffer_after_min" type="number" min="0" step="5"
                  defaultValue={String(service?.buffer_after_min ?? 15)}
                />
                <div className="hint">
                  Room reset time. The calendar refuses to book inside it, so a 120-minute
                  treatment cannot be followed immediately by the next one.
                </div>
              </div>

              <div className="field">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description" name="description"
                  defaultValue={String(service?.description ?? '')}
                  placeholder="What it involves, in the words a client would use."
                />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Price</h2>
                <p>Pick how this is priced before typing a number.</p>
              </div>
            </div>

            <div className="field">
              <label>How it is priced</label>
              <div className="stack tight">
                {PRICE_MODES.map(m => (
                  <label className="switch" key={m.value} style={{ alignItems: 'flex-start' }}>
                    <input
                      type="radio" name="price_mode" value={m.value}
                      defaultChecked={mode === m.value} required
                      style={{ position: 'static', width: 'auto', height: 'auto', opacity: 1, marginTop: '.3rem' }}
                    />
                    <span className="txt">
                      <b>{m.label}</b>
                      <br />
                      <span className="dim" style={{ fontSize: '.78rem' }}>{m.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid g3" style={{ marginTop: 'var(--gd-4)' }}>
              <div className="field">
                <label htmlFor="price_cents">Flat price ($)</label>
                <input
                  id="price_cents" name="price_cents" type="text" inputMode="decimal"
                  defaultValue={service?.price_cents ? String(Number(service.price_cents) / 100) : ''}
                  placeholder="175"
                />
              </div>
              <div className="field">
                <label htmlFor="price_from_cents">From / per-unit price ($)</label>
                <input
                  id="price_from_cents" name="price_from_cents" type="text" inputMode="decimal"
                  defaultValue={service?.price_from_cents ? String(Number(service.price_from_cents) / 100) : ''}
                  placeholder="14"
                />
              </div>
              <div className="field">
                <label htmlFor="unit_label">Unit name</label>
                <input
                  id="unit_label" name="unit_label" type="text"
                  defaultValue={String(service?.unit_label ?? '')}
                  placeholder="unit"
                />
                <div className="hint">Only for per-unit.</div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Rules</h2></div></div>
            <div className="stack tight">
              <label className="switch">
                <input type="checkbox" name="online_bookable" defaultChecked={service?.online_bookable !== false} />
                <span className="track" />
                <span className="txt">Clients can book this online</span>
              </label>
              <label className="switch">
                <input type="checkbox" name="requires_consent" defaultChecked={!!service?.requires_consent} />
                <span className="track" />
                <span className="txt">Needs a signed consent first</span>
              </label>
              <label className="switch">
                <input type="checkbox" name="requires_labs" defaultChecked={!!service?.requires_labs} />
                <span className="track" />
                <span className="txt">Needs labs on file first</span>
              </label>
              <label className="switch">
                <input type="checkbox" name="active" defaultChecked={service?.active !== false} />
                <span className="track" />
                <span className="txt">
                  Active
                  <br />
                  <span className="dim" style={{ fontSize: '.78rem' }}>
                    Turn this off to retire a service without deleting its history.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>How it reads on your public page</h2>
                <p>
                  The short line goes in the menu. The longer version sits behind
                  &ldquo;What this involves&rdquo;, so the menu stays scannable and
                  the detail is one tap away.
                </p>
              </div>
            </div>
            <div className="stack">
              <div className="field">
                <label htmlFor="image">Menu image</label>
                {service?.image_path ? (
                  <div className="row" style={{ gap: 'var(--gd-4)', alignItems: 'center', marginBottom: '.5rem' }}>
                    <img src={String(service.image_path)} alt=""
                      style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--gd-r-sm)' }} />
                    <label className="switch">
                      <input type="checkbox" name="remove_image" value="1" />
                      <span className="track" />
                      <span className="txt">Remove it</span>
                    </label>
                  </div>
                ) : null}
                <input id="image" name="image" type="file" accept="image/*" />
                <div className="hint">
                  Optional. With none, the menu draws a line-art mark in your
                  accent colour, which is often cleaner than a stock photo.
                </div>
              </div>

              <div className="field">
                <label htmlFor="details">What this involves</label>
                <textarea id="details" name="details" rows={5}
                  defaultValue={String(service?.details ?? '')}
                  placeholder="What is included, what to expect, whether a series is recommended." />
                <div className="hint">
                  Leave the price out of this — it is a field above, and repeating
                  it here is how a page ends up showing two different numbers.
                </div>
              </div>

              <div className="grid g2">
                <div className="field">
                  <label htmlFor="deposit_cents">Deposit</label>
                  <input id="deposit_cents" name="deposit_cents" type="text" inputMode="decimal"
                    defaultValue={service?.deposit_cents ? String(Number(service.deposit_cents) / 100) : ''}
                    placeholder="0.00" />
                  <div className="hint">Shown on the menu, and comes off the total.</div>
                </div>
                <div className="field">
                  <label htmlFor="sort_order">Menu position</label>
                  <input id="sort_order" name="sort_order" type="number"
                    defaultValue={String(service?.sort_order ?? 0)} />
                  <div className="hint">Lower shows first inside its category.</div>
                </div>
              </div>

              <label className="switch">
                <input type="checkbox" name="is_membership" defaultChecked={!!service?.is_membership} />
                <span className="track" />
                <span className="txt">This is a membership</span>
              </label>

              {!isNew && service?.needs_copy ? (
                <div className="note-band warn">
                  Marked as <b>awaiting copy</b>, so the public page currently says a
                  description is to be supplied. Writing the short line above clears
                  that automatically when you save.
                </div>
              ) : null}
            </div>
          </section>

          <div className="row" style={{ marginTop: 'var(--gd-5)' }}>
            <button className="btn primary" type="submit">
              {isNew ? 'Add service' : 'Save changes'}
            </button>
            <Link className="btn ghost" href="/console/services">Cancel</Link>
          </div>
        </form>

        {/* Deleting lives outside the edit form — a destructive action sharing a
            submit button with an edit is how the wrong one gets pressed. */}
        {!isNew && (
          <section className="card" style={{ marginTop: 'var(--gd-8)' }}>
            <div className="card-head">
              <div>
                <div className="eyebrow">Removing it</div>
                <h2>Retire or delete</h2>
              </div>
            </div>

            {usedBy > 0 ? (
              <p className="muted" style={{ fontSize: '.9rem', lineHeight: 1.6 }}>
                This service appears on <b>{usedBy}</b> existing record
                {usedBy === 1 ? '' : 's'} — appointments, treatments or packages.
                It cannot be deleted, because a past treatment record naming a
                service that no longer exists is a clinical record that has lost
                information. <b>Untick Active</b> above to take it off the menu and
                stop new bookings; everything already recorded stays readable.
              </p>
            ) : (
              <>
                <p className="muted" style={{ fontSize: '.9rem', lineHeight: 1.6 }}>
                  Nothing references this service yet, so it can be deleted
                  outright. If it has ever been booked, retire it instead by
                  unticking Active — that keeps the history.
                </p>
                <form action={destroy} style={{ marginTop: 'var(--gd-4)' }}>
                  <input type="hidden" name="id" value={id} />
                  <button className="btn danger" type="submit">
                    Delete this service
                  </button>
                </form>
              </>
            )}
          </section>
        )}
      </div>
    </>
  );
}
