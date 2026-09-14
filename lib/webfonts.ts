/**
 * lib/webfonts.ts
 * One Google Fonts request for whatever faces a brand kit actually names.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT A STRING IN THE LAYOUT
 * ---------------------------------------------------------------------------
 * It was. The storefront layout carried a hardcoded Cormorant Garamond URL
 * behind `if (/Cormorant/i.test(brand.displayFont))` — so the ONLY webfont any
 * practice could ever load was the one this project happened to pick first.
 * Adding a second face to the brand kit would have set `font-family` to a name
 * the browser had never heard of, and the page would have rendered in Georgia
 * while looking, in the database, perfectly configured.
 *
 * That is not hypothetical: the console has been doing exactly that. It reads
 * the same kit and asks for Cormorant, but only the storefront ever injected
 * the link, so every console screen has been rendering in the Georgia fallback
 * since the day the practice chose a face.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT WILL AND WILL NOT ASK FOR
 * ---------------------------------------------------------------------------
 * Only families on the allowlist below. A brand kit is data, and data that
 * reaches a URL is an injection surface — without a fixed list, a kit could
 * name anything and this would fetch it. Adding a face is a code change, which
 * is the right amount of friction for something that loads a third-party
 * resource onto every page of a practice's site.
 *
 * The weights are declared per family rather than requested wholesale. Asking
 * for every weight of a variable font is megabytes for the three the design
 * uses.
 */

const GOOGLE = 'https://fonts.googleapis.com/css2';

/**
 * family name → the axis spec to request.
 *
 * Keys are matched case-insensitively against the font stacks in the kit, so
 * '"Cormorant Garamond", Georgia, serif' finds Cormorant Garamond.
 */
const ALLOWED: { match: RegExp; family: string; axes: string }[] = [
  {
    match: /cormorant\s*garamond/i,
    family: 'Cormorant Garamond',
    // Italic is used by the display headings (<i> inside .sf-display).
    axes: 'ital,wght@0,400;0,600;0,700;1,400'
  },
  { match: /\bpoppins\b/i, family: 'Poppins', axes: 'wght@400;500;600;700' },
  { match: /\barchivo\b/i, family: 'Archivo', axes: 'wght@400;500;600;700' }
];

/**
 * MONTSERRAT IS DELIBERATELY ABSENT FROM THAT LIST.
 *
 * It is the interface face for the storefront AND the console, and it is
 * self-hosted from /public/fonts with an @font-face in tokens.css. Listing it
 * here would fetch 38KB a second time from a third party onto a page that
 * already has the file.
 *
 * It matters more than the bytes: the console shares that stylesheet and its
 * content security policy admits no external font origin, deliberately —
 * CLAUDE.md rule 3, nothing third-party from behind a login. A face used on
 * both sides has to be served from our own origin or it works in one place and
 * silently falls back in the other.
 *
 * A family belongs on this list only when it is used on the PUBLIC storefront
 * and nowhere else.
 */

/**
 * The single stylesheet href for these stacks, or null when none of them names
 * a family we host.
 *
 * One request for all of them: Google serves multiple `family=` parameters in
 * a single response, and two <link>s would be two round trips on the critical
 * path for no benefit.
 */
export function googleFontsHref(stacks: (string | null | undefined)[]): string | null {
  const wanted = new Map<string, string>();

  for (const stack of stacks) {
    if (!stack) continue;
    for (const entry of ALLOWED) {
      if (entry.match.test(stack)) wanted.set(entry.family, entry.axes);
    }
  }

  if (wanted.size === 0) return null;

  // Sorted so the same set of faces always produces the same URL, which keeps
  // it cacheable and keeps the rendered markup stable between deploys.
  const families = [...wanted.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([family, axes]) => `family=${family.replace(/ /g, '+')}:${axes}`)
    .join('&');

  return `${GOOGLE}?${families}&display=swap`;
}
