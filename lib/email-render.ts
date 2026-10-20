/**
 * lib/email-render.ts
 * Turning content into email HTML. Pure — no database, no Next, no imports.
 *
 * SPLIT FROM lib/email-theme.ts DELIBERATELY. That module reaches for Supabase
 * to find out what a practice looks like, which makes it unloadable outside a
 * request. This half is a function from data to a string, so it can be compiled
 * on its own and rendered to a file you can open in a browser — which is the
 * only honest way to check an email, since nothing about it can be seen from a
 * passing test.
 *
 * Everything about WHY it is shaped this way — tables, inline styles, the
 * preheader as a privacy surface, light-only — is documented in email-theme.ts.
 */

export type EmailBrand = {
  clinicName: string;
  accent: string;
  accentInk: string;
  paper: string;
  card: string;
  ink: string;
  inkMuted: string;
  border: string;
  radius: string;
  displayFont: string;
  bodyFont: string;
  logoUrl: string | null;
  /**
   * The colour the logo was DRAWN for.
   *
   * A practice uploads one logo file, and it is drawn to sit on that
   * practice's own site background. The Med Bar's is white-on-near-black, and
   * rendering it on this cream paper produced a header that was simply blank
   * — the first real order confirmation went out with an invisible logo.
   *
   * Taking the practice's own background and putting the mark on a band of it
   * is correct by construction and needs nobody to pick a variant: whatever
   * ground the logo was made for is the ground it gets. Null means the
   * practice has no opinion, and the logo sits on the paper as before.
   */
  logoBackdrop: string | null;
  addressText: string | null;
  phone: string | null;
  origin: string;
};

/** Sensible neutral defaults, used when the clinic row cannot be read. */
export function defaultBrand(clinicName: string, origin: string): EmailBrand {
  return {
    clinicName,
    accent: '#16201A',
    accentInk: '#FFFFFF',
    paper: '#EFE7DA',
    card: '#FFFFFF',
    ink: '#16201A',
    inkMuted: '#5C6560',
    border: '#E1D8C8',
    radius: '10px',
    /**
     * SINGLE QUOTES INSIDE THE FONT STACK, AND IT IS NOT COSMETIC.
     *
     * These strings are interpolated into `style="..."` attributes. A double
     * quote in the value closes the attribute early, so everything after it —
     * including `color` — is dropped and the browser parses the remainder as
     * stray attributes. The visible symptom was a Pay button whose white label
     * vanished: the anchor lost its colour and inherited the stylesheet's dark
     * `a { color }`, giving dark text on a dark button.
     *
     * Single quotes are valid CSS for a family name with a space and survive
     * inside a double-quoted attribute. cssSafe() below defends the same thing
     * for a font name the practice sets in its brand kit.
     */
    displayFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    logoUrl: null,
    logoBackdrop: null,
    addressText: null,
    phone: null,
    origin
  };
}
/* ---------------------------------------------------------------- render ---- */

/** Everything that goes into a message, as content rather than markup. */
export type EmailContent = {
  /** The inbox preview line. Neutral — see the note at the top of this file. */
  preheader: string;
  greeting?: string | null;
  /** Paragraphs, in order. */
  lines?: (string | null)[];
  /** The highlighted block: what, when, where. */
  panel?: {
    label: string;
    value: string;
    /**
     * Stops the mail client turning this into a link.
     *
     * Gmail on desktop and iOS both detect anything that looks like a postal
     * address and wrap it in their OWN anchor — blue, underlined, pointing at
     * a map. A shipping address rendered that way looks like broken
     * navigation, which is exactly how the first order confirmation read.
     *
     * CSS cannot win that fight: the anchor is injected after the styles
     * resolve and carries the client's own colour. The reliable answer is to
     * get there first — text already inside an anchor is not linkified again,
     * so the value is wrapped in one that is styled to look like the text
     * around it and points somewhere honest.
     */
    asAddress?: boolean;
  }[] | null;
  /**
   * How the panel reads.
   *
   * 'stack' (the default) puts a small-caps label above a bold value, which
   * suits "Treatment / Microneedling with PRF".
   *
   * 'ledger' puts them on one line with the value hard right, which is the
   * only way a list of money reads as a list of money — stacked, an invoice
   * becomes six lines of alternating words and numbers and the total stops
   * looking like a total.
   */
  panelLayout?: 'stack' | 'ledger';
  /**
   * Money, under the panel, ruled off with the total last.
   *
   * Separate from `panel` because they are different things rendered
   * differently: a panel row labels a fact, a ledger row is an amount that has
   * to line up with the amounts above it. Cramming an itemised list into one
   * panel value produced "1 x Green Envee Refine Polishing Facial Scrub —
   * $45.50" as a single run of text, which is a sentence, not an invoice.
   */
  ledger?: { label: string; value: string }[] | null;
  /** A single action. More than one button in an email is none. */
  cta?: { label: string; url: string } | null;
  /** A quieter aside under the action, e.g. a consent notice. */
  note?: string | null;
  /** Free text under the footer rule, e.g. why this was sent. */
  footerLines?: (string | null)[];
};

