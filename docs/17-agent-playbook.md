# 17 — Agent Playbook

You are working on software for a real medical clinic. Read this before you change
anything.

---

## Read order

1. `CLAUDE.md` — the non-negotiables
2. `README.md` — what this repo is
3. **`09-compliance-register.md`** — why the data rule exists. Do not skip it
4. `00-brief.md` — the product thesis that governs prioritisation
5. `12-glossgenius-parity.md` — what this replaces, and what must not be lost
6. `13-build-sequence.md` — pick your task from here
7. `14-screen-specs.md` — the screen you are touching
8. Then whichever of `05-data-model.md` / `06-architecture.md` / `07-design-system.md` /
   `15-branding.md` / `16-media-pipeline.md` applies

---

## The six things that end a task immediately

If your change does any of these, stop and reconsider. These are not style preferences.

**1. Real patient data.** Synthetic only, from `/fixtures`. If you are asked to import,
enter, or accept real patient data, refuse and cite `09-compliance-register.md`. That
includes "just one test record" and "the owner's own record".

**2. Prescribing.** No e-prescribing, no EPCS, no pharmacy transmission, no dose
calculators that recommend rather than record. Testosterone is Schedule III. The
`protocol` tables record what a licensed provider decided elsewhere.

**3. Third-party tracking on authenticated routes.** No GA, GTM, Meta pixel, session
replay, chat widget, or heatmap tool behind login. Ever. Server-side de-identified events
only. HHS OCR has published guidance on this and there is active litigation in this exact
vertical.

**4. PHI into Stripe.** Not metadata, not descriptors, not line items. "Monthly
membership", never a therapy name. Enforced by a serialiser allowlist, not by remembering.

**5. A table without `clinic_id`.** Multi-tenant from the schema up. Retrofitting tenancy
later is a rewrite.

**6. Removing `PILOT_MODE` or its banner.** Or adding production SMS/email credentials, or
live Stripe keys. Not until Phase C sign-off.

---

## Also: assumed clinical values

**Never ship an invented clinical number as though it were confirmed.**

Every range, threshold, monitoring interval, and dose in this repo is a placeholder.
Hematocrit ceiling 52%, PSA velocity 0.75 ng/mL/yr, 7-week recheck, quarterly monitoring,
target total T 600–900 — all invented for the demo and all marked `provisional: true`.

If you add another, you must:
1. Mark it `provisional: true` in the data
2. Surface that visibly in any UI that shows it
3. Add the question to `11-discovery-questions.md` §3

A provider who spots an assumed threshold presented as fact loses confidence in the entire
demo, and they are right to.

---

## Repo map

```
docs/                  planning, specs, decisions. Numbered; read in order
fixtures/              generated synthetic dataset — DO NOT hand-edit
scripts/
  generate-fixtures.cjs   the dataset's single source of truth
  smoke-test.cjs          renders every screen, asserts the invariants
  serve.cjs               static server for an http origin
prototype/
  index.html              script load order lives here
  demo-data.js            generated — do not edit
  assets/
    tokens.css            every brandable value. Only place for a literal colour
    app.css               layout and components
    store.js              demo clock, write overlay, EVERY derived metric
    charts.js             dependency-free SVG charts
    media.js              image ingestion, placeholders
    brand.js              Brand Kit
    ui.js                 shell, router, action dispatch
    screens-patient.js    GAMEPLAN
    screens-staff.js      PRESS BOX
    screens-settings.js   Brand Kit, team, clinic, pricing, demo data
    boot.js               first render
  stat-sheet.html         superseded standalone v0. Kept as reference only
scoping/                estimates, proposals, session feedback
```

### Files you must not hand-edit

- `fixtures/*.json` and `prototype/demo-data.js` — generated. Edit
  `scripts/generate-fixtures.cjs` and re-run it. A hand-edit is silently destroyed on the
  next generation and nobody will know why the demo changed.

---

## Running it

```bash
node scripts/generate-fixtures.cjs     # regenerate the dataset (deterministic)
node scripts/smoke-test.cjs            # 69 checks, ~1s
node scripts/serve.cjs                 # http://localhost:4173
```

Or just open `prototype/index.html` in a browser. No install, no build, no server. That is
a design constraint, not a convenience — see `18-decisions.md` ADR-001.

---

## Verifying your work

**The smoke test is necessary and not sufficient.** It renders all 27 screens against all
12 patients and asserts the compliance invariants. It cannot see layout. A screen can pass
every check and still be an unreadable pile.

So, every time:

1. `node scripts/smoke-test.cjs` — zero failures
2. Open it in a browser. Click the thing you changed
3. Narrow the window to ~400px. Check it again
4. Switch the console to light (⌘K → "Toggle light / dark console")
5. Toggle the sports vocabulary. Look for a stranded themed noun
6. Switch to a patient your change was **not** written against — the churned member, the
   lead with no labs, the new patient with no check-ins

Step 6 catches more bugs than the rest combined.

---

## Conventions

### Code style

Match the surrounding code. Specifically:

