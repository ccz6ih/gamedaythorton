/**
 * app/console/packages/manage/page.tsx
 * The packages she offers — as opposed to /console/packages, which is the
 * packages she has sold.
 *
 * Shows the saving and the per-session price on every row because those are
 * the two numbers a client compares, and the two a practice most often gets
 * wrong by a digit. Seeing them computed next to each other is how a typo in
 * the price gets noticed here rather than on the website.
 */

import Link from 'next/link';
import { serverClient } from '@/lib/supabase/server';
import { getClinic } from '@/lib/db/queries';
import { money } from '@/lib/format';
import { claimsIn } from '@/lib/claims';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  name: string;
  description: string | null;
  sessions: number;
  price_cents: number;
  list_price_cents: number | null;
  active: boolean;
  sort_order: number;
  service: { name: string } | null;
};

export default async function ManagePackages({
  searchParams
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const supabase = await serverClient();
  const { data } = await supabase
    .from('service_package')
    .select('id, name, description, sessions, price_cents, list_price_cents, active, sort_order, service:service_id ( name )')
    .eq('clinic_id', clinic.id)
    .order('sort_order')
    .order('name');

  const rows = (data ?? []) as unknown as Row[];
  const live = rows.filter(r => r.active);

  /**
   * Copy already in the database that would not be accepted if it were typed
   * today. The check is new and the rows are not, so rather than pretend they
   * are fine, the ones that read as claims are flagged where she can fix them.
   */
  const flagged = rows.filter(r => claimsIn(r.description).length > 0 || claimsIn(r.name).length > 0);

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{clinic.name}</div>
          <h1>Package pricing</h1>
        </div>
        <div className="spacer" />
        <Link className="btn primary" href="/console/packages/manage/new">New package</Link>
      </header>

      <div className="view wide">
        {saved && <div className="note-band">Saved.</div>}

        {flagged.length > 0 && (
          <div className="note-band" role="status">
            {flagged.length === 1 ? 'One package reads' : `${flagged.length} packages read`} as
            a clinical claim &mdash; a promised outcome, a number of sessions, or how a
            treatment works. {flagged.length === 1 ? 'It is' : 'They are'} marked below.
          </div>
        )}

        <div className="grid g4">
          <div className="stat">
            <div className="lab">On the website</div>
            <div className="stat-val">{live.length}</div>
          </div>
          <div className="stat">
            <div className="lab">Hidden</div>
            <div className="stat-val">{rows.length - live.length}</div>
            <div className="note">Still valid for anyone who bought one</div>
          </div>
        </div>

        <section className="card flush" style={{ marginTop: 'var(--gd-5)' }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Treatment</th>
                  <th className="num">Sessions</th>
                  <th className="num">Price</th>
                  <th className="num">Each</th>
                  <th className="num">Saves</th>
                  <th>On site</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const saving = r.list_price_cents !== null
                    ? r.list_price_cents - r.price_cents
                    : null;
                  const claims = [...claimsIn(r.name), ...claimsIn(r.description)];
                  return (
                    <tr className="clickable" key={r.id}>
                      <td>
                        <Link href={`/console/packages/manage/${r.id}`} style={{ textDecoration: 'none' }}>
                          <b>{r.name}</b>
                        </Link>
                        {claims.length > 0 && (
                          <div className="warnc" style={{ fontSize: '.72rem', marginTop: '.15rem' }}>
                            reads as a claim: &ldquo;{claims[0]!.phrase}&rdquo;
                          </div>
                        )}
                      </td>
                      <td className="dim" style={{ fontSize: '.78rem' }}>
                        {r.service?.name ?? '—'}
                      </td>
                      <td className="num">{r.sessions}</td>
                      <td className="num">{money(r.price_cents)}</td>
                      <td className="num dim">{money(Math.round(r.price_cents / r.sessions))}</td>
                      <td className="num">
                        {saving !== null && saving > 0
                          ? <span className="okc">{money(saving)}</span>
                          : <span className="dim">—</span>}
                      </td>
                      <td>
                        <span className="pill" data-tone={r.active ? 'ok' : undefined}>
                          {r.active && <i className="dot" />}{r.active ? 'Live' : 'Hidden'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      No packages yet. <Link href="/console/packages/manage/new">Create the first one</Link>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="muted" style={{ marginTop: 'var(--gd-5)' }}>
          Selling one to a client happens on <Link href="/console/packages">Packages</Link>.
          This page is what you offer; that one is what you have sold.
        </p>
      </div>
    </>
  );
}
