# fixtures/ — Synthetic dataset

**Everything in this folder is fabricated. No real person, no real lab value, no real
photograph. Ever.**

These names are invented and deliberately unremarkable. If a name here ever coincides
with a real Thornton patient, replace it.

## Design principle

A dataset of happy, improving patients demos beautifully and teaches nothing. Useful
feedback comes from edge cases, so the roster is built around the awkward ones.

## Planned roster (12 patients)

| Key | Profile | What it demonstrates |
|---|---|---|
| `p_01_new` | Booked, intake incomplete, visit tomorrow | Front-desk intake chase, anxiety card |
| `p_02_firstvisit` | Baseline labs drawn today, protocol just published | First-visit flow, protocol publishing |
| `p_03_enthusiast` | Month 2, scores climbing, checks in weekly | The happy path. Milestone moment |
| `p_04_doubter` | **Month 4, scores plateaued, no check-in for 3 weeks** | **The patient the product exists for.** Default demo patient. At-risk list, month-3 push, the Stat Sheet moment |
| `p_05_safety` | Month 5, hematocrit trending toward ceiling | Safety queue, patient-facing safety trending |
| `p_06_psa` | Month 8, PSA velocity flag | Safety queue, escalation path |
| `p_07_churned` | Cancelled month 6, reason `no_perceived_benefit` | Churn cohorts, reason codes, win-back |
| `p_08_paused` | Paused month 3, cost concern | Pause-vs-cancel, membership self-service |
| `p_09_noshow` | No-showed first visit, recovered, now active | No-show recovery sequence |
| `p_10_weightloss` | GLP-1 + body comp series, no TRT | Non-TRT service line, body comp charts |
| `p_11_hairloss` | Finasteride + PRP, 6-month photo series | Game Film, ghost-overlay compare |
| `p_12_failedpay` | Active but card declined twice | Involuntary churn, retry sequence |

## Files

**All generated. Do not hand-edit any of them** — edit
`scripts/generate-fixtures.cjs` and re-run `node scripts/generate-fixtures.cjs`. A
hand-edit is destroyed silently on the next generation, and nobody will work out why the
demo changed.

The generator is deterministic (seeded `mulberry32`), so the roster comes back identical
every time.

| File | Contents |
|---|---|
| `clinic.json` | Clinic record, hours, and the visit-facts copy behind the pre-visit card |
| `patients.json` | The roster above, with demographics and privacy flags |
| `providers.json` / `staff.json` | Invented clinicians and staff accounts |
| `services.json` | 27 services seeded from `docs/01-audit-findings.md` |
| `plans.json` | Three membership tiers — **placeholder pricing** |
| `appointments.json` | Story appointments plus two weeks of filler so the calendar is legible |
| `analytes.json` | 14 analytes with reference **and** target ranges, all provisional |
| `lab_panels.json` / `lab_results.json` | Multi-draw histories with plausible drift |
| `checkins.json` | Weekly series with gaps, noise, and two free-text notes |
| `protocols.json` / `protocol_items.json` / `protocol_changes.json` | Protocols and the dose-change records that plot Stat Sheet markers |
| `memberships.json` / `payments.json` | Active, paused, cancelled, failed payment |
| `leads.json` | All 16 acquisition sources, with TCPA consent evidence |
| `intake_template.json` / `intake_submissions.json` | Versioned template, one complete and one partial submission |
| `message_threads.json` / `messages.json` | Five threads incl. the doubter's cancellation signal |
| `photo_series.json` / `photos.json` | Series **metadata only** — no image bytes ship in this repo |
| `body_comp.json` | InBody-style series for the weight-loss and TRT patients |
| `inventory_items.json` / `inventory_lots.json` | Lots, expiry, Schedule III marking |
| `automation_runs.json` | Message log — every preview passes the no-clinical-content check |
| `missed_calls.json` / `waitlist.json` / `tasks.json` | Front-desk queues |

`prototype/demo-data.js` bundles all of it into one file the prototype can load over
`file://` with no server.

### No image bytes, ever

`photos.json` carries metadata only. Placeholders are generated as inline SVG at render
time, visibly watermarked `PLACEHOLDER`. A placeholder that could be mistaken for a patient
photo is worse than none. See `docs/16-media-pipeline.md`.

## Realism rules

Fake data that behaves unrealistically produces unrealistic feedback.

- **Lab values must drift plausibly.** Total T rising from ~240 to ~750 over 12 weeks on
  cypionate is plausible; jumping to 1400 in two weeks is not, and the provider will
  notice immediately and lose confidence in the whole demo
- Hematocrit rises gradually on TRT — that is the entire reason it is monitored
- Check-in scores should be noisy, not monotonic. Real men have bad weeks
- `p_04_doubter` must show the pattern that makes the thesis visible: **scores clearly
  improved from baseline, but flat for the last six weeks.** That is exactly the shape
  where a man cancels while his own data says he is better off than when he started
- Include at least one plausible free-text check-in note that a provider would want to
  act on — it proves someone has to be reading that field

### The response curve is part of the analysis

The check-in generator uses **smoothstep**, not ease-out. This is not cosmetic. An ease-out
curve puts ~85% of the total gain in the first six weeks, which makes every patient look
like he plateaued at month one — and the plateau detector in `store.js` reads these curves,
so a front-loaded generator manufactures plateaus that are not in the story and makes a
real feature look broken.

Real TRT response is sigmoid: little in weeks 1–3, most of the movement in the middle,
flattening as levels reach steady state. If you change this curve, re-run the smoke test —
it asserts the doubter shows a ~6-week plateau while still being up from baseline on all
six dimensions.

## Ranges

Use clinically plausible placeholder ranges until the real clinic values arrive from
`docs/11-discovery-questions.md` §3. **Mark every placeholder range in the data as
`"provisional": true`** so nothing assumed gets carried into production unnoticed.

The smoke test enforces this: every analyte must carry `provisional: true`, and the UI
surfaces it wherever a range is shown. A provider who spots an assumed threshold presented
as fact loses confidence in the entire demo, and they are right to.

Provisional values currently in play, all invented: hematocrit ceiling 52%, PSA velocity
0.75 ng/mL/yr, target total T 600–900 ng/dL, 7-week initial recheck then quarterly, and
every price in `plans.json` and `services.json`.
