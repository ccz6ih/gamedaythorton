# CLAUDE.md — Agent context for gamedaythorton

Read this before touching anything in this repo.

## What this is

Patient-facing app (**GAMEPLAN**) and owner/staff console (**PRESS BOX**) for the
Gameday Men's Health franchise in Thornton, CO. Built by Craig Carda / The Modern
Evolution. The corporate Webflow site is out of scope and unreachable — we build a
separately owned property.

**This replaces GlossGenius**, which runs the clinic's front desk today. That raises the
stakes: a portal nobody adopts is a disappointment, but a replacement for the system that
runs the front desk, missing one thing they use daily, is an outage. Every feature they
depend on is mapped in `docs/12-glossgenius-parity.md`, including the cutover plan and the
things we have not verified yet.

Read in order: `README.md`, `docs/00-brief.md`, `docs/04-feature-backlog.md`,
`docs/06-architecture.md`. Then the doc relevant to your task.

**Before changing code, read `docs/17-agent-playbook.md`.** It has the rules of
engagement, the conventions, and the mistakes already made here. Pick tasks from
`docs/13-build-sequence.md`.

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

**Production (Phase B+):** Next.js App Router + TypeScript · Supabase (Postgres, auth,
storage) · Recharts · GSAP on the marketing/booking funnel only, near-zero inside the
portal · Stripe test mode · Tailwind with the tokens in `docs/07-design-system.md`.

**The Phase A pilot in `prototype/` is deliberately none of that** — a dependency-free
static app that runs from a double-clicked `file://` URL, so it can be demoed on a clinic
iPad with no install and no build step that can fail five minutes before a meeting. Route
names map 1:1 onto App Router paths so the port is mechanical. Reasoning and consequences
in `docs/18-decisions.md` ADR-001.

Dark theme by default — the clinics are dark rooms and the real usage context is a phone
at 11pm. The staff console can be switched to light (the front desk works under
fluorescent lights); the patient app cannot.

## Working on the pilot

```
node scripts/generate-fixtures.cjs   # regenerate the dataset (deterministic)
node scripts/smoke-test.cjs          # 69 checks: all 27 screens x all 12 patients
node scripts/serve.cjs               # optional http origin, http://localhost:4173
```

`fixtures/*.json` and `prototype/demo-data.js` are **generated**. Edit
`scripts/generate-fixtures.cjs` and re-run it; a hand-edit is destroyed silently on the
next generation.

The smoke test is necessary and not sufficient — it cannot see layout. Always click
through the change in a real browser, at 400px too, and against a patient the change was
*not* written for.

Never hard-code a colour, radius, or font outside `prototype/assets/tokens.css`, and never
hard-code a themed noun — call `GD.brand.word()`. Every derived metric belongs in
`store.js` under `GD.q`, defined exactly once.

## Craig's working preferences

- Structured, page-by-page build sequence over broad simultaneous changes
- File ops on `C:\Projects\` use the **Filesystem** MCP tools. Desktop Commander does
  not have access to `C:\Projects\`
- For complex edits, write `.cjs` scripts into a `scripts/` folder and run them via
  `node scriptname.cjs` — inline `node -e` one-liners fail on Windows quote escaping
- Content searching: Node `fs.readFileSync` + `String.includes()` via script.
  `findstr`, PowerShell `Select-String`, and DC `start_search` are unreliable here

## Current status

Docs complete. Synthetic dataset built. **Phase A clickable pilot built** — 27 screens,
brandable, accepts real images for practitioners, the clinic, and patients.

Next: the Stage A finishing tasks in `docs/13-build-sequence.md`, then the Gate A feedback
session per `docs/10-demo-script.md`. **Gate A output replaces our phase ordering** — do
not start Phase B from the build sequence before that session has happened.

## Open blockers

- **Franchise agreement unread** — may forbid an independent patient system. Gate 0
- **GlossGenius account not seen.** Every "today" column in the parity matrix is inferred
  rather than observed. One morning watching the front desk resolves it, and it is the
  highest-value hour available in this project
- **Payment-credential migration unknown.** If members have to re-enter cards at cutover,
  that is a churn event that has to be planned, announced, and staffed — not discovered.
  `docs/18-decisions.md` ADR-011
- EMR / charting system unknown — build for manual structured lab entry first
- Real clinical target ranges and safety thresholds unknown — do not ship assumed
  values; see `docs/11-discovery-questions.md` §3. Everything currently in the dataset is
  marked `provisional: true` and says so in the UI
- **The plateau copy on the patient Stat Sheet needs provider sign-off.** It is the one
  place the pilot says something quasi-clinical to a patient. ADR-009
