# 09 — Compliance Register

Everything deliberately deferred, why, what it costs, and what triggers it.

**This document exists to be shown to the client.** When the owner says "can we just try
it with a couple of real patients," this is the answer. Print it if necessary.

---

## The decision on the table

We chose to build the functional software first and add HIPAA controls in Phase C. That
is a **legitimate** sequencing decision and it saves real money — BAAs, enterprise
hosting tiers, and a penetration test are expensive to buy before you know what you are
buying them for.

It is legitimate **only** while no real patient data exists in the system. The moment
one real patient record is entered, every deferred item below becomes a live legal
exposure, retroactively, with no grace period.

## What the clinic is actually holding

Worth stating plainly so nobody treats this as paperwork:

- Testosterone prescriptions (Schedule III controlled substance)
- Erectile dysfunction diagnoses and treatment
- Hormone lab values
- Weight-loss and metabolic data
- Progress photographs
- The fact that a named, identifiable man is a patient of a men's-health clinic — which
  is itself a disclosure, independent of any clinical detail attached to it

A breach here is reportable under the HIPAA Breach Notification Rule. Penalties are
tiered by culpability and "we knew and deferred it" sits in the worst tier. **The
franchisee carries this liability, not corporate, and not us** — which is exactly why
the rule below is not negotiable for his sake, not ours.

---

## THE RULE

> **No real patient data enters this system until Phase C sign-off is complete.**
> No names. No "just my own record as a test." No importing an existing patient list.
> No screenshots of real labs pasted into the lab-entry grid.

Enforced technically, not by memory:

| Control | Implementation |
|---|---|
| `PILOT_MODE=true` | Default on; refuses to start without an explicit override |
| Persistent banner | "PILOT — SYNTHETIC DATA ONLY" on every screen, patient and staff |
| No live sending | SMS/email log to console or dev inbox. No production credentials in any env file |
| Test payments only | Stripe test keys. Live keys are not present in the repo or any deploy target |
| Not indexable | `noindex` + `robots.txt` disallow on every route |
| Not discoverable | Non-guessable preview URL, never a public subdomain |
| Resettable | One command wipes and reseeds from `/fixtures` |

---

## Deferred items

| # | Item | Deferred to | Est. cost | Trigger |
|---|---|---|---|---|
| C01 | BAA — hosting | C | Vercel Enterprise, or migrate to AWS/Render/Fly | Any real PHI |
| C02 | BAA — database | C | Supabase HIPAA add-on (verify current pricing) | Any real PHI |
| C03 | BAA — file storage | C | Bundled with C02 | Any real photo or document |
| C04 | BAA — SMS (Twilio) | C | Low | Any message to a real patient |
| C05 | BAA — email | C | Low. **Verify Resend offers one; fall back to SES** | Any email to a real patient |
| C06 | BAA — error monitoring | C | Low | Any real PHI in a stack trace |
| C07 | RLS on all PHI tables | C | Dev time | Any real PHI |
| C08 | Audit logging, append-only | C | Dev time | Any real PHI. Required by the Security Rule |
| C09 | Column encryption (photos, intake, free text) | C | Dev time | Any real PHI |
| C10 | Staff MFA + RBAC verification | C | Low | Any staff account touching real PHI |
| C11 | Session timeout | C | Low | Any real PHI |
| C12 | Break-glass access with justification | C | Dev time | Any real PHI |
| C13 | Encrypted backups + tested restore | C | Low | Any real PHI |
| C14 | Retention + deletion policy | C | Dev time | Any real PHI |
| C15 | Security risk assessment, documented | C | Consultant or thorough self-assessment | Any real PHI. **Explicitly required** |
| C16 | Incident response + breach notification runbook | C | Low | Any real PHI |
| C17 | Staff HIPAA training records | C | Low | Any staff access |
| C18 | Penetration test | C | Moderate | Before first real patient |
| C19 | Business continuity / disaster recovery plan | C | Low | Any real PHI |
| C20 | Legal review — controlled-substance log | C | Attorney time | Before the log becomes the clinic's actual DEA-facing record |

## Already built correctly — no deferral, no retrofit

These are not deferred because deferring them would require rework later, and because
some of them are the actual liability:

| Item | Status |
|---|---|
| No third-party tracking on authenticated routes | Enforced from commit one |
| No PHI in payment processor fields | Serialiser allowlist in `lib/phi/` |
| No prescribing / e-prescribing / EPCS | Architectural exclusion |
| PHI classified on every entity | `05-data-model.md` |
| `clinic_id` on every table | Multi-tenant-ready |
| Consent + TCPA evidence captured with text version, timestamp, IP | `consent_record` |
| EXIF stripped on photo upload | Upload pipeline |
| No clinical content in notification previews | Notification layer |
| Template versioning on consents | `intake_submission.template_version` |
| Separate analytics schema that cannot join to PHI | Schema separation |

---

## Also deferred, non-HIPAA but real

| Item | Note |
|---|---|
| TCPA compliance review | Consent capture is built correctly; have counsel review the actual message templates before any live send |
| Colorado state privacy law | CPA has its own requirements around sensitive data and consent. Review at Phase C |
| Colorado telehealth / scope-of-practice | Only relevant if remote consults are ever added. Currently out of scope |
| Accessibility (WCAG 2.1 AA) | Tokens and touch targets designed for it in `07-design-system.md`; formal audit at Phase C |
| Franchise agreement clearance | **Gate 0, blocking.** Separate from compliance but equally capable of ending the project |

---

## Sign-off

Phase C is complete when every C-numbered row above is closed, fixture data is purged,
`PILOT_MODE` is removed, and the owner has signed acknowledgement of the runbook.

Only then does a real name enter the system.

| Role | Name | Date |
|---|---|---|
| Clinic owner | | |
| Build (Craig Carda) | | |
| Legal review | | |
