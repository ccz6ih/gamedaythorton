# CLAUDE.md — Agent context for gamedaythorton

Read this before touching anything in this repo.

## What this is

**As of 13 Sept 2026 the live product is THE MED BAR**, a cash-pay aesthetics practice
in Loveland, CO owned by Jamie Salazar (The Med Bar CO Jamie Salazar LLC). It replaces
her GlossGenius subscription, serves `medbarco.com`, and is going into real use with
real clients and real payments.

Gameday Men's Health Thornton remains in the codebase as a **second tenant on synthetic
data**. It is a later, separate system — the multi-tenancy and the men's-health modules
stay because they are built and tested, not because they are in use.

Read that order of priority into every decision: if something helps The Med Bar this
week and something else helps Gameday next quarter, the first one wins.

Built by Craig Carda / The Modern Evolution.

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

1. **Real data is allowed for THE MED BAR ONLY, and only because of what it is.**
   Changed 13 Sept 2026 by the owner's decision, after the covered-entity analysis in
   `docs/21-compliance-cost.md`. The Med Bar is cash-pay aesthetics: no insurance
   billing, no labs, no protocols, no prescribing, and its owner is not yet practising
   as an RN. HIPAA very likely does not attach, so a client list is ordinary business
   contact data.

   The guard is **per clinic** (`clinic.pilot_mode`) and is still **ON for Gameday**,
   which stays synthetic. Never turn it off by editing the flag — use
   `scripts/go-live.cjs`, which prints what changes and records the decision.

   **What is still refused, for any clinic:** lab results, protocols, prescribing, and
   anything belonging to a men's-health workflow. If The Med Bar's owner qualifies as
   an RN and starts practising as one here, or the practice ever bills insurance, the
   guard goes back on until `docs/20-hipaa-readiness.md` is closed.

   **Real data never enters the repository.** It lives in `private/`, which is
   gitignored, because this repo is public.
2. **Never build prescribing.** No e-prescribing, no EPCS, no pharmacy transmission.
   Testosterone is Schedule III. The `protocol` tables *record* what a licensed provider
   decided elsewhere.
3. **No third-party tracking on authenticated routes.** No GA, GTM, Meta pixel, session
   replay, or chat widget behind login. Ever. Server-side de-identified events only.
4. **No PHI into Stripe** — not metadata, not descriptors, not line items. Enforce via
   the serialiser allowlist in `lib/phi/`.
5. **`clinic_id` on every table.** Multi-tenant from the schema up, even though the UI
   is single-tenant. Retrofitting this later is a rewrite.
6. **Real money is gated per clinic, not per deployment.** This changed in September
   2026 — read it before touching payments.

   It used to be one switch: `PILOT_MODE` on meant nobody could use a live Stripe
   key. Right with one tenant; unsatisfiable with two. Gameday must stay guarded
   because it holds clinical records, and The Med Bar must be able to sell a
   moisturiser — same deployment, same afternoon.

   So the question is asked per clinic by `canTakeMoney()` in `lib/stripe.ts`,
   against **`clinic.pilot_mode`** — the same column the database independently
   enforces, where every PHI table rejects non-synthetic rows while it is true. One
   flag, two enforcers, no way for the app's belief and the database's to drift.

   What has **not** changed:
   - `PILOT_MODE=true` is an absolute override. While on, no clinic may use a live
     key whatever its own column says.
   - Gameday Thornton keeps `pilot_mode = true`. Do not clear it, do not remove the
     banner.
   - No production SMS/email credentials.
   - The **clinical** money path — memberships, visits, deposits — is still unbuilt
     and stays that way. Only the retail shop can charge.

7. **No secret keys in the database, ever.** The only thing stored is
   `clinic.stripe_account_id`, which is an identifier. `docs/19-environment.md`
   explains why at length.

   Connect is opt-in and currently **off** (`STRIPE_CONNECT` unset). The Med Bar
   runs on its own secret key in the deployment's environment, which is the correct
   arrangement while there is one paying tenant: you cannot act on behalf of
   yourself, so passing an account id alongside that practice's own key would fail.
   Connect becomes necessary the day a second practice takes money here.

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

Phase A prototype built (27 screens, no backend). **Production foundation also built and
live**: Supabase schema (33 tables, RLS on every one), auth, a staff console and patient
portal reading real data, Stripe scaffolding, deployed via Vercel.

**Two tenants, two clinical models.** `clinic.practice_type` drives a module map:

| | `mens_health` | `med_spa` |
|---|---|---|
| Example | Gameday Thornton | The Med Bar (Jamie Salazar, Loveland) |
| Clinical loop | labs → protocol → dose → recheck | treatment → series → interval |
| Tables | `analyte`, `lab_panel`, `protocol*`, `checkin` | `treatment_record`, `treatment_detail` |
| Money | membership | prepaid `service_package` series |

Never assume labs and protocols exist. Check `hasModule(clinic, 'labs')`. Showing a med spa
a lab-entry screen — or calling her clients "patients" — reads as software built for
somebody else.

Next: port the remaining prototype screens (`docs/13-build-sequence.md` stage B), then the
Gate A feedback session per `docs/10-demo-script.md`. **Gate A output replaces our phase
ordering.**

## Compliance is enforced by the database, not by convention

Read `docs/20-hipaa-readiness.md` before touching anything near PHI.

- While `clinic.pilot_mode` is true, **every PHI table rejects rows not marked
  `synthetic`**. If a write fails with "PILOT MODE", that is the control working.
- **Payment descriptors and Stripe metadata** are trigger-checked for clinical terms. Build
  them with `paymentDescriptor()` / `stripeMetadata()` from `lib/phi`, never by hand.
- **Notification previews** are trigger-checked too. Use `notificationPreview()`.
- `audit_log` is append-only and records which columns changed, not their values.
- Double-booking and package over-redemption are impossible at the schema level.
- `lib/stripe.ts` refuses to initialise with a live key while `PILOT_MODE` is on, and
  `canTakeMoney()` refuses again per clinic against `clinic.pilot_mode`.
- **The shop cannot invent a price.** A basket is ids and counts; `app.shop_order_create`
  reads `product` itself and computes the total. `anon` has no insert, update, select or
  delete on `shop_order` or `shop_order_item` — only two function grants. Settlement
  (`shop_order_mark_paid`) is granted to `service_role` alone and is reachable only from
  the signature-verified Stripe webhook.
- **A shop order is not a `payment` row.** `payment` means money from a patient. A
  stranger buying cleanser has no patient record and must never be given one.

Verify the money path with `node scripts/shop-test.cjs` (22 checks, every one an attempt
to do something forbidden). It also asserts which files may import
`lib/supabase/service.ts` — the only service-role client, allowed in the webhook and
nowhere else.

Verify with `npm run test:db` (35 checks, includes a deliberate cross-tenant attempt) and
`npm run test:auth` (16 checks through the real API). Both run against throwaway data and
clean up after themselves.

**Migrations are append-only.** Never edit an applied file in `supabase/migrations/`; add a
new one. `0007` and `0008` exist for that reason.

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
