/**
 * app/console/clients/new/page.tsx
 * Add a client, and edit one — `?id=` switches to editing.
 *
 * The pilot guard is visible on this form rather than hidden. Adding a person is
 * exactly where someone would type a real name, so the form says plainly that the
 * record will be stored as synthetic and why. That is more useful than letting
 * them type a real client and discover the refusal afterwards.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { getClinic } from '@/lib/db/queries';
import { vocab } from '@/components/Brand';
import { requireStaff, pilotFields, text, requiredText, formMessage } from '@/lib/actions';

export const dynamic = 'force-dynamic';

const SOURCES = [
  'instagram', 'google_search_maps', 'friend_family', 'tiktok', 'facebook',
  'walk_by', 'gym_referral', 'email_newsletter', 'billboard', 'podcast',
  'radio', 'other'
];

async function save(formData: FormData) {
  'use server';

  const staff = await requireStaff();
  const id = text(formData, 'id');
  const back = id ? `/console/clients/new?id=${id}` : '/console/clients/new';

  let target = id;
  try {
    const row = {
      clinic_id: staff.clinicId,
      first_name: requiredText(formData, 'first_name'),
      last_name: requiredText(formData, 'last_name'),
      preferred_name: text(formData, 'preferred_name'),
      email: text(formData, 'email'),
      phone: text(formData, 'phone'),
      dob: text(formData, 'dob'),
      status: requiredText(formData, 'status'),
      acquisition_source: text(formData, 'acquisition_source'),
      address_line1: text(formData, 'address_line1'),
      address_city: text(formData, 'address_city'),
      address_state: text(formData, 'address_state'),
      address_zip: text(formData, 'address_zip'),
      emergency_contact_name: text(formData, 'emergency_contact_name'),
      emergency_contact_phone: text(formData, 'emergency_contact_phone'),
      notes_internal: text(formData, 'notes_internal'),
      ...(await pilotFields(staff.clinicId))
    };

    const supabase = await serverClient();
    if (id) {
      const { error } = await supabase.from('patient').update(row).eq('id', id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase.from('patient').insert(row).select('id').single();
      if (error) throw new Error(error.message);
      target = data.id;
    }
  } catch (err) {
    redirect(`${back}&error=${encodeURIComponent(formMessage(err))}`.replace('new&', 'new?'));
  }

  revalidatePath('/console/clients');
  redirect(`/console/clients/${target}?saved=1`);
}

export default async function ClientFormPage({
  searchParams
}: {
  searchParams: Promise<{ id?: string; error?: string }>;
}) {
  const { id, error } = await searchParams;
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const words = vocab(clinic);
  let person: Record<string, unknown> | null = null;

  if (id) {
    const supabase = await serverClient();
    const { data } = await supabase.from('patient').select('*').eq('id', id).maybeSingle();
    person = data;
  }

  const pilot = true; // the guard applies whenever the clinic is in pilot mode

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">
            <Link href="/console/clients" className="banner-link">{words.people}</Link>
          </div>
          <h1>{person ? `${person.first_name} ${person.last_name}` : `New ${words.person}`}</h1>
        </div>
      </header>

      <div className="view narrow">
        {error && <div className="note-band critical" style={{ marginBottom: 'var(--gd-5)' }}>{error}</div>}

        {!person && pilot && (
          <div className="note-band" style={{ marginBottom: 'var(--gd-5)' }}>
            This record will be stored as <b>synthetic</b>. Use a made-up name — the
            database refuses real {words.person} data until compliance work is signed
            off, and it refuses it rather than trusting anyone to remember.
          </div>
        )}

        <form action={save}>
          {id && <input type="hidden" name="id" value={id} />}

          <section className="card">
            <div className="card-head"><div><h2>Who they are</h2></div></div>
            <div className="stack">
              <div className="grid g2">
                <div className="field">
                  <label htmlFor="first_name">First name</label>
                  <input id="first_name" name="first_name" type="text" required
                    defaultValue={String(person?.first_name ?? '')} />
                </div>
                <div className="field">
                  <label htmlFor="last_name">Last name</label>
                  <input id="last_name" name="last_name" type="text" required
                    defaultValue={String(person?.last_name ?? '')} />
                </div>
              </div>

              <div className="grid g2">
                <div className="field">
                  <label htmlFor="preferred_name">Goes by</label>
                  <input id="preferred_name" name="preferred_name" type="text"
                    defaultValue={String(person?.preferred_name ?? '')} />
                  <div className="hint">Used everywhere they are addressed.</div>
                </div>
                <div className="field">
                  <label htmlFor="dob">Date of birth</label>
                  <input id="dob" name="dob" type="date"
                    defaultValue={person?.dob ? String(person.dob) : ''} />
                </div>
              </div>

              <div className="grid g2">
                <div className="field">
                  <label htmlFor="phone">Phone</label>
                  <input id="phone" name="phone" type="tel"
                    defaultValue={String(person?.phone ?? '')} placeholder="+1 970 555 0000" />
                </div>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email"
                    defaultValue={String(person?.email ?? '')} />
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Status &amp; source</h2></div></div>
            <div className="grid g2">
              <div className="field">
                <label htmlFor="status">Status</label>
                <select id="status" name="status" defaultValue={String(person?.status ?? 'lead')}>
                  <option value="lead">Lead — enquired, not seen yet</option>
                  <option value="consulted">Consulted — seen, not converted</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="churned">Lapsed</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="acquisition_source">How they found you</label>
                <select id="acquisition_source" name="acquisition_source"
                  defaultValue={String(person?.acquisition_source ?? '')}>
                  <option value="">Not asked</option>
                  {SOURCES.map(s => (
                    <option value={s} key={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <div className="hint">
                  This is the field that eventually answers &ldquo;does the billboard
                  work&rdquo;. Worth asking every time.
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Optional</h2>
                <p>Nothing here blocks booking. Fill it in when it matters.</p>
              </div>
            </div>
            <div className="stack">
              <div className="field">
                <label htmlFor="address_line1">Address</label>
                <input id="address_line1" name="address_line1" type="text"
                  defaultValue={String(person?.address_line1 ?? '')} />
              </div>
              <div className="grid g3">
                <div className="field">
                  <label htmlFor="address_city">City</label>
                  <input id="address_city" name="address_city" type="text"
                    defaultValue={String(person?.address_city ?? '')} />
                </div>
                <div className="field">
                  <label htmlFor="address_state">State</label>
                  <input id="address_state" name="address_state" type="text" maxLength={2}
                    defaultValue={String(person?.address_state ?? '')} />
                </div>
                <div className="field">
                  <label htmlFor="address_zip">ZIP</label>
                  <input id="address_zip" name="address_zip" type="text"
                    defaultValue={String(person?.address_zip ?? '')} />
                </div>
              </div>
              <div className="grid g2">
                <div className="field">
                  <label htmlFor="emergency_contact_name">Emergency contact</label>
                  <input id="emergency_contact_name" name="emergency_contact_name" type="text"
                    defaultValue={String(person?.emergency_contact_name ?? '')} />
                </div>
                <div className="field">
                  <label htmlFor="emergency_contact_phone">Their phone</label>
                  <input id="emergency_contact_phone" name="emergency_contact_phone" type="tel"
                    defaultValue={String(person?.emergency_contact_phone ?? '')} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="notes_internal">Internal note</label>
                <textarea id="notes_internal" name="notes_internal"
                  defaultValue={String(person?.notes_internal ?? '')}
                  placeholder="Anything the team should know. Never shown to the client." />
                <div className="hint">Staff only. The client never sees this.</div>
              </div>
            </div>
          </section>

          <div className="row" style={{ marginTop: 'var(--gd-5)' }}>
            <button className="btn primary" type="submit">
              {person ? 'Save changes' : `Add ${words.person}`}
            </button>
            <Link className="btn ghost" href={id ? `/console/clients/${id}` : '/console/clients'}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
