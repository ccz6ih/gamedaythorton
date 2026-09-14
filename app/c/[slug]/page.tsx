/**
 * app/c/[slug]/page.tsx — the storefront home.
 *
 * Built from the design Craig supplied, with three deliberate changes.
 *
 * 1. GREEN, NOT AUBERGINE. Her brand is plants and brass, so the ground is a
 *    deep botanical green and the accent is the gold already in her kit. Every
 *    colour reads from the brand kit rather than being written in here, so a
 *    different practice renders the same markup in its own identity.
 *
 * 2. NO GSAP. The mockup pulls two scripts from a CDN. The content security
 *    policy admits no external script origin, and opening one for an animation
 *    is a far bigger concession than the font — a script can do anything on the
 *    page. The centrifuge and the hero entrance are CSS keyframes; the
 *    scroll-lit process rail is one IntersectionObserver.
 *
 * 3. DATA-DRIVEN. The mockup hardcodes six treatments and three lash tiers.
 *    Here they come from the practice's own catalogue, so editing a price in
 *    the console changes this page and the two cannot drift apart.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getStorefront, getStorefrontServices, getStorefrontProviders, getStorefrontProducts, hoursLines
} from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { ServiceIcon } from '@/components/ServiceIcon';
import { Centrifuge } from '@/components/Centrifuge';
import { ProcessRail } from '@/components/ProcessRail';
import { priceLabel, initials, money } from '@/lib/format';
import { PRF_PROCESS } from '@/lib/prf-content';

export const dynamic = 'force-dynamic';

/**
 * The home page names itself ABSOLUTELY.
 *
 * The layout carries `title.template` so every child reads "Shop · The Med
 * Bar". Relying on the layout's `title.default` for this page let that template
 * apply to it as well, and the tab read "The Med Bar · Loveland, CO · The Med
 * Bar". `absolute` opts out of every template above it, which is what a home
 * page wants — it is the one page whose title should be the business's full
 * name and nothing appended.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) return { title: 'Not found' };

  return {
    title: { absolute: `${clinic.name} · PRF & Regenerative Aesthetics · Loveland, CO` },
    description: 'The Med Bar in Loveland, CO specializes in PRF (Platelet-Rich Fibrin) under-eye & microneedling treatments, hair restoration, UV lashes, and medical-grade botanical skincare.'
  };
}

export default async function StorefrontHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const links = storefrontLinks(await storefrontBase(slug));

  const [services, providers, products] = await Promise.all([
    getStorefrontServices(clinic.id),
    getStorefrontProviders(clinic.id),
    getStorefrontProducts(clinic.id)
  ]);

  const isSpa = clinic.practice_type === 'med_spa';
  const hours = hoursLines(clinic.hours);
  const facts = Object.entries(clinic.visit_facts ?? {});

  // Signature work leads: the regenerative and injectable side for a med spa.
  const signature = services
    .filter(s => s.online_bookable)
    .filter(s => !isSpa || /injectable|paramedical|skin/.test(s.category))
    .slice(0, 6);

  // Lash tiers collapse to one line each: full set, then cheapest fill.
  const lashes = services.filter(s => s.category === 'lashes');
  const tiers = ['Classic', 'Hybrid', 'Volume']
    .map(tier => {
      const inTier = lashes.filter(s => s.name.includes(tier));
      const full = inTier.find(s => /full set/i.test(s.name));
      const fills = inTier
        .filter(s => /fill/i.test(s.name))
        .map(s => s.price_cents ?? 0)
        .filter(Boolean);
      return full ? { tier, full, from: fills.length ? Math.min(...fills) : null } : null;
    })
    .filter((t): t is { tier: string; full: typeof services[number]; from: number | null } => t !== null);

  const consult = services.find(s => s.category === 'consult');

  return (
    <>
      <section className="sf-stage">
        <div className="sf-wrap sf-stage-grid">
          <div>
            <h1 className="sf-display" aria-label="The bar where the good stuff comes from you.">
              <span className="ln"><span>The bar where </span></span>
              <span className="ln"><span>the good stuff </span></span>
              <span className="ln"><span>comes <i>from you</i>.</span></span>
            </h1>

            <p className="sf-lede sf-fade" style={{ animationDelay: '.95s' }}>
              {clinic.intro ??
                'Platelet-rich fibrin treatments — under-eyes, microneedling and hair restoration built on your own platelets, drawn and spun in the room. Plus lashes, facials and inkless scar revision.'}
            </p>

            <div className="sf-actions sf-fade" style={{ animationDelay: '1.1s' }}>
              <Link href={links.book} className="sf-btn primary">Book a treatment</Link>
              {consult && (
                <Link
                  href={`${links.book}?service=${encodeURIComponent(consult.id)}`}
                  className="sf-btn ghost"
                >
                  Free 15-minute consult
                </Link>
              )}
            </div>

            <p className="sf-note-line sf-fade" style={{ animationDelay: '1.25s' }}>
              Consultation and candidacy assessment before every regenerative treatment.
            </p>
          </div>

          <Centrifuge />
        </div>
      </section>

      <section className="sf-section sf-bordered">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>No lab. No second visit. One appointment, start to finish.</h2>
            <p>
              PRF is your own blood, concentrated. It never leaves the building,
              and nothing synthetic is added to it.
            </p>
          </div>
          <ProcessRail steps={PRF_PROCESS} />
        </div>
      </section>

      {signature.length > 0 && (
        <section className="sf-section sf-invert">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <h2>Signature treatments</h2>
              <p>
                Every regenerative service begins with a consultation to confirm
                you are a candidate and to set a realistic plan.
              </p>
            </div>

            <div className="sf-menu-group" style={{ marginTop: 'var(--gd-8)' }}>
              {signature.map(s => {
                const badge = s.name.includes('Jeuveau')
                  ? 'Neurotoxin'
                  : s.name.includes('Hair')
                  ? 'Follicle Restoration'
                  : s.name.includes('Microneedl')
                  ? 'Collagen Induction'
                  : s.name.includes('PRF')
                  ? 'Regenerative PRF'
                  : s.category === 'paramedical'
                  ? 'Scar Revision'
                  : null;

                return (
                  <article className="sf-item" key={s.id}>
                    <div className="sf-item-icon-box" aria-hidden="true">
                      <ServiceIcon name={s.name} category={s.category} />
                    </div>

                    <div className="sf-item-body">
                      {badge && <div className="sf-item-eyebrow">{badge}</div>}
                      <h3 className="sf-item-name">
                        <Link href={`${links.book}?service=${encodeURIComponent(s.id)}`} className="sf-item-title-link">
                          {s.name}
                        </Link>
                      </h3>
                      {s.description && <p className="sf-item-desc">{s.description}</p>}
                    </div>

                    <div className="sf-item-price">
                      <span className="amount">{priceLabel(s)}</span>
                      <span className="dur">{s.duration_min} min</span>
                      <Link
                        href={`${links.book}?service=${encodeURIComponent(s.id)}`}
                        className="sf-item-reserve"
                      >
                        Reserve <span>&rarr;</span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="sf-actions" style={{ marginTop: 'var(--gd-8)' }}>
              <Link href={links.services} className="sf-btn ghost">
                All {services.length} treatments &amp; pricing
              </Link>
              <Link href={links.shop} className="sf-btn ghost">Explore Shop</Link>
            </div>
          </div>
        </section>
      )}

      {products.length > 0 && (
        <section className="sf-section sf-bordered">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <div className="sf-eyebrow">Green Envee Botanicals</div>
              <h2>Take-home skincare ritual</h2>
              <p>
                The organic, cold-pressed plant formulas used in our treatment rooms.
                Formulated to calm, protect, and extend your regenerative results at home.
              </p>
            </div>

            <div className="sf-grid">
              {products.slice(0, 4).map(p => {
                const hasSecondary = Boolean(p.secondary_image_path);
                return (
                  <article className="sf-card" key={p.id}>
                    <div className={`sf-card-img${hasSecondary ? ' has-hover-img' : ''}`}>
                      {p.image_path ? (
                        <>
                          <img className="sf-card-img-primary" src={p.image_path} alt={p.name} loading="lazy" />
                          {p.secondary_image_path && (
                            <img className="sf-card-img-hover" src={p.secondary_image_path} alt={`${p.name} alternate view`} loading="lazy" />
                          )}
                        </>
                      ) : (
                        <span aria-hidden="true">{p.name.slice(0, 1)}</span>
                      )}
                    </div>

                    <div className="sf-card-body">
                      {p.brand && <div className="sf-card-brand">{p.brand}</div>}
                      <h3>
                        {p.slug
                          ? <Link href={`${links.shop}/${p.slug}`}>{p.name}</Link>
                          : p.name}
                      </h3>
                      {p.description && <p className="sf-card-desc">{p.description}</p>}
                    </div>

                    <div className="sf-card-foot">
                      <span className="sf-card-price">{money(p.price_cents)}</span>
                      <Link href={`${links.shop}/${p.slug ?? ''}`} className="sf-btn ghost sm">
                        View product
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="sf-actions" style={{ marginTop: 'var(--gd-8)' }}>
              <Link href={links.shop} className="sf-btn primary">
                Shop all {products.length} products &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

      {tiers.length > 0 && (
        <section className="sf-section sf-bordered">
          <div className="sf-wrap sf-split">
            <div>
              <h2 className="sf-display-sm">UV-cured lashes, no adhesive cure time</h2>
              <p className="sf-lede sm">
                Every set is mapped to your natural lashes and eye shape. Fills stay
                on a two- or three-week rhythm so the set never has to start over.
              </p>
            </div>
            <div>
              <div className="sf-tiers">
                {tiers.map(t => (
                  <div className="sf-tier" key={t.tier}>
                    <span>{t.tier}</span>
                    <span>
                      {priceLabel(t.full)} full set
                      {t.from ? ` · fills from ${money(t.from)}` : ''}
                    </span>
                  </div>
                ))}
              </div>
              <div className="sf-actions" style={{ marginTop: 'var(--gd-6)' }}>
                <Link href={links.services} className="sf-btn ghost sm">Lash menu</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {facts.length > 0 && (
        <section className="sf-section sf-bordered">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <h2>What actually happens</h2>
              <p>Worth knowing before a first visit. No surprises at the door.</p>
            </div>
            <dl className="sf-facts">
              {facts.map(([label, value]) => (
                <div className="sf-fact" key={label}>
                  <dt>{label.replace(/_/g, ' ')}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {providers.length > 0 && (
        <section className="sf-section sf-bordered">
          <div className="sf-wrap">
            <div className="sf-section-head"><h2>Who you&rsquo;ll see</h2></div>
            <div className="sf-people">
              {providers.slice(0, 2).map(p => (
                <article className="sf-person" key={p.id}>
                  <div className="sf-portrait">
                    {p.photo_path && /^(\/|https?:)/.test(p.photo_path)
                      ? <img src={p.photo_path} alt={p.name} width={480} height={600} />
                      : <span className="initials" aria-hidden="true">{initials(p.name)}</span>}
                  </div>
                  <div>
                    <h3>{p.name}{p.credentials ? `, ${p.credentials}` : ''}</h3>
                    {p.role_label && <p className="role">{p.role_label}</p>}
                    {p.bio
                      ? <p className="bio">{p.bio}</p>
                      : <p className="sf-pending">Biography to be supplied by the practice.</p>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="sf-section sf-centre">
        <div className="sf-wrap">
          <h2 className="sf-display-sm">Start with fifteen minutes.</h2>
          <p className="sf-lede centre">
            {clinic.booking_note ??
              'Bring your questions and whatever you have already tried. We will talk through what is realistic, what it costs, and whether you are a candidate — at no charge, with nothing booked at the end unless you want it.'}
          </p>
          <div className="sf-actions centre">
            <Link
              href={consult ? `${links.book}?service=${encodeURIComponent(consult.id)}` : links.book}
              className="sf-btn primary"
            >
              {consult ? 'Book the free consult' : 'Book an appointment'}
            </Link>
            {clinic.phone_voice && (
              <a href={`tel:${clinic.phone_voice}`} className="sf-btn ghost">Call the practice</a>
            )}
          </div>
          {hours[0] && (
            <p className="sf-note-line centre">
              {hours[0].days} &middot; {hours[0].window}
              {clinic.location_name ? ` · ${clinic.location_name}` : ''}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
