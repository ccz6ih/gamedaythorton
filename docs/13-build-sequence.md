# 13 — Build Sequence

The page-by-page work order. One task at a time, in order, each one finishable and
demonstrable on its own.

**If you are an agent picking up work here, read `17-agent-playbook.md` first.** It has
the rules of engagement — what you may change, what you must not, and how to verify.

---

## How this document works

Tasks are `A1`, `B1`, `C1`… by phase. Each carries:

- **Goal** — one sentence. If you cannot say what changed in one sentence, the task is
  too big; split it.
- **Touches** — the files. If you need to touch a file not listed, that is a signal to
  stop and check, not to widen silently.
- **Depends on** — do not start before these are done.
- **Done when** — the acceptance test. Not "it looks right".

### Global definition of done

Every task, no exceptions:

1. `node scripts/smoke-test.cjs` passes (69+ checks, zero failures).
2. **Clicked through in a real browser** at desktop width and at 400px. The smoke test
   cannot see layout; it will pass on a screen that renders as an unreadable pile.
3. No new hard-coded colour, radius, or font. Those live in `tokens.css` only.
4. No `clinic_id` omitted from any new table or record.
5. No PHI in any payment field, notification preview, analytics event, or log line.
6. New derived numbers go in `store.js` under `GD.q`, never inline in a screen.
7. New assumed clinical value (range, threshold, interval, dose) is marked
   `provisional: true` and added to `11-discovery-questions.md` §3.
8. Commit message says what changed and why, not just what.

---

## Where we are now

**Phase A is built.** 27 screens, running on the synthetic roster, brandable, accepting
images. `prototype/README.md` says how to run and demo it.

What Phase A deliberately does **not** have: a server, a database, auth, real sending,
real payments, or compliance controls. Those are Phases B and C, in that order, and
attempting any of them before Gate A is wasted work — Gate A exists to tell us which
of them matter.

---

## Stage A — finish the pilot (before Gate A)

Small, high-value gaps found after the first build pass. Do these before the demo
session; none is more than a session's work.

### A1 · Day view on the calendar
**Goal** A single-day column view, because a provider works a day and an owner reviews a
week.
**Touches** `prototype/assets/screens-staff.js` (calendar), `app.css`
**Depends on** —
**Done when** A toggle switches day/week, the day view shows room columns, and both
survive a week with 30+ appointments without horizontal chaos at 400px.

### A2 · Symptom self-assessment, ungated
**Goal** ADAM and IIEF-5 as a standalone flow that returns a plain-language read with **no
email gate**.
**Touches** new `screens-public.js`, route `public/assess`
**Depends on** —
**Done when** A result is shown before any identity is requested, the copy is calm and
non-diagnostic, and a booking CTA follows it. Backlog P08.
**Why it matters** Value before identity (`02-patient-journey.md` stage 1). Gating the
result is the obvious growth hack and it is the wrong call for a man researching ED at
11pm.

### A3 · Milestone moment
**Goal** At week 12, a single screen: week 1 vs today, scores and photos side by side.
**Touches** `screens-patient.js`, route `patient/milestone`
**Depends on** —
**Done when** It triggers off `q.season()` hitting a 12-week boundary, and it reads as
earned rather than congratulatory-for-nothing. Backlog P21.

### A4 · Print / export the chart
**Goal** A provider can hand a patient a one-page summary, and a patient can give his PCP
his lab history.
**Touches** `app.css` print styles, `screens-patient.js`
**Depends on** —
**Done when** `Ctrl+P` on the Stat Sheet and the labs screen produces a clean single page
with no navigation chrome. Backlog P33.

### A5 · Demo-mode guard rails
**Goal** Make it structurally hard to type a real name in during a demo.
**Touches** `store.js`, `ui.js`
**Done when** Any free-text field that would hold a name warns on blur if the value is
not in the synthetic roster, and the banner count of pilot edits is visible at all times.
**Why it matters** The most likely way this project goes wrong is someone trying it "with
just a couple of real patients" (`08-roadmap.md` risk register). Make it awkward.

---

## Stage B — production application

**B1–B4 are DONE, ahead of Gate A.** That was a deliberate reordering: the brief changed
to "a fully functional demo one person can actually use", and a second practice
(The Med Bar) arrived, which forced the tenancy and practice-type decisions to be made in
the schema rather than deferred. Those are the two things that are expensive to retrofit,
so they were worth doing before the feedback session rather than after.

**Everything from B5 onward still waits on Gate A.** Whatever the owner and staff mark as
Must comes first, regardless of the ordering below.

### B1 · Next.js scaffold — DONE
App Router, TypeScript, deployed on Vercel. `app/layout.tsx` imports
`prototype/assets/tokens.css` and `app.css` **directly** rather than copying them, so
there is one copy of the design system and no drift. See `18-decisions.md`.

### B2 · Supabase schema — DONE
`supabase/migrations/0001`–`0008`. 33 tables, `clinic_id` on every one, RLS enabled and
**enforcing** (not permissive — there was no reason to wait). `practice_type` drives a
module map so the two clinical models coexist.

The cross-tenant test is not a future failing test; it passes now.
`scripts/db-test.cjs` — 35 checks.

### B3 · Data layer — DONE
`lib/db/queries.ts`, same selector names as `GD.q`.

**Still outstanding from B3:** an explicit equivalence test between the prototype's
metrics and the app's for the same fixture data. A silently different
`avgMonthsOnProtocol` is the kind of bug nobody catches until the owner asks why the
number moved. Worth an hour.

