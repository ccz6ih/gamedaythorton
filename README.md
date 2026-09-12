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

A complete planning + prototype package for the back-end and patient-facing software
the Thornton franchise currently does not have. The corporate site's "Book Appointment"
button leads to a callback form. There is no portal, no self-serve scheduling, no lab
delivery, no membership self-service, and no owner-side pipeline or retention data.

The goal of Phase A/B is a **functional pilot the owner and staff can actually click
through and react to** — so we harvest real requirements instead of guessing — then
scope the production build against what they tell us.

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
| `CLAUDE.md` | Context file for Claude Code agents working this repo |

## Structure

```
gamedaythorton/
├── README.md
├── CLAUDE.md
├── docs/                 planning, journeys, roadmap, scope
├── fixtures/             synthetic patients, labs, appointments (JSON)
├── prototype/            clickable pilot — patient app + staff console
└── scoping/              estimates, proposal drafts, feedback capture
```

## Status

- [x] Corporate site audit
- [x] Strategy + planning docs
- [ ] Synthetic fixture dataset
- [ ] Clickable prototype (Phase A)
- [ ] Owner/staff feedback session
- [ ] Production scope + proposal
