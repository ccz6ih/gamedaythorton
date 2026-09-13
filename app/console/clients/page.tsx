/**
 * app/console/clients/page.tsx
 * The roster. "Patients" or "Clients" depending on the practice — using the wrong
 * noun in front of a practitioner reads as software built for somebody else.
 */

import Link from 'next/link';
import { getClinic, getClients, getVisitBookends } from '@/lib/db/queries';
import { vocab } from '@/components/Brand';
import { dateLabel, relative, titleCase, phone, initials } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const [clients, bookends] = await Promise.all([getClients(), getVisitBookends()]);
  const words = vocab(clinic);

  // Anyone with no future visit booked. For a practice that lives on rebooking —
  // a lash fill every three weeks, a recheck every seven — this is the single most
  // actionable column on the screen.
  const noNext = clients.filter(c => !bookends.get(c.id)?.next && c.status === 'active');

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{clinic.name}</div>
          <h1>{words.people}</h1>
        </div>
        <div className="spacer" />
        <span className="pill">{clients.length} total</span>
      </header>

      <div className="view wide">
        <div className="grid g4">
          <div className="stat">
            <div className="lab">Active</div>
            <div className="stat-val">{clients.filter(c => c.status === 'active').length}</div>
          </div>
          <div className="stat">
            <div className="lab">No next visit</div>
            <div className="stat-val">{noNext.length}</div>
            <div className="note">Nothing on the books to bring them back</div>
          </div>
          <div className="stat">
            <div className="lab">Leads</div>
            <div className="stat-val">{clients.filter(c => c.status === 'lead').length}</div>
          </div>
          <div className="stat">
            <div className="lab">Lapsed</div>
            <div className="stat-val">
              {clients.filter(c => c.status === 'churned' || c.status === 'paused').length}
            </div>
          </div>
        </div>

        <section className="card flush">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{titleCase(words.person)}</th>
                  <th>Status</th>
                  <th>Last visit</th>
                  <th>Next visit</th>
                  <th>Contact</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => {
                  const marks = bookends.get(c.id);
                  const tone =
                    c.status === 'active' ? 'ok' :
                    c.status === 'churned' ? 'critical' :
                    c.status === 'paused' ? 'warn' : undefined;
                  return (
                    <tr className="clickable" key={c.id}>
                      <td>
                        <Link href={`/console/clients/${c.id}`} style={{ textDecoration: 'none' }}>
                          <div className="row tight">
                            <span className="av" aria-hidden="true">{initials(`${c.first_name} ${c.last_name}`)}</span>
                            <span>
                              <b>{c.first_name} {c.last_name}</b>
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <span className="pill" data-tone={tone}>
                          {tone && <i className="dot" />}{titleCase(c.status)}
                        </span>
                      </td>
                      <td className="num">{marks?.last ? relative(marks.last) : '—'}</td>
                      <td className="num">
                        {marks?.next
                          ? dateLabel(marks.next, 'md')
                          : <span className="warnc">none</span>}
                      </td>
                      <td className="dim" style={{ fontSize: '.78rem' }}>{phone(c.phone)}</td>
                      <td className="dim" style={{ fontSize: '.78rem' }}>{titleCase(c.acquisition_source)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
