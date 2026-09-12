# 15 — Branding & the Brand Kit

Rebranding this product is a **token swap, never a code change**. This document is the
contract that keeps it that way.

Two audiences:
- **The client** — how to make this look like theirs. Start at [For the client](#for-the-client).
- **Agents building on this** — the rules. Start at [For agents](#for-agents).

---

## For the client

Everything is in **PRESS BOX → Settings → Brand Kit**. Change something and the whole
product changes immediately — both the staff console and the patient app.

### What you can change

| | What it affects |
|---|---|
| **Clinic name & location** | Both rails, the browser tab, the favicon monogram |
| **Tagline** | Sign-in and booking screens only. Never inside the portal |
| **Logo** | Both rails. Drop a file or click to choose. Transparent PNG works best on dark |
| **Accent colour** | Every button, highlight, chart marker, dose line, and progress bar |
| **Corner radius** | 0 reads corporate and institutional. 16+ reads consumer app |
| **Typeface** | Five locally available stacks, so the demo works with no network |
| **Console surface** | Dark, light, or follow-the-system |
| **Sports vocabulary** | On or off — see below |

### The accent colour is checked, not just accepted

Paste a brand colour and the Brand Kit computes its contrast and tells you if it fails:

- Text on the accent must reach **4.5:1** (WCAG AA) or buttons are hard to read
- The accent against the background must reach **3:1** or links and highlights vanish

The ink colour on buttons is picked automatically — black or white, whichever passes. If
your brand colour fails, the warning says so in plain terms. It is not blocked, because
sometimes a brand is a brand, but you will know.

**About 8% of men have some colour-vision deficiency, and this is an all-male patient
population.** That is why no clinical status is ever communicated by colour alone —
every flag, range, and trend carries a label or an icon too. That does not change with
your brand colour, and it is not a setting.

### The patient app stays dark

You can make the console light. The patient app does not follow it, deliberately: the
clinics are dark rooms, and the real usage context for the patient app is a man on his
phone in bed at 11pm. A white screen at that moment is the wrong product.

### The sports vocabulary switch

Gameday is a sports-metaphor brand, so the product leans into it. One switch turns it off
entirely:

| Concept | Sports vocabulary on | Off |
|---|---|---|
| Patient app | GAMEPLAN | Patient Portal |
| Staff console | PRESS BOX | Clinic Console |
| Owner dashboard | Scoreboard | Dashboard |
| Lab results + scores | Stat Sheet | Progress |
| Progress photos | Game Film | Progress Photos |
| Treatment protocol | Game Plan | Treatment Plan |
| 12-week block | Season | Cycle |

**Only nouns are themed. Never instructions.** Dosing guidance, safety information, and
consent language stay clinically plain in both modes. A man mis-dosing testosterone
because the copy was being clever is not an acceptable trade for personality, and that
line does not move.

### Taking your kit somewhere else

**Copy Brand Kit JSON** exports your settings and your brand images as one file. Paste it
into another browser, or hand it to whoever builds the production version, and everything
comes back. **Reset to Gameday defaults** undoes everything except your uploaded images.

### What is not brandable

The **PILOT — SYNTHETIC DATA ONLY** banner. It cannot be hidden, restyled away, or
switched off while this is a pilot build. It is a compliance control, not decoration —
see `09-compliance-register.md`.

---

## For agents

### The one rule

> Every value a client can change lives in `prototype/assets/tokens.css` and **only**
> there. If you write a literal colour, radius, or font stack anywhere else, you have
> broken rebranding.

`brand.js` writes the same custom properties onto `<html>` at runtime. That is the only
place brand values are allowed to reach the DOM.

### Token layers

```
tokens.css
│
├── --brand-*        the five knobs a client controls
│                    accent · accent-ink · radius · font · logo-height
│
├── --gd-accent-*    derived accent states (hover, press, dim, line)
│                    via color-mix — never hand-picked
│
├── --gd-bg          surfaces. Dark by default.
│   --gd-surface     :root[data-surface="light"] overrides the same names.
│   --gd-border      [data-app="patient"] pins them back to dark.
│   --gd-text*
│
├── --gd-in-range    clinical semantics. Always paired with a label or icon
│   --gd-below       in the component — never colour alone.
│   --gd-above
│   --gd-critical
│   --gd-improving
│
├── --gd-step-*      type scale, fluid clamp()
├── --gd-1..16       space, 4px base
├── --gd-r-*         radius, all derived from --brand-radius
└── --gd-fast/med    motion. Small on purpose
```

### Adding a token

1. Is it something a **client** should control? → a `--brand-*` knob, a Brand Kit
   control, and a row in the table above.
2. Is it derived from a brand knob? → `color-mix()` or `calc()` off that knob. Never a
   parallel hand-picked value that will drift.
3. Is it a clinical semantic? → add it to **both** the dark and light blocks and to the
   `[data-app="patient"]` block, and make sure the component pairs it with a label.

### Things that will break rebranding, in order of likelihood

- A hex value in a screen file
- `border-radius: 8px` instead of `var(--gd-r-md)`
- A colour defined **only** inside a `@media` or `[data-surface]` block, so the default
  case has no value at all
- A chart colour hard-coded in `charts.js` rather than referencing a token
- Assuming the accent is dark enough for white text — it may not be; use
  `var(--brand-accent-ink)`
- New copy that hard-codes "Stat Sheet" instead of calling `GD.brand.word('statSheet')`

### Vocabulary in code

```js
GD.brand.word('statSheet')        // "Stat Sheet" or "Progress"
GD.brand.patientAppName()         // "GAMEPLAN" or "Patient Portal"
GD.brand.seasonLabel(season)      // always includes "of 12" — goal gradient
```

Never interpolate a themed noun as a literal. The smoke test checks the toggle changes
output; it cannot find a string you hard-coded into one sentence.

### Goal gradient is not optional

`seasonLabel()` always renders "Week 6 **of 12**". Visible endpoints sustain effort;
open-ended commitments decay. A bare "Week 6" is a bug, in both vocabulary modes.

### Before you ship a brand change

- [ ] `node scripts/smoke-test.cjs` — includes contrast audit and vocabulary round-trip
- [ ] Set the accent to something awful (`#1a1a1a`, `#ffff00`) and confirm the app stays
      usable and the warning appears
- [ ] Toggle the vocabulary and read every screen for a stranded themed noun
- [ ] Set radius to 0 and to 20 and check nothing overflows or collides
- [ ] Switch the console to light and re-check every semantic colour against WCAG AA
- [ ] Check 400px width

### The unknown

**The exact franchise accent hex is not confirmed.** `#d7262f` is sampled from the
corporate site, not taken from a brand kit. It is in `11-discovery-questions.md` §9 and it
is cheap to fix — one token — which is precisely why it was built this way.
