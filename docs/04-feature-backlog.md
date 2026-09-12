# 04 — Feature Backlog

Scoring: **Retention** = does it extend months-on-protocol (the thesis in `00-brief.md`).
**Rev** = direct revenue impact. **Effort** S/M/L. **Phase** per `08-roadmap.md`.

Use this document as the feedback instrument in the demo session — have the owner and
staff mark every row Must / Nice / Don't-care. Their marks, not ours, drive the
production scope.

---

## Patient app — GAMEPLAN

### Booking & access
| # | Feature | Retention | Rev | Effort | Phase |
|---|---|---|---|---|---|
| P01 | Real-time self-serve booking, service + provider + slot | med | **high** | M | A |
| P02 | Guest booking, silent account creation at checkout | low | **high** | S | A |
| P03 | Magic-link auth, passkey on return | low | med | S | A |
| P04 | Card-on-file deposit for first visit | low | **high** | M | B |
| P05 | Self-serve reschedule / cancel | med | med | S | A |
| P06 | Waitlist with auto-offer on cancellation | low | **high** | M | B |
| P07 | Published service pricing | low | **high** | S | A |
| P08 | Symptom self-assessment (ADAM, IIEF-5), ungated result | low | **high** | M | B |

### Intake & first visit
| # | Feature | Retention | Rev | Effort | Phase |
|---|---|---|---|---|---|
| P09 | Digital intake: history, meds, supplements | low | med | M | A |
| P10 | Validated instruments in intake | med | low | M | B |
| P11 | Consents + e-signature | low | low | M | B |
| P12 | Pre-fill intake on return visits | low | low | S | B |
| P13 | Anxiety-reduction card (clinician photo, room, parking, cost, duration) | low | **high** | S | A |

### The retention engine — highest priority block in the build
| # | Feature | Retention | Rev | Effort | Phase |
|---|---|---|---|---|---|
| P14 | **Weekly 60-second check-in** (energy, libido, sleep, mood, gym, clarity) | **high** | low | M | A |
| P15 | **Stat Sheet** — scores charted with lab dates + dose changes on one axis | **high** | med | L | A |
| P16 | **Lab trends** with target ranges + plain-language interpretation | **high** | med | L | A |
| P17 | Hematocrit / PSA safety trending surfaced to patient | **high** | low | M | B |
| P18 | **Game Film** — progress photos, ghost-overlay capture guide | **high** | med | L | B |
| P19 | Side-by-side photo compare slider | **high** | low | M | B |
| P20 | Body composition history (InBody-style) | med | med | M | C |
| P21 | Milestone moments ("12 weeks in — week 1 vs today") | **high** | low | S | B |
| P22 | Annual season review | med | med | M | D |

### Protocol & adherence
| # | Feature | Retention | Rev | Effort | Phase |
|---|---|---|---|---|---|
| P23 | Game Plan card — dose, schedule, next due, refill countdown | **high** | med | M | A |
| P24 | Injection-site rotation tracker | med | low | S | B |
| P25 | Self-injection video + written steps | med | low | S | B |
| P26 | Expectation timeline (wks 1-4 / 4-8 / 8-12) | **high** | low | S | A |
| P27 | Dose reminders | med | low | S | B |
| P28 | Refill request + renewal reminder | med | **high** | M | B |

### Communication & money
| # | Feature | Retention | Rev | Effort | Phase |
|---|---|---|---|---|---|
| P29 | Async secure messaging with triage tags | **high** | low | M | B |
| P30 | Membership self-service: status, invoices, card, **pause** | med | **high** | M | B |
| P31 | HSA/FSA-formatted receipts | low | med | S | C |
| P32 | Referral with tracked code | low | **high** | M | C |
| P33 | Lab PDF export for his PCP | med | low | S | C |
| P34 | Data-driven add-on discovery (never generic upsell) | low | **high** | M | C |

### Privacy layer — build from day one, do not retrofit
| # | Feature | Retention | Rev | Effort | Phase |
|---|---|---|---|---|---|
| P35 | No clinical content in any notification preview | **high** | low | S | A |
| P36 | Biometric / PIN lock, default on | med | low | S | B |
| P37 | Discreet app label + icon | med | low | S | A |
| P38 | "Hide sensitive data" screen toggle | med | low | S | B |
| P39 | Neutral card-statement billing descriptor | low | med | S | C |

