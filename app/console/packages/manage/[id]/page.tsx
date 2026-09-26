/**
 * app/console/packages/manage/[id]/page.tsx
 * Add or edit a package she sells. `id` of "new" creates one.
 *
 * ===========================================================================
 * WHY NOT /console/packages/new
 * ===========================================================================
 * That path is taken, and it means something else: selling a package TO a
 * client. Two different jobs a word apart — "make a new package" and "sell a
 * package" — so the definitions live under /manage where the difference is
 * visible in the URL rather than inferred from the heading.
 *
 * ===========================================================================
 * THE SAVING IS COMPUTED, NEVER TYPED
 * ===========================================================================
 * `list_price_cents` is what the sessions would cost bought one at a time, and
 * the storefront derives the discount from it. The form offers to fill it in
 * from the parent treatment's own price, because a hand-typed "was" figure is
 * how a page ends up advertising a saving that does not survive arithmetic —
 * and an overstated discount is the one pricing error with a regulator
 * attached to it.
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { getClinic } from '@/lib/db/queries';
import { requireRole, text, requiredText, money, int, bool, formMessage } from '@/lib/actions';
import { claimsMessage } from '@/lib/claims';
import { money as fmt } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function save(formData: FormData) {
  'use server';

  const staff = await requireRole(['owner', 'admin']);
  const id = String(formData.get('id') ?? 'new');
  const back = `/console/packages/manage/${id}`;

  try {
    const sessions = int(formData, 'sessions', 0)!;
    const priceCents = money(formData, 'price_cents');
    const listCents = money(formData, 'list_price_cents');

    if (sessions < 1) throw new Error('A package needs at least one session.');
    if (priceCents === null) throw new Error('A package needs a price.');

    /**
     * A "was" price below the real one would print a negative saving. Caught
     * here rather than left to look like a rendering bug on the storefront.
     */
    if (listCents !== null && listCents < priceCents) {
      throw new Error('The full price cannot be lower than the package price.');
    }

    /**
     * The claims check, applied where the sentence is written.
     *
     * This copy goes straight onto the public packages page, and until now
     * nothing has ever checked it — scripts/claims-test.cjs cannot see the
     * database. Refusing here is the only place a person is still around to
     * rephrase it.
     */
    const description = text(formData, 'description');
    const intervalNote = text(formData, 'interval_note');
    for (const field of [description, intervalNote]) {
      const problem = claimsMessage(field);
      if (problem) throw new Error(problem);
    }

    const row: Record<string, unknown> = {
      clinic_id: staff.clinicId,
      name: requiredText(formData, 'name'),
      service_id: text(formData, 'service_id') || null,
      description,
      sessions,
      price_cents: priceCents,
      list_price_cents: listCents,
      interval_note: intervalNote,
      expiry_days: int(formData, 'expiry_days', null),
      sort_order: int(formData, 'sort_order', 0)!,
      active: bool(formData, 'active')
    };

    const supabase = await serverClient();
    if (id === 'new') {
      const { error } = await supabase.from('service_package').insert(row);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from('service_package').update(row).eq('id', id).eq('clinic_id', staff.clinicId);
      if (error) throw new Error(error.message);
    }
  } catch (err) {
    redirect(`${back}?error=${encodeURIComponent(formMessage(err))}`);
  }

  revalidatePath('/console/packages/manage');
  revalidatePath('/c/[slug]/packages', 'page');
  redirect('/console/packages/manage?saved=1');
}

/**
 * Retire rather than delete, when anything has been sold.
 *
 * A package somebody has bought is referenced by package_purchase, and the
 * sessions they have left are counted against it. Deleting it would either
 * orphan that balance or blank the name on a purchase somebody paid for. So a
 * sold package is deactivated — off the storefront, still intact behind the
 * sales it explains.
 */
async function retire(formData: FormData) {
  'use server';
  const staff = await requireRole(['owner', 'admin']);
  const id = String(formData.get('id') ?? '');
  const supabase = await serverClient();

  const { count } = await supabase
    .from('package_purchase')
    .select('id', { count: 'exact', head: true })
    .eq('package_id', id);

  if (count && count > 0) {
    await supabase.from('service_package').update({ active: false })
      .eq('id', id).eq('clinic_id', staff.clinicId);
  } else {
    await supabase.from('service_package').delete()
      .eq('id', id).eq('clinic_id', staff.clinicId);
  }

  revalidatePath('/console/packages/manage');
  redirect('/console/packages/manage?saved=1');
}

