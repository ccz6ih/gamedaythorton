/**
 * app/console/settings/page.tsx
 * Practice details, brand, team, and the pilot controls.
 *
 * Read-only for now, deliberately: the Brand Kit editor exists and works in the
 * Phase A prototype, and porting it is a real piece of work rather than a form
 * stub. Showing the current values with an honest pointer to the working editor
 * beats a settings page whose Save button does nothing.
 */

import Link from 'next/link';
import { getClinic, getTeam, hasModule } from '@/lib/db/queries';
import { brandOf, contrastRatio, inkFor } from '@/components/Brand';
import { titleCase, phone } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const { staff, providers } = await getTeam();
  const brand = brandOf(clinic);
  const accent = brand.accent ?? '#d7262f';
  const ink = inkFor(accent);
  const inkRatio = contrastRatio(accent, ink);
  const darkRatio = contrastRatio(accent, '#141414');

  const openDays = clinic.hours.filter(h => h.open);
  const modules = Object.entries(clinic.modules ?? {});

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{clinic.name}</div>
          <h1>Settings</h1>
        </div>
        <div className="spacer" />
        <span className="pill">{titleCase(clinic.practice_type)}</span>
      </header>

      <div className="view wide">

        <section className="card">

          <div className="card-head">

            <div>

              <div className="eyebrow">Public page</div>

              <h2>Your storefront</h2>

              <p>

                What someone sees before they are a client — services, pricing,

                packages, and a request form. Built from this clinic&rsquo;s own

                record, so editing a service here changes it there.

              </p>

            </div>

          </div>

          <div className="row tight">

            <a className="btn primary" href={`/c/${clinic.slug}`} target="_blank" rel="noreferrer">

              View storefront

            </a>

            <a className="btn" href={`/c/${clinic.slug}/services`} target="_blank" rel="noreferrer">

              Services page

            </a>

          </div>

          <p className="muted" style={{ fontSize: '.82rem', marginTop: 'var(--gd-4)' }}>

            Not indexed by search engines and not accepting real enquiries while

            the pilot is on.

          </p>

        </section>

        <div className="grid g2">
          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Practice</div>
                <h2>{clinic.name}</h2>
              </div>
            </div>
            <dl className="kv">
              <dt>Location</dt><dd>{clinic.location_name ?? '—'}</dd>
              <dt>Address</dt>
              <dd style={{ textAlign: 'right' }}>
                {clinic.address_line1 ?? '—'}
                {clinic.address_city ? <><br />{clinic.address_city}, {clinic.address_state} {clinic.address_zip}</> : null}
              </dd>
              <dt>Voice</dt><dd>{clinic.phone_voice ? phone(clinic.phone_voice) : <span className="warnc">not set</span>}</dd>
              <dt>Text</dt><dd>{clinic.phone_text ? phone(clinic.phone_text) : <span className="warnc">not set</span>}</dd>
              <dt>Timezone</dt><dd>{clinic.timezone}</dd>
            </dl>

            {(!clinic.phone_voice || !clinic.phone_text) && (
              <div className="note-band warn" style={{ marginTop: '1rem' }}>
                Phone numbers are not on file. They are not published on the practice&rsquo;s
                own booking site either, so they need collecting at discovery rather than
                guessing.
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Opening hours</div>
                <h2>{openDays.length} day{openDays.length === 1 ? '' : 's'} a week</h2>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Day</th><th>Open</th><th>Close</th></tr></thead>
                <tbody>
                  {clinic.hours.map(h => (
                    <tr key={h.day}>
                      <td><b>{h.day}</b></td>
                      <td>{h.open ?? <span className="dim">closed</span>}</td>
                      <td>{h.close ?? <span className="dim">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {openDays.length <= 3 && (
              <div className="note-band" style={{ marginTop: '1rem' }}>
                Narrow hours make self-serve booking and a waitlist matter more here, not
                less — there are fewer slots to lose to a missed phone call.
              </div>
            )}
          </section>
        </div>

        <div className="section-title">Brand</div>
        <div className="grid g2">
          <section className="card">
            <div
              style={{
                background: accent, color: ink, padding: '1.2rem',
                borderRadius: 'var(--gd-r-md)', marginBottom: '1rem'
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Primary action</div>
              <div style={{ fontSize: '.84rem', opacity: 0.9 }}>
                Ink chosen automatically for contrast: {inkRatio.toFixed(1)}:1
              </div>
            </div>
            <dl className="kv">
              <dt>Accent</dt><dd className="mono">{accent}</dd>
              <dt>Corner radius</dt><dd>{brand.radius ?? 10}px</dd>
              <dt>Typeface</dt><dd>{titleCase(brand.font ?? 'system')}</dd>
              <dt>Console surface</dt><dd>{titleCase(brand.surface ?? 'dark')}</dd>
              <dt>Vocabulary</dt>
              <dd>{brand.sportsVocabulary ? 'Sports metaphor' : 'Plain clinical'}</dd>
            </dl>

            {inkRatio < 4.5 ? (
              <div className="note-band warn" style={{ marginTop: '1rem' }}>
                Text on this accent reaches {inkRatio.toFixed(1)}:1. AA needs 4.5:1, so
                buttons will be hard to read.
              </div>
            ) : darkRatio < 3 ? (
              <div className="note-band warn" style={{ marginTop: '1rem' }}>
                This accent is only {darkRatio.toFixed(1)}:1 against a dark background, so
                links and highlights will disappear. 3:1 is the minimum.
              </div>
            ) : (
              <div className="note-band" style={{ marginTop: '1rem', borderLeftColor: 'var(--gd-in-range)' }}>
                <b>Contrast passes.</b> Readable on the accent and against both surfaces.
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Modules</div>
                <h2>What this practice uses</h2>
                <p>
                  Driven by the practice type. It is why this console has no lab-entry
                  screen for a med spa and no package ledger for a TRT clinic.
                </p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Module</th><th>Status</th></tr></thead>
                <tbody>
                  {modules.map(([key, on]) => (
                    <tr key={key}>
                      <td>{titleCase(key)}</td>
                      <td>
                        {on
                          ? <span className="pill" data-tone="ok"><i className="dot" />on</span>
                          : <span className="dim">off</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="section-title">Team</div>
        <div className="grid g2">
          <section className="card flush">
            <div className="card-head">
              <div>
                <div className="eyebrow">Seen by clients</div>
                <h2>Clinicians</h2>
                <p>A real face is the most effective anxiety reducer on a pre-visit card.</p>
              </div>
            </div>
            <div className="list">
              {providers.map((p: Record<string, unknown>) => (
                <div className="item" key={String(p.id)}>
                  <span className="body">
                    <span className="ttl">
                      {String(p.name)}
                      {!p.credentials && (
                        <span className="pill" data-tone="warn"><i className="dot" />no credentials on file</span>
                      )}
                    </span>
                    <span className="sub">
                      {[p.role_label, p.credentials].filter(Boolean).join(' · ') || 'Details not collected'}
                    </span>
                  </span>
                  <span className="side">
                    {p.photo_path
                      ? <span className="pill" data-tone="ok"><i className="dot" />photo</span>
                      : <span className="pill" data-tone="warn"><i className="dot" />no photo</span>}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ padding: '0 var(--gd-5) var(--gd-5)' }}>
              <div className="note-band warn">
                Credentials and bios are deliberately blank where they were not published.
                Inventing a professional credential for a real clinician would be a false
                claim, not a placeholder — these need collecting, not guessing.
              </div>
            </div>
          </section>

          <section className="card flush">
            <div className="card-head">
              <div>
                <div className="eyebrow">Console access</div>
                <h2>Staff accounts</h2>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Name</th><th>Role</th><th>MFA</th></tr></thead>
                <tbody>
                  {staff.map((s: Record<string, unknown>) => (
                    <tr key={String(s.id)}>
                      <td><b>{String(s.name)}</b></td>
                      <td>{titleCase(String(s.role))}</td>
                      <td>
                        {s.mfa_enabled
                          ? <span className="pill" data-tone="ok"><i className="dot" />on</span>
                          : <span className="pill" data-tone="warn"><i className="dot" />Phase C</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="section-title">Brand editor</div>
        <section className="card">
          <p className="muted" style={{ fontSize: '.9rem', lineHeight: 1.65 }}>
            The working Brand Kit editor — change the accent, upload a logo and
            clinician headshots, switch the vocabulary, and watch the whole product
            follow — lives in the Phase A prototype. It has not been ported to this
            console yet, and a settings form whose Save button did nothing would be
            worse than saying so.
          </p>
          <div className="row" style={{ marginTop: '1rem' }}>
            <Link className="btn primary" href="/prototype/index.html#/staff/settings">
              Open the Brand Kit editor
            </Link>
            <Link className="btn ghost" href="/about-pilot">What is still a pilot</Link>
          </div>
        </section>
      </div>
    </>
  );
}
