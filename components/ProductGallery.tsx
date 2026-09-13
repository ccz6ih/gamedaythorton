'use client';

/**
 * components/ProductGallery.tsx
 * The photographs on a product page.
 *
 * One image renders as a plain picture with no thumbnails and no controls,
 * because a gallery of one is furniture pretending to be a feature.
 *
 * With more than one, thumbnails sit under the main image. Arrow keys move
 * between them, since a keyboard user landing on a row of image buttons
 * reasonably expects that to work.
 *
 * Deliberately no lightbox, no zoom-on-hover, no carousel that advances by
 * itself. These are 1000px product shots on white; the thing that helps
 * somebody decide is seeing the second angle, not magnifying the first.
 */

import { useState } from 'react';

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="sf-product-gallery">
        <div className="sf-product-main sf-product-empty" aria-hidden="true">
          {name.slice(0, 1)}
        </div>
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)]!;

  return (
    <div className="sf-product-gallery">
      <div className="sf-product-main">
        <img src={current} alt={name} />
      </div>

      {images.length > 1 && (
        <div
          className="sf-product-thumbs"
          role="group"
          aria-label={`Photographs of ${name}`}
          onKeyDown={e => {
            if (e.key === 'ArrowRight') setActive(i => (i + 1) % images.length);
            if (e.key === 'ArrowLeft') setActive(i => (i - 1 + images.length) % images.length);
          }}
        >
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              className={`sf-product-thumb${i === active ? ' is-active' : ''}`}
              aria-label={`Photograph ${i + 1} of ${images.length}`}
              aria-pressed={i === active}
              onClick={() => setActive(i)}
            >
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
