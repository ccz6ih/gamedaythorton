# 14 — Screen Specs

Every screen in the pilot: what it is for, what it reads, what its one primary action is,
and the states it has to handle. This is the reference for porting a screen to production
(`13-build-sequence.md` stage B) or rebuilding one after Gate A feedback.

Route names map 1:1 onto Next.js App Router paths. That was deliberate:
`staff/patient/:id` → `app/(staff)/patients/[id]/page.tsx`.

---

## Rules that apply to every screen

**One primary action.** Declared as `primary` in the route spec, rendered in a fixed
position in the top bar. If a screen cannot name its next action, question the screen.

**Three states minimum, all designed:**
- **Loading** — skeleton matching the final layout. Never a spinner on a primary surface.
- **Empty** — what to do and what it unlocks. Never "No data."
- **Populated** — and separately, populated *heavily*. Test the calendar with 40
  appointments and the roster with 200 patients.

**Every screen must survive every patient.** The smoke test renders all 27 screens against
all 12 fixture patients for exactly this reason: the churned member has no future
appointment, the lead has no labs, the new patient has no check-ins, the weight-loss
patient has no TRT protocol. A screen written against the doubter and never tested against
the lead will crash in front of a client.

**Contrast before current value.** On any progress surface, baseline-vs-now comes first.
A screen that leads with "your energy is 7" has already lost the argument.

**44px minimum touch targets.** The user base skews 35–65 and is often reading in bed.

---

## GAMEPLAN — patient app

Dark surfaces always, regardless of the console setting. Mobile-first: a 620px column with
a bottom tab bar. The real usage context is a phone at 11pm.

### `patient/home`
| | |
|---|---|
| **For** | The patient, opening the app for the first time that week |
| **Job** | Answer "is this working?" before answering anything operational |
| **Reads** | `q.season`, `q.lastCheckin`, `q.thenVsNow`, `q.nextAppt`, `q.nextDose`, `q.labsDue`, `q.safetyQueue`, `q.membership` |
| **Primary** | Start check-in (when due), otherwise the next unfinished thing |
| **Order** | Season progress → check-in ask → **then-vs-now contrast band** → operational tiles → safety note. The emotional payload is above the operational cards, never below |
| **Empty** | Pre-first-visit: what happens at the visit, what to bring |
| **Backlog** | P14, P21, P23, P26, P35 |

### `patient/checkin`
| | |
|---|---|
| **Job** | Six scores in sixty seconds |
| **Reads** | `q.lastCheckin` for the starting slider positions |
| **Writes** | `checkins` — replaces rather than duplicates within the same week |
| **Primary** | Submit check-in |
| **Hard constraints** | One screen, no scrolling on a phone, no typing required, submit always visible, sliders pre-set to last week's values, last week's number shown beside each |
| **Why it is this strict** | This is the highest-value data collected and the only thing the patient must do weekly. At two minutes it stops happening by week five and the retention engine runs out of fuel |
| **Backlog** | P14 |

### `patient/stats` — the Stat Sheet
| | |
|---|---|
| **Job** | The feature the whole retention thesis rests on |
| **Reads** | `q.checkins`, `q.panels`, `q.protocolChanges`, `q.thenVsNow`, `q.plateauWeeks`, `q.bodyComp` |
| **Chart** | Six score lines · lab draws as blue ticks · dose changes as labelled red markers · baseline average as a pinned band. One axis, so cause and effect is visible |
| **Primary** | See lab numbers |
| **Special** | Lines draw in once per session — the one animation inside the portal worth the spend |
| **Plateau case** | When `plateauWeeks >= 5`, say so explicitly, then reframe against baseline and offer a recheck. **Do not hide a plateau.** He will notice it alone and conclude the therapy failed; naming it first is what keeps the trust |
| **Empty** | Under two check-ins: what the chart will show and one button to the check-in |
| **Backlog** | P15, P20 |

### `patient/labs`
| | |
|---|---|
| **Job** | Every value, trended, in language that does not frighten anyone unnecessarily |
| **Reads** | `q.panels`, `q.resultsFor`, `q.analyteSeries`, `q.interpret` |
| **Order** | Safety analytes first — total T, free T, hematocrit, PSA, estradiol. He must not hunt for them |
| **Per value** | Name · big tabular number · unit · **range bar with target band inside reference bounds** · delta vs last draw · one-sentence plain-language read · trend sparkline |
| **Critical** | Reference range and target range are different things. The filled band is the clinic target; the outer numbers are the lab's reference. Conflating them is how a man panics over a value his provider is happy with |
| **Primary** | Hide/show values (privacy toggle) |
| **Backlog** | P16, P17, P33, P38 |

