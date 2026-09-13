/**
 * app/console/services/page.tsx
 * Services and pricing.
 *
 * Price display is the point of this screen. A med spa quotes "from $800" and
 * "$14+/unit"; printing a single flat number where the practice quotes a range
 * is a misquote on the screen where cost is the objection. `priceLabel()` is the
 * only thing allowed to render a price.
 */

import { getClinic, getServices, getPlans, getPackageCatalogue, hasModule } from '@/lib/db/queries';
import { priceLabel, money, titleCase } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const [services, plans, packages] = await Promise.all([
    getServices(),
    hasModule(clinic, 'memberships') ? getPlans() : Promise.resolve([]),
    hasModule(clinic, 'packages') ? getPackageCatalogue() : Promise.resolve([])
  ]);

  const byCategory = services.reduce<Record<string, typeof services>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  const bookable = services.filter(s => s.online_bookable && s.active).length;

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{clinic.name}</div>
          <h1>Services &amp; pricing</h1>
        </div>
        <div className="spacer" />
        <span className="pill">{services.length} services</span>
      </header>

      <div className="view wide">
        <div className="grid g4">
          <div className="stat">
            <div className="lab">Services</div>
            <div className="stat-val">{services.length}</div>
          </div>
          <div className="stat">
            <div className="lab">Bookable online</div>
            <div className="stat-val">{bookable}</div>
            <div className="note">The rest need a conversation first</div>
          </div>
          <div className="stat">
            <div className="lab">Categories</div>
            <div className="stat-val">{Object.keys(byCategory).length}</div>
          </div>
          <div className="stat">
            <div className="lab">Need consent</div>
            <div className="stat-val">{services.filter(s => s.requires_consent).length}</div>
          </div>
        </div>

        {packages.length > 0 && (
          <>
            <div className="section-title">Prepaid series</div>
            <div className="grid g3">
              {packages.map((p: Record<string, unknown>) => {
                const list = Number(p.list_price_cents ?? 0);
                const paid = Number(p.price_cents ?? 0);
                const saves = list > paid ? list - paid : 0;
                return (
                  <div className="labcard" key={String(p.id)}>
                    <div style={{ fontWeight: 700 }}>{String(p.name)}</div>
                    <div className="lval num">{money(paid)}</div>
                    <div className="muted" style={{ fontSize: '.82rem', marginTop: '.2rem' }}>
                      {String(p.sessions)} sessions
                      {saves > 0 && <> · saves {money(saves)}</>}
                    </div>
                    {p.interval_note ? (
                      <div className="read">{String(p.interval_note)}</div>
                    ) : null}
                    {p.expiry_days ? (
                      <div className="note-band warn" style={{ marginTop: '.6rem' }}>
                        Expires {String(p.expiry_days)} days after purchase. That has to be
                        disclosed at the point of sale, not buried in terms.
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {plans.length > 0 && (
          <>
            <div className="section-title">Memberships</div>
            <div className="grid g3">
              {plans.map((p: Record<string, unknown>) => (
                <div className="labcard" key={String(p.id)}>
                  <div style={{ fontWeight: 700 }}>{String(p.name)}</div>
                  <div className="lval num">
                    {money(Number(p.price_cents))}
                    <small>/{String(p.interval)}</small>
                  </div>
                  <ul style={{ paddingLeft: '1.1rem', fontSize: '.8rem', lineHeight: 1.6, color: 'var(--gd-text-muted)', marginTop: '.6rem' }}>
                    {(Array.isArray(p.includes) ? p.includes : []).map((i: unknown, n: number) => (
                      <li key={n}>{String(i)}</li>
                    ))}
                  </ul>
                  {p.provisional_price ? (
                    <div style={{ marginTop: '.6rem' }}>
                      <span className="pill" data-tone="warn"><i className="dot" />placeholder price</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}

        {Object.entries(byCategory).map(([category, rows]) => (
          <section className="card flush" key={category}>
            <div className="card-head">
              <div>
                <div className="eyebrow">{titleCase(category)}</div>
                <h2>{rows.length} service{rows.length === 1 ? '' : 's'}</h2>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th className="num">Minutes</th>
                    <th className="num">Turnaround</th>
                    <th className="num">Price</th>
                    <th>Consent</th>
                    <th>Online</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(s => (
                    <tr key={s.id}>
                      <td><b>{s.name}</b></td>
                      <td className="num">{s.duration_min}</td>
                      <td className="num dim">{s.buffer_after_min || '—'}</td>
                      <td className="num"><b>{priceLabel(s)}</b></td>
                      <td>
                        {s.requires_consent
                          ? <span className="pill" data-tone="warn"><i className="dot" />required</span>
                          : <span className="dim">—</span>}
                      </td>
                      <td>
                        {s.online_bookable
                          ? <span className="pill" data-tone="ok"><i className="dot" />yes</span>
                          : <span className="dim">no</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <div className="card">
          <div className="eyebrow quiet">Turnaround time</div>
          <p className="muted" style={{ fontSize: '.86rem', lineHeight: 1.6 }}>
            The turnaround column is room-reset time, and the calendar enforces it —
            a 120-minute lash set cannot be followed immediately by the next one.
            Double-booking is rejected by the database rather than checked in the app,
            because an app-level check races with itself and the failure is a real
            person in a waiting room.
          </p>
        </div>
      </div>
    </>
  );
}
