/**
 * components/PilotBanner.tsx
 * The banner that does not come off until Phase C sign-off.
 *
 * docs/09-compliance-register.md lists it as a control, not decoration: a
 * persistent "PILOT — SYNTHETIC DATA ONLY" marker on every screen, patient and
 * staff. It renders from PILOT_MODE, and the database independently refuses
 * non-synthetic writes while the clinic's pilot_mode flag is true — so the
 * banner and the enforcement cannot disagree for long.
 */

import Link from 'next/link';

export function PilotBanner({ pilotMode, dbPilotMode }: { pilotMode: boolean; dbPilotMode?: boolean }) {
  if (!pilotMode && !dbPilotMode) return null;

  // If these two ever disagree, say so loudly. It means either the app thinks it
  // is live while the database is still refusing real data, or the database has
  // been opened up while the app still believes it is a pilot. Both are worth
  // stopping for.
  const mismatch = dbPilotMode !== undefined && pilotMode !== dbPilotMode;

  return (
    <div className="pilot-banner" role="status">
      <span>Pilot — synthetic data only</span>
      {mismatch && (
        <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 700 }}>
          ⚠ app PILOT_MODE={String(pilotMode)} but database pilot_mode={String(dbPilotMode)}
        </span>
      )}
      <Link href="/about-pilot" className="banner-link" style={{ color: 'inherit', opacity: 0.85 }}>
        Why?
      </Link>
    </div>
  );
}
