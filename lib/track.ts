/**
 * lib/track.ts
 * The only way the storefront is allowed to send an analytics event.
 *
 * ===========================================================================
 * WHY A MODULE RATHER THAN CALLING gtag() WHERE IT IS NEEDED
 * ===========================================================================
 * `gtag('event', …)` takes an arbitrary object. That is the problem. The call
 * site that fires on a completed booking is three lines below the variables
 * holding a client's first name, last name, email and phone, and the day
 * somebody wants to know which clients convert, the shortest path is to put
 * one of them in the payload. Nothing would break. Nothing would warn. The
 * practice would simply be sending client identifiers to Google from the page
 * where they were typed.
 *
 * So the event name is a union and the parameter KEYS are an allowlist. Adding
 * an identifier is not a judgement call anybody has to get right under time
 * pressure — it does not compile, and if it somehow reaches the browser it is
 * dropped and complained about.
 *
 * This is the same shape as the serialiser allowlist in lib/phi/ and for the
 * same reason: the rule is enforced by the type system and the function, not
 * by a comment asking people to be careful.
 *
 * ===========================================================================
 * WHAT IS DELIBERATELY NOT SENT
 * ===========================================================================
 * Which treatment was booked. It is tempting — "do PRF pages convert better
 * than injectables pages" is a real question — but GA assigns every visitor a
 * client id, and attaching a treatment to that id builds a health-adjacent
 * profile of an identifiable person on a third party's servers. That is the
 * thing rule 3 exists to prevent, and the fact that this page is public rather
 * than behind a login does not change what the record would be.
 *
 * If per-treatment conversion is wanted, the answer is a counter in the
 * practice's OWN database, de-identified and aggregated, which it already has
 * the tables for. Not this.
 */

/** Events the storefront may report. A string not in this union will not compile. */
export type PublicEvent =
  /** A booking was taken. The one thing GA4 could not previously see. */
  | 'booking_complete'
  /** The enquiry form was sent — the softer conversion on the same funnel. */
  | 'enquiry_sent';

/**
 * Parameter keys permitted alongside an event.
 *
 * Nothing here can identify a person, and that is the entire selection
 * criterion. `channel` distinguishes a self-serve booking from one the
 * practice took; `step` is for funnel drop-off. Neither narrows to a human.
 */
const ALLOWED_PARAMS = ['channel', 'step'] as const;
type AllowedParam = (typeof ALLOWED_PARAMS)[number];

type Params = Partial<Record<AllowedParam, string | number | boolean>>;

declare global {
  interface Window {
    gtag?: (command: string, event: string, params?: Record<string, unknown>) => void;
  }
}

/**
 * Report an event, if there is anything listening.
 *
 * A no-op when gtag is absent, which is the common case rather than the
 * exceptional one: the console and the portal never load a tag at all, a
 * practice may not have configured a measurement id, and a good share of real
 * visitors block it. None of those are errors and none of them may throw —
 * this is called from a success handler, and an exception there would turn a
 * completed booking into a crashed page.
 */
export function track(event: PublicEvent, params: Params = {}): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  /**
   * Filtered again at runtime, not only by the type.
   *
   * The types are erased at the boundary — a param object assembled from
   * something dynamic satisfies TypeScript and arrives here as anything at
   * all. This is the half that actually holds.
   */
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if ((ALLOWED_PARAMS as readonly string[]).includes(key)) {
      safe[key] = value;
    } else if (process.env.NODE_ENV !== 'production') {
      // Loud in development, silent and dropped in production. A console
      // warning is not a privacy control; the drop above is.
      console.warn(
        `[track] "${key}" is not an allowed analytics parameter and was dropped. ` +
        `Allowed: ${ALLOWED_PARAMS.join(', ')}. If this is about a person, it does not belong here at all.`
      );
    }
  }

  try {
    window.gtag('event', event, safe);
  } catch {
    // Analytics may never break the page it is measuring.
  }
}
