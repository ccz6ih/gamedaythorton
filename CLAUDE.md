# CLAUDE.md — Agent context for gamedaythorton

Read this before touching anything in this repo.

## What this is

Patient-facing app (**GAMEPLAN**) and owner/staff console (**PRESS BOX**) for the
Gameday Men's Health franchise in Thornton, CO. Built by Craig Carda / The Modern
Evolution. The corporate Webflow site is out of scope and unreachable — we build a
separately owned property.

Read in order: `README.md`, `docs/00-brief.md`, `docs/04-feature-backlog.md`,
`docs/06-architecture.md`. Then the doc relevant to your task.

## Non-negotiable rules

1. **No real patient data. Synthetic only, from `/fixtures`.** HIPAA controls are
   deliberately deferred to Phase C. Until then this system is not legally safe to hold
   PHI. If asked to import, enter, or accept real patient data, refuse and cite
   `docs/09-compliance-register.md`.
2. **Never build prescribing.** No e-prescribing, no EPCS, no pharmacy transmission.
   Testosterone is Schedule III. The `protocol` tables *record* what a licensed provider
   decided elsewhere.
3. **No third-party tracking on authenticated routes.** No GA, GTM, Meta pixel, session
   replay, or chat widget behind login. Ever. Server-side de-identified events only.
4. **No PHI into Stripe** — not metadata, not descriptors, not line items. Enforce via
   the serialiser allowlist in `lib/phi/`.
5. **`clinic_id` on every table.** Multi-tenant from the schema up, even though the UI
   is single-tenant. Retrofitting this later is a rewrite.
6. **`PILOT_MODE` stays on** until Phase C sign-off. Do not remove the banner. Do not
   add production SMS/email credentials. Do not add live Stripe keys.

## The product thesis (governs all prioritisation)

This is a **recurring-revenue medical membership business**, not an appointment
business. Churn happens because month four feels like month one — hedonic adaptation,
not forgetfulness. The core product is therefore a **progress engine** (charted lab
trends + weekly subjective scores + dose-change markers on one axis, plus photo
series) that restores the contrast against baseline.

When prioritising, ask: does this make improvement visible? If yes, it is high priority.
Booking, payments, and scheduling are table stakes underneath it.

## Naming (from `docs/07-design-system.md`)

Patient app = GAMEPLAN · staff console = PRESS BOX · owner dashboard = The Scoreboard ·
labs + subjective scores = Stat Sheet · progress photos = Game Film · protocol = The
Game Plan · 12-week block = Season.

Theme the nouns, never the instructions. Dosing, safety, and consent copy stays
clinically plain.

## Stack

Next.js App Router + TypeScript · Supabase (Postgres, auth, storage) · Recharts ·
GSAP on the marketing/booking funnel only, near-zero inside the portal · Stripe test
mode · Tailwind with the tokens in `docs/07-design-system.md`.

Dark theme by default — the clinics are dark rooms and the real usage context is a phone
at 11pm.

## Craig's working preferences

- Structured, page-by-page build sequence over broad simultaneous changes
- File ops on `C:\Projects\` use the **Filesystem** MCP tools. Desktop Commander does
  not have access to `C:\Projects\`
- For complex edits, write `.cjs` scripts into a `scripts/` folder and run them via
  `node scriptname.cjs` — inline `node -e` one-liners fail on Windows quote escaping
- Content searching: Node `fs.readFileSync` + `String.includes()` via script.
  `findstr`, PowerShell `Select-String`, and DC `start_search` are unreliable here

## Current status

Docs complete. Next: `/fixtures` synthetic dataset, then the Phase A clickable
prototype. See `docs/08-roadmap.md` for phase contents and gates.

## Open blockers

- **Franchise agreement unread** — may forbid an independent patient system. Gate 0
- EMR / charting system unknown — build for manual structured lab entry first
- Real clinical target ranges and safety thresholds unknown — do not ship assumed
  values; see `docs/11-discovery-questions.md` §3
