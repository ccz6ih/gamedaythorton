# 06 — Architecture

Design principle: **build every data path as if it were already compliant, then turn the
controls on in Phase C.** The difference between a hardening pass and a rewrite is
decided now, in these choices.

---

## Stack

| Layer | Pilot (Phase A/B) | Production (Phase C+) | Why it changes |
|---|---|---|---|
| Framework | Next.js (App Router), TypeScript | same | no change needed |
| Hosting | Vercel Hobby/Pro | **BAA-covered host** | Vercel's BAA is Enterprise-tier. Verify current pricing — if prohibitive, AWS (Amplify/ECS), Render, or Fly all offer BAAs at far lower cost. **Decide before Phase C, not during** |
| DB | Supabase (free/Pro) | Supabase with HIPAA add-on, or RDS | Supabase offers HIPAA terms as a paid add-on on non-free plans. Verify terms |
| Auth | Supabase Auth, magic link | + passkeys, mandatory staff MFA | |
| File storage | Supabase Storage, private bucket | + column-encrypted refs, signed short-TTL URLs, EXIF stripped | Photos are the highest-sensitivity asset |
| SMS | Twilio | Twilio under BAA | Twilio will sign; confirm the specific products covered |
| Email | Resend (already connected) | verify BAA availability; **fall back to SES under BAA** if not | Do not assume. Transactional email carrying clinical content needs coverage |
| Payments | Stripe test mode | Stripe live | Stripe is not a HIPAA-covered vendor for PHI. Keep PHI out of Stripe entirely — see below |
| Charts | Recharts | same | |
| Animation | GSAP — marketing funnel only | same | See the discipline rule below |
| State | Server components + minimal client state | same | |

## Hard architectural rules

**1. PHI never leaves systems we control.**
Stripe gets amounts and a neutral descriptor. Analytics gets de-identified events.
Error monitoring gets scrubbed payloads. No exceptions, and enforce it in code — a
serialiser allowlist, not a convention people remember.

**2. No third-party tracking on authenticated routes. Ever.**
No GA, no Meta pixel, no GTM, no session replay, no chat widget anywhere behind login.
HHS OCR has published guidance on tracking technologies and PHI, and there is active
litigation across exactly this vertical over pixels on health pages. The corporate site
currently fires two GTM containers on pages about erectile dysfunction — that is their
exposure, not ours, and we do not replicate it.

Measurement instead: server-side events, hashed identifiers, de-identified, on a
separate analytics schema that cannot join to PHI.

**3. We reflect protocols; we never prescribe.**
No pharmacy transmission, no e-prescribing, no EPCS. Testosterone is Schedule III. The
`protocol` tables record what a licensed provider decided elsewhere.

**4. The clinical system of record stays wherever it is.**
`patient.external_emr_id` links out. We do not become the legal medical record, and we
do not duplicate it. Discovery question: does that system have an API? If not, manual
structured entry, and that is fine.

**5. Build for manual lab entry first.**
Most projects of this shape die trying to integrate HL7/FHIR on day one. Staff enter
values into a well-designed grid; the trend charts do not care where the numbers came
from. Add integration in Phase D if a real interface exists.

**6. Multi-tenant from the schema up, single-tenant in the UI.**
Every table carries `clinic_id` from commit one. Costs nothing now. If this works for
Thornton, 400+ franchisees have the same problem and corporate is actively hunting for
it. Retrofitting tenancy later is a rewrite.

## Animation discipline

GSAP on the marketing and booking funnel, where perceived polish drives trust and
conversion. **Near zero inside the portal.** A man checking his hematocrit at 11pm wants
instant, not choreographed. Fast *is* the feeling. Skeleton states, optimistic updates,
no page transitions.

Exception worth the spend: the Stat Sheet's first load can animate lines drawing in, once
per session. That one is emotional payload, not decoration.

## Pilot-mode safety rails (Phase A/B)

Because this runs without compliance controls, the pilot build must make real-data entry
*hard*, not merely discouraged:

- `PILOT_MODE=true` env flag, default on
- Persistent banner on every screen: "PILOT — SYNTHETIC DATA ONLY"
- Seeded from `/fixtures` on boot; a reset command restores it
- No production SMS/email sending — log to console or a dev inbox
- Stripe test keys only; live keys not present in any env file
- Staff console behind a shared pilot passcode, no real accounts provisioned
- `robots.txt` disallow + `noindex` on every route
- Deployed to a non-guessable preview URL, not a public subdomain

## Repo layout (prototype/)

```
prototype/
├── app/
│   ├── (patient)/           GAMEPLAN — book, intake, dashboard, stats, labs,
│   │                        gameplan, film, messages, membership
│   ├── (staff)/             PRESS BOX — scoreboard, today, patients/[id],
│   │                        labs-entry, safety, pipeline, automations, inventory
│   └── api/
├── components/
│   ├── charts/              StatSheet, LabTrend, BodyComp
│   ├── patient/
│   └── staff/
├── lib/
│   ├── db/                  schema, queries
│   ├── phi/                 serialiser allowlist, redaction helpers
│   └── fixtures/            synthetic loader
└── styles/                  tokens per 07-design-system.md
```

## Phase C hardening checklist

- [ ] BAA signed: host, DB, storage, SMS, email, error monitoring
- [ ] RLS enforced on every PHI table, tested with a deliberate cross-tenant attempt
- [ ] `audit_log` triggers on all PHI read/write paths
- [ ] Column encryption on photos, intake answers, check-in free text
- [ ] Staff MFA mandatory, session timeout, role-based access verified
- [ ] Break-glass access with mandatory justification, logged
- [ ] Encrypted backups, tested restore
- [ ] Retention + deletion policy per entity
- [ ] Penetration test
- [ ] Security risk assessment documented (HIPAA Security Rule requires it)
- [ ] Incident response + breach notification runbook
- [ ] Staff training records
- [ ] `PILOT_MODE` removed and all fixture data purged before first real patient
