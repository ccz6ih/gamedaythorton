# 08 — Roadmap

Four phases with a **decision gate** between each. The gates exist so we do not build
Phase C before the owner has told us what Phase B got wrong.

```
PHASE 0   Discovery                    ~1 week      [GATE 0: franchise clearance]
PHASE A   Clickable pilot              2-3 weeks    [GATE A: owner/staff feedback]   BUILT
PHASE B   Functional pilot             4-6 weeks    [GATE B: go/no-go on production]
PHASE C   Compliance + production      6-8 weeks    [GATE C: first real patient]
CUTOVER   Replace GlossGenius          2-4 weeks    [GATE CUT: decommission]
PHASE D   Depth + multi-tenant         ongoing
```

**CUTOVER was added after the brief clarified that this replaces GlossGenius rather than
filling a vacuum.** It sits between C and D rather than taking a letter, because the lettered
phases are referenced throughout the other docs and renumbering them would create more
confusion than it removes.

It is not optional and it is not a launch — it is a migration with a rollback. Skipping it is
how replacement projects fail: the missing workflow gets discovered the week after the old
subscription was cancelled. See `12-glossgenius-parity.md` § Cutover and `18-decisions.md`
ADR-011.

The blocker with the longest lead time is the payment-credential migration. If members have
to re-enter cards, that is a churn event and needs to be planned, announced, and staffed.
Find out early.

---

## PHASE 0 — Discovery (~1 week, low cost, highest value per hour)

**Deliverables**
- Franchise agreement review — the answers in `11-discovery-questions.md` §1
- Current-state inventory: EMR/charting, booking, payment processor, lab vendor
- Baseline metrics captured (see below)
- Half-day staff shadowing
- Confirmed brand assets and exact accent hex

**Baseline metrics — capture these or we can never prove value**
Monthly leads, booked-consult rate, show rate, consult-to-member conversion, current
member count, MRR, average months retained, no-show rate. If the owner does not have
them, that itself is the finding and the first deliverable is measurement.

### GATE 0 — blocking
Does the franchise agreement permit an independent patient-facing system and independent
payment processing? **If no, stop and redesign the approach.** Do not build first and
ask later.

**Three more, added Sept 2026** after finding that corporate already runs a custom EMR
built with Lobbie and has announced a patient app:

- Are franchisees **required** to use the corporate EMR, and does it expose an API?
  (Lobbie advertises HL7/FHIR integration.)
- What is the corporate patient app's **scope and timeline**? Scheduling, results and
  messaging are lost ground; build around them, not against them.
- Is the practice a **HIPAA covered entity** at all? Gameday does not bill insurance.
  An attorney answers this in writing — it is the single largest cost variable in the
  project. `21-compliance-cost.md`.

---

## PHASE A — Clickable pilot (2–3 weeks) — **BUILT**

**Goal:** something the owner and staff click through and react to. Not a product — a
feedback instrument. Synthetic data, no real sending, no real payments.

**Status: built and passing.** 27 screens in `prototype/`, running on the 12-patient
synthetic roster, brandable by the client, accepting real images for clinicians, the clinic
and patients. Run it per `prototype/README.md`. Remaining finishing tasks — calendar day
view, ungated symptom self-assessment, the week-12 milestone screen, print/export — are
Stage A in `docs/13-build-sequence.md`.

Everything below was the plan; it is now the inventory of what exists.

**Patient app (GAMEPLAN)**
- Booking flow end to end: service -> provider -> slot -> confirm (P01, P02, P03, P05)
- Published pricing (P07)
- Anxiety-reduction pre-visit card (P13)
- Digital intake (P09)
- Dashboard, Game Plan card, expectation timeline (P23, P26)
- **Weekly check-in (P14)**
- **Stat Sheet with scores + lab ticks + dose markers (P15)**
- **Lab trends with target ranges and plain-language reads (P16)**
- Privacy layer: notification discipline, discreet labelling (P35, P37)

**Staff console (PRESS BOX)**
- Scoreboard: MRR, NRR, members, **months on protocol** (S01, S02, S03)
- Pipeline funnel (S04)
- Today's patients with intake status (S12)
- Unified patient timeline (S13)
- Structured lab entry (S14)
- Protocol builder with change history (S15)
- Due-for-labs queue (S17)
- Check-in board (S21)
- Rebook-before-leaving prompt (S23)
- Speed-to-lead SMS — **simulated**, logged not sent (S27)

**Also built:** `/fixtures` — 12 synthetic patients across the lifecycle. Must include
a month-2 enthusiast, a month-4 doubter, a churned member with a reason code, a
hematocrit safety flag, and a no-show recovery. The edge cases are what generate useful
feedback; a dataset of happy patients demos beautifully and teaches nothing.

### GATE A — the feedback session
Run `10-demo-script.md`. Owner, clinic director, and front desk, separately where
possible. Output: every backlog row marked Must / Nice / Don't-care, plus their
unprompted additions. **Their marks replace our phase assignments from here.**

---

## PHASE B — Functional pilot (4–6 weeks, scoped by Gate A)

**Goal:** genuinely usable by staff on synthetic data, with real automation logic and
real payment rails in test mode. Still no real patients.

