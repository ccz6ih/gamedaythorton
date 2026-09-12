# 18 — Decision Record

Decisions that are expensive to reverse, with the reasoning and what would change our
mind. When a future agent or developer asks "why on earth is it like this", the answer is
here.

Format: **Decision · Context · Reasoning · Consequences · What would change this.**

---

## ADR-001 — The Phase A pilot is a static browser app, not Next.js

**Status** Accepted · Phase A

**Context** `06-architecture.md` specifies Next.js + Supabase for production. The
immediate need is something the owner and staff can click through and argue with, so we
harvest real requirements instead of guessing.

**Decision** Build Phase A as a dependency-free static app under `prototype/`, running
from a double-clicked `file://` URL. Port to Next.js in Phase B.

**Reasoning**
- The pilot's purpose is feedback, and feedback needs the thing in front of people at zero
  friction. `npm install` before a clinic demo is a way for a demo not to happen
- It runs on a clinic iPad, a phone on the same wifi, or a laptop with no dev tooling
- No build step means no build failure five minutes before a meeting
- Phase A has no server, no database, no auth and no real sending, so most of what a
  framework buys is unused
- Route names map 1:1 onto App Router paths, which makes the port mechanical rather than a
  rewrite

**Consequences**
- Hand-rolled SVG charts instead of Recharts (which needs React) — see ADR-004
- `store.js` will be rewritten as `lib/db` queries. The **selector names are the
  contract**, so the port is renaming rather than redesigning
- No type safety in Phase A. Accepted for a throwaway feedback instrument; not acceptable
  in production
- Images live in `localStorage`, capped at ~4MB — see ADR-005

**What would change this** If Phase A had needed real auth, multi-device state, or real
sending, the calculus flips and the Next.js scaffold comes first.

---

## ADR-002 — The demo clock shifts fixtures forward by whole weeks

**Status** Accepted · Phase A

**Context** Fixture dates are fixed so the dataset is reproducible. But a demo shown three
weeks after generation shows an empty "Today" and a calendar full of the past, which reads
as a broken product.

**Decision** Anchor the dataset to a **Monday**. At load, shift every date forward by whole
weeks so the demo is always the current week. Weekends roll forward to the following
Monday.

**Reasoning**
- Shifting by whole weeks preserves weekday alignment. The clinic runs Mon–Fri, so an
  appointment seeded on a Tuesday must stay on a Tuesday
- Shifting by an arbitrary number of days would land appointments on Saturdays, when the
  clinic is closed, and the calendar would contradict the opening hours on the same screen
- A weekend demo rolling forward to Monday shows the week ahead rather than a week that has
  already happened

**Consequences**
- On a Saturday or Sunday the demo says "today" is the coming Monday. The pilot banner
  shows the demo date, and Settings → Demo data shows the shift applied, so nobody is
  misled
- `dob` is excluded from shifting; everything else date-shaped shifts
- All date maths must go through `GD.store.today()`, never `new Date()`. A screen that
  reads the wall clock will disagree with the rest of the app

**What would change this** A real backend with real timestamps. This is a fixture concern
only.

---

## ADR-003 — Pilot writes persist in a localStorage overlay

**Status** Accepted · Phase A

**Context** A demo where nothing the client does persists cannot show cause and effect.
Submitting a check-in has to make the chart change; entering a critical lab value has to
make the safety queue light up. That is the product.

**Decision** A three-part overlay — `added` / `patched` / `removed` per table — merged over
the generated base at read time, persisted in `localStorage`, resettable in one click.

**Reasoning**
- Mutating the base dataset would mean no clean reset between interviews, and
  `10-demo-script.md` interviews three roles separately
- Additive-overlay-over-immutable-base means reset is deleting one key
- The pilot-edit count in the banner makes it obvious when a session has diverged from the
  seeded roster
- It proves the write paths work end to end, which a read-only mock cannot

**Consequences**
- `store.all(table)` does merge work on every call. Irrelevant at this data volume;
  would not survive real volume
- Shares the ~5MB `localStorage` budget with images
- Every mutation must go through `store.add/patch/remove` or it will not persist

**What would change this** Phase B's real database. The overlay is deleted, not ported.

---

## ADR-004 — Charts are hand-rolled SVG

**Status** Accepted · Phase A · revisit at B5

**Context** `06-architecture.md` specifies Recharts. Recharts requires React, which
requires a build step, which contradicts ADR-001.

