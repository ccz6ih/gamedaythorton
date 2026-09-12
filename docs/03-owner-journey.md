# 03 — Owner & Staff Journeys (PRESS BOX)

Three distinct users with different jobs. Designing one screen for all three is how
clinic software gets hated.

| Role | Cares about | Sessions per day | Device |
|---|---|---|---|
| Owner | Revenue, churn, attribution, staff performance | 1–2, brief | Phone, then desktop |
| Clinic director / provider | Today's patients, labs, protocols, safety flags | Continuous | Desktop in room |
| Front desk / MA | Check-in, intake status, payments, phones, rebooking | Continuous | Desktop at counter |

---

## Owner — morning (2 minutes, on a phone, coffee in hand)

One screen, no navigation. **The Scoreboard:**

- MRR and net revenue retention, vs last month
- Active members / new / cancelled this month
- Average months on protocol (the number that actually governs the business)
- New leads, booked rate, show rate, consult-to-member conversion — this week
- Today's schedule count and any gaps
- Top 3 things needing his attention

**Rule:** if the owner has to navigate to find whether the business is up or down, the
dashboard has failed.

## Owner — weekly review (15 minutes, desktop)

- **Attribution to revenue.** The corporate form already asks "how did you hear about
  us" across 16 options and that data currently goes nowhere. Tie each source to booked
  consults, conversions, and realised revenue. This is the first time he will be able to
  answer "does the billboard work"
- **Churn cohorts.** Members who cancelled, grouped by month started, with reason codes.
  Reveals whether churn is a month-3 expectation problem or a month-9 price problem —
  entirely different fixes
- **LTV by source.** Cheapest lead source is often not the most valuable
- **Service mix revenue.** Which add-ons carry margin
- **Provider and room utilisation**
- **At-risk list** with a reason on each: no check-in for 3 weeks, overdue labs, failed
  payment, no future appointment

## Owner — monthly

- P&L-adjacent view: revenue by category, refunds, discounts, payment failures
- Cohort retention curve, month over month
- Corporate reporting export
- Marketing spend vs attributed revenue by channel

---

## Clinic director / provider — daily

**Start of day:** today's patients in order, each showing intake complete/incomplete,
new vs returning, last labs date, current protocol, open messages, and anything flagged.

**Per patient, one screen:**
- Timeline: visits, labs, dose changes, check-in scores, photos, messages — one axis
- Lab panel with trend arrows and out-of-range highlighting
- Current protocol and change history with reasons
- Check-in score trend (tells him how the patient feels between visits, which he has
  never had before)
- Note field, and a plain-language patient-facing summary that publishes to the app

**Safety queue — the clinically important one:**
- Hematocrit above threshold (erythrocytosis risk on TRT)
- PSA rise or velocity flag
- Estradiol out of range
- Overdue monitoring labs
- Blood pressure entries out of range
- Missed doses reported in check-ins

**End of day:** anything unsigned, unanswered, or unentered.

## Front desk / MA — daily

- Check-in board with intake status per arrival, one tap to send a missing intake
- Payment / membership start at checkout, card on file, receipt
- **Rebook-before-leaving prompt** with the clinically correct next date pre-filled
- Missed-call and unanswered-text queue
- Waitlist fill on a cancellation — one tap to offer the slot to the next man up
- Inventory decrement at administration

---

## Automations (run without anyone watching)

| Trigger | Action | Why |
|---|---|---|
| New lead submitted | SMS within 60 seconds with a booking link | While the corporate form is a callback queue, response time *is* conversion rate |
| Missed inbound call | Auto text-back offering to book | Recovers the caller who will otherwise call the next clinic |
| Intake incomplete at T-24h | SMS with intake link | Protects the 45-minute visit |
| No-show | Same-day recovery outreach, then 72h | No-shows are recoverable; nobody has time to chase them manually |
| Consulted, did not convert | 3-touch nurture over 14 days | Largest untapped pool in the business |
| Due for labs (6–8wk, then quarterly) | Prompt + one-tap booking | Clinical necessity and revenue event simultaneously |
| Refill window approaching | Reminder | Prevents therapy gaps, which cause cancellations |
| No check-in for 21 days | Gentle nudge, then staff task | Earliest reliable churn signal we will have |
| Payment failed | Retry sequence + notify front desk | Involuntary churn is pure waste |
| Post-visit | Review request, routed by satisfaction | Fix NAP first (see `01-audit-findings.md`) or reviews land on the wrong listing |
| Membership month 3 | "Here's your progress" summary push | Intervenes exactly where churn concentrates |

## Inventory & controlled substances

Testosterone is Schedule III — record-keeping obligations are real.

- Lot and expiry tracking on testosterone, GLP-1s, peptides, consumables
- Decrement on administration, tied to the patient and provider
- Controlled-substance log with running balance
- Low-stock and near-expiry alerts
- Reorder list

**Note:** the log module can be *built* in the pilot on synthetic data, but it must not
become the clinic's actual DEA-facing record until Phase C and a legal review. Flagged in
`09-compliance-register.md`.
