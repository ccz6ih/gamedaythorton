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
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { CartBadge } from '@/components/CartBadge';
import { StorefrontNav } from '@/components/StorefrontNav';
import { Analytics } from '@/components/Analytics';
import { phone } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  const brand = (clinic?.brand ?? {}) as Record<string, string>;

  if (!clinic) return { title: 'Not found' };

  const name = clinic.name;
  const where = clinic.address_city && clinic.address_state
    ? `${clinic.address_city}, ${clinic.address_state}`
    : clinic.location_name ?? '';

  const titleText = `${name} · PRF & Regenerative Aesthetics${where ? ` · ${where}` : ''}`;

  /**
   * The title says WHAT and WHERE, not just who.
   * Includes highest-intent search keywords: PRF (Platelet-Rich Fibrin), Aesthetics, Loveland CO.
   */
  const description = clinic.tagline
    ?? clinic.intro
    ?? `The Med Bar in Loveland, CO specializes in PRF (Platelet-Rich Fibrin) under-eye & microneedling treatments, hair restoration, UV lashes, and medical-grade botanical skincare.`;

  /**
   * A DRAWN favicon rather than the practice's logo.
   *
   * Her mark is a white stacked lockup on transparent. At the 16px a tab gets,
   * its three words are about two pixels tall each, and on a light tab bar
   * white-on-transparent is simply invisible — which is what pointing the icon
   * at the logo produced. The SVG carries her colours instead, which is what
   * anybody actually recognises at that size.
   */
  const logo = brand.logoUrl || '/brand/medbar-logo-white.png';

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');

  return {
    ...(base ? { metadataBase: new URL(base) } : {}),
    title: {
      default: titleText,
      template: `%s · ${name}`
    },
    description,
    icons: {
      icon: [
        { url: '/brand/medbar-favicon.svg', type: 'image/svg+xml' },
        { url: logo }
      ],
      apple: logo
    },
    // Social cards. Without these a shared link renders as a bare URL with no
    // picture, which on a business whose whole proposition is how things look
    // is worse than not being shared at all.
    openGraph: {
      type: 'website',
      siteName: name,
      title: titleText,
      description,
      locale: 'en_US'
    },
    twitter: {
      card: 'summary_large_image',
      title: titleText,
      description
    },
    // Still noindex while this is a pilot. A storefront carrying a real
    // practice's name and prices must not appear in search results next to
    // the business's actual site until the practice says it is live.
    // A live practice wants to be found; a pilot tenant must not be. Driven by
    // the clinic's own state rather than a build-wide constant, because those
    // two things are now true at the same time in the same deployment.
    robots: clinic?.live
      ? { index: true, follow: true }
      : { index: false, follow: false }
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
    ['borderColor', '--gd-border'],
    /**
     * TEXT AS WELL AS SURFACES, and leaving it out was a real bug.
     *
     * The kit repainted the ground green and left the type on tokens.css's
     * neutral greys. A neutral grey on a warm green ground reads COOL — body
     * copy was rendering blue-grey, the only cool note anywhere on the site,
     * and looked like an unstyled link or a broken span rather than prose.
     */
    ['text', '--gd-text'],
    ['textMuted', '--gd-text-muted'],
    ['textDim', '--gd-text-dim']
  ];
  for (const [key, token] of SURFACE_KEYS) {
    if (brand[key]) style[token] = brand[key];
  }

  const hours = hoursLines(clinic.hours);

  /**
   * Links are relative to the DOMAIN the visitor is on, not to the route the
   * pages happen to live at. On medbarco.com that means /services; on the
   * shared deployment it means /c/medbar-loveland/services. See
   * lib/storefront-links.ts for why this is decided by the Host header alone.
   */
  const links = storefrontLinks(await storefrontBase(slug));

  const nav = [
    { href: links.home, label: 'Home' },
    { href: links.services, label: 'Services' },
    { href: links.prf, label: 'PRF' },
    { href: links.shop, label: 'Shop' },
    { href: links.packages, label: 'Packages' },
    { href: links.about, label: 'About' }
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

  /**
   * LocalBusiness structured data, present on every storefront page.
   *
   * Every field here comes straight off the clinic record — nothing is
   * invented, so this cannot drift from what the page itself already says.
   * It is what lets Google's local pack and an AI answer engine build an
   * entity profile of the practice (name, address, phone, hours) instead of
   * having to guess at it from prose. Only emitted once the practice's own
   * site is live — a pilot tenant's storefront is already noindex, and giving
   * a crawler a business's real address before the practice has said "go
   * live" would be the same mistake as indexing the page itself.
   */
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://www.medbarco.com';
  const localBusinessJsonLd = clinic.live ? {
    '@context': 'https://schema.org',
    '@type': isSpa ? 'MedicalBusiness' : 'MedicalOrganization',
    name: clinic.name,
    url: `${base}${links.home}`,
    ...(brand.logoUrl ? { logo: brand.logoUrl } : {}),
    ...(clinic.address_line1 ? {
      address: {
        '@type': 'PostalAddress',
        streetAddress: [clinic.address_line1, clinic.address_line2].filter(Boolean).join(', '),
        addressLocality: clinic.address_city ?? undefined,
        addressRegion: clinic.address_state ?? undefined,
        postalCode: clinic.address_zip ?? undefined,
        addressCountry: 'US'
      }
    } : {}),
    ...(clinic.phone_voice ? { telephone: clinic.phone_voice } : {}),
    ...(clinic.email ? { email: clinic.email } : {}),
    ...(hours.length ? {
      openingHoursSpecification: clinic.hours
        .filter(h => h.open && h.close)
        .map(h => ({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: `https://schema.org/${h.day}`,
          opens: h.open,
          closes: h.close
        }))
    } : {})
  } : null;

  return (
    <div className="sf" data-surface={surface} style={style}>
      {localBusinessJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
      )}
      {needsCormorant && (
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap"
        />
      )}
      <Analytics measurementId={clinic.ga_measurement_id} />
      <StorefrontNav
        items={nav}
        homeHref={links.home}
        bookHref={links.book}
        logoUrl={brand.logoUrl}
        name={clinic.name}
      >
        <CartBadge slug={slug} href={links.cart} />
      </StorefrontNav>

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

            {isSpa && (
              <div>
                <h4>Guides &amp; Science</h4>
                <ul className="sf-foot-links" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <li><Link href={links.prf}>PRF Regenerative Guide</Link></li>
                  <li><Link href={links.prfCompare}>Compare PRF vs PRP &amp; Fillers</Link></li>
                  <li><Link href={links.prfAftercare}>PRF Pre-Care &amp; Recovery</Link></li>
                  <li><Link href={links.facialsGuide}>Colorado Altitude Facials</Link></li>
                  <li><Link href={links.ledLightTherapy}>7-Wavelength LED Therapy</Link></li>
                  <li><Link href={links.scarRevision}>Inkless Scar &amp; Stretch Marks</Link></li>
                </ul>
              </div>
            )}
          </div>

          {clinic.live ? (
            <p className="sf-pilot">
              &copy; {new Date().getFullYear()} {clinic.legal_name ?? clinic.name}.
              {' '}<Link href={links.about}>About</Link>
              {' · '}<Link href={links.enquire}>Contact</Link>
            </p>
          ) : (
            /* A pilot tenant carries a real practice's name and real prices, so
               it says plainly what it is. A live practice does not need telling
               that its own website is its website. */
            <p className="sf-pilot">
              Preview of a booking site in development for {clinic.name}. Not the
              practice&rsquo;s live website, not accepting real bookings, and not
              indexed by search engines. All client records shown anywhere in this
              system are invented. <Link href="/about-pilot">More about this pilot</Link>.
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
