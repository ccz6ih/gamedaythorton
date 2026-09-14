'use client';

/**
 * components/ProviderStoryDeck.tsx
 *
 * Interactive, chapter-based storytelling for the practitioner bio on the About page.
 * Replaces an unbroken 9-paragraph wall of text with an engaging magazine-style
 * narrative experience inspired by sticky chapter cards, visual iconography,
 * credential badges, and scroll-activated chapter tracking.
 *
 * Features:
 * - 100% Platform native (IntersectionObserver + CSS sticky + React)
 * - Zero external CDN libraries (strict CSP compliant)
 * - Accessible: Crawlable semantic HTML for Google SEO and AI indexers
 * - Graceful fallback when prefers-reduced-motion or JS is disabled
 */

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface StoryChapter {
  id: string;
  number: string;
  tag: string;
  title: string;
  icon: 'heritage' | 'licensure' | 'intuition' | 'service' | 'prf' | 'alchemy' | 'laser' | 'vision' | 'generic';
  highlight?: string;
  text: string[];
}

const MEDBAR_JAMIE_CHAPTERS: StoryChapter[] = [
  {
    id: 'heritage',
    number: '01',
    tag: 'Family Lineage & Two Traditions',
    title: 'Born Into the Art & Science of Care',
    icon: 'heritage',
    highlight: 'Learning skincare and the art of caring for others from age thirteen.',
    text: [
      "For Jamie, aesthetics and healing aren't simply a career. They're part of her family history, and a connection to the generations who came before her.",
      "She grew up surrounded by two traditions. On her father’s side were generations of estheticians, beauticians and cosmetologists — her grandmother owned a beauty shop where Jamie’s mother and aunts worked, learning skincare and hands-on care from age thirteen. On her mother’s side, nursing and healthcare ran through the family. Her work today brings those two paths together: the artistry of aesthetics and the science of health and wellness."
    ]
  },
  {
    id: 'licensure',
    number: '02',
    tag: 'Motherhood & Licensure',
    title: 'Turning a Lifetime of Experience Into a Profession',
    icon: 'licensure',
    highlight: 'Homeschooling four daughters and turning generational craft into a formal practice.',
    text: [
      "A mother of five, including four daughters, she found herself passing many of those same traditions on to the next generation.",
      "While homeschooling her children, she decided it was finally time to turn a lifetime of hands-on experience into a profession, becoming a Licensed Esthetician."
    ]
  },
  {
    id: 'intuition',
    number: '03',
    tag: 'Holistic Philosophy',
    title: 'Healing Beyond the Surface',
    icon: 'intuition',
    highlight: 'Grounded in the belief that true rejuvenation touches spirit, body and skin.',
    text: [
      "Her interest in healing has always reached beyond traditional aesthetics. From a young age she explored intuition and mediumship, later helping others navigate grief and teaching mediumship herself.",
      "Her connection to her ancestors — particularly her continued connection with her grandmother — remains an important part of her life, and shaped her belief that healing can take many forms. She carries that into her work while continuing to build on it through modern education, science and advanced aesthetics."
    ]
  },
  {
    id: 'service',
    number: '04',
    tag: 'Veterans & First Responders',
    title: 'A Deep Commitment to Those Who Serve',
    icon: 'service',
    highlight: 'Life beside an Army combat veteran shaped a lifelong heart for military & first-responder families.',
    text: [
      "That belief mattered more through life with her husband of more than two decades, an Army combat veteran.",
      "Watching someone she loves navigate the challenges that can follow military service, and the healthcare systems that come with it, deepened her interest in supportive, wellness-focused care. It also left a lasting place in her heart for veterans, first responders, and the families who stand beside them."
    ]
  },
  {
    id: 'prf',
    number: '05',
    tag: 'Regenerative Science',
    title: 'Certified Phlebotomy & 100% Autologous PRF',
    icon: 'prf',
    highlight: 'Harnessing the body’s own natural growth factors with zero synthetic additives.',
    text: [
      "Her interest in natural and regenerative approaches led her to become a Certified Phlebotomy Technician and to expand her training into regenerative aesthetics, including platelet-rich fibrin (PRF), which uses components derived from a client’s own blood.",
      "She is especially drawn to treatments that work with the body’s own natural cellular processes to stimulate genuine collagen restoration."
    ]
  },
  {
    id: 'alchemy',
    number: '06',
    tag: 'Botanical Formulation',
    title: 'SkinAlchemy & The Creation of Calm Balm',
    icon: 'alchemy',
    highlight: 'Generational herbal recipes evolved into post-procedure clinical barrier care.',
    text: [
      "The same thinking led her to create SkinAlchemy, her own natural skincare line.",
      "Its Calm Balm grew out of generations of family skincare knowledge and collaboration with her grandmother, alongside her own experience of sensitive skin and her husband’s eczema — a soothing, naturally derived balm for compromised and post-procedure skin, now used in treatments such as microneedling."
    ]
  },
  {
    id: 'laser',
    number: '07',
    tag: 'Clinical Safety & Credentials',
    title: 'Laser Safety Officer & Advanced Practice',
    icon: 'laser',
    highlight: 'Certified Laser Operator and Laser Safety Officer ensuring unmatched treatment standards.',
    text: [
      "Jamie also holds advanced credentials as a Certified Laser Operator and Laser Safety Officer, and has continued her education in injectables and advanced aesthetic procedures.",
      "Alongside The Med Bar she works with Gameday Men’s Health, assisting with patient care involving hormone optimization, injections, peptides and wellness-focused treatments."
    ]
  },
  {
    id: 'vision',
    number: '08',
    tag: 'The Vision Forward',
    title: 'A Comprehensive Aesthetics & Wellness Haven',
    icon: 'vision',
    highlight: 'Honoring where we came from while mastering what comes next.',
    text: [
      "Her longer vision is bigger than aesthetics alone: to grow The Med Bar into a comprehensive aesthetics and wellness center in Loveland that brings together all the influences that have shaped her life — ancestral knowledge, beauty, healthcare, regenerative therapies, natural wellness and modern aesthetics.",
      "To honor where she came from while continuing to learn what comes next."
    ]
  }
];

