# 00 — Project Brief

## The business we are actually building software for

Gameday Thornton is **not an appointment business**. It is a recurring-revenue medical
membership business with a clinical feedback loop:

```
baseline labs -> starting protocol -> 6-8wk recheck -> titrate -> quarterly monitoring -> annual
        ^                                                                    |
        +------------------ membership renews monthly ----------------------+
```

Revenue = monthly membership + add-ons (peptides, GLP-1, shockwave, PRP, pellets).
The controlling metric is therefore **months retained**, not bookings.

This tells us what the software is. A booking calendar is table stakes. The
differentiating product is a **progress engine** that makes improvement visible, plus a
**monitoring engine** that makes clinical oversight visible.

## Why churn actually happens

Not because a patient forgot to rebook. Because **month four feels the same as month
one.** Hormone therapy improvements are real but gradual, and the patient's new baseline
becomes his normal — he loses the contrast against where he started, concludes it
stopped working, and cancels.

The counter is *evidence*: charted lab trends, charted subjective scores, side-by-side
photos, and dose-change markers on the same timeline. Show a man his energy score went
3 -> 7 over sixteen weeks and the cancellation conversation does not happen.

Everything in the backlog is ranked against that thesis.

## Goals

**Primary (pilot):** produce something the owner and staff use hands-on and have
opinions about, so the production scope is built from their reactions rather than our
assumptions.

**Secondary (production):**
1. Convert more inbound into booked consults — today every CTA ends in a callback queue
2. Reduce first-visit no-shows
3. Extend average months-on-protocol
4. Give the owner numbers he does not have: source attribution to revenue, churn
   cohorts, LTV, months retained
5. Take clipboard work out of the 45-minute first visit so it stays clinical

## Constraints

| Constraint | Implication |
|---|---|
| Corporate owns gamedaymenshealth.com | We build a separate owned property; no edits to the Webflow site |
| Franchise agreement unread | **BLOCKING RISK.** Confirm independent patient systems + payment processing are permitted before production build |
| Testosterone is Schedule III | No prescribing, e-prescribing, or dispensing in our system. Ever. We reflect protocols; the clinical system of record writes them |
| HIPAA deferred by decision | Synthetic data only until Phase C. Architecture built compliance-ready |
| Existing EMR / charting unknown | Build for manual structured lab entry first; integrate later if an API exists |
| Lab delivery format unknown | Assume PDF + manual entry until proven otherwise |

## Success metrics for the pilot

This is a feedback instrument, not a product launch. Judge it on:

- Owner completes a full walkthrough unaided
- Staff identify 10+ things they would change. **If they identify zero, the prototype
  failed** — it means they did not engage with it as real
- We leave with a ranked must-have / nice-to-have / do-not-care split across all modules
- We leave with the answers in `11-discovery-questions.md`
- We leave with a signable production scope

## Explicitly out of scope

- The corporate Webflow site
- Prescribing / EPCS / DEA workflows
- Insurance billing or claims (clinic is cash-pay)
- Native iOS / Android apps — PWA only
- Multi-tenant / multi-franchise (designed for, not built in pilot — see Phase D)