/**
 * HTML-escape. Every value that reaches these templates is somebody's typed
 * input — a client's name, the note they left, a service name — and an
 * unescaped ampersand is the least of what can go in one.
 */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * A value the mail client must not linkify.
 *
 * Wrapped in an anchor that is styled to look like the surrounding text.
 * Clients do not detect an address inside an existing link, so getting there
 * first is the only thing that reliably holds — inline CSS loses, because the
 * client's anchor is injected after styles resolve and brings its own colour.
 *
 * The href is a map search for the address itself, which is the one
 * destination that is actually useful if somebody does tap it. Checking the
 * address they typed is a reasonable thing to want from a confirmation.
 */
function addressSafe(value: unknown, colour: string): string {
  const text = String(value ?? '');
  const parts = text.split(/\r?\n/).filter(Boolean);
  const href = 'https://maps.google.com/?q=' + encodeURIComponent(parts.join(', '));
  const shown = parts.map(esc).join('<br />');
  return `<a href="${esc(href)}" style="color:${colour};text-decoration:none;border:0;">${shown}</a>`;
}

/** Line breaks a person typed, preserved without letting markup through. */
function escMultiline(value: unknown): string {
  return esc(value).replace(/\r?\n/g, '<br />');
}

/**
 * A value safe to drop inside style="…".
 *
 * Every brand value here comes from the practice's own kit in the database —
 * a font name, a hex colour, a radius — and all of them are interpolated into
 * a double-quoted HTML attribute. One double quote in any of them silently
 * truncates the whole declaration list. Quotes become apostrophes rather than
 * being stripped, because a font family with a space genuinely needs them.
 */