Indicative content (reorder per Gate A):
- Deposits, waitlist (P04, P06)
- Symptom self-assessment (P08)
- Validated instruments, consents + e-sign, intake pre-fill (P10, P11, P12)
- Safety trending to patient (P17)
- **Game Film with ghost-overlay capture + compare slider (P18, P19)**
- Milestone moments (P21)
- Injection tracker, videos, dose reminders, refills (P24, P25, P27, P28)
- Secure messaging (P29)
- Membership self-service incl. pause (P30)
- Biometric lock, hide-sensitive toggle (P36, P38)
- Source attribution to revenue (S05)
- Churn cohorts + reason codes (S06)
- At-risk list (S10)
- Safety queue (S16)
- Patient-summary publisher (S18)
- Checkout + membership start (S22)
- Missed-call queue, waitlist fill (S24, S25)
- Automation engine: S28–S33, S36, S37

### GATE B — go/no-go
Staff have run the console against synthetic data for two full weeks. Decision: proceed
to compliance and production, or iterate Phase B. **Phase C costs real money in vendor
contracts — do not enter it on enthusiasm alone.**

---

## PHASE C — Compliance + production (6–8 weeks)

This is where HIPAA lands. Work the full checklist in `06-architecture.md`. Highlights:

- BAAs: host, DB, storage, SMS, email, monitoring
- **Hosting decision point:** Vercel's BAA is a $350/mo Pro add-on, not Enterprise.
  The bigger cost is Supabase's HIPAA floor (Team $599 + add-on). Costed against
  AWS / Render / Aptible in `21-compliance-cost.md`. Decide at the start of Phase C
- RLS on every PHI table, with a deliberate cross-tenant penetration attempt as the test
- Audit logging on all PHI paths
- Column encryption: photos, intake answers, check-in free text
- Staff MFA, session timeout, RBAC verification
- Break-glass access, logged with justification
- Encrypted backups + tested restore
- Security risk assessment documented (the Security Rule requires it)
- Incident response + breach notification runbook
- Staff training records
- Penetration test
- Remaining items: HSA/FSA receipts, referral tracking, PCP export, add-on surfacing,
  billing descriptor, LTV, service mix, utilisation, photo markup, consent expiry,
  inventory + controlled-substance log, failed-payment retry, review automation
- **Purge all fixture data. Remove `PILOT_MODE`. Verify no synthetic record survives.**

### GATE C — first real patient
Sign-off checklist complete, legal review of the controlled-substance log, staff
trained. Only then does a real name enter the system.

---

## CUTOVER — replacing GlossGenius (2–4 weeks)

Only after Gate C. Work `12-glossgenius-parity.md` § Cutover in order.

```
1. PARALLEL        Both live. GlossGenius is still the system of record.
2. CUTOVER         Client list imported. New bookings here; existing
                   GlossGenius appointments honoured until they drain.
3. READ-ONLY TAIL  GlossGenius kept paid and readable for at least one
                   billing cycle. Export everything before it ends.
4. DECOMMISSION    Only after a tested export is verified restorable.
```

**Blockers to resolve before Phase C ends, not during cutover:** client-list export
(including notes and photos), outstanding gift cards and prepaid series, future appointments
already booked, **payment credentials**, and record-retention obligations on anything that
functioned as a clinical record.

### GATE CUT — decommission
A tested, verified-restorable export exists. Gift cards and packages reconciled. No workflow
has surfaced in a month of live use that only the old system could do. Only then cancel it.

---

## PHASE D — Depth + the actual opportunity

- Lab integration (HL7/FHIR) if a real interface exists
- Body composition device integration
- Annual season review
- Corporate reporting export
- **Multi-tenant activation.** The schema has carried `clinic_id` since Phase A. 400+
  franchisees have this identical problem, corporate runs a Franchise Advisory Council
  explicitly hunting for system-wide wins, and none of them have a patient portal. This
  is the difference between a client project and a product — and the reason the
  multi-tenant discipline in Phase A is non-negotiable even though it does nothing yet

---

## Risk register

| Risk | Sev | Mitigation |
|---|---|---|
| Franchise agreement forbids independent patient system | **Critical** | Gate 0. Resolve before any build |
| Real patient data enters pilot | **Critical** | `PILOT_MODE`, banner, test keys only, no live sending, written rule in README |
| Vercel BAA cost kills the hosting plan | Low | Now $350/mo self-serve on Pro. Supabase's HIPAA floor is the larger cost; alternatives costed in `21-compliance-cost.md` |
| Compliance cost exceeds the fee at one clinic | **High** | Real. Fixed cost, ~5–10 practices to break even. Client owns the hosting accounts and BAAs; we charge for work, not infrastructure. `22-commercial-model.md` |
| Covered-entity status never established | **High** | Neither practice bills insurance, so HIPAA may not attach at all. Attorney answers it, in writing, before Phase C is costed |
| No EMR API — manual entry forever | Medium | Already the design assumption. Make the entry grid genuinely good |
| Staff do not adopt the console | High | Gate A and Gate B exist precisely for this. Shadow them; do not demo at them |
| Owner wants "just two real patients" in pilot | High | Say no. Point at `09-compliance-register.md`. This is the most likely way this project goes wrong |
| Scope creep from an enthusiastic owner | Medium | Backlog is the contract. New asks get scored and phased, not absorbed |
| **Corporate has built their own EMR and a patient app is "coming soon"** | **MATERIALISED** | Confirmed Sept 2026: Gameday built a custom EMR with Lobbie; a patient app for scheduling, results and messaging is announced. Concede the record and the messaging app; hold the progress engine and retention economics, which nothing described covers. `22-commercial-model.md` |
