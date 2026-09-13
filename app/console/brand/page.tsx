/**
 * app/console/brand/page.tsx
 * Logo, colours and photographs — the look of the public page.
 *
 * Uploads go to the `brand` storage bucket under the clinic's own folder, which
 * is what its RLS policy keys on. The bucket is PUBLIC, deliberately: a logo
 * that needs a signed URL is a logo that does not load.
 *
 * That public-ness is exactly why patient media never comes near here. Progress
 * photographs live in a separate private bucket behind short-TTL signed URLs
 * (docs/16-media-pipeline.md), and this screen has no path to them. The two
 * kinds of image have opposite requirements and the separation is enforced by
 * being different buckets rather than by anyone remembering.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { getClinic } from '@/lib/db/queries';
import { requireRole, text, formMessage } from '@/lib/actions';
import { uploadBrandImage } from '@/lib/brand-upload';
import { contrastRatio, inkFor } from '@/components/Brand';
import { initials } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function saveBrand(formData: FormData) {
  'use server';

  const staff = await requireRole(['owner', 'admin']);

  try {
    const supabase = await serverClient();
    const { data: current } = await supabase
      .from('clinic').select('brand, logo_path').eq('id', staff.clinicId).maybeSingle();

    const brand = { ...((current?.brand ?? {}) as Record<string, unknown>) };

    const accent = text(formData, 'accent');
    if (accent) {
      if (!/^#[0-9a-fA-F]{6}$/.test(accent)) throw new Error('A colour looks like #a1b2c3.');
      brand.accent = accent;
      // Text that sits ON the accent is computed, never chosen. Left to a colour
      // picker, somebody eventually puts white on yellow.
      brand.accentInk = inkFor(accent);
    }

    const surface = text(formData, 'surface');
    if (surface) brand.surface = surface;

    const radius = text(formData, 'radius');
    // Stored as a number for the editor's select, given a unit at render time.
    // Storing "14px" here instead would work but breaks the select's matching.
    if (radius !== null) brand.radius = Number(radius);

    const font = text(formData, 'font');
    if (font) { brand.font = font; brand.displayFont = font; }

    const logoFile = formData.get('logo') as File | null;
    const logoUrl = logoFile ? await uploadBrandImage(logoFile, staff.clinicId, 'logo') : null;
    if (logoUrl) brand.logoUrl = logoUrl;
    const removingLogo = text(formData, 'remove_logo') === '1';
    if (removingLogo) delete brand.logoUrl;

    const { error } = await supabase
      .from('clinic')
      .update({
        brand,
        ...(logoUrl ? { logo_path: logoUrl } : removingLogo ? { logo_path: null } : {})
      })
      .eq('id', staff.clinicId);
    if (error) throw new Error(error.message);
  } catch (err) {
    redirect(`/console/brand?error=${encodeURIComponent(formMessage(err))}`);
  }

  revalidatePath('/console/brand');
  revalidatePath('/c', 'layout');
  redirect('/console/brand?saved=1');
}

async function savePortrait(formData: FormData) {
  'use server';

  const staff = await requireRole(['owner', 'admin']);
  const providerId = text(formData, 'provider_id');

  try {
    if (!providerId) throw new Error('No practitioner selected.');
    const file = formData.get('portrait') as File | null;
    const url = file ? await uploadBrandImage(file, staff.clinicId, `provider-${providerId}`) : null;
    if (!url) throw new Error('Choose an image first.');

    const supabase = await serverClient();
    const { error } = await supabase
      .from('provider')
      .update({ photo_path: url })
      .eq('id', providerId)
      .eq('clinic_id', staff.clinicId);
    if (error) throw new Error(error.message);
  } catch (err) {
    redirect(`/console/brand?error=${encodeURIComponent(formMessage(err))}`);
  }

  revalidatePath('/console/brand');
  revalidatePath('/c', 'layout');
  redirect('/console/brand?saved=1');
}

const FONTS = [
  { value: '"Inter", system-ui, sans-serif', label: 'Inter — plain and modern' },
  { value: '"Cormorant Garamond", Georgia, serif', label: 'Cormorant — elegant serif' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Georgia — classic serif' },
  { value: '"Archivo", Helvetica, sans-serif', label: 'Archivo — industrial' }
];

export default async function BrandPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const supabase = await serverClient();
  const { data: providers } = await supabase
    .from('provider_public')
    .select('id, name, role_label, photo_path')
    .eq('clinic_id', clinic.id)
    .order('sort_order');

  const brand = (clinic.brand ?? {}) as Record<string, string>;
  const accent = brand.accent ?? '#d7262f';
  const ratio = contrastRatio(accent, inkFor(accent));

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">
            <Link href="/console/storefront" className="banner-link">Your public page</Link>
          </div>
          <h1>Logo, colours and photographs</h1>
        </div>
        <div className="spacer" />
        <a className="btn" href={`/c/${clinic.slug}`} target="_blank" rel="noreferrer">Open it</a>
      </header>

      <div className="view narrow">
        {sp.saved && (
          <div className="note-band" style={{ marginBottom: 'var(--gd-5)' }}>Saved.</div>
        )}
        {sp.error && (
          <div className="note-band critical" style={{ marginBottom: 'var(--gd-5)' }}>{sp.error}</div>
        )}

        <form action={saveBrand} encType="multipart/form-data">
          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Identity</div>
                <h2>Logo</h2>
                <p>PNG, JPEG, WebP or SVG, up to 5MB. A transparent PNG sits best.</p>
              </div>
            </div>
            <div className="stack">
              {brand.logoUrl && (
                <div className="row" style={{ gap: 'var(--gd-4)', alignItems: 'center' }}>
                  <img src={brand.logoUrl} alt="Current logo"
                    style={{ maxHeight: 56, maxWidth: 220, objectFit: 'contain' }} />
                  <label className="switch">
                    <input type="checkbox" name="remove_logo" value="1" />
                    <span className="track" />
                    <span className="txt">Remove it</span>
                  </label>
                </div>
              )}
              <div className="field">
                <label htmlFor="logo">{brand.logoUrl ? 'Replace it' : 'Upload a logo'}</label>
                <input id="logo" name="logo" type="file" accept="image/*" />
                <div className="hint">
                  With no logo, your practice name is set in your chosen typeface.
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Colour</div>
                <h2>Your accent</h2>
                <p>One colour, used for buttons, links and the line-art marks on your menu.</p>
              </div>
            </div>
            <div className="stack">
              <div className="grid g2">
                <div className="field">
                  <label htmlFor="accent">Accent colour</label>
                  <input id="accent" name="accent" type="color" defaultValue={accent}
                    style={{ height: '2.75rem', padding: '.2rem' }} />
                </div>
                <div className="field">
                  <label htmlFor="surface">Background</label>
                  <select id="surface" name="surface" defaultValue={brand.surface ?? 'dark'}>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>
              </div>

              <div className="grid g2">
                <div className="field">
                  <label htmlFor="font">Typeface</label>
                  <select id="font" name="font" defaultValue={brand.font ?? FONTS[0]!.value}>
                    {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="radius">Corners</label>
                  <select id="radius" name="radius" defaultValue={String(brand.radius ?? 10)}>
                    <option value="0">Square</option>
                    <option value="6">Slightly rounded</option>
                    <option value="10">Rounded</option>
                    <option value="16">Very rounded</option>
                  </select>
                </div>
              </div>

              {/* Contrast is checked rather than trusted. A pale accent with white
                  text on it is unreadable, and the person choosing it is looking
                  at a swatch, not at the button. */}
              <div className={`note-band${ratio < 4.5 ? ' warn' : ''}`}>
                Text on your accent scores <b>{ratio.toFixed(1)}:1</b> for contrast.{' '}
                {ratio >= 4.5
                  ? 'That passes the readability standard.'
                  : 'That is below the 4.5:1 standard — buttons in this colour will be hard to read. A darker or more saturated shade fixes it.'}
              </div>
            </div>
          </section>

          <div className="row" style={{ marginTop: 'var(--gd-5)' }}>
            <button className="btn primary" type="submit">Save appearance</button>
          </div>
        </form>

        {/* Portraits are separate forms — one per person, so uploading a photo
            for one practitioner cannot overwrite another's. */}
        <section className="card" style={{ marginTop: 'var(--gd-8)' }}>
          <div className="card-head">
            <div>
              <div className="eyebrow">People</div>
              <h2>Practitioner photographs</h2>
              <p>
                Shown on your home and about pages. Use a photo the person has
                agreed to publish — it is their likeness, on a medical page.
              </p>
            </div>
          </div>

          <div className="stack">
            {(providers ?? []).map(p => (
              <form action={savePortrait} encType="multipart/form-data" key={String(p.id)}>
                <input type="hidden" name="provider_id" value={String(p.id)} />
                <div className="row" style={{ gap: 'var(--gd-4)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="av lg" aria-hidden="true"
                    style={{ overflow: 'hidden', padding: 0 }}>
                    {p.photo_path
                      ? <img src={String(p.photo_path)} alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initials(String(p.name))}
                  </span>
                  <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{String(p.name)}</div>
                    <div className="dim" style={{ fontSize: '.8rem' }}>
                      {p.role_label ? String(p.role_label) : 'No role set'}
                    </div>
                  </div>
                  <input name="portrait" type="file" accept="image/*"
                    style={{ flex: '1 1 14rem' }} />
                  <button className="btn sm" type="submit">Upload</button>
                </div>
              </form>
            ))}

            {(providers ?? []).length === 0 && (
              <p className="muted" style={{ fontSize: '.9rem' }}>
                No practitioners on file yet.
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <div className="eyebrow quiet">Where these go</div>
          <p className="muted" style={{ fontSize: '.86rem', lineHeight: 1.6 }}>
            Everything uploaded here is <b>public</b> — that is what a logo is for.
            Client photographs are a different thing entirely and never come here:
            they are stored privately, reachable only through short-lived links,
            and there is no path from this screen to them.
          </p>
        </section>
      </div>
    </>
  );
}