export default async function EditPackage({
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
  const supabase = await serverClient();

  const [{ data: services }, pkgRes, soldRes] = await Promise.all([
    supabase.from('service')
      .select('id, name, price_cents, price_from_cents')
      .eq('clinic_id', clinic.id).eq('active', true).order('name'),
    isNew
      ? Promise.resolve({ data: null })
      : supabase.from('service_package').select('*').eq('id', id).maybeSingle(),
    isNew
      ? Promise.resolve({ count: 0 })
      : supabase.from('package_purchase').select('id', { count: 'exact', head: true }).eq('package_id', id)
  ]);

  const pkg = pkgRes.data as Record<string, unknown> | null;
  if (!isNew && !pkg) notFound();
  const sold = (soldRes as { count: number | null }).count ?? 0;

  const list = (services ?? []) as { id: string; name: string; price_cents: number | null; price_from_cents: number | null }[];

  const priceCents = (pkg?.price_cents as number | undefined) ?? null;
  const listCents = (pkg?.list_price_cents as number | undefined) ?? null;
  const sessions = (pkg?.sessions as number | undefined) ?? 3;
  const saving = listCents !== null && priceCents !== null ? listCents - priceCents : null;

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">
            <Link href="/console/packages/manage">Package pricing</Link>
          </div>
          <h1>{isNew ? 'New package' : String(pkg?.name ?? 'Package')}</h1>
        </div>
      </header>

      <div className="view narrow">
        {error && <div className="note-band" role="alert">{error}</div>}

        <form action={save}>
          <input type="hidden" name="id" value={id} />

          <section className="card">
            <div className="field">
              <label htmlFor="name">Package name</label>
              <input id="name" name="name" required defaultValue={String(pkg?.name ?? '')}
                     placeholder="Frotox | SubZero Cryo Facial | 3 Sessions" />
              <div className="hint">What a client sees on the packages page.</div>
            </div>

            <div className="field">
              <label htmlFor="service_id">Treatment</label>
              <select id="service_id" name="service_id" defaultValue={String(pkg?.service_id ?? '')}>
                <option value="">— not tied to one treatment —</option>
                {list.map(s => {
                  const single = s.price_cents ?? s.price_from_cents;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name}{single ? ` — ${fmt(single)} each` : ''}
                    </option>
                  );
                })}
              </select>
              <div className="hint">
                Which treatment the sessions are for. Used to redeem a session against a booking.
              </div>
            </div>

            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea id="description" name="description" rows={4}
                        defaultValue={String(pkg?.description ?? '')} />
              <div className="hint">
                Shown on the public packages page. Avoid promising an outcome, a
                number of sessions, or how a treatment works — you will be asked
                to rephrase if it reads as a claim.
              </div>
            </div>
          </section>

          <section className="card">
            <h2>Price</h2>
            <div className="grid g2">
              <div className="field">
                <label htmlFor="sessions">Sessions</label>
                <input id="sessions" name="sessions" type="number" min="1" max="52"
                       required defaultValue={sessions} />
              </div>
              <div className="field">
                <label htmlFor="price_cents">Package price</label>
                <input id="price_cents" name="price_cents" required inputMode="decimal"
                       defaultValue={priceCents !== null ? (priceCents / 100).toFixed(2) : ''} />
              </div>
              <div className="field">
                <label htmlFor="list_price_cents">Full price, bought singly</label>
                <input id="list_price_cents" name="list_price_cents" inputMode="decimal"
                       defaultValue={listCents !== null ? (listCents / 100).toFixed(2) : ''} />
                <div className="hint">
                  Sessions &times; the single price. Leave blank to show no saving.
                  {saving !== null && saving > 0 && ` Currently saves ${fmt(saving)}.`}
                </div>
              </div>
              <div className="field">
                <label htmlFor="expiry_days">Expires after</label>
                <input id="expiry_days" name="expiry_days" type="number" min="0"
                       defaultValue={String(pkg?.expiry_days ?? 365)} />
                <div className="hint">Days from purchase. Blank or 0 means never.</div>
              </div>
            </div>

            <div className="field">
              <label htmlFor="interval_note">Spacing note</label>
              <input id="interval_note" name="interval_note"
                     defaultValue={String(pkg?.interval_note ?? '')}
                     placeholder="Appointments are scheduled with your practitioner." />
              <div className="hint">
                Optional. Keep it general — naming a number of weeks is prescribing
                from a price list.
              </div>
            </div>
          </section>

          <section className="card">
            <div className="grid g2">
              <div className="field">
                <label htmlFor="sort_order">Order on the page</label>
                <input id="sort_order" name="sort_order" type="number"
                       defaultValue={String(pkg?.sort_order ?? 0)} />
              </div>
              <div className="field check">
                <label htmlFor="active">
                  <input id="active" name="active" type="checkbox"
                         defaultChecked={pkg ? pkg.active === true : true} />
                  {' '}Show on the website
                </label>
              </div>
            </div>
          </section>

          <div className="row tight" style={{ marginTop: 'var(--gd-4)' }}>
            <button className="btn primary" type="submit">
              {isNew ? 'Create package' : 'Save changes'}
            </button>
            <Link className="btn" href="/console/packages/manage">Cancel</Link>
          </div>
        </form>

        {!isNew && (
          <form action={retire} style={{ marginTop: 'var(--gd-6)' }}>
            <input type="hidden" name="id" value={id} />
            <section className="card">
              <h2>{sold > 0 ? 'Stop selling this' : 'Delete this package'}</h2>
              <p className="muted">
                {sold > 0
                  ? `${sold} ${sold === 1 ? 'client has' : 'clients have'} bought this. It will be
                     hidden from the website, and their remaining sessions stay exactly as they are.`
                  : 'Nobody has bought this one, so it can be removed completely.'}
              </p>
              <button className="btn" type="submit">
                {sold > 0 ? 'Hide from the website' : 'Delete'}
              </button>
            </section>
          </form>
        )}
      </div>
    </>
  );
}