### `patient/plan` — The Game Plan
| | |
|---|---|
| **Job** | What he is taking, when, and what to expect |
| **Reads** | `q.protocolItems`, `q.protocolChanges`, `q.nextDose`, `q.season` |
| **Sections** | Current protocol → expectation timeline with "you are here" → change history with patient-facing reasons → injection-site rotation |
| **Copy discipline** | **Instructions are never themed.** Dosing and safety copy stays clinically plain even with the sports vocabulary on |
| **Backlog** | P23, P24, P25, P26 |

### `patient/film` — Game Film
| | |
|---|---|
| **Job** | Show change that a number cannot |
| **Reads** | `q.photoSeries`, `q.photos` |
| **Compare** | A **slider, not a toggle**. A slider makes the change feel continuous and controllable; a toggle makes it feel like a before/after ad |
| **Capture guide** | Ghost overlay with centre line and horizontals. Without the guide you get a pile of unusable selfies; with it you get a comparable series |
| **Placeholders** | Generated silhouettes, visibly watermarked PLACEHOLDER. Nobody should ever mistake one for a patient |
| **Backlog** | P18, P19 |

### `patient/book`
| | |
|---|---|
| **Job** | Book without talking to anyone |
| **Steps** | Service → provider (or first available) → slot → confirm. Progress bar, back button at every step |
| **Reads** | `q.services`, `q.providers`, `q.slotsFor` |
| **Rule** | **Never make him create an account to give you money.** Guest booking, silent account creation at confirm |
| **Confirm screen** | Shows the exact notification wording, so he knows nothing clinical will appear on his phone |
| **Backlog** | P01, P02, P05, P06, P07 |

### `patient/visit` — the pre-visit card
| | |
|---|---|
| **Job** | Kill the anxiety that cancels first visits |
| **Reads** | `q.nextAppt`, `q.provider`, `clinic.visit_facts`, clinic photos |
| **Content** | The clinician's actual face · the building · the parking lot · exact suite · what the draw feels like · exactly how long · exactly what it costs · what privacy means here |
| **Rule** | Specificity kills anxiety. Generic reassurance does nothing; a photo of the parking lot does a lot |
| **Backlog** | P13 |

### `patient/intake`
| | |
|---|---|
| **Job** | Move the clipboard out of the 45-minute visit |
| **Reads** | versioned `intake_template` |
| **Endowed progress** | The bar starts part-full because booking already supplied name, email, phone. A bar starting at 0% gets abandoned far more than one starting at 30% |
| **Sections** | Symptoms → history → medications → lifestyle → ADAM → consents |
| **Versioning** | A consent signed against v3 must be reproducible as v3 forever |
| **Backlog** | P09, P10, P11, P12 |

### `patient/membership`
| | |
|---|---|
| **Job** | Self-service without a phone call, including leaving |
| **Rule** | **Pause offered prominently, cancel findable and honest.** A pause you own beats a cancellation you obstructed, and men who feel trapped leave permanently and tell people |
| **Cancel flow** | One reason question, then done. The reason goes to the owner, not to a retention script |
| **Backlog** | P30, P31, P39 |

### `patient/messages`
Triage tag chosen by the patient at send time, so nothing lands in a shared inbox nobody
owns. Not for emergencies, and the copy says so. Backlog P29.

### `patient/more`
Everything else, plus the privacy panel: blur-values toggle, notification discipline
(always on, shown as locked), biometric lock. Backlog P35–P38.

---

## PRESS BOX — staff console

Light or dark, client's choice — the front desk works under fluorescent lights. Left rail,
grouped by job, one level deep. Role switcher for demoing to each role separately.

### `staff/scoreboard`
| | |
|---|---|
| **For** | The owner, two minutes, on a phone, coffee in hand |
| **Rule** | If he has to navigate to find out whether the business is up or down, this screen has failed |
| **Above the fold** | MRR + NRR · **average months on protocol** · active members · today's visit count |
| **Then** | **Top 3 things needing attention today, ranked by consequence** — not a list of everything |
| **Then** | Funnel with drop-off · speed-to-lead · open queue counts |
| **Reads** | `q.mrr`, `q.nrr`, `q.avgMonthsOnProtocol`, `q.funnel`, `q.speedToLead`, `q.safetyQueue`, `q.atRisk`, `q.dueForLabs` |
| **Backlog** | S01–S04 |

### `staff/today`
Time-ordered arrivals with everything the provider needs on one line: intake status,
safety flags, days silent, unread messages, last lab date. One-tap arrived → complete, and
**completing triggers the rebook prompt**. Backlog S12, S21, S23.

### `staff/calendar`
Mon–Fri week grid, 30-minute slots, room-aware, colour-coded by status with a separate
marker for patients carrying a safety flag. Day view is task A1. Backlog S09.

