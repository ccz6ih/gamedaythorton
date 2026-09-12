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

## Files to build

```
patients.json           roster above, with demographics
appointments.json       past + future, incl. no-show and cancellation
lab_panels.json         multi-draw histories with realistic drift
checkins.json           weekly series, incl. gaps for p_04 and p_07
protocols.json          with protocol_change records for dose markers
photos/                 generated placeholder images, correct pose_keys
memberships.json        active, paused, cancelled, failed payment
leads.json              all 16 acquisition sources represented
services.json           seeded from docs/01-audit-findings.md
providers.json          invented clinicians, placeholder headshots
```

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

## Ranges

Use clinically plausible placeholder ranges until the real clinic values arrive from
`docs/11-discovery-questions.md` §3. **Mark every placeholder range in the data as
`"provisional": true`** so nothing assumed gets carried into production unnoticed.
