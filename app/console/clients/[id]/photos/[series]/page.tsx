import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClinic } from '@/lib/db/queries';
import { serverClient } from '@/lib/supabase/server';
import { signedPhotoUrls } from '@/lib/client-media';
import { dateLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PhotoComparisonPage({
  params
}: {
  params: Promise<{ id: string; series: string }>;
}) {
  const { id, series: seriesId } = await params;
  const clinic = await getClinic();
  if (!clinic) notFound();
  const supabase = await serverClient();
  const [{ data: patient }, { data: series }, { data: photos }] = await Promise.all([
    supabase.from('patient').select('first_name, last_name').eq('id', id).eq('clinic_id', clinic.id).maybeSingle(),
    supabase.from('photo_series').select('*').eq('id', seriesId).eq('patient_id', id).maybeSingle(),
    supabase.from('photo').select('*').eq('series_id', seriesId).eq('patient_id', id).order('captured_at', { ascending: true })
  ]);
  if (!patient || !series) notFound();
  const frames = photos ?? [];
  const urls = await signedPhotoUrls(frames.map(p => p.storage_path as string | null));
  const first = frames[0];
  const latest = frames[frames.length - 1];

  return (
    <>
      <header className="topbar"><div><div className="crumb"><Link href={`/console/clients/${id}/photos`} className="banner-link">Progress photos</Link></div><h1>{String(series.label || 'Photo series')}</h1></div><div className="spacer" /><Link className="btn sm" href={`/console/clients/${id}`}>Back to chart</Link></header>
      <div className="view wide">
        <section className="card"><div className="card-head"><div><div className="eyebrow">{patient.first_name} {patient.last_name} · {String(series.series_type)}</div><h2>Baseline to latest</h2><p>Compare only frames made with the same pose and guide version. This series uses {String(series.guide_version)}.</p></div></div>
          {frames.length === 0 ? <p className="muted">No frames captured yet.</p> : <div className="photo-comparison">{[first, latest].filter((photo, index) => photo && (index === 0 || photo.id !== first?.id)).map(photo => { const url = photo?.storage_path ? urls.get(String(photo.storage_path)) : null; return <figure key={String(photo.id)}><div className="photo-comparison-image">{url ? <img src={url} alt={`${String(photo.pose_key)} frame from ${dateLabel(String(photo.captured_at), 'long')}`} /> : <span>No image available</span>}</div><figcaption><b>{photo?.id === first?.id ? 'Baseline' : 'Latest'}</b><br />{dateLabel(String(photo?.captured_at), 'long')} · {String(photo?.pose_key)}{photo?.week_index != null ? ` · Week ${photo.week_index}` : ''}</figcaption></figure>; })}</div>}
        </section>
        <section className="card"><div className="card-head"><div><h2>All frames</h2><p>Chronological record for this series.</p></div></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Pose</th><th>Week</th><th>Guide</th></tr></thead><tbody>{frames.map(photo => <tr key={String(photo.id)}><td>{dateLabel(String(photo.captured_at), 'md')}</td><td>{String(photo.pose_key)}</td><td>{photo.week_index ?? '—'}</td><td>{String(photo.guide_version)}</td></tr>)}</tbody></table></div></section>
      </div>
    </>
  );
}
