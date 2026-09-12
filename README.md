# Gameday Thornton — Patient & Operations Platform

Working name: **GAMEPLAN** (patient app) + **PRESS BOX** (owner/staff console)

Client: Gameday Men's Health — Thornton, CO (10701 Melody Dr #315, Northglenn CO 80234)
Corporate site: gamedaymenshealth.com/thornton-co (Webflow, corporate-managed, out of scope)
Build owner: Craig Carda / The Modern Evolution

---

## ⚠️ READ THIS FIRST — the pilot data rule

This build is intentionally **not HIPAA-compliant yet**. Compliance infrastructure
(BAAs, audit logging, encryption-at-rest guarantees, access controls) is deferred to
Phase C by decision, so we can learn what the clinic actually wants before paying for it.

**Therefore, until Phase C is signed off:**

- **No real patient data enters this system. None. Not one name.**
- All demos run on the synthetic dataset in `/fixtures`.
- If the owner or staff want to "just try it with a couple real patients," the answer
  is no, and `docs/09-compliance-register.md` is the document that explains why.
- Every schema, module, and data path is built *as if* it were compliant, so Phase C
  is a hardening pass and not a rewrite. See `docs/06-architecture.md`.

This is not bureaucratic caution. A men's-health clinic holds testosterone
prescriptions, ED diagnoses, and lab values. A leak here is a reportable breach with
statutory penalties, and the franchisee carries it.

---

## What this repo is

A complete planning package **and a working clickable pilot** for the software the
Thornton franchise runs on.

Two things are being replaced:

1. **GlossGenius**, which runs the front desk today. It is a good salon product and it is
   the wrong tool here — it has no concept of a lab panel, a protocol, a dose, or a safety
   threshold, so the entire clinical loop can only live as free text in a client note.
   See `docs/12-glossgenius-parity.md`, which maps every feature they rely on to its
   replacement so nothing gets dropped in the cutover.
2. **Nothing, on the patient side** — because nothing exists. The corporate site's "Book
   Appointment" button leads to a callback form. There is no portal, no self-serve
   scheduling, no lab delivery, no membership self-service, and no owner-side pipeline or
   retention data.

The goal of Phase A/B is a **functional pilot the owner and staff can actually click
through and react to** — so we harvest real requirements instead of guessing — then
scope the production build against what they tell us.

## Run the pilot

```bash
node scripts/generate-fixtures.cjs     # build the synthetic dataset
node scripts/smoke-test.cjs            # 69 checks across all 27 screens
```

Then open `prototype/index.html` in a browser. No install, no build, no server.
Or `node scripts/serve.cjs` for an http origin a phone can reach.

`prototype/README.md` has the demo walkthrough, the roster, and how to brand it.

## Docs

| File | What it's for |
|---|---|
| `docs/00-brief.md` | Problem, goals, constraints, success metrics |
| `docs/01-audit-findings.md` | Evidence from the crawl of the corporate site |
| `docs/02-patient-journey.md` | End-to-end patient journey, stage by stage |
| `docs/03-owner-journey.md` | Owner + staff operational journeys |
| `docs/04-feature-backlog.md` | Every feature, scored and phased |
| `docs/05-data-model.md` | Entities, relationships, PHI classification |
| `docs/06-architecture.md` | Stack, HIPAA-ready design, what changes in Phase C |
| `docs/07-design-system.md` | Brand tokens, sports vocabulary, UX psychology rules |
| `docs/08-roadmap.md` | Phases, sprints, deliverables, decision gates |
| `docs/09-compliance-register.md` | Everything deliberately deferred + its trigger |
| `docs/10-demo-script.md` | How to run the feedback session and what to ask |
| `docs/11-discovery-questions.md` | What we still need from the owner |
| `docs/12-glossgenius-parity.md` | **What we are replacing, feature by feature, and the cutover plan** |
| `docs/13-build-sequence.md` | **The page-by-page work order. Agents start here** |
| `docs/14-screen-specs.md` | Every screen: job, data, primary action, states |
| `docs/15-branding.md` | How the client rebrands it; token rules for agents |
| `docs/16-media-pipeline.md` | Logos, headshots, clinic photos, progress photos |
| `docs/17-agent-playbook.md` | **Rules of engagement for anyone building on this** |
| `docs/18-decisions.md` | Decision record — why it is built this way |
| `prototype/README.md` | Run it, demo it, brand it |
| `CLAUDE.md` | Context file for Claude Code agents working this repo |

## Structure

```
gamedaythorton/
├── README.md
├── CLAUDE.md
├── docs/                 planning, journeys, specs, decisions
├── fixtures/             synthetic patients, labs, appointments (JSON, generated)
├── prototype/            the clickable pilot — GAMEPLAN + PRESS BOX
├── scripts/
│   ├── generate-fixtures.cjs   the dataset's single source of truth
│   ├── smoke-test.cjs          renders every screen, asserts the invariants
│   └── serve.cjs               static server
└── scoping/              estimates, proposal drafts, feedback capture
```

## Status

- [x] Corporate site audit
- [x] Strategy + planning docs
- [x] Synthetic fixture dataset — 12 patients across the lifecycle
- [x] **Clickable pilot (Phase A)** — 27 screens, brandable, accepts real images
- [x] Build docs for other agents
- [ ] Stage A finishing tasks (`docs/13-build-sequence.md`)
- [ ] Owner/staff feedback session — Gate A
- [ ] Production scope + proposal

### Open blockers

- **Franchise agreement unread.** May forbid an independent patient system. Gate 0, blocking
- **GlossGenius account not seen.** Every "today" claim in the parity matrix is inferred,
  not observed. One morning at the front desk resolves it
- **Payment-credential migration unknown.** If members must re-enter cards at cutover, that
  is a churn event and needs planning. `docs/18-decisions.md` ADR-011
- EMR / charting system unknown — built for manual structured lab entry first
- Real clinical target ranges and safety thresholds unknown — everything in the dataset is
  marked `provisional`
