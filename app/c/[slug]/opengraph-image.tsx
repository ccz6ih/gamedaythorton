/**
 * app/c/[slug]/opengraph-image.tsx
 * The picture that appears when somebody shares a link to this practice.
 *
 * GENERATED, NOT A FILE, because there is more than one tenant. A committed
 * 1200x630 PNG would be one practice's card served for every practice, and
 * keeping a folder of hand-made images in sync with a brand kit somebody can
 * edit in the console is a job nobody will do twice.
 *
 * It reads the same brand kit the site does, so a colour changed on the
 * appearance screen changes the share card too, with nothing to remember.
 *
 * DELIBERATELY TYPOGRAPHIC. next/og has only the fonts you hand it, and
 * fetching the practice's display face on every render to draw one line of text
 * is a lot of machinery for a thumbnail. The system font on her green, with her
 * gold, reads correctly at the size these are actually seen — a 400px-wide
 * rectangle in a message thread.
 */

import { ImageResponse } from 'next/og';
import { getStorefront } from '@/lib/db/storefront';

export const runtime = 'nodejs';
export const alt = 'The practice';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clinic = await getStorefront(slug);

  const brand = (clinic?.brand ?? {}) as Record<string, string>;
  const bg = brand.bg || '#0E1711';
  const accent = brand.accent || '#C9A227';
  const name = clinic?.name ?? 'The practice';

  const where = clinic?.address_city && clinic?.address_state
    ? `${clinic.address_city}, ${clinic.address_state}`
    : clinic?.location_name ?? '';

  const tagline = clinic?.tagline
    ?? 'Aesthetics, lashes and regenerative treatments.';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: bg,
          padding: '72px 88px',
          fontFamily: 'Georgia, serif'
        }}
      >
        {/* A rule in the accent, so the card is recognisably hers at a glance
            even before anybody reads the words. */}
        <div style={{ display: 'flex', width: 96, height: 4, background: accent, marginBottom: 44 }} />

        <div style={{ display: 'flex', fontSize: 88, color: '#F4F1EA', letterSpacing: -2, lineHeight: 1.05 }}>
          {name}
        </div>

        {where && (
          <div style={{ display: 'flex', fontSize: 30, color: accent, marginTop: 18, letterSpacing: 4, textTransform: 'uppercase' }}>
            {where}
          </div>
        )}

        <div style={{ display: 'flex', fontSize: 34, color: 'rgba(244,241,234,0.72)', marginTop: 34, maxWidth: 880, lineHeight: 1.35 }}>
          {tagline}
        </div>
      </div>
    ),
    size
  );
}
