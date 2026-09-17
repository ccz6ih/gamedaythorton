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
    displayFont: 'Georgia, "Times New Roman", serif',
    bodyFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    logoUrl: null,
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
  panel?: { label: string; value: string }[] | null;
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

/** Line breaks a person typed, preserved without letting markup through. */
function escMultiline(value: unknown): string {
  return esc(value).replace(/\r?\n/g, '<br />');
}

export function renderEmail(brand: EmailBrand, content: EmailContent): string {
  const {
    accent, accentInk, paper, card, ink, inkMuted, border, radius, displayFont, bodyFont
  } = brand;

  const header = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.clinicName)}" width="150"
           style="display:block;width:150px;max-width:60%;height:auto;border:0;outline:none;text-decoration:none;" />`
    : `<div style="font-family:${displayFont};font-size:22px;line-height:1.3;color:${ink};letter-spacing:.01em;">
         ${esc(brand.clinicName)}
       </div>`;

  const panel = content.panel?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
              style="margin:24px 0;border-collapse:separate;">
         <tr>
           <td style="background:${paper};border:1px solid ${border};border-radius:${radius};padding:20px 22px;">
             ${content.panel.map(row => `
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
                     ${escMultiline(row.value)}
                   </td>
                 </tr>
               </table>`).join('')}
           </td>
         </tr>
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
<meta name="supported-color-schemes" content="light" />
<title>${esc(brand.clinicName)}</title>
<style>
  /* Gmail keeps a little of this; everything structural is inline regardless. */
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  a { color: ${accent}; }
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

        <tr>
          <td align="left" style="padding:0 0 22px;">
            ${header}
          </td>
        </tr>

        <tr>
          <td class="gd-card"
              style="background:${card};border:1px solid ${border};border-radius:${radius};padding:34px 32px;">

            ${content.greeting
              ? `<p style="margin:0 0 14px;font-family:${bodyFont};font-size:16px;line-height:1.6;color:${ink};">
                   ${escMultiline(content.greeting)}
                 </p>`
              : ''}

            ${paragraphs}
            ${panel}
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
                   ${esc(brand.clinicName)} · ${esc(contactLine)}
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
