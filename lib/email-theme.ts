/**
 * lib/email-theme.ts
 * The practice's brand, rendered into an email that survives real mail clients.
 *
 * ===========================================================================
 * WHY THIS IS NOT JUST A TEMPLATE STRING
 * ===========================================================================
 * Email HTML is not web HTML. Outlook renders through Word, Gmail strips most
 * of a <style> block, and flexbox and grid do not exist. So this is tables,
 * inline styles, and a fixed 600px column — not because that is nice, but
 * because everything else silently collapses in somebody's inbox and the first
 * you hear of it is a client saying the email "looked broken".
 *
 * ===========================================================================
 * THE PREHEADER IS A PRIVACY SURFACE
 * ===========================================================================
 * The hidden preheader is what the inbox list and the lock screen show next to
 * the subject. Without one, clients grab the first text in the body — which
 * for a confirmation is the treatment name.
 *
 * So every message passes an explicit, deliberately dull preheader. Same rule
 * as notificationPreview() in lib/phi: it may say something needs attention,
 * never what. The body may name the treatment, because the body is behind a
 * tap and belongs to the person concerned. The line visible over their
 * shoulder on a train may not.
 *
 * ===========================================================================
 * LIGHT ONLY, ON PURPOSE
 * ===========================================================================
 * `color-scheme: light` tells Apple Mail and Outlook not to auto-invert. A
 * cream-and-ink practice brand run through an email client's automatic dark
 * mode comes out muddy and off-brand, and the inversion is not something we
 * can preview or control. Declaring light keeps what we designed.
 */

import { serverClient } from '@/lib/supabase/server';
import { defaultBrand, type EmailBrand } from '@/lib/email-render';

/**
 * The address the site is reachable at.
 *
 * Deliberately NOT siteOrigin() from lib/storefront-links: that reads the
 * request headers, and the two places that matter most here — the reminder
 * cron and a background send — have no incoming request to read. Same
 * expression the cron already uses, so the two cannot disagree about where a
 * confirm link points.
 */
export function emailOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://www.medbarco.com').replace(/\/$/, '');
}

/**
 * Resolve a practice's brand for an email.
 *
 * Reads `clinic_public`, which is an existing deliberately-public surface —
 * name, address, phone and the brand kit, granted to anon since 0005. Nothing
 * private is touched to draw a letterhead.
 *
 * FAIL-SOFT, ALWAYS. A brand lookup that fails must never stop a booking
 * confirmation going out; an unbranded email is a disappointment, a missing one
 * is a client standing outside a locked door. Every failure path returns the
 * defaults above.
 */
export async function emailBrand(clinicId: string, clinicName: string): Promise<EmailBrand> {
  const origin = emailOrigin();
  const base = defaultBrand(clinicName, origin);

  try {
    const supabase = await serverClient();
    const { data } = await supabase
      .from('clinic_public')
      .select('name, brand, address_line1, address_city, address_state, address_zip, phone_voice')
      .eq('id', clinicId)
      .maybeSingle();

    if (!data) return base;

    const brand = (data.brand ?? {}) as Record<string, string>;

    // logo_path is granted as its own column on `clinic`, not carried on the
    // public view. A failure here costs the logo and nothing else.
    let logoUrl: string | null = null;
    try {
      const { data: row } = await supabase
        .from('clinic')
        .select('logo_path')
        .eq('id', clinicId)
        .maybeSingle();
      const p = row?.logo_path as string | undefined;
      // A leading slash means a repo asset; anything else is already a URL or a
      // storage path the storefront resolves. Only the first is safe to make
      // absolute by concatenation.
      if (p) logoUrl = p.startsWith('/') ? `${origin}${p}` : (/^https?:\/\//.test(p) ? p : null);
    } catch {
      // keep logoUrl null
    }

    const addressText = [
      data.address_line1,
      [data.address_city, data.address_state].filter(Boolean).join(', '),
      data.address_zip
    ].filter(Boolean).join(' · ') || null;

    const radius = brand.radius !== undefined && brand.radius !== null && String(brand.radius) !== ''
      ? (/^\d+(\.\d+)?$/.test(String(brand.radius)) ? `${brand.radius}px` : String(brand.radius))
      : base.radius;

    return {
      ...base,
      clinicName: data.name || clinicName,
      accent: brand.accent || base.accent,
      accentInk: brand.accentInk || base.accentInk,
      radius,
      // A brand font is a web font the practice chose. Email cannot load it
      // reliably, so it is offered first and a real stack follows behind it.
      displayFont: brand.displayFont ? `${brand.displayFont}, ${base.displayFont}` : base.displayFont,
      bodyFont: brand.font ? `${brand.font}, ${base.bodyFont}` : base.bodyFont,
      logoUrl,
      addressText,
      phone: data.phone_voice ?? null
    };
  } catch {
    return base;
  }
}

/* The rendering itself lives in email-render.ts, which has no imports so it can
   be compiled standalone and previewed. Re-exported here so callers have one
   place to import from. */
export { renderEmail, esc } from '@/lib/email-render';
export type { EmailBrand, EmailContent } from '@/lib/email-render';