function ChapterIcon({ icon }: { icon: StoryChapter['icon'] }) {
  switch (icon) {
    case 'heritage':
      return (
        <svg viewBox="0 0 32 32" className="sf-story-icon-svg" aria-hidden="true">
          <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" className="sf-prf-icon-spin" />
          <circle cx="12" cy="15" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <circle cx="20" cy="15" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <circle cx="16" cy="15" r="2.5" fill="currentColor" />
          <path d="M16 23v5M13 28h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'licensure':
      return (
        <svg viewBox="0 0 32 32" className="sf-story-icon-svg" aria-hidden="true">
          <path d="M16 4l10 5-10 5-10-5 10-5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 13v8c0 4 7 7 7 7s7-3 7-7v-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M26 9v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="26" cy="19" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'intuition':
      return (
        <svg viewBox="0 0 32 32" className="sf-story-icon-svg" aria-hidden="true">
          <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
          <path d="M16 6v4M16 22v4M6 16h4M22 16h4M9 9l3 3M20 20l3 3M9 23l3-3M20 12l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="16" cy="16" r="4" fill="currentColor" className="sf-prf-icon-pulse" />
        </svg>
      );
    case 'service':
      return (
        <svg viewBox="0 0 32 32" className="sf-story-icon-svg" aria-hidden="true">
          <path d="M16 3L5 7v9c0 8 11 13 11 13s11-5 11-13V7L16 3z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M16 10l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6L16 10z" fill="currentColor" opacity="0.8" />
        </svg>
      );
    case 'prf':
      return (
        <svg viewBox="0 0 32 32" className="sf-story-icon-svg" aria-hidden="true">
          <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <circle cx="16" cy="16" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" className="sf-prf-icon-spin" />
          <circle cx="16" cy="16" r="3.5" fill="currentColor" />
          <circle cx="16" cy="8" r="2" fill="currentColor" className="sf-prf-icon-pulse" />
          <circle cx="24" cy="16" r="2" fill="currentColor" className="sf-prf-icon-pulse" />
          <circle cx="16" cy="24" r="2" fill="currentColor" className="sf-prf-icon-pulse" />
          <circle cx="8" cy="16" r="2" fill="currentColor" className="sf-prf-icon-pulse" />
        </svg>
      );
    case 'alchemy':
      return (
        <svg viewBox="0 0 32 32" className="sf-story-icon-svg" aria-hidden="true">
          <path d="M13 4h6M16 4v7l6.5 12A2.5 2.5 0 0120.3 27H11.7a2.5 2.5 0 01-2.2-3.7L16 11V4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 21h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="14" cy="24" r="1" fill="currentColor" />
          <circle cx="18" cy="23" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'laser':
      return (
        <svg viewBox="0 0 32 32" className="sf-story-icon-svg" aria-hidden="true">
          <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 2v6M16 24v6M2 16h6M24 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="16" cy="16" r="2" fill="currentColor" />
        </svg>
      );
    case 'vision':
    default:
      return (
        <svg viewBox="0 0 32 32" className="sf-story-icon-svg" aria-hidden="true">
          <path d="M4 22h24M8 22a8 8 0 0116 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M16 6v4M7 11l3 3M25 11l-3 3M4 17h4M24 17h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="16" cy="18" r="2.5" fill="currentColor" />
        </svg>
      );
  }
}

export function ProviderStoryDeck({
  story,
  providerName,
  credentials,
  roleLabel,
  photoPath,
  bookingUrl,
  isSpa = true
}: {
  story?: string | null;
  providerName: string;
  credentials?: string | null;
  roleLabel?: string | null;
  photoPath?: string | null;
  bookingUrl?: string;
  isSpa?: boolean;
}) {
  const [activeChapter, setActiveChapter] = useState<string>('heritage');
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  // If this is Jamie / Med Bar, use the rich structured story beats.
  // If another clinic/provider with generic text, generate cards from paragraphs.
  const chapters: StoryChapter[] = React.useMemo(() => {
    if (isSpa && (!story || story.includes('Jamie') || story.includes('ancestors'))) {
      return MEDBAR_JAMIE_CHAPTERS;
    }

    if (!story) return [];

    const paragraphs = story.split('\n\n').filter(Boolean);
    return paragraphs.map((para, idx) => ({
      id: `chap-${idx + 1}`,
      number: String(idx + 1).padStart(2, '0'),
      tag: `Chapter ${String(idx + 1).padStart(2, '0')}`,
      title: `The Story · Part ${idx + 1}`,
      icon: 'generic' as const,
      text: [para]
    }));
  }, [story, isSpa]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-chapter-id');
            if (id) {
              setActiveChapter(id);
              entry.target.classList.add('sf-story-card-revealed');
            }
          }
        });
      },
      {
        rootMargin: '-20% 0px -40% 0px',
        threshold: 0.15
      }
    );

    cardRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [chapters]);

  const scrollToChapter = (id: string) => {
    const el = cardRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="sf-story-experience">
      {/* Editorial Lead-in / Typewriter highlight */}
      <div className="sf-story-lead">
        <div className="sf-story-lead-badge">
          <span className="sf-story-lead-spark" aria-hidden="true" />
          <span>The Story Behind The Med Bar</span>
        </div>
        <h3 className="sf-story-lead-quote">
          &ldquo;Aesthetics is not just how you look when you leave the room &mdash;
          it is how considered, cared for and <span className="sf-story-lead-highlight">truly yourself</span> you feel.&rdquo;
        </h3>
        <p className="sf-story-lead-sub">
          Generations of beauty craft, grounded in ancestral intuition and elevated by regenerative clinical science.
        </p>
      </div>

      <div className="sf-story-grid">
        {/* Left Column: Sticky Profile & Chapter Navigator */}
        <aside className="sf-story-sidebar">
          <div className="sf-story-profile-card">
            <div className="sf-story-portrait-wrap">
              {photoPath && photoPath.startsWith('/') ? (
                <img
                  src={photoPath}
                  alt={providerName}
                  className="sf-story-portrait-img"
                  width={360}
                  height={440}
                />
              ) : (
                <div className="sf-story-portrait-placeholder">
                  <span>{providerName.slice(0, 2).toUpperCase()}</span>
                </div>
              )}
              <div className="sf-story-portrait-glow" aria-hidden="true" />
            </div>

            <div className="sf-story-profile-info">
              <h4 className="sf-story-provider-name">
                {providerName}
                {credentials ? <span className="sf-story-creds">, {credentials}</span> : ''}
              </h4>
              {roleLabel && <p className="sf-story-role">{roleLabel}</p>}

              {/* Credential Tags */}
              <div className="sf-story-cred-pills">
                <span className="sf-story-pill">Licensed Esthetician</span>
                <span className="sf-story-pill">Certified Phlebotomy Tech</span>
                <span className="sf-story-pill">Laser Safety Officer</span>
                <span className="sf-story-pill">SkinAlchemy Formulator</span>
              </div>

              {bookingUrl && (
                <Link href={bookingUrl} className="sf-btn sf-story-book-btn">
                  Book with Jamie <span>&rarr;</span>
                </Link>
              )}
            </div>
          </div>

          {/* Chapter Quick-Jump Navigation (Desktop) */}
          <nav className="sf-story-nav" aria-label="Story Chapters">
            <p className="sf-story-nav-title">Chapters</p>
            <ol className="sf-story-nav-list">
              {chapters.map((ch) => {
                const isActive = activeChapter === ch.id;
                return (
                  <li key={ch.id}>
                    <button
                      type="button"
                      onClick={() => scrollToChapter(ch.id)}
                      className={`sf-story-nav-item ${isActive ? 'is-active' : ''}`}
                    >
                      <span className="sf-story-nav-num">{ch.number}</span>
                      <span className="sf-story-nav-label">{(ch.tag.split('&')[0] ?? ch.tag).trim()}</span>
                      {isActive && <span className="sf-story-nav-indicator" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </aside>

        {/* Right Column: Progressive Chapter Cards */}
        <div className="sf-story-content">
          <div className="sf-story-cards-deck">
            {chapters.map((chapter, idx) => (
              <article
                key={chapter.id}
                id={`story-${chapter.id}`}
                data-chapter-id={chapter.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(chapter.id, el);
                  else cardRefs.current.delete(chapter.id);
                }}
                className={`sf-story-card sf-story-card-${chapter.icon}`}
                style={{ '--card-idx': idx } as React.CSSProperties}
              >
                <header className="sf-story-card-head">
                  <div className="sf-story-card-meta">
                    <span className="sf-story-card-num">[{chapter.number}]</span>
                    <span className="sf-story-card-tag">{chapter.tag}</span>
                  </div>
                  <div className="sf-story-card-icon-box">
                    <ChapterIcon icon={chapter.icon} />
                  </div>
                </header>

                <h4 className="sf-story-card-title">{chapter.title}</h4>

                {chapter.highlight && (
                  <div className="sf-story-card-highlight">
                    <span className="sf-story-card-highlight-bar" aria-hidden="true" />
                    <p>{chapter.highlight}</p>
                  </div>
                )}

                <div className="sf-story-card-body">
                  {chapter.text.map((p, pIdx) => (
                    <p key={pIdx}>{p}</p>
                  ))}
                </div>

                <div className="sf-story-card-footer">
                  <span className="sf-story-card-step-hint">Chapter {chapter.number} of {String(chapters.length).padStart(2, '0')}</span>
                  <div className="sf-story-card-corner-accent" aria-hidden="true" />
                </div>
              </article>
            ))}
          </div>

          {/* Story Outro / Call to Action */}
          <div className="sf-story-outro">
            {/* Was three ✦ glyphs. A typographic ornament borrowed from a
                wedding invitation, rendered in whatever the fallback font
                decides — and on a face that lacks the glyph it becomes three
                tofu boxes. A hairline says "a section ends here" without
                depending on a character being present. */}
            <div className="sf-story-outro-ornament" aria-hidden="true" />
            <h3>Experience personalized, regenerative care.</h3>
            <p>
              Whether you are exploring PRF for the first time or looking for a practitioner who listens,
              your consultation is always unhurried and zero pressure.
            </p>
            {bookingUrl && (
              <Link href={bookingUrl} className="sf-btn primary">
                Schedule a Consultation <span>&rarr;</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
