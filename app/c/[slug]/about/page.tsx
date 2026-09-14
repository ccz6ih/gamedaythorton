/**
 * app/c/[slug]/about/page.tsx — the practice and the people.
 *
 * Where credentials or a biography are missing, this says so rather than
 * filling the space. The Med Bar fixtures carry null for both on purpose: we
 * do not write a clinician's qualifications for them, and an invented
 * credential on a medical page is not a placeholder, it is a false claim.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getStorefront, getStorefrontProviders, hoursLines } from '@/lib/db/storefront';
import { storefrontBase, storefrontLinks } from '@/lib/storefront-links';
import { initials, phone } from '@/lib/format';
import { ProviderStoryDeck } from '@/components/ProviderStoryDeck';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) return { title: 'Not found' };

  const isSpa = clinic.practice_type === 'med_spa';
  return {
    title: isSpa ? 'About The Med Bar | Loveland Med Spa' : 'About',
    description: isSpa
      ? 'Meet The Med Bar, a thoughtful med spa in Loveland, Colorado offering PRF, injectables, facials, lashes and paramedical scar revision.'
      : clinic.intro ?? undefined
  };
}

export default async function StorefrontAbout({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);
  if (!clinic) notFound();

  const links = storefrontLinks(await storefrontBase(slug));

  const providers = await getStorefrontProviders(clinic.id);
  const hours = hoursLines(clinic.hours);
  const facts = Object.entries(clinic.visit_facts ?? {});
  const isSpa = clinic.practice_type === 'med_spa';

  return (
    <>
      <header className="sf-stage sf-about-stage">
        <div className="sf-wrap sf-stage-grid">
          <div>
            <div className="sf-eyebrow">About {clinic.name}</div>
            {isSpa ? (
              <>
                <h1 className="sf-display">
                  <span className="ln"><span>Beauty, but</span></span>
                  <span className="ln"><span>make it <i>personal.</i></span></span>
                </h1>
                <p className="sf-lede sf-fade" style={{ animationDelay: '.7s' }}>
                  A thoughtful med spa in Loveland, Colorado for the moments
                  when you want to look rested, feel considered and leave more
                  like yourself.
                </p>
              </>
            ) : (
              <>
                <h1 className="sf-display">
                  <span className="ln"><span>Care that</span></span>
                  <span className="ln"><span>starts with</span></span>
                  <span className="ln"><span><i>listening.</i></span></span>
                </h1>
                {clinic.intro && <p className="sf-lede sf-fade" style={{ animationDelay: '.7s' }}>{clinic.intro}</p>}
              </>
            )}
            <div className="sf-about-orbit" aria-hidden="true">
              <span className="sf-about-orbit-line sf-about-orbit-line-a" />
              <span className="sf-about-orbit-line sf-about-orbit-line-b" />
              <span className="sf-about-orbit-dot sf-about-orbit-dot-a" />
              <span className="sf-about-orbit-dot sf-about-orbit-dot-b" />
              <span className="sf-about-orbit-word">made for you</span>
            </div>
          </div>

          <div className="sf-about-manifesto sf-fade" style={{ animationDelay: '.95s' }}>
            <p className="sf-about-manifesto-kicker">The idea</p>
            <p>
              The best work does not announce itself. It feels like a version
              of you that was already there, waiting for a little attention.
            </p>
            {isSpa && (
              <Link href={links.services} className="sf-btn ghost">
                Explore the treatments <span>&rarr;</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {isSpa && (
        <section className="sf-section sf-bordered">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <h2>A studio for your own kind of beautiful.</h2>
              <p>
                The Med Bar brings regenerative treatments, injectables,
                facials, lashes and paramedical scar revision into one
                considered experience — with time to ask questions and space
                to make a decision that feels like yours.
              </p>
            </div>

            <div className="sf-about-principles">
              <article>
                <span className="sf-about-number">01</span>
                <h3>Start with you</h3>
                <p>Your goals, your features, your pace. Consultation comes before a plan.</p>
              </article>
              <article>
                <span className="sf-about-number">02</span>
                <h3>Keep it considered</h3>
                <p>Thoughtful treatment over a one-size-fits-all menu of promises.</p>
              </article>
              <article>
                <span className="sf-about-number">03</span>
                <h3>Leave room for real life</h3>
                <p>Clear pricing, honest expectations and a visit that fits into your day.</p>
              </article>
            </div>
          </div>
        </section>
      )}

      {providers.length > 0 && (
        <section className="sf-section">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <h2>{isSpa ? 'The person behind the practice' : 'The team'}</h2>
              {isSpa && (
                <p>
                  A small practice means your experience is personal from the
                  first hello. Meet the person making the room what it is.
                </p>
              )}
            </div>
            {isSpa && providers[0]?.story ? (
              <ProviderStoryDeck
                story={providers[0].story}
                providerName={providers[0].name}
                credentials={providers[0].credentials}
                roleLabel={providers[0].role_label}
                photoPath={providers[0].photo_path}
                bookingUrl={links.book}
                isSpa={isSpa}
              />
            ) : (
              <div className="sf-people">
                {providers.map(p => (
                  <article className="sf-person" key={p.id}>
                    <div className="sf-portrait">
                      {p.photo_path?.startsWith('/')
                        ? <img src={p.photo_path} alt={p.name} width={480} height={600} />
                        : <span className="initials" aria-hidden="true">{initials(p.name)}</span>}
                    </div>
                    <div>
                      <h3>{p.name}{p.credentials ? `, ${p.credentials}` : ''}</h3>
                      {p.role_label && <p className="role">{p.role_label}</p>}
                      {p.bio
                        ? <p className="bio">{p.bio}</p>
                        : (
                          <p className="sf-pending">
                            Biography {p.credentials ? '' : 'and credentials '}
                            to be supplied by the practice. Nothing here is written
                            on a practitioner&rsquo;s behalf.
                          </p>
                        )}

                      {/* The long version, in full, for a reader who has come
                          this far. It is the thing that actually distinguishes
                          this practice from the one down the road, so it is not
                          hidden behind a "read more" that most people never
                          press — the about page IS the read-more. */}
                      {p.story && (
                        <div className="sf-story">
                          {p.story.split('\n\n').map((para, i) => (
                            <p key={i}>{para}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {facts.length > 0 && (
        <section className="sf-section">
          <div className="sf-wrap">
            <div className="sf-section-head">
              <h2>Before your first visit</h2>
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

      <section className="sf-section">
        <div className="sf-wrap">
          <div className="sf-section-head">
            <h2>Finding us</h2>
          </div>
          <div className="sf-foot-grid">
            <div>
              <h4>Address</h4>
              <address>
                {clinic.address_line1}<br />
                {clinic.address_line2 && <>{clinic.address_line2}<br /></>}
                {clinic.address_city}, {clinic.address_state} {clinic.address_zip}
              </address>
              {clinic.address_note && <p style={{ marginTop: '.5rem' }}>{clinic.address_note}</p>}
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

          <div className="sf-actions" style={{ marginTop: 'var(--gd-8)' }}>
            <Link href={links.enquire} className="sf-btn primary">Request an appointment</Link>
          </div>
        </div>
      </section>
    </>
  );
}
