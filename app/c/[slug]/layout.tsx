/**
 * app/c/[slug]/layout.tsx
 * The public storefront shell — the replacement for a GlossGenius booking page.
 *
 * Unauthenticated. There is no viewer, no session, and nothing here may read a
 * table that is not in lib/db/storefront.ts. The brand kit is applied from the
 * clinic's own record, so the same code renders a med spa and a men's health
 * clinic as visibly different businesses.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront, hoursLines } from '@/lib/db/storefront';
import { phone } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  return {
    title: clinic ? `${clinic.name}${clinic.location_name ? ' · ' + clinic.location_name : ''}` : 'Not found',
    description: clinic?.tagline ?? undefined,
    // Still noindex while this is a pilot. A storefront carrying a real
    // practice's name and prices must not appear in search results next to
    // the business's actual site until the practice says it is live.
    robots: { index: false, follow: false }
  };
}

export default async function StorefrontLayout({ children, params }: Props) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);

  // A clinic that has not opted in with `listed` is indistinguishable from one
  // that does not exist. That is deliberate: a 403 would confirm it is real.
  if (!clinic) notFound();

  const brand = (clinic.brand ?? {}) as Record<string, string>;
  const isSpa = clinic.practice_type === 'med_spa';

  // Med spas read light; the men's health brand is dark. The brand kit wins if
  // it says otherwise.
  const surface = brand.surface ?? (isSpa ? 'light' : 'dark');

  const style: React.CSSProperties & Record<string, string> = {} as never;
  if (brand.accent) style['--brand-accent'] = brand.accent;
  if (brand.accentInk) style['--brand-accent-ink'] = brand.accentInk;
  // The brand kit stores radius as a number (14), and CSS needs a unit —
  // `calc(14 * 0.6)` is invalid and silently drops the whole declaration.
  if (brand.radius !== undefined && brand.radius !== null && String(brand.radius) !== '') {
    const r = String(brand.radius);
    style['--brand-radius'] = /^\d+(\.\d+)?$/.test(r) ? `${r}px` : r;
  }
  if (brand.font) style['--brand-font'] = brand.font;
  if (brand.displayFont) style['--brand-display-font'] = brand.displayFont;

  /**
   * Surface colours, when the practice wants a ground of its own.
   *
   * "dark" in tokens.css is a neutral near-black, which is right for a men's
   * health clinic and wrong for a practice whose whole identity is plants and
   * brass. Rather than add a second named theme for every brand that comes
   * along, the kit can set the four surface values directly and everything
   * else — borders, text, the accent chain — still derives from them.
   */
  const SURFACE_KEYS: [string, string][] = [
    ['bg', '--gd-bg'],
    ['surfaceColor', '--gd-surface'],
    ['surfaceRaised', '--gd-surface-raised'],
    ['borderColor', '--gd-border']
  ];
  for (const [key, token] of SURFACE_KEYS) {
    if (brand[key]) style[token] = brand[key];
  }

  const hours = hoursLines(clinic.hours);
  const nav = [
    { href: `/c/${slug}`, label: 'Home' },
    { href: `/c/${slug}/services`, label: 'Services' },
    { href: `/c/${slug}/shop`, label: 'Shop' },
    { href: `/c/${slug}/packages`, label: 'Packages' },
    { href: `/c/${slug}/about`, label: 'About' }
  ];

  /**
   * The display face, loaded here rather than in the root layout so the console
   * does not pay for it and the strict no-external-origins policy still covers
   * everything private. The CSP for these paths allows exactly these two hosts
   * and nothing else — see next.config.mjs.
   *
   * Every face named in the brand kit needs a real fallback, because this link
   * can fail and the page still has to read.
   */
  const needsCormorant = /Cormorant/i.test(String(brand.displayFont ?? brand.font ?? ''));

  return (
    <div className="sf" data-surface={surface} style={style}>
      {needsCormorant && (
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap"
        />
      )}
      <nav className="sf-nav" aria-label="Storefront">
        <div className="sf-nav-inner">
          <Link href={`/c/${slug}`} className="sf-mark">
            {brand.logoUrl
              ? <img src={brand.logoUrl} alt={clinic.name} />
              : <span>{clinic.name}</span>}
          </Link>
          {nav.map(item => (
            <Link key={item.href} href={item.href} className="sf-link">{item.label}</Link>
          ))}
          <Link href={`/c/${slug}/enquire`} className="sf-btn primary sm">Book</Link>
        </div>
      </nav>

      {children}

      <footer className="sf-foot">
        <div className="sf-wrap">
          <div className="sf-foot-grid">
            <div>
              <h4>Visit</h4>
              <address>
                {clinic.address_line1}<br />
                {clinic.address_line2 && <>{clinic.address_line2}<br /></>}
                {clinic.address_city}, {clinic.address_state} {clinic.address_zip}
              </address>
              {clinic.address_note && (
                <p style={{ marginTop: '.5rem', color: 'var(--gd-text-dim)' }}>{clinic.address_note}</p>
              )}
            </div>

            <div>
              <h4>Hours</h4>
              {hours.length ? (
                <dl className="sf-hours">
                  {hours.map(h => (
                    <div key={h.window} style={{ display: 'contents' }}>
                      <dt>{h.days}</dt>
                      <dd>{h.window}</dd>
                    </div>
                  ))}
                </dl>
              ) : <p>By appointment</p>}
            </div>

            <div>
              <h4>Contact</h4>
              <p>
                {clinic.phone_voice && (
                  <><a href={`tel:${clinic.phone_voice}`}>{phone(clinic.phone_voice)}</a><br /></>
                )}
                {clinic.email && <a href={`mailto:${clinic.email}`}>{clinic.email}</a>}
              </p>
            </div>
          </div>

          {/* This page carries a real practice's name and real prices. Saying
              plainly what it is keeps it from being mistaken for their live
              site — by a visitor or by us. */}
          <p className="sf-pilot">
            Preview of a booking site in development for {clinic.name}. Not the
            practice&rsquo;s live website, not accepting real bookings, and not
            indexed by search engines. All client records shown anywhere in this
            system are invented. <Link href="/about-pilot">More about this pilot</Link>.
          </p>
        </div>
      </footer>
    </div>
  );
}
