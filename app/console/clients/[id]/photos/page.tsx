import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getClinic, getClients } from '@/lib/db/queries';
import { serverClient } from '@/lib/supabase/server';
import { requireRole, pilotFields, requiredText, text, int, bool, formMessage } from '@/lib/actions';
import { uploadClientPhoto, signedPhotoUrls } from '@/lib/client-media';
import { dateLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function capture(formData: FormData) {
  'use server';
  const staff = await requireRole(['owner', 'admin', 'provider']);
  const patientId = requiredText(formData, 'patient_id');
  let seriesId: string | null = null;

  try {
    const supabase = await serverClient();
    if (!bool(formData, 'consent_confirmed')) throw new Error('Confirm that the client has consented before uploading a photo.');
    const pilot = await pilotFields(staff.clinicId);
    const { data: series, error: seriesError } = await supabase.from('photo_series').insert({
      clinic_id: staff.clinicId,
      patient_id: patientId,
      series_type: requiredText(formData, 'series_type'),
      label: text(formData, 'label'),
      guide_version: 'v1',
      ...pilot
    }).select('id').single();
    if (seriesError || !series) throw new Error(seriesError?.message ?? 'Could not create the series.');
    seriesId = String(series.id);

    const file = formData.get('photo');
    if (!(file instanceof File) || file.size === 0) throw new Error('Choose a photo first.');
    const path = await uploadClientPhoto(file, staff.clinicId, patientId, `series-${seriesId}`);
    if (!path) throw new Error('The photo could not be uploaded.');

    const { error: photoError } = await supabase.from('photo').insert({
      clinic_id: staff.clinicId,
      series_id: seriesId,
      patient_id: patientId,
      captured_at: requiredText(formData, 'captured_at'),
      week_index: int(formData, 'week_index'),
      pose_key: requiredText(formData, 'pose_key'),
      guide_version: 'v1',
      storage_path: path,
      placeholder: false,
      ...pilot
    });
    if (photoError) throw new Error(photoError.message);

    revalidatePath(`/console/clients/${patientId}`);
    revalidatePath(`/console/clients/${patientId}/photos`);
    redirect(`/console/clients/${patientId}/photos?saved=1`);
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    redirect(`/console/clients/${patientId}/photos?error=${encodeURIComponent(formMessage(err))}`);
  }
}

export default async function PhotosPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const feedback = await searchParams;
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const supabase = await serverClient();
  const [{ data: patient }, { data: seriesRows }] = await Promise.all([
    supabase.from('patient').select('id, first_name, last_name').eq('id', id).eq('clinic_id', clinic.id).maybeSingle(),
    supabase.from('photo_series').select('*').eq('patient_id', id).is('archived_at', null).order('created_at', { ascending: false })
  ]);
  if (!patient) redirect('/console/clients');

  const series = seriesRows ?? [];
  const { data: photoRows } = await supabase.from('photo')
    .select('*').eq('patient_id', id).order('captured_at', { ascending: true });
  const photos = photoRows ?? [];
  const urls = await signedPhotoUrls(photos.map(p => p.storage_path as string | null));
  const latestBySeries = new Map<string, typeof photos[number]>();
  for (const photo of photos) latestBySeries.set(String(photo.series_id), photo);

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb"><Link href={`/console/clients/${id}`} className="banner-link">{patient.first_name} {patient.last_name}</Link></div>
          <h1>Progress photos</h1>
        </div>
        <div className="spacer" />
        <Link className="btn sm" href={`/console/clients/${id}`}>Back to chart</Link>
      </header>
      <div className="view wide">
        {feedback.saved && <div className="note-band" style={{ marginBottom: 'var(--gd-5)' }}>Photo captured.</div>}
        {feedback.error && <div className="note-band critical" style={{ marginBottom: 'var(--gd-5)' }}>{feedback.error}</div>}

        <div className="grid g2">
          <section className="card">
            <div className="card-head"><div><div className="eyebrow">Capture</div><h2>Add a frame</h2><p>Use the same pose and guide each time. Photos stay in the private client-media bucket.</p></div></div>
            <form action={capture} encType="multipart/form-data" className="stack">
              <input type="hidden" name="patient_id" value={id} />
              <div className="field"><label htmlFor="series_type">Series</label><select id="series_type" name="series_type" defaultValue="face"><option value="face">Face</option><option value="treatment_area">Treatment area</option><option value="hair">Hair</option><option value="body">Body</option></select></div>
              <div className="field"><label htmlFor="label">Series name</label><input id="label" name="label" placeholder="e.g. PRF under-eye" /></div>
              <div className="grid g2"><div className="field"><label htmlFor="captured_at">Captured on</label><input id="captured_at" name="captured_at" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div><div className="field"><label htmlFor="week_index">Week</label><input id="week_index" name="week_index" type="number" min="0" placeholder="e.g. 6" /></div></div>
              <div className="field"><label htmlFor="pose_key">Pose</label><select id="pose_key" name="pose_key" defaultValue="front"><option value="front">Front</option><option value="left">Left profile</option><option value="right">Right profile</option><option value="detail">Treatment detail</option></select></div>
              <div className="field"><label htmlFor="photo">Photo</label><input id="photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp,image/heic" required /><div className="hint">Maximum 15MB. Do not upload a photo without the client’s consent.</div></div>
              <label className="check"><input name="consent_confirmed" type="checkbox" required /> <span>Client consent is confirmed for this series.</span></label>
              <button className="btn primary" type="submit">Save photo</button>
            </form>
          </section>

          <section className="card">
            <div className="card-head"><div><div className="eyebrow">Comparison</div><h2>Latest frames</h2><p>One current frame per series, with the capture date and pose visible.</p></div></div>
            {series.length === 0 ? <p className="muted">No photo series yet.</p> : <div className="photo-series-list">{series.map(s => { const photo = latestBySeries.get(String(s.id)); const url = photo?.storage_path ? urls.get(String(photo.storage_path)) : null; return <article className="photo-series-card" key={String(s.id)}><div className="photo-series-image">{url ? <img src={url} alt={`${s.label || s.series_type} latest frame`} /> : <span>No image</span>}</div><div><div className="eyebrow">{String(s.series_type)}</div><h3>{String(s.label || 'Untitled series')}</h3><p className="muted">{photo ? `${dateLabel(String(photo.captured_at), 'md')} · ${String(photo.pose_key)}` : 'No frames captured'}</p><Link className="banner-link" href={`/console/clients/${id}/photos/${s.id}`}>Open comparison</Link></div></article>; })}</div>}
          </section>
        </div>
      </div>
    </>
  );
}