### B4 · Auth — DONE
Supabase Auth, session in the middleware, role separation (staff cannot reach the portal,
patients cannot reach the console), pilot passcode gate that **fails closed** when
unconfigured. `scripts/auth-test.cjs` — 16 checks through the real API.

**Magic links are still the production design** (P03). The password accounts exist so a
pilot works on a clinic iPad without an inbox round-trip, and they get deleted before
Phase C.

### B4a · Port the remaining console screens — NEXT
**Goal** The console screens that exist in the prototype but not yet in the app.
**Depends on** Gate A for ordering
**Currently in the app:** scoreboard, today, client roster, client chart.
**Still only in the prototype:** calendar, checkout + rebook prompt, lab entry, safety
queue, due-for-labs, pipeline, retention, automations, inventory, settings/Brand Kit.

Port in whatever order Gate A says. If Gate A has not happened, the highest-value three
are **lab entry** (time a provider against their current process), **checkout with the
rebook default**, and **the Brand Kit** — the last because it is what makes the client
believe the product is theirs.

### B4b · Practice-type screens the med spa needs
**Goal** The screens The Med Bar needs that Gameday does not.
**Done when** There is a treatment-record entry screen (areas, units, lot selection,
aftercare), a package sale and redemption flow, and a photo series capture/compare screen.
**Why it matters** These are her daily work. The schema supports all three; no UI does yet.

### B5–B9 · Port the patient app, in this order
Highest retention value first, because that is what Gate A will have confirmed matters:

- **B5** Stat Sheet + labs (P15, P16) — the reason the product exists
- **B6** Weekly check-in (P14) — the fuel for B5
- **B7** Game Plan + expectation timeline (P23, P26)
- **B8** Booking + intake + pre-visit card (P01–P03, P09, P13)
- **B9** Game Film with real storage (P18, P19)

**Done when** each has parity with the prototype screen *and* a skeleton loading state
matching its final layout.

### B10–B14 · Port the staff console
- **B10** Scoreboard + pipeline (S01–S04)
- **B11** Patient chart + timeline (S13)
- **B12** Lab entry (S14) — **time a provider against the prototype; it must not be slower**
- **B13** Safety queue + due-for-labs (S16, S17)
- **B14** Today + checkout + rebook prompt (S12, S21–S23)

### B15 · Real sending, still gated
**Goal** Twilio and Resend wired, behind `PILOT_MODE`.
**Done when** With `PILOT_MODE=true` nothing transmits and everything logs; with it false
(never in this phase) it would send. Every template passes the preview-safety check.

### B16 · Stripe test mode
**Goal** Deposits, membership billing, checkout.
**Done when** A test card completes a booking deposit and starts a membership, and a
deliberate attempt to put a service name in Stripe metadata fails a test.
**Notes** The serialiser allowlist in `lib/phi/` is the enforcement. Write it before the
Stripe integration, not after.

### B17 · Automation engine
**Goal** The 10 rules in `staff/automations`, running on a scheduler.
**Done when** Each rule has a test that proves it fires on the right trigger, does not
double-fire, and respects the consent flags. TCPA evidence recorded per send.

---

## Stage C — compliance (after Gate B)

Work the checklist in `06-architecture.md` and close every `C01`–`C20` row in
`09-compliance-register.md`. The sequencing that matters:

1. **C1 · Decide the host first.** If Vercel's BAA tier is prohibitive, migrate before
   building on it, not after. This decision blocks everything else in Stage C.
2. **C2 · Sign BAAs before any other Stage C work.** Vendors are slow; start them on day
   one and build while you wait.
3. **C3 · Enable RLS and make B2's cross-tenant test pass.**
4. **C4 · Audit logging on every PHI read and write.**
5. **C5 · Column encryption** on photos, intake answers, check-in free text.
6. **C6 · Staff MFA, RBAC verification, session timeout, break-glass with justification.**
7. **C7 · Security risk assessment, documented.** The Security Rule requires it.
8. **C8 · Penetration test.**
9. **C9 · Purge every fixture record, remove `PILOT_MODE`, verify nothing synthetic
   survives.** Verify by querying for `synthetic = true` and getting zero rows.

Then, and only then, Gate C and a real patient.

---

## Stage CUTOVER — replacing GlossGenius

Do not skip this. It is where a replacement project actually fails.

Work `12-glossgenius-parity.md` § Cutover in order, blockers first. The one that needs the
most lead time is the payment-credential migration — if members have to re-enter cards,
that is a churn event and needs to be planned, announced, and staffed, not discovered.

Keep GlossGenius paid and readable for at least one billing cycle after cutover, and do not
decommission until a tested export has been verified restorable. `18-decisions.md` ADR-011.

---

## Never build

Restating so it survives into any future scope conversation:

| Not building | Why |
|---|---|
| Prescribing, e-prescribing, EPCS | Schedule III, DEA-regulated. Stays in the clinical system of record |
| Insurance claims | Cash-pay clinic |
| Native iOS/Android apps | PWA covers it; app-store review is friction and delay |
| Telehealth video | The clinic's model is explicitly in-person |
| A generic upsell engine | Data-driven add-on surfacing only. Pushing peptides based on nothing erodes the clinical trust the product depends on |
| Public patient reviews in-app | Reviews belong on Google; in-app they invite PHI in free text |
| A website builder | Corporate owns the Webflow site |
| Third-party tracking behind login | Not a preference. See `06-architecture.md` rule 2 |
