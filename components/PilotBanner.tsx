/**
 * components/PilotBanner.tsx
 *
 * One compact marker, one link to the explanation. That is the whole compliance
 * surface inside the product.
 *
 * An earlier version repeated the "no HIPAA controls" paragraph on the gate, the
 * sign-in page, the scoreboard and the portal. It was accurate and it was too
 * much: a person trying to use the software read a warning four times before
 * seeing a patient, which buries the actual product and reads as a lack of
 * confidence in it. The register stays a real control — the banner cannot be
 * removed, and the database independently refuses non-synthetic data — but the
 * full argument lives at /about-pilot, once, for whoever wants it.
 */

import Link from 'next/link';

export function PilotBanner({ pilotMode, dbPilotMode }: { pilotMode: boolean; dbPilotMode?: boolean }) {
  if (!pilotMode && !dbPilotMode) return null;

  // If these disagree, say so loudly: either the app believes it is live while the
  // database still refuses real data, or the database has been opened up while the
  // app still believes it is a pilot. Both are worth stopping for.
  const mismatch = dbPilotMode !== undefined && pilotMode !== dbPilotMode;

  return (
    <div className="pilot-banner" role="status">
      <span>Pilot · synthetic data</span>
      {mismatch && (
        <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 700 }}>
          ⚠ app PILOT_MODE={String(pilotMode)} but database pilot_mode={String(dbPilotMode)}
        </span>
      )}
      <Link href="/about-pilot" style={{ color: 'inherit', opacity: 0.8, textDecoration: 'underline' }}>
        details
      </Link>
    </div>
  );
}