**Decision** Write the chart primitives by hand as functions returning SVG strings, in the
same shapes Recharts will render later — same axes, same markers, same colour semantics.

**Reasoning**
- The Stat Sheet is the most important screen in the product and it needs to be right in
  the pilot, not approximated
- What it needs is unusual enough that a library is not obviously less work: six score
  lines, lab-draw ticks, labelled dose-change markers, and a pinned baseline band, all on
  one axis
- Chart colours come from the same tokens as everything else, so rebranding recolours the
  charts too — which a library's default palette would not

**Consequences**
- ~270 lines to maintain, with no accessibility or interaction affordances a mature library
  would provide
- Tooltips are `<title>` elements only
- Port to Recharts at task B5, and **keep the visual result identical** — the client will
  have reacted to the pilot's version

**What would change this** Needing zoom, brush selection, or real tooltips. At that point
Recharts earns its weight.

---

## ADR-005 — Images stay in the browser; there is no upload endpoint

**Status** Accepted · Phase A

**Context** The client must be able to put their logo, clinician headshots, and clinic
photos in, or the demo never feels like theirs. But this build has no BAA, no encryption at
rest, and no access control.

**Decision** Downscale on a canvas, hold as data URLs in the overlay. **Build no upload
endpoint at all.**

**Reasoning**
- The safest place for an image in a pre-compliance build is a place it cannot be sent from
- Not having the endpoint is stronger than having one and being careful. There is no code
  path to misuse
- The canvas re-encode strips EXIF including GPS as a side effect, which is a Phase C
  requirement done early for free
- Patient progress photos stay generated placeholders, so no real patient photograph can
  enter the pilot

**Consequences**
- Images are per-browser. Clearing site data loses them; another device does not see them.
  The Brand Kit export exists so a kit can move deliberately
- ~4MB soft cap shared with the write overlay
- Phase C needs the full private-bucket, signed-URL, audit-logged pipeline
  (`16-media-pipeline.md`) — none of which is prototyped here

**What would change this** Nothing, in the pilot. This is the decision that makes it safe
to leave the demo with a client.

---

## ADR-006 — The sports vocabulary is a toggle, not a fork

**Status** Accepted · Phase A

**Context** Gameday is a sports-metaphor brand and leaning into it solves a real design
problem — it gives a native language for progress that avoids clinical coldness without
making a man feel like a patient. But 400+ franchisees have the same underlying problem,
and a clinic that is not Gameday should not inherit the metaphor.

**Decision** One vocabulary map with `themed` and `plain` values per concept, switched by
a single Brand Kit toggle. All UI copy calls `GD.brand.word()`.

**Reasoning**
- The alternative — a themed build and a generic build — is two codebases and a drift
  problem
- It is the cheapest possible move toward the multi-tenant play in `08-roadmap.md` Phase D:
  nothing about the metaphor is load-bearing
- It forces the discipline that matters anyway: **only nouns are themed, never
  instructions**. Having to categorise each string as themeable or not surfaces any place
  where clinical copy has been made cute

**Consequences**
- No themed noun may be hard-coded anywhere. Easy to violate; the test checks the toggle
  changes output but cannot find a string hard-coded into one sentence
- Both modes need reading end to end after copy changes

**What would change this** Nothing foreseen. Cost is near zero and the option value is
high.

---

## ADR-007 — Accent contrast is computed, not trusted

**Status** Accepted · Phase A

**Context** A client will paste a brand colour that fails WCAG AA against a dark surface.
About 8% of men have some colour-vision deficiency and this is an all-male patient
population.

**Decision** Compute relative luminance and contrast ratios. Pick button ink
automatically. Warn in plain language on failure — but do not block.

**Reasoning**
- The failure mode is silent and severe: illegible buttons that the person who chose the
  colour will not perceive as a problem
- Auto-picking the ink colour removes the most common way this goes wrong
- Not blocking is deliberate: sometimes a brand is a brand, and a tool that refuses the
  client's actual colour gets abandoned. Informed is the goal, not obedient
- No clinical status is ever communicated by colour alone regardless, which is the real
  safety net

**Consequences** ~40 lines of colour maths in `brand.js`. Two smoke-test checks.

---

## ADR-008 — Manual structured lab entry is the design, not the fallback

**Status** Accepted · inherited from `06-architecture.md`

**Context** The EMR and the lab analyser are both unknown. It is not known whether any
electronic output exists.

**Decision** Build for fast manual structured entry. Treat any future HL7/FHIR integration
as Phase D upside.

