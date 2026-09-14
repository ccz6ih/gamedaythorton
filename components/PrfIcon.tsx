type PrfIconName = 'blood' | 'spin' | 'place' | 'origin';

type PrfIconProps = {
  name: PrfIconName;
};

/**
 * Small, inline PRF illustrations for the education page.
 *
 * These are intentionally SVG rather than a Lottie dependency: the storefront
 * CSP allows no third-party scripts, and these marks need to work on a
 * double-clicked preview as well as in production. Motion is CSS-only and
 * respects prefers-reduced-motion in storefront.css.
 */
export function PrfIcon({ name }: PrfIconProps) {
  if (name === 'blood') {
    return (
      <svg className="sf-prf-icon" viewBox="0 0 48 48" aria-hidden="true">
        <path className="sf-prf-icon-drop" d="M24 5C19 13 12 19 12 28a12 12 0 0 0 24 0c0-9-7-15-12-23Z" />
        <path d="M18 28c0 4 2.6 7 6 7" />
        <circle className="sf-prf-icon-spark" cx="31" cy="15" r="2" />
      </svg>
    );
  }

  if (name === 'spin') {
    return (
      <svg className="sf-prf-icon" viewBox="0 0 48 48" aria-hidden="true">
        <circle className="sf-prf-icon-ring" cx="24" cy="24" r="16" />
        <circle className="sf-prf-icon-ring sf-prf-icon-ring-inner" cx="24" cy="24" r="8" />
        <path d="M24 3v7M24 38v7M3 24h7M38 24h7" />
        <circle className="sf-prf-icon-orbit" cx="24" cy="8" r="2" />
      </svg>
    );
  }

  if (name === 'place') {
    return (
      <svg className="sf-prf-icon" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 44S10 31 10 19a14 14 0 0 1 28 0c0 12-14 25-14 25Z" />
        <circle cx="24" cy="19" r="5" />
        <path className="sf-prf-icon-pulse" d="M6 11h5M37 11h5" />
      </svg>
    );
  }

  return (
    <svg className="sf-prf-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 42V7M24 13 16 6M24 20l9-8M24 28l-10-8M24 35l9-7" />
      <circle cx="24" cy="7" r="3" />
      <circle cx="16" cy="6" r="2.5" />
      <circle cx="33" cy="12" r="2.5" />
      <circle cx="14" cy="20" r="2.5" />
      <circle cx="33" cy="28" r="2.5" />
    </svg>
  );
}
