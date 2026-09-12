# 12 — GlossGenius Parity & Replacement Map

The clinic runs on **GlossGenius** today. This build replaces it. That is a different
brief from "build a patient portal", and it changes the risk profile of the project in
one specific way:

> A portal that nobody adopts is a disappointment. A **replacement for the system that
> runs the front desk** that is missing one thing they rely on daily is an outage.

So this document exists to make sure nothing they currently depend on gets dropped,
and to be honest about where we do not yet know what they depend on.

---

## ⚠️ What we do not know yet

**We have not seen their GlossGenius account.** Everything in the "today" column below is
inferred from what that product is generally known to do, not from observed use. Before
Phase B scope is signed, someone has to sit at the front desk and watch.

Marked **[VERIFY]** throughout. Every one of those is a question in
[§ Discovery additions](#discovery-additions) below.

The single most valuable hour in this whole project is watching the front desk use
GlossGenius for a normal Tuesday morning. Nothing in this document substitutes for it.

---

## Why they are on the wrong tool, stated fairly

GlossGenius is a good product built for salons, spas, and independent beauty
professionals. It is genuinely strong at booking, payments, and client retention
marketing, and it is far better than the paper-and-phone alternative.

It is the wrong tool here for two structural reasons, neither of which is a criticism of
the product:

**1. It has no concept of the clinical loop.** There is no lab panel, no analyte, no
reference range, no protocol, no dose, no titration, no safety threshold, no monitoring
interval. A men's-health membership business runs on
`baseline labs → protocol → recheck → titrate → monitor`, and in a salon tool that entire
cycle can only live as free text in a client note. Which means it cannot be charted, and
if it cannot be charted it cannot be shown back to the patient — and showing it back to
the patient is the whole retention mechanism (see `00-brief.md`).

**2. It is not a healthcare platform.** [VERIFY] whether GlossGenius will sign a Business
Associate Agreement. If they will not — and general-purpose salon software typically does
not — then **every clinical detail currently sitting in a client note is already a
compliance exposure**, today, before we build anything.

That second point deserves care in how it is raised. It is not a sales lever and it
should not be used as one. If it turns out to be true, the honest framing is: *this is a
problem you already have, it is not urgent-panic, and the fix is sequenced into Phase C
along with everything else.* Do not use it to pressure a decision. See
`09-compliance-register.md` for the tone this project takes on compliance generally.

---

## The parity matrix

Legend for **Status**: ✅ built in the pilot · 🔶 partial, needs Phase B ·
⬜ not started · ❌ deliberately not building.

### Booking & calendar

| GlossGenius does (today) | Our replacement | Status | Notes |
|---|---|---|---|
| Online booking page | Patient booking flow: service → provider → slot → confirm | ✅ | `patient/book`. Real availability computed from clinic hours |
| Appointment calendar, day/week | Week calendar, Mon–Fri, room-aware | ✅ | `staff/calendar`. Day view ⬜ |
| Staff/resource scheduling | Provider + room on every appointment | 🔶 | Per-provider availability rules ⬜ |
| Recurring appointments | Protocol-driven: next visit derived from the monitoring interval | 🔶 | Better than recurring — see "Rebook default" below |
| Waitlist | Waitlist with one-tap offer on cancellation | 🔶 | `staff/messages`. Auto-offer ⬜ |
| Appointment reminders | Reminder automations, privacy-filtered | 🔶 | Logged not sent in pilot |
| Deposits / no-show protection | Card-on-file deposit | ⬜ | P04, Phase B |
| Calendar sync (Google/iCal) | — | ⬜ | [VERIFY] whether anyone relies on this. If a provider lives in Google Calendar, this is a must-have, not a nice-to-have |
| Client self-reschedule / cancel | Self-serve reschedule and cancel | ✅ | `patient/visit` |

### Payments & money

| GlossGenius does (today) | Our replacement | Status | Notes |
|---|---|---|---|
| In-person card processing | Stripe Terminal | ⬜ | Phase B. **[VERIFY] which card reader they use and whether it is leased** |
| Checkout / POS | Checkout with cart, services, add-ons | ✅ | `staff/checkout` |
| Tipping | — | ❌ | Clinical practice. Confirm, but tipping a nurse practitioner is not a thing |
| Recurring / subscription billing | Membership billing, Stripe | 🔶 | Plans + status modelled; live billing Phase B |
| Invoices & receipts | Invoice list, receipts | 🔶 | HSA/FSA formatting Phase C |
| Gift cards | — | ⬜ | [VERIFY] whether any are outstanding. **Outstanding gift cards are a liability that must be honoured through a cutover** |
| Packages / prepaid series | Service packages | ⬜ | Shockwave and PRP are sold in series — likely needed |
| Discounts / promo codes | Discount at checkout | ⬜ | Phase B |
| Payment plans / financing | — | ⬜ | [VERIFY] whether Cherry, Wisetack or similar is in use |
| Payouts & fee reporting | Revenue reporting | 🔶 | Stripe dashboard covers payouts; we report revenue |
| **No PHI to the processor** | Serialiser allowlist, neutral descriptor | ✅ | Not a GlossGenius feature. Ours, and non-negotiable |

### Clients / patients

| GlossGenius does (today) | Our replacement | Status | Notes |
|---|---|---|---|
| Client list, search | Patient roster with clinical filters | ✅ | `staff/patients` + ⌘K |
| Client profile & history | Unified patient chart, one timeline | ✅ | `staff/patient/:id` — visits, labs, doses, scores, photos, messages |
| Client notes | Structured records, *not* free text | ✅ | The upgrade that matters. Free text cannot be charted |
| Intake forms / waivers | Digital intake + validated instruments | ✅ | `patient/intake`, versioned template |
| E-signature on forms | E-signature | ⬜ | Phase B. **Legally meaningful signatures need the audit trail first** |
| Photo attachments | Game Film, guided series with pose keys | ✅ | A guided series is a different product from an attachment |
| Client tags / segments | Status, source, clinical flags | 🔶 | Marketing segments ⬜ |
| Import / export client list | — | ⬜ | **Cutover blocker. See below** |

### Marketing & retention

| GlossGenius does (today) | Our replacement | Status | Notes |
|---|---|---|---|
| Email campaigns | — | ⬜ | [VERIFY] whether they actually send any. Most don't |
| SMS campaigns | Automation engine, consent-gated | 🔶 | Logged not sent in pilot |
| Automated reminders / follow-ups | 10 automation rules with reasons | ✅ | `staff/automations` |
| Review requests | Satisfaction-routed review ask | ⬜ | **Fix the NAP conflict first** (`01-audit-findings.md`) or reviews land on the wrong listing |
| Referral / loyalty | Tracked referral code | ⬜ | Phase C |
| Booking-page branding | Full Brand Kit | ✅ | Goes much further — `15-branding.md` |
| Website builder | — | ❌ | Corporate owns the Webflow site. Out of scope by constraint |

### Reporting

| GlossGenius does (today) | Our replacement | Status | Notes |
|---|---|---|---|
| Sales & revenue reports | MRR, NRR, revenue | ✅ | `staff/scoreboard` |
| Service performance | Service-mix revenue | ⬜ | Phase C |
| Client retention reports | **Average months on protocol**, churn cohorts with reason codes | ✅ | The number that governs this business, which a salon tool has no reason to compute |
| Staff performance | Provider utilisation | ⬜ | Phase C |
| — | **Source attribution to revenue** | ✅ | The 16 corporate form options, finally connected to money |
| — | **Safety queue** | ✅ | No equivalent exists or could |
| — | **Stat Sheet** | ✅ | No equivalent exists or could |

### Operations

| GlossGenius does (today) | Our replacement | Status | Notes |
|---|---|---|---|
| Team member accounts & permissions | Role-based console | 🔶 | Real accounts + MFA at Phase C |
| Inventory / product sales | Lot and expiry tracking, controlled-substance log | ✅ | Goes much further: Schedule III record-keeping |
| Two-way client messaging | Triage-tagged secure messaging | ✅ | Tagged at send so nothing lands in an unowned inbox |
| Mobile app for staff | Responsive PWA | 🔶 | Works on a phone; installable PWA ⬜ |
| Missed-call text-back | Missed-call queue + auto text-back | 🔶 | Logged not sent |

---

## What "easier to use" actually means here

The brief says make it easier. Vague goals produce vague products, so these are the
specific commitments, each one testable:

1. **One-level navigation.** Every screen is one click from the rail. No nested menus, no
   settings three taps deep. If a feature needs a submenu, the rail grouping is wrong.
2. **⌘K goes anywhere.** Type a patient's name or a screen name, press Enter. For a front
   desk with a patient waiting at the counter and a phone ringing, this is the single
   biggest speed win available.
3. **Every screen names its next action.** One obvious primary button per screen, in a
   fixed position. A screen that cannot name its next action is usually the wrong screen.
4. **Every work-queue row carries its reason.** Not "Gregory Sunderman" but "Gregory
   Sunderman — no check-in for 23 days, scores flat 6 weeks". A list of names with no
   reasons gets opened once and never again.
5. **The clinically correct default is pre-filled.** The rebook prompt already has the
   right date in it because the recheck is indicated. The front desk confirms rather than
   decides.
6. **Keyboard-first data entry.** The lab grid: Tab across, Enter down, live flagging,
   previous value in view. Time a provider entering a panel. If it is slower than their
   paper process, it has failed.
7. **No dead ends.** Every empty state says what to do and what it will unlock. Never
   "No data."
8. **Nothing clinical in any notification.** Not a usability feature on paper, but for
   this patient population privacy *is* usability — see `02-patient-journey.md`.

Test these at Gate A by timing them, not by asking whether people like the design.

---

## Cutover: how a replacement actually lands

Do not think of this as a launch. Think of it as a migration with a rollback.

```
1. PARALLEL          Both systems live. GlossGenius remains the system of record.
                     Staff use ours on synthetic data only. (Phase A/B)
      ↓
2. GATE C            Compliance complete. Only now can real data exist here.
      ↓
3. CUTOVER WINDOW    Client list imported. New bookings in ours, existing
                     GlossGenius appointments honoured until they age out.
                     GlossGenius stays paid and readable — do not cancel it.
      ↓
4. READ-ONLY TAIL    GlossGenius kept read-only for at least one full billing
                     cycle plus whatever the record-retention answer turns out
                     to be. Export everything before the subscription ends.
      ↓
5. DECOMMISSION      Only after a tested export is verified restorable.
```

**Cutover blockers — resolve before Phase C, not during:**

- [ ] **Can the client list be exported?** Format? Does it include notes and photos?
      If photos cannot be exported, that history is lost and the owner must know that
      *before* he decides, not after.
- [ ] **Outstanding gift cards, packages, and prepaid series.** These are real
      liabilities. They must be honoured through the cutover and reconciled after.
- [ ] **Future appointments already on the GlossGenius calendar.** Migrate them or run
      both calendars until they drain. Running two calendars is how double-bookings
      happen, so decide deliberately.
- [ ] **Recurring billing already authorised there.** Card credentials do not transfer
      between processors without a formal migration. [VERIFY] whether GlossGenius uses
      Stripe underneath — if so, a Stripe-to-Stripe migration may be possible; if not,
      **every member has to re-enter a card**, which is a churn event and has to be
      planned as one.
- [ ] **Record retention.** Anything that functioned as a clinical record has retention
      obligations. Ask counsel before deleting anything.

That fifth one is the biggest risk in the entire replacement, and it is commercial rather
than technical. A forced re-card across the whole member base will cost members. Whatever
the answer, it needs a plan: pre-announce it, staff it, and expect to chase people.

---

## Discovery additions

These are the [VERIFY] items above, collected. **They are already added to
`11-discovery-questions.md` as §10** — that document is the one to take into the room;
this copy is here so the parity matrix reads on its own.

### Current platform (GlossGenius)

- [ ] **Sit with the front desk for one morning and watch.** Note every click and every
      workaround. Workarounds are requirements.
- [ ] Which GlossGenius features are used daily, weekly, never?
- [ ] What is the monthly cost, and what is the contract term?
- [ ] Will GlossGenius sign a BAA? (Ask them directly, in writing.)
- [ ] What clinical information currently lives in client notes?
- [ ] Can the client list be exported? With notes? With photos? What format?
- [ ] How many future appointments are on the calendar at any time?
- [ ] Are gift cards, packages, or prepaid series sold? Any outstanding?
- [ ] Is recurring billing run through GlossGenius or separately?
- [ ] **Which payment processor sits underneath it?** This decides whether members have
      to re-enter cards at cutover
- [ ] Which card reader hardware? Owned or leased?
- [ ] Does anyone rely on Google Calendar sync?
- [ ] Are email or SMS campaigns actually being sent, or is the feature dormant?
- [ ] Who administers the account? Who has the password?
- [ ] What does the owner like about it? **Ask this genuinely.** Whatever he names is a
      hard requirement, and it is far cheaper to hear it now than at Gate B
- [ ] What makes staff swear at it? Those are the features to beat

---

## A note on positioning

Do not sell this as "GlossGenius but better." It is not the same category.

GlossGenius runs a booking-and-payments business. This runs a **recurring-revenue medical
membership business**, where the controlling metric is months retained and the core
product is a progress engine that makes improvement visible. Booking and payments are
table stakes underneath it — necessary, unglamorous, and not the reason to switch.

The reason to switch is that a salon tool cannot show a man his own trend line, and that
trend line is what stops him cancelling in month four.