function cssSafe(value: string): string {
  return String(value ?? '').replace(/"/g, "'").replace(/[<>]/g, '');
}

export function renderEmail(brand: EmailBrand, content: EmailContent): string {
  const accent = cssSafe(brand.accent);
  const accentInk = cssSafe(brand.accentInk);
  const paper = cssSafe(brand.paper);
  const card = cssSafe(brand.card);
  const ink = cssSafe(brand.ink);
  const inkMuted = cssSafe(brand.inkMuted);
  const border = cssSafe(brand.border);
  const radius = cssSafe(brand.radius);
  const displayFont = cssSafe(brand.displayFont);
  const bodyFont = cssSafe(brand.bodyFont);

  /**
   * The logo, on the ground it was drawn for.
   *
   * When the practice has a background of its own, the mark sits in a band of
   * it rather than directly on the paper. Without this a white logo on cream
   * paper renders as nothing at all, which is exactly what the first real
   * order confirmation looked like.
   *
   * A table rather than a div with padding, because Outlook ignores padding
   * on a block element often enough to matter and this is the one element
   * whose background is load-bearing.
   */
  const logoBackdrop = brand.logoBackdrop ? cssSafe(brand.logoBackdrop) : null;

  const logoImg = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.clinicName)}" width="150"
           style="display:block;width:150px;max-width:60%;height:auto;border:0;outline:none;text-decoration:none;" />`
    : null;

  const header = logoImg
    ? (logoBackdrop
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"
                  style="border-collapse:separate;">
             <tr>
               <td bgcolor="${logoBackdrop}"
                   style="background:${logoBackdrop};border-radius:${radius};padding:18px 22px;">
                 ${logoImg}
               </td>
             </tr>
           </table>`
        : logoImg)
    : `<div style="font-family:${displayFont};font-size:22px;line-height:1.3;color:${ink};letter-spacing:.01em;">
         ${esc(brand.clinicName)}
       </div>`;

  const panel = content.panel?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
              style="margin:24px 0;border-collapse:separate;">
         <tr>
           <td style="background:${paper};border:1px solid ${border};border-radius:${radius};padding:20px 22px;">
             ${content.panel.map((row, i, all) => {
               if (content.panelLayout === 'ledger') {
                 // The last row is the total: ruled off and heavier, so the eye
                 // lands on the number that matters without reading the rest.
                 const isTotal = i === all.length - 1 && all.length > 1;
                 return `
               <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                 <tr>
                   <td style="font-family:${bodyFont};font-size:15px;line-height:1.5;color:${ink};
                              padding:${isTotal ? '10px 0 0' : '0 0 8px'};
                              ${isTotal ? `border-top:1px solid ${border};font-weight:700;` : ''}">
                     ${escMultiline(row.label)}
                   </td>
                   <td align="right" style="font-family:${bodyFont};font-size:15px;line-height:1.5;
                              color:${ink};white-space:nowrap;padding:${isTotal ? '10px 0 0 12px' : '0 0 8px 12px'};
                              ${isTotal ? `border-top:1px solid ${border};font-weight:700;` : ''}">
                     ${esc(row.value)}
                   </td>
                 </tr>
               </table>`;
               }
               return `
               <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                 <tr>
                   <td style="font-family:${bodyFont};font-size:12px;line-height:1.4;color:${inkMuted};
                              text-transform:uppercase;letter-spacing:.07em;padding:0 0 3px;">
                     ${esc(row.label)}
                   </td>
                 </tr>
                 <tr>
                   <td style="font-family:${bodyFont};font-size:16px;line-height:1.5;color:${ink};
                              font-weight:600;padding:0 0 14px;">
                     ${row.asAddress ? addressSafe(row.value, ink) : escMultiline(row.value)}
                   </td>
                 </tr>
               </table>`;
             }).join('')}
           </td>
         </tr>
       </table>`
    : '';

  /**
   * The money, ruled, with the total last and heavier.
   *
   * A panel row labels a fact; a ledger row is an amount that has to line up
   * with the amounts above it. Before this, an itemised order was crammed into
   * one panel value and came out as a sentence — "1 x Green Envee Refine
   * Polishing Facial Scrub — $45.50" — which reads as prose rather than as a
   * receipt, and gives the total nowhere to stand out.
   *
   * The accent rule above the total is the only place a practice's own colour
   * appears in the body. One line, on the number that matters.
   */
  const ledger = content.ledger?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
              style="margin:4px 0 24px;border-collapse:collapse;">
         ${content.ledger.map((row, i, all) => {
           const isTotal = i === all.length - 1 && all.length > 1;
           const pad = isTotal ? '12px 0 0' : '0 0 9px';
           const weight = isTotal ? '700' : '400';
           const size = isTotal ? '17px' : '15px';
           const rule = isTotal ? `border-top:2px solid ${accent};` : '';
           return `<tr>
             <td style="font-family:${bodyFont};font-size:${size};line-height:1.45;color:${ink};
                        font-weight:${weight};padding:${pad};${rule}">
               ${escMultiline(row.label)}
             </td>
             <td align="right" style="font-family:${bodyFont};font-size:${size};line-height:1.45;
                        color:${ink};font-weight:${weight};white-space:nowrap;
                        padding:${pad};padding-left:14px;${rule}">
               ${esc(row.value)}
             </td>
           </tr>`;
         }).join('')}
       </table>`
    : '';

  /**
   * A "bulletproof" button: the colour is on the <td>, not the <a>, because
   * Outlook drops background on an anchor. The padding is on the anchor so the
   * whole rectangle is the tap target, which matters on a phone.
   */
  const cta = content.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
         <tr>
           <td align="center" bgcolor="${accent}" style="background:${accent};border-radius:${radius};">
             <a href="${esc(content.cta.url)}"
                style="display:inline-block;padding:14px 30px;font-family:${bodyFont};font-size:16px;
                       line-height:1;font-weight:600;color:${accentInk};text-decoration:none;
                       border-radius:${radius};">
               ${esc(content.cta.label)}
             </a>
           </td>
         </tr>
       </table>`
    : '';

  const paragraphs = (content.lines ?? [])
    .filter((l): l is string => typeof l === 'string' && l.length > 0)
    .map(l => `<p style="margin:0 0 14px;font-family:${bodyFont};font-size:16px;line-height:1.6;color:${ink};">
                 ${escMultiline(l)}
               </p>`)
    .join('');

  const footer = (content.footerLines ?? [])
    .filter((l): l is string => typeof l === 'string' && l.length > 0)
    .map(l => `<p style="margin:0 0 6px;font-family:${bodyFont};font-size:12px;line-height:1.6;color:${inkMuted};">
                 ${escMultiline(l)}
               </p>`)
    .join('');

  const contactLine = [brand.addressText, brand.phone].filter(Boolean).join(' · ');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<!--
  An address in an email is data, not a link. iOS and some Gmail builds detect
  one and style it as a blue underlined anchor, which is how a shipping
  address rendered as three stacked links in the first order confirmation —
  unreadable, and inviting a tap that does nothing useful.
-->
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(brand.clinicName)}</title>
<style>
  /* Gmail keeps a little of this; everything structural is inline regardless. */
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  a { color: ${accent}; }
  /* The other half of format-detection: iOS wraps detected text in its own
     anchor regardless, so the anchor is told to look like the text around it. */
  a[x-apple-data-detectors] {
    color: inherit !important; text-decoration: none !important;
    font-size: inherit !important; font-family: inherit !important;
    font-weight: inherit !important; line-height: inherit !important;
  }
  @media only screen and (max-width:620px) {
    .gd-card { padding: 28px 22px !important; }
    .gd-shell { padding: 16px 12px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${paper};color-scheme:light;">

<!-- Inbox preview. Deliberately dull: it is visible without opening anything. -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;
            mso-hide:all;font-family:${bodyFont};">
  ${esc(content.preheader)}
</div>
<!-- Stops the client padding the preview out with the body text that follows. -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;
            mso-hide:all;">
  &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="background:${paper};border-collapse:collapse;">
  <tr>
    <td align="center" class="gd-shell" style="padding:32px 16px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
             style="width:100%;max-width:600px;border-collapse:separate;">

        ${logoBackdrop ? '' : `
        <tr>
          <td align="left" style="padding:0 0 22px;">
            ${header}
          </td>
        </tr>`}

        ${logoBackdrop ? `
        <!--
          A MASTHEAD, NOT A STICKER.

          The logo used to sit in its own row above the card: a small dark
          square, left-aligned, floating on the paper and touching nothing.
          It read as something pasted on rather than part of the design, which
          is exactly what the practice said when she saw it.

          Full width, flush on top of the card, square-cornered where it meets
          the body. Email clients are unreliable about border-radius on a cell
          that abuts another, so the top corners are the only ones rounded and
          the join is left hard.
        -->
        <tr>
          <td align="left" bgcolor="${logoBackdrop}"
              style="background:${logoBackdrop};padding:18px 32px;
                     border:1px solid ${logoBackdrop};border-bottom:0;
                     border-radius:${radius} ${radius} 0 0;">
            ${/*
              Smaller here than it would be floating on its own. A stacked
              wordmark is nearly as tall as it is wide, so 150px of width
              bought about 150px of black — a band deeper than the greeting
              under it. 112px keeps it legible and keeps the masthead a
              masthead.
            */''}
            ${brand.logoUrl
              ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.clinicName)}" width="112"
                      style="display:block;width:112px;max-width:45%;height:auto;border:0;outline:none;text-decoration:none;" />`
              : `<div style="font-family:${displayFont};font-size:20px;line-height:1.3;color:#ffffff;">${esc(brand.clinicName)}</div>`}
          </td>
        </tr>` : ''}

        <tr>
          <td class="gd-card"
              style="background:${card};border:1px solid ${border};${logoBackdrop
                ? `border-top:0;border-radius:0 0 ${radius} ${radius};`
                : `border-radius:${radius};`}padding:34px 32px;">

            ${content.greeting
              ? `<p style="margin:0 0 14px;font-family:${bodyFont};font-size:16px;line-height:1.6;color:${ink};">
                   ${escMultiline(content.greeting)}
                 </p>`
              : ''}

            ${paragraphs}
            ${panel}
            ${ledger}
            ${cta}

            ${content.note
              ? `<p style="margin:16px 0 0;font-family:${bodyFont};font-size:14px;line-height:1.6;color:${inkMuted};">
                   ${escMultiline(content.note)}
                 </p>`
              : ''}

          </td>
        </tr>

        <tr>
          <td style="padding:22px 4px 0;">
            ${footer}
            ${contactLine
              ? `<p style="margin:10px 0 0;font-family:${bodyFont};font-size:12px;line-height:1.6;color:${inkMuted};">
                   ${esc(brand.clinicName)} · ${addressSafe(contactLine, inkMuted)}
                 </p>`
              : `<p style="margin:10px 0 0;font-family:${bodyFont};font-size:12px;line-height:1.6;color:${inkMuted};">
                   ${esc(brand.clinicName)}
                 </p>`}
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