**Reasoning**
- Projects of this shape routinely die trying to integrate HL7 on day one
- The trend charts do not care where the numbers came from. Structure is what matters, not
  transport
- **Attaching a PDF is not structured entry.** A PDF cannot be charted, and the whole
  retention engine depends on charting

**Consequences**
- The entry grid has to be genuinely fast or staff will resent it daily. Hence
  keyboard-first, Enter-down-the-column, live flagging, previous value in view
- **Time a provider against their current process at Gate A.** If it is slower than paper,
  the feature has failed regardless of how good the charts look downstream

**What would change this** A documented API on the existing system. Ask at Gate 0.

---

## ADR-009 — The plateau is named to the patient, not hidden

**Status** Accepted · Phase A · **needs clinical sign-off**

**Context** The month-4 doubter is the patient the product exists for: clearly better than
baseline, flat for six weeks, about to cancel. The Stat Sheet will show the flat stretch
whether or not we mention it.

**Decision** When scores have been flat for five or more weeks, say so explicitly on the
patient's own Stat Sheet, then reframe against baseline and offer a recheck.

**Reasoning**
- He can see the flat line. Not naming it reads as either not noticing or hiding it, and
  both cost more trust than the plateau costs
- A plateau after an early climb is the normal shape of this therapy. Framed as normal in
  advance it is reassuring; discovered alone it reads as failure
- It routes to the clinically correct action — a lab recheck tells the provider whether
  there is room to adjust
- It is the same logic as surfacing hematocrit and PSA: a clinic that volunteers what it is
  watching reads as more competent than one that only shows good news

**Consequences**
- **The copy is quasi-clinical and needs a provider to approve it.** This is the single
  item in the pilot most likely to need rewriting by someone with a licence
- The detection threshold is tuned against synthetic data and will need retuning against
  real check-in noise
- At Gate A, ask directly: *should patients see this, or does it generate calls?* Real
  disagreement lives here and the provider's view should win

**What would change this** A provider saying it will frighten people or generate call
volume. Their call, not ours.

---

## ADR-010 — Every screen is tested against every patient

**Status** Accepted · Phase A

**Context** 27 screens × 12 fixture patients, hand-written with no framework and no types.
A screen written against the doubter crashes on the lead who has no labs.

**Decision** `scripts/smoke-test.cjs` renders every screen against every patient in a
minimal fake DOM, asserts no exception, no `undefined`/`NaN`/`[object Object]` in the
output, and checks the compliance invariants.

**Reasoning**
- Without types, a render error is only found by clicking, and nobody clicks all 324
  combinations
- The edge-case patients are the ones that matter and the ones least likely to be clicked
  during development
- Encoding the compliance invariants as tests — `clinic_id` everywhere, no PHI in payment
  descriptors, no clinical content in notification previews, all ranges provisional — turns
  rules people forget into failures people cannot ignore
- It found four real bugs on first run, including an infinite render loop

**Consequences**
- The fake DOM needs maintaining as the code touches more browser APIs
- **It cannot see layout.** Stated at the end of every run so nobody mistakes a pass for
  "it looks right"
- New screens must be added to `ROUTES` or they are silently untested

---

## ADR-011 — GlossGenius stays paid and readable through cutover

**Status** Proposed · Stage CUTOVER · **needs owner agreement**

**Context** This replaces the system currently running the front desk. A missing feature
in a portal is a disappointment; a missing feature in the system that runs the clinic is an
outage.

**Decision** Run in parallel, cut over deliberately, keep GlossGenius read-only for at
least one billing cycle after, and do not decommission until a tested export has been
verified restorable.

**Reasoning**
- Rollback has to exist. Discovering a missing workflow the week after cancelling is
  unrecoverable
- Gift cards, packages, and prepaid series are real liabilities that must be honoured
  across the boundary
- Anything that functioned as a clinical record has retention obligations. Ask counsel
  before deleting
- **The payment-credential migration is the real risk.** Card credentials do not move
  between processors without a formal migration. If members have to re-enter cards, that is
  a churn event and has to be planned, announced, and staffed — not discovered

**Consequences** A few months of double subscription cost. Cheap relative to one lost
member, let alone an unrecoverable data loss.

**What would change this** Confirmation that GlossGenius runs on Stripe underneath, which
may make a Stripe-to-Stripe credential migration possible. [VERIFY] — it is the first
question in `12-glossgenius-parity.md` § Discovery additions.
