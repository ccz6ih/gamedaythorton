/**
 * lib/appointment-where.ts
 * One sentence saying where to be, written once.
 *
 * ===========================================================================
 * WHY THIS IS ITS OWN FILE
 * ===========================================================================
 * Jamie took a consultation booking and could not tell whether she was meant
 * to be at the studio, at Northglenn, on the phone or on a video call. She was
 * not missing it in the email — the email could not say. Nothing in the system
 * knew, and the notice that reached her listed Treatment, When and Contact and
 * nothing about WHERE at all.
 *
 * Four surfaces need this sentence: the practice's booking notice, the
 * client's confirmation, the day-before reminder, and the console. Four
 * hand-written versions would disagree inside a month, and the one that
 * disagrees is the one that sends somebody to the wrong town.
 *
 * Pure, with no imports, so it can be unit-tested without a database or a
 * request — see scripts/where-test.cjs.
 */

export type Modality = 'in_person' | 'phone' | 'video';

export type WhereInput = {
  /** Defaults to in person when absent, which is what every older row is. */
  modality?: Modality | null;
  clinicName: string;
  /** The practice's own address, used for the usual room. */
  clinicAddress?: string | null;
  /** Set ONLY when it is not the usual room. */
  locationName?: string | null;
  locationAddress?: string | null;
  clientPhone?: string | null;
  practicePhone?: string | null;
  meetingUrl?: string | null;
};

/**
 * `forPractice` flips the perspective, and it is the part most worth getting
 * right: on a phone consult SHE rings the CLIENT, and the client is waiting to
 * be rung. Same appointment, opposite sentence. Getting it backwards leaves
 * two people each waiting for the other to dial, which is exactly the kind of
 * failure that looks like the practice being disorganised.
 */
export function whereLine(w: WhereInput, forPractice: boolean): string {
  const modality = w.modality ?? 'in_person';

  if (modality === 'phone') {
    if (forPractice) {
      return w.clientPhone
        ? `Phone call — ring them on ${w.clientPhone}`
        : 'Phone call — no number on file, check the client record';
    }
    return w.practicePhone
      ? `Phone call — we will ring you from ${w.practicePhone}`
      : 'Phone call — we will ring you';
  }

  if (modality === 'video') {
    return w.meetingUrl
      ? `Video call\n${w.meetingUrl}`
      : 'Video call — the link will be sent before the appointment';
  }

  /**
   * In person. The place is always named; the address appears only when it is
   * NOT the usual room. Repeating an address somebody has driven to six times
   * is noise, and omitting it the once it changed is how they end up in
   * Loveland when the appointment is in Northglenn.
   */
  const elsewhere = Boolean(w.locationName);
  const name = w.locationName ?? w.clinicName;
  const address = elsewhere ? w.locationAddress : w.clinicAddress;

  return `In person at ${name}${address ? `\n${address}` : ''}`;
}

/** Short form for a calendar row or a list, where one line is all there is. */
export function whereShort(w: WhereInput): string {
  const modality = w.modality ?? 'in_person';
  if (modality === 'phone') return 'Phone';
  if (modality === 'video') return 'Video';
  return w.locationName ?? 'In person';
}

/**
 * What to CALL a room, in one or two words.
 *
 * The city, not the name, and that is the whole point. This practice's
 * default location is called "The Med Bar" and its second is called "Gameday
 * Men's Health — Northglenn"; showing the name tells somebody who works in
 * both rooms nothing useful, while "Loveland" and "Northglenn" tell them
 * everything in one word.
 *
 * `fallback` is the practice's default room, used when an appointment has no
 * location of its own. A null location_id does not mean "nowhere" — it means
 * the usual place, which is a real address the client was given, and leaving
 * it unnamed is why the chart said only "In person" for an appointment that
 * was definitely in Loveland.
 */
export function locationLabel(
  loc: { name?: string | null; city?: string | null } | null | undefined,
  fallback?: { name?: string | null; city?: string | null } | null
): string | null {
  const pick = (l?: { name?: string | null; city?: string | null } | null) =>
    (l?.city?.trim() || l?.name?.trim() || null);
  return pick(loc) ?? pick(fallback);
}
