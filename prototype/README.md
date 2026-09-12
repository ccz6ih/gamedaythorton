# prototype/ — the clickable pilot

**GAMEPLAN** (patient app) and **PRESS BOX** (staff console), running on the synthetic
roster in `/fixtures`.

> **Everything in here is fabricated.** No real person, no real lab value, no real
> photograph. The banner does not come off until Phase C sign-off. See
> `../docs/09-compliance-register.md`.

---

## Run it

**The simple way:** open `index.html` in a browser. That is all. No install, no build, no
server — see `../docs/18-decisions.md` ADR-001 for why that was a requirement.

**With an http origin** (needed to reach it from a phone on the same wifi):

```bash
node scripts/serve.cjs          # http://localhost:4173, prints the LAN address too
```

**If the page says the dataset is missing:**

```bash
node scripts/generate-fixtures.cjs
```

**Before you change anything:**

```bash
node scripts/smoke-test.cjs      # 69 checks, ~1s
```

---

## Find your way around

| | |
|---|---|
| **⌘K / Ctrl+K** | Go anywhere. Type a patient's name, a screen name, or a command |
| **Left rail** | Every screen, one click, grouped by job |
| **Viewing as** (rail, bottom) | Owner / Provider / Front desk |
| **Open GAMEPLAN** (rail, bottom) | Switch to the patient app |
| **⇄** (patient app, top right) | Change which patient you are |
| **Why?** (banner) | The synthetic-data rule, and the demo clock state |

The patient app opens as **Gregory Sunderman** — month 4, scores plateaued, silent three
weeks. He is the default because he is the patient the whole product exists for.

---

## The 90-second version

If you have one pass to show someone why this matters:

1. **`staff/scoreboard`** — "Which number would you look at first every morning?" Note
   *average months on protocol*. Most clinics cannot produce that number at all.
2. **`staff/safety`** — hematocrit at 52.6% and a PSA velocity flag, surfaced without
   anyone going looking. A salon booking tool cannot do this and never could.
3. **`patient/stats`** as Gregory — **say nothing and watch their face.** Four months of
   his own data: scores up from baseline, flat for six weeks, lab draws and dose changes
   marked on the same axis.
4. **`staff/settings` → Brand Kit** — change the accent colour in front of them. The whole
   product follows.

Step 3 is the product. Everything else is table stakes underneath it.

---

## The roster

Twelve synthetic patients, built around the awkward cases. A dataset of happy, improving
patients demos beautifully and teaches nothing.

| Patient | Demonstrates |
|---|---|
| Aaron Petrak | Booked, intake incomplete, visit tomorrow |
| Curtis Nahm | Baseline labs drawn, protocol just published |
| Dominic Rauwerda | Month 2, scores climbing — the happy path |
| **Gregory Sunderman** | **Month 4, plateaued, silent 3 weeks — the demo patient** |
| Vaughn Iselin | Hematocrit at the ceiling, plus a check-in note that needs reading |
| Errol Bratcher | PSA velocity flag, escalation path |
| Damon Kelsoe | Cancelled month 6, "no perceived benefit" |
| Leland Ashcraft | Paused month 3, cost concern |
| Trent Mabry | No-showed, recovered by SMS, now active |
| Hollis Draney | GLP-1 + body composition, no TRT |
| Simon Vertrees | Finasteride + PRP, 6-month photo series |
| Brady Hollifield | Active but card declined twice |

---

## Make it look like theirs

**Settings → Brand Kit.** Name, logo, accent colour, radius, typeface, light or dark
console. Change something and the whole product changes immediately.

Accent contrast is checked rather than trusted — paste an unreadable colour and it tells
you, in plain language, why. Full detail in `../docs/15-branding.md`.

**Sports vocabulary toggle:** turns "Stat Sheet" into "Progress", "Game Film" into
"Progress Photos", and so on. Only nouns are themed, never instructions — dosing and
safety copy stays clinically plain either way.

## Add real images

All of these are real uploads. None of them leaves the browser.

| What | Where |
|---|---|
| Logo | Settings → Brand Kit |
| Clinician headshots | Settings → Team & photos |
| Clinic exterior, parking, room, lobby | Settings → Clinic & visit card |
| Patient photo | Patient chart → **Photo** |
| Progress photos | GAMEPLAN → Game Film → tap a frame |

Images are downscaled on a canvas, which also strips EXIF including GPS coordinates. There
is no upload endpoint in this build — that is what makes it safe to leave the demo with a
client. `../docs/16-media-pipeline.md`.

**Clinician headshots are the highest-value upload.** They appear on the patient's
pre-visit card, and the corporate site's own "Meet Your Thornton Clinicians" section
currently renders "No items found".

---

## Demo hygiene

**Before each session:** Settings → Demo data → **Reset demo data**. Clears everything
added during the last interview and keeps the Brand Kit and uploaded images.

`10-demo-script.md` interviews the three roles separately. Reset between each.

**The demo clock:** the dataset is anchored to a Monday and shifted forward by whole weeks
at load, so the demo is always the current week and "Today" always has patients in it. On a
weekend it rolls forward to Monday. The banner shows the demo date; Settings → Demo data
shows the shift applied. ADR-002.

---

## What is real and what is not

**Really works:** every screen, all navigation, weekly check-in → chart, lab entry → flags
→ safety queue, booking → availability → confirmation, protocol changes → dose markers,
brand kit, image upload, checkout → rebook prompt, membership pause/cancel, messaging. All
of it persists across reloads and resets in one click.

**Deliberately simulated:** no SMS or email is ever sent — the automation log shows what
*would* have gone out. Payments are Stripe test mode only and no card is accepted. There
is no auth. Nothing is stored anywhere but this browser.

**Not built yet:** calendar day view, symptom self-assessment, the week-12 milestone
screen, print/export. All in `../docs/13-build-sequence.md` stage A.

---

## Files

```
index.html              script load order lives here
demo-data.js            GENERATED — edit scripts/generate-fixtures.cjs instead
assets/
  tokens.css            every brandable value. The only place for a literal colour
  app.css               layout and components
  store.js              demo clock, write overlay, every derived metric
  charts.js             dependency-free SVG charts
  media.js              image ingestion and placeholders
  brand.js              Brand Kit
  ui.js                 shell, router, action dispatch
  screens-patient.js    GAMEPLAN
  screens-staff.js      PRESS BOX
  screens-settings.js   Brand Kit, team, clinic, pricing, demo data
  boot.js               first render
stat-sheet.html         superseded standalone v0, kept as reference
```

Working on this? Read `../docs/17-agent-playbook.md` first.
