/**
 * app/console/layout.tsx
 * The staff console shell.
 *
 * Navigation is ONE LEVEL DEEP and built from the clinic's module flags, so a med
 * spa never sees a "Lab entry" link and a men's-health clinic never sees
 * "Packages". Showing a practitioner a screen for somebody else's speciality is
 * how clinic software loses credibility in the first minute.
 * docs/12-glossgenius-parity.md.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { currentViewer, serverClient } from '@/lib/supabase/server';
import { getClinic, hasModule } from '@/lib/db/queries';
import { Brand, vocab } from '@/components/Brand';
import { PilotBanner } from '@/components/PilotBanner';
import { ConsoleShell } from '@/components/ConsoleShell';
import { titleCase } from '@/lib/format';

/**
 * The practice names itself. It was hardcoded to "The Med Bar", which put one
 * tenant's name in every other tenant's browser tab — a cross-tenant leak in
 * the one place nobody looks for one, and the screen test caught it as
 * "Gameday's console mentions The Med Bar".
 *
 * A second getClinic() here rather than threading it down from the layout body:
 * Next resolves metadata separately from rendering, so there is nothing to
 * thread. The query is RLS-scoped and cheap.
 */
export async function generateMetadata(): Promise<Metadata> {
  const clinic = await getClinic();
  const name = clinic?.name ?? 'Console';
  return {
    title: { default: `Console · ${name}`, template: `%s · ${name}` }
  };
}

async function signOut() {
  'use server';
  const supabase = await serverClient();
  await supabase.auth.signOut();
  redirect('/admin');
}

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const viewer = await currentViewer();
  if (!viewer) redirect('/admin?next=/console');
  if (viewer.kind !== 'staff') redirect('/portal');

  const clinic = await getClinic();
  const words = vocab(clinic);
  const brand = (clinic?.brand ?? {}) as Record<string, string>;

  // pilot_mode is not exposed by clinic_public on purpose, so read it directly —
  // RLS still scopes it to this staff member's own clinic.
  const supabase = await serverClient();
  const { data: flags } = await supabase
    .from('clinic')
    .select('pilot_mode')
    .eq('id', viewer.clinicId)
    .maybeSingle();

  const nav = [
    { group: 'Run the day' },
    { href: '/console', label: words.dashboard, icon: '◯' },
    { href: '/console/today', label: 'Today', icon: '▦' },
    { href: '/console/calendar', label: 'Calendar', icon: '▤' },
    { href: '/console/book', label: 'Book', icon: '✚' },
    { href: '/console/clients', label: words.people, icon: '☇' },
    { group: 'Clinical', when: hasModule(clinic, 'labs') || hasModule(clinic, 'treatment_records') },
    { href: '/console/labs', label: 'Lab entry', icon: '⚗', when: hasModule(clinic, 'labs') },
    { href: '/console/safety', label: 'Safety queue', icon: '⚠', when: hasModule(clinic, 'safety_queue') },
    { href: '/console/treatments', label: 'Treatment records', icon: '✎', when: hasModule(clinic, 'treatment_records') },
    { group: 'Money' },
    { href: '/console/charge', label: 'Take a payment', icon: '＄' },
    { href: '/console/packages', label: 'Packages', icon: '◱', when: hasModule(clinic, 'packages') },
    { href: '/console/payments', label: 'Payments', icon: '⌗' },
    // Only where there is a shop to have orders in. A men's health clinic with
    // no retail line does not need a permanently empty screen in its rail.
    { href: '/console/orders', label: 'Shop orders', icon: '⬓', when: hasModule(clinic, 'retail') },
    { group: 'Setup' },
    { href: '/console/services', label: 'Services & pricing', icon: '☰' },
    { href: '/console/products', label: 'Shop products', icon: '▤', when: hasModule(clinic, 'retail') },
    { href: '/console/storefront', label: 'Your public page', icon: '◈' },
    { href: '/console/brand', label: 'Logo & colours', icon: '◐' },
    { href: '/console/settings', label: 'Settings', icon: '⚙' }
  ].filter(item => item.when === undefined || item.when);

  return (
    <Brand clinic={clinic}>
      <PilotBanner pilotMode={process.env.PILOT_MODE !== 'false'} dbPilotMode={flags?.pilot_mode} />
      <ConsoleShell
        clinicName={clinic?.location_name ?? clinic?.name ?? 'Clinic'}
        /* Only what the bar needs to name the current screen. The icons and
           the module gating stay on the server where they are decided. */
        sections={nav.flatMap(item =>
          item.href && item.label ? [{ href: item.href, label: item.label }] : []
        )}
        rail={<>
          <div className="rail-brand">
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt={clinic?.name ?? 'Clinic'}
                style={{ height: 'auto', maxHeight: 'var(--brand-logo-height, 75px)', maxWidth: '180px', objectFit: 'contain' }}
              />
            ) : (
              <>
                <span className="mark" aria-hidden="true">
                  {(clinic?.name ?? '?').slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <div className="nm">{clinic?.location_name ?? clinic?.name ?? 'Clinic'}</div>
                  <div className="sub">{words.console}</div>
                </div>
              </>
            )}
          </div>

          <div className="tenant-chip">
            <span className="dot" aria-hidden="true" />
            <span>
              <span className="name">{clinic?.name}</span>
              <br />
              <span className="type">{titleCase(clinic?.practice_type ?? '')}</span>
            </span>
          </div>

          {nav.map((item, i) =>
            'group' in item && item.group ? (
              <div className="rail-group" key={`g${i}`}>{item.group}</div>
            ) : (
              <Link className="navlink" href={item.href!} key={item.href}>
                <span className="ico" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          )}

          <div className="rail-foot">
            <div className="rail-group" style={{ paddingTop: 0 }}>Signed in</div>
            <div style={{ padding: '0 .6rem .6rem', fontSize: '.8rem' }}>
              <div style={{ fontWeight: 700 }}>{viewer.name}</div>
              <div className="dim" style={{ fontSize: '.72rem' }}>{titleCase(viewer.role)}</div>
            </div>
            <form action={signOut}>
              <button className="navlink" type="submit" style={{ width: '100%' }}>
                <span className="ico" aria-hidden="true">⏏</span>
                <span>Sign out</span>
              </button>
            </form>
          </div>
        </>}
      >
        {children}
      </ConsoleShell>
    </Brand>
  );
}