### `staff/patients`
Roster with clinical filters (all / active / at risk / safety flags / paused-churned),
score sparkline per row, days-since-check-in, next visit. ⌘K is the faster path and the
screen should say so.

### `staff/patient/:id` — the chart
The screen a provider opens before walking into the room. Header with flags, then tabs:

| Tab | Contents |
|---|---|
| **Timeline** | Visits, labs, dose changes, check-in scores with notes, membership events. One axis, newest first |
| **Labs** | All panels side by side, flagged against both ranges, sparkline per analyte |
| **Protocol** | Current items + full change history with **both** reasons — clinical and patient-facing |
| **Check-ins** | Score chart on the same axis as labs and doses. Free-text notes called out separately, because somebody has to read that field |
| **Photos** | Series with pose keys and consent refs |
| **Messages** | Thread with reply |
| **Billing** | Membership, payments, cancel reason in the patient's own words |

Actions: upload patient photo · record a protocol change · **publish a plain-language
summary** (pre-drafted from his own data, editable before sending). Backlog S13, S15, S18.

### `staff/labs` — lab entry
| | |
|---|---|
| **Job** | Manual structured entry, fast enough that nobody resents it |
| **Design** | Keyboard-first: Tab across, **Enter down the column**, live flagging as you type, previous panel's value in view, analyte units and both ranges on every row |
| **Critical** | Do **not** re-render on keystroke. Updating the flag cell in place is why this grid is usable; a full re-render steals focus mid-panel and the grid gets abandoned |
| **On save** | Flags computed with the same function the fixtures use, so typed values flag identically to seeded ones. Critical values create a provider task automatically |
| **Validate at Gate A** | Time a provider entering a real panel against their current process. Ask which analytes they actually track — that conversation validates or kills the seed list |
| **Backlog** | S14 |

### `staff/safety`
| | |
|---|---|
| **Job** | The clinically important queue |
| **Detects** | Hematocrit at/above ceiling · hematocrit rising · PSA above reference · PSA velocity · estradiol out of range · overdue monitoring · **unread check-in free text** · reported missed doses |
| **Every threshold is provisional** | Hematocrit 52%, PSA velocity 0.75 ng/mL/yr. The screen says so in a banner. Get the clinic's real numbers — `11-discovery-questions.md` §3 |
| **Backlog** | S16 |

### `staff/due`
Due-for-labs with the clinical reason and overdue days on each row, one tap to book.
Clinical necessity and a revenue event simultaneously. Backlog S17, S32.

### `staff/pipeline`
Funnel with drop-off · speed-to-lead · **source attribution to revenue** (the 16 corporate
form options finally connected to money) · churn reasons with the patient's own words.
Backlog S04–S06.

### `staff/retention`
Average months on protocol · at-risk list **with the reason on every row** · plateau count
· silent count. One-tap "send progress" per row. Closes with the product thesis stated
plainly, because this is the screen where the owner decides whether the thesis is real.
Backlog S03, S06, S10.

### `staff/automations`
Ten rules with trigger, action, and **why it exists**. Message log showing what would have
gone out, each preview checked against the banned-terms list and flagged if it leaks.
TCPA consent evidence table. Backlog S27–S37.

### `staff/checkout`
Patient → cart → total → take payment → **rebook prompt with the clinically correct date
already filled**. The rebook default is the single highest-leverage default in the build:
the recheck is indicated, so pre-selecting it is honest, and it converts far better than
asking. Backlog S22, S23.

### `staff/messages`
Threads with triage tags and unread state · missed-call queue with text-back status ·
waitlist with one-tap offer. Backlog S24, S25, S29.

### `staff/inventory`
Items, lots, expiry, reorder thresholds, Schedule III marking. Opens with an unmissable
banner: **this is not a DEA-facing record until Phase C and a legal review.**
Backlog S38–S40.

### `staff/settings`
Five tabs: **Brand Kit** (`15-branding.md`) · **Team & photos** · **Clinic & visit card**
(`16-media-pipeline.md`) · **Services & pricing** · **Demo data**. The demo-data tab
carries the synthetic-only rule in full and the reset controls.

---

## Screens not built yet

| Screen | Task | Why it is not in Phase A |
|---|---|---|
| `public/assess` | A2 | Symptom self-assessment. Highest-value pre-contact surface |
| `patient/milestone` | A3 | Week-12 moment |
| `staff/calendar` day view | A1 | Week view was enough to get feedback |
| Owner monthly / cohort retention curve | Phase C | Needs real history to mean anything |
| Provider + room utilisation | Phase C | Needs real booking volume |
| Corporate reporting export | Phase D | Needs corporate to ask for it |