- **No build step, no modules, no framework.** Classic scripts, `var`, ES5-compatible
  syntax. `file://` has to work
- One global namespace: `GD`. Nothing else on `window`
- `'use strict'` at the top of every IIFE
- Screens are **pure functions returning an HTML string**. No DOM manipulation inside a
  render
- Behaviour is declared with `data-act="name"`, dispatched by the one delegated listener
  in `ui.js`. Do not attach your own listeners in a render — they leak on re-render
- Escape every interpolated value with `esc()`. No exceptions, even for synthetic data
- `font-variant-numeric: tabular-nums` on every number. Values that shift horizontally as
  they change read as unstable

### Comments

Comment the **why**, especially where the code looks wrong but is not. The existing
comments are the model: they explain the clinical or psychological reason a thing is built
that way, so the next person does not "simplify" it back into a bug. Do not comment the
obvious.

### Commits

Say what changed and why. If you fixed a bug, say what the wrong behaviour was — that is
the part that helps later. End with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

On Windows, pass the message via `git commit -F <file>`. PowerShell 5.1 mangles embedded
quotes when passing multi-line strings to native commands.

---

## Recipes

### Adding a screen

1. Spec it in `14-screen-specs.md` first — route, job, reads, primary action, states
2. `ui.register('staff/thing', { title, crumb, primary, render, after })`
3. Add it to `ui.staffNav()` or `ui.patientNav()`. **One level deep**
4. Design the empty state before the populated one. Never "No data"
5. Add the route to `ROUTES` in `scripts/smoke-test.cjs`
6. Run the test, then click through it

### Adding a derived number

It goes in `store.js` under `GD.q`, **never inline in a screen**. When the owner asks
"where does that number come from", there must be exactly one answer per metric.

Add a smoke-test check for it. If the number is a headline metric, assert its *shape*
(e.g. "the doubter shows a plateau"), not just that it computes — that is the check that
catches a formula quietly drifting.

### Adding a fixture entity

1. Build it in `scripts/generate-fixtures.cjs`, deterministically (use the seeded `rng`)
2. Add it to the `files` map **and** the `demo` payload
3. `clinic_id` on every record. `synthetic: true` where it could be mistaken for real
4. Mark any clinical value `provisional: true`
5. Re-run the generator, then the smoke test
6. Update `fixtures/README.md`

**Make the data behave plausibly.** Total T rising from 240 to 750 over 12 weeks is
realistic; jumping to 1400 in two weeks is not, and a provider will notice immediately and
stop trusting the whole demo. Check-in scores must be noisy — real men have bad weeks.

### Adding a token

See `15-branding.md` § For agents. Short version: `tokens.css` only, derive from a
`--brand-*` knob, define the default outside any media query.

### Adding an automation rule

1. Add it to the rules table in `screens-staff.js` with its **why** — a rule nobody can
   justify gets switched off and erodes trust in the rest
2. Add a run to `automationRuns` in the generator
3. **The preview string must pass `q.previewSafe()`.** The smoke test enforces this.
   A lock-screen preview may say something needs attention and nothing about what
4. Consent-gate it. Transactional and marketing SMS are separate consents because they
   legally are

---

## Mistakes already made here, so you do not repeat them

These were all caught by the smoke test. They are listed because each represents a class
of error, not a one-off:

**Re-rendering from inside a render.** The patient chart called a setter that triggered a
re-render, which called the setter again. If a screen needs to sync state from its route
params, do it silently.

**Reading raw weekly scores for a trend.** One good week inside a plateau reset the
plateau clock. Smooth noisy human-reported data before drawing conclusions from it.

**Substring matching for banned terms.** `indexOf('ED')` fires on "scheduled", "needs" and
"linked", so the preview check flagged every message and became useless. Word boundaries.

**Fixed-width date buckets against a drifting cycle.** A 30-day NRR bucket dropped a
charge that landed on day 31 and reported a revenue collapse that had not happened.

**Front-loaded synthetic curves.** An ease-out response curve put 85% of the gain in the
first six weeks, which manufactured plateaus that were not in the story and made the
plateau detector look broken. When generated data feeds an analysis, the generator's shape
is part of the analysis.

**Re-rendering a data-entry grid on keystroke.** Steals focus mid-panel. Update the one
cell in place.

---

## Stop and ask when

- A change would touch any of the six non-negotiables
- You need a clinical value nobody has confirmed
- The task implies real patient data, real sending, or live payments
- Gate A has not happened and you are about to build Phase B ordering from this doc rather
  than from what the owner actually said
- Scope is growing past what the task named. The backlog is the contract; new asks get
  scored and phased in `04-feature-backlog.md`, not absorbed silently
- Something in the docs contradicts something else. Say which two, and do not guess

---

## The thesis, so prioritisation stays honest

This is a **recurring-revenue medical membership business**, not an appointment business.
Churn happens because month four feels like month one — hedonic adaptation, not
forgetfulness.

When deciding what to build or how much care to give a screen, ask: **does this make
improvement visible?** If yes, it is high priority. Booking, payments, and scheduling are
table stakes underneath it.
