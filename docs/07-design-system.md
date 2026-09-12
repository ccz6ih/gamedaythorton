# 07 — Design System & UX Psychology

## The brand already handed us a vocabulary

Gameday is a sports-metaphor brand with "man cave" clinics and a "game plan" promise.
Leaning into that solves a real design problem: it gives us a native language for
progress that avoids clinical coldness **and** avoids making a man feel like a patient —
which is precisely the objection the whole brand is built around.

| Concept | Our name | Why |
|---|---|---|
| Patient app | **GAMEPLAN** | It is literally what the clinic promises to build for him |
| Staff console | **PRESS BOX** | Where you watch the whole field |
| Owner dashboard | **The Scoreboard** | One glance, are we up or down |
| Lab results | **Stat Sheet** | Numbers about your performance, not a medical report |
| Subjective scores | **Stat Sheet** (same axis) | They belong together and that is the point |
| Progress photos | **Game Film** | Reviewing the tape is what serious athletes do |
| Treatment protocol | **The Game Plan** | |
| Treatment block | **Season** (12 weeks) | Bounded, which matters — see goal gradient below |
| Weekly check-in | **Check-In** | Keep it plain; do not over-theme the thing he does weekly |

Discipline: theme the *nouns*, never the *instructions*. Dosing guidance, safety
information, and consent language stay clinically plain. A man mis-dosing testosterone
because the copy was being clever is an unacceptable trade for personality.

---

## Tokens

```css
:root {
  /* Core — dark by default. The corporate theme-color is #202020 and the
     clinics are dark "man cave" rooms. A dark portal is also the right call
     for the 11pm phone session this app is actually used in. */
  --gd-bg:            #141414;
  --gd-surface:       #1c1c1c;
  --gd-surface-raised:#242424;
  --gd-border:        #323232;

  --gd-text:          #f5f5f5;
  --gd-text-muted:    #a0a0a0;
  --gd-text-dim:      #6e6e6e;

  /* Accent — the red dot is an existing brand element on the corporate site.
     CONFIRM exact hex against the franchise brand kit before production. */
  --gd-accent:        #d7262f;
  --gd-accent-hover:  #ef3b44;
  --gd-accent-dim:    rgba(215,38,47,0.14);

  /* Clinical semantics — never red/green alone. Always paired with a label
     or icon: ~8% of men are colour-vision deficient, and this is an
     all-male patient population. */
  --gd-in-range:      #3fa96b;
  --gd-below:         #e0a33a;
  --gd-above:         #e0a33a;
  --gd-critical:      #d7262f;
  --gd-improving:     #4a9fd8;

  /* Type */
  --gd-font: "Inter", system-ui, -apple-system, sans-serif;
  --gd-font-num: "Inter", ui-monospace, monospace;   /* tabular-nums on all values */

  --gd-step--1: clamp(0.83rem, 0.8rem + 0.15vw, 0.9rem);
  --gd-step-0:  clamp(1rem, 0.96rem + 0.2vw, 1.1rem);
  --gd-step-1:  clamp(1.33rem, 1.2rem + 0.6vw, 1.6rem);
  --gd-step-2:  clamp(1.78rem, 1.5rem + 1.2vw, 2.4rem);
  --gd-step-3:  clamp(2.37rem, 1.9rem + 2.2vw, 3.5rem);

  /* Space — 4px base */
  --gd-1: 0.25rem; --gd-2: 0.5rem;  --gd-3: 0.75rem; --gd-4: 1rem;
  --gd-6: 1.5rem;  --gd-8: 2rem;    --gd-12: 3rem;   --gd-16: 4rem;

  --gd-r-sm: 6px; --gd-r-md: 10px; --gd-r-lg: 16px; --gd-r-full: 999px;

  --gd-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --gd-fast: 140ms; --gd-med: 240ms;
}
```

Numbers always render with `font-variant-numeric: tabular-nums`. Lab values that shift
horizontally as they change read as unstable, and stability is the feeling we are
selling.

---

## Psychology rules, each tied to a build decision

**1. Privacy is the conversion lever.**
He is ashamed. Every forced human interaction is an exit. This is why booking must be
self-serve, why results must be viewable without a phone call, and why notification
previews must never contain clinical content. Not a nice-to-have — the mechanism.

**2. Goal gradient effect.**
Show "Week 6 of 12," never "Week 6." Visible endpoints sustain effort; open-ended
commitments decay. This is why treatment is framed as a 12-week **Season** with a
defined finish, then renewed — rather than an indefinite subscription.

**3. Contrast restoration is the retention mechanic.**
Hedonic adaptation is the actual churn mechanism (see `00-brief.md`). The counter is
mechanical: always show *then* beside *now*. Every progress surface defaults to
baseline-vs-current, never current alone.

**4. Defaults do the work.**
Pre-select the next lab draw at checkout with the clinically correct date filled. It is
honest — the recheck is indicated — and it converts far better than asking.

**5. Specificity kills anxiety.**
Generic reassurance is noise. A photo of the parking lot, the clinician's actual face,
the exact suite number, the exact price, the exact duration. The corporate FAQ reveals
these are the real objections; answer them concretely and pre-emptively.

**6. Endowed progress.**
The intake starts partially complete because we already have his name, email, and phone
from booking. A bar that starts at 30% gets finished far more often than one at 0%.

**7. Effort must match reward.**
The weekly check-in is the highest-value data we collect and it must cost 60 seconds,
one screen, thumb-reachable, no scrolling, no typing required. If it costs two minutes
it stops happening by week five and the retention engine has no fuel.

**8. Loss framing on adherence, carefully.**
Streaks on injection schedule and check-ins work. Keep them supportive, never punitive —
a shame mechanic in a men's-health app aimed at men who already feel inadequate is
actively harmful and will drive cancellation, not compliance.

**9. Authority through transparency.**
Show him the hematocrit and PSA trends, including the safety reasoning. A clinic that
volunteers what it is watching for reads as more competent than one that only shows good
news.

**10. No dark patterns on cancellation.**
Offer **pause** prominently, make cancel findable and honest. A pause you own beats a
cancellation you obstructed, and men who feel trapped leave permanently and tell people.

---

## Component rules

- **Lab value:** name, big tabular number, unit, range bar with his marker, arrow vs
  last draw, one-sentence plain-language read. Range bar shows target range as the
  filled band and reference range as the outer bounds — they differ and the difference
  matters
- **Stat Sheet chart:** scores as lines, lab draws as vertical ticks, dose changes as
  labelled markers. Baseline value pinned in the corner, always visible
- **Game Film compare:** slider, not a toggle. Slider makes the change feel continuous
  and controllable; toggle makes it feel like a before/after ad
- **Check-in:** six sliders, one screen, big thumb targets, submit always visible
- **Empty states:** never "No data." Always what to do and what it will unlock
- **Loading:** skeletons matching final layout. No spinners on primary surfaces
- **Touch targets:** 44px minimum. The user base skews 35–65 and is often reading in bed
- **Contrast:** WCAG AA minimum on all text. The dark theme makes this easy to get
  wrong with muted greys — check every token pair