---

## Staff console — PRESS BOX

### Owner
| # | Feature | Retention | Rev | Effort | Phase |
|---|---|---|---|---|---|
| S01 | **Scoreboard** — one-screen morning view | low | med | M | A |
| S02 | MRR, NRR, active/new/cancelled | low | **high** | M | A |
| S03 | **Average months on protocol** | **high** | **high** | M | A |
| S04 | Funnel: lead -> booked -> showed -> converted -> active -> churned | low | **high** | L | A |
| S05 | **Source attribution to revenue** (wire up the 16 form options) | low | **high** | M | B |
| S06 | Churn cohorts + reason codes | **high** | **high** | L | B |
| S07 | LTV by source | low | **high** | M | C |
| S08 | Service-mix revenue | low | **high** | M | C |
| S09 | Provider + room utilisation | low | med | M | C |
| S10 | At-risk member list with reason per row | **high** | **high** | M | B |
| S11 | Corporate reporting export | low | low | S | D |

### Clinical
| # | Feature | Retention | Rev | Effort | Phase |
|---|---|---|---|---|---|
| S12 | Today's patients with intake status | low | med | M | A |
| S13 | Unified patient timeline (visits, labs, doses, scores, photos, messages) | **high** | med | L | A |
| S14 | Structured lab entry (manual first, API later) | **high** | low | M | A |
| S15 | Protocol builder + change history with reasons | **high** | med | M | A |
| S16 | **Safety queue** — hematocrit, PSA, estradiol, overdue monitoring | **high** | low | M | B |
| S17 | Due-for-labs queue | **high** | **high** | M | A |
| S18 | Plain-language patient summary publisher | **high** | low | M | B |
| S19 | Photo review + markup | med | low | M | C |
| S20 | Consent expiry tracking | low | low | S | C |

### Front desk
| # | Feature | Retention | Rev | Effort | Phase |
|---|---|---|---|---|---|
| S21 | Check-in board | low | med | M | A |
| S22 | Checkout: payment, membership start, receipt | low | **high** | M | B |
| S23 | **Rebook-before-leaving prompt, next date pre-filled** | **high** | **high** | S | A |
| S24 | Missed-call / unanswered-text queue | low | **high** | M | B |
| S25 | One-tap waitlist fill on cancellation | low | **high** | M | B |
| S26 | Inventory decrement at administration | low | low | S | C |

### Automation engine
| # | Feature | Retention | Rev | Effort | Phase |
|---|---|---|---|---|---|
| S27 | **Speed-to-lead SMS < 60s** | low | **high** | M | A |
| S28 | Missed-call text-back | low | **high** | S | B |
| S29 | Intake-incomplete reminder T-24h | low | med | S | B |
| S30 | No-show recovery sequence | low | **high** | M | B |
| S31 | Consulted-didn't-convert nurture | low | **high** | M | B |
| S32 | Due-for-labs prompt | **high** | **high** | M | B |
| S33 | 21-day no-check-in nudge -> staff task | **high** | **high** | M | B |
| S34 | Failed-payment retry sequence | med | **high** | M | C |
| S35 | Post-visit review request, satisfaction-routed | low | med | M | C |
| S36 | Month-3 progress summary push | **high** | **high** | M | B |
| S37 | Consent + TCPA audit trail per message | low | low | M | B |

### Inventory
| # | Feature | Retention | Rev | Effort | Phase |
|---|---|---|---|---|---|
| S38 | Lot + expiry tracking | low | med | M | C |
| S39 | Controlled-substance log (synthetic only until Phase C) | low | low | M | C |
| S40 | Low-stock / near-expiry alerts | low | med | S | C |

---

## Deliberately not building

| Not building | Why |
|---|---|
| Prescribing / e-prescribing / EPCS | Schedule III. DEA-regulated. Stays in the clinical system of record |
| Insurance claims | Clinic is cash-pay |
| Native apps | PWA covers it; app-store review is friction and delay |
| Telehealth video | Not requested; the clinic's model is explicitly in-person |
| Generic upsell engine | Data-driven add-on surfacing only. Pushing peptides at a man based on nothing erodes the clinical trust the whole product depends on |
| Public patient reviews inside the app | Reviews belong on Google; in-app they invite PHI in free text |
