# 02 — Patient Journey

Nine stages. Each lists the emotional state, what happens today, what GAMEPLAN does,
and the design rule that follows from it.

The through-line: **this man is embarrassed.** He is researching erectile dysfunction or
admitting he feels weak and old. Every point of forced human contact is friction, and
every ounce of removed friction converts. Privacy is not a compliance checkbox here —
it is the primary conversion lever.

---

## Stage 1 — Symptom awareness (pre-contact)

**State:** tired, gaining weight, low libido, blaming age. Googling at 11pm, privately,
probably on his phone, probably not logged into anything.

**Today:** lands on the corporate Webflow page.

**GAMEPLAN:** a symptom self-assessment on our owned property — ADAM questionnaire for
low-T symptoms, IIEF-5 for ED — that returns a plain-language read and a booking CTA. No
account required, no email gate to see the result. Gating the result is the obvious
growth-hack and it is the wrong call: he will abandon rather than hand over his email
before he trusts you.

**Rule:** value before identity. Ask for nothing until he has received something.

---

## Stage 2 — Decision to act

**State:** decided something is wrong. Now weighing embarrassment against the cost of
doing nothing. Wants to know price and wants to not talk to anyone.

**Today:** eleven buttons, all leading to a form that promises a phone call about his
erection. This is the worst possible design for this emotional state.

**GAMEPLAN:** real-time availability, service selection, instant confirmation, no phone
call required. Published pricing. Card-on-file deposit for the first visit.

**Rule:** remove the human from the anxious part of the funnel. Re-introduce humans once
he is committed.

---

## Stage 3 — Booking

**State:** motivated but fragile. Any friction is an exit.

**GAMEPLAN:**
- Pick service -> pick provider (or "first available") -> pick slot -> confirm
- Guest booking. Account is created silently at checkout from the details he already
  typed. No password — magic link, passkey on second visit
- Deposit charged to protect the slot, credited against the visit
- Waitlist if his preferred time is full, auto-offered on cancellation
- Calendar file + SMS + email confirmation, all with discreet wording
- Self-serve reschedule and cancel, no call

**Rule:** never make him create an account to give you money.

---

## Stage 4 — Pre-visit (T-minus 48h)

**State:** second thoughts. Anxiety about the blood draw, the building, parking, whether
he will be judged.

**Today:** the FAQ answers exactly these questions — what to bring, is there parking, is
it private, how long — which tells us these are the real objections.

**GAMEPLAN:**
- Digital intake, pre-visit: history, medications, supplements, symptom instruments,
  consents, e-signature. Pre-filled on every return visit so it is a 30-second confirm
- **Anxiety-reduction card:** his actual clinician's name and face, a photo of the actual
  room, exact suite number and parking instructions, what the draw feels like, how long
  he will be there, what it costs
- Reminders at 48h and 2h

**Rule:** specificity kills anxiety. Generic reassurance ("we're private and
professional!") does nothing; a photo of the parking lot does a lot.

Ops payoff: moving intake upstream returns ~15 minutes of the 45-minute first visit to
clinical work. That is the product the site is selling.

---

## Stage 5 — First visit

**State:** in the building, committed, slightly on guard.

**GAMEPLAN (staff-side, patient sees the output):**
- Staff open the visit and the intake is already there
- Labs drawn, results entered structured (not just a PDF attached)
- Provider builds the protocol; it publishes to the patient's app before he leaves
- **Next lab draw is pre-selected at checkout with the date already filled.** This is
  the single highest-leverage default in the build — the recheck is clinically indicated,
  not optional, so pre-selecting it is honest and it works
- Membership started, card on file, receipt formatted for HSA/FSA

**Rule:** he must not walk out of the building without a next appointment on the books.

---

## Stage 6 — Week 1–2, initiation

**State:** hopeful, uncertain, slightly nervous about self-injecting.

**GAMEPLAN:**
- **The Game Plan card:** current dose, schedule, next dose due, refill countdown
- Injection-site rotation tracker with a body diagram
- Self-injection video and written steps
- "What to expect weeks 1–4 / 4–8 / 8–12" so the absence of instant results is framed
  in advance rather than experienced as failure
- Day-3 check-in prompt: any issues, questions, site reactions
- Async message thread to the clinic

**Rule:** set the expectation curve before he rides it. Unmanaged expectations in week 3
are a cancellation in week 6.

---

## Stage 7 — Week 2 onward, the retention loop

**This is the core of the product.**

**State:** the danger zone. Improving, but adapting to his own improvement and losing the
memory of his baseline.

**GAMEPLAN:**
- **Weekly 60-second check-in.** Sliders: energy, libido, sleep quality, mood, gym
  performance, mental clarity. Sixty seconds, one screen, thumb-reachable
- **The Stat Sheet.** Every subjective score charted over time, with lab draw dates and
  every dose change marked on the same axis. He can see cause and effect
- **Lab trends.** Total T, free T, SHBG, estradiol, hematocrit, PSA, lipids, A1c, CBC —
  each as a trend line against target range, each with plain-language interpretation.
  Not a PDF dump. Hematocrit and PSA trending is a genuine TRT safety obligation, and
  surfacing it is simultaneously good medicine and the strongest trust signal available:
  *this clinic watches things your primary care doctor does not*
- **Game Film.** Progress photos with a ghost-overlay capture guide so angle and
  distance match every time. Without the guide you get a pile of unusable selfies; with
  it you get a real series. Side-by-side compare slider
- **Body composition history** if the clinic uses InBody-type scans: body fat %, lean
  mass, visceral fat
- Milestone moments: "12 weeks in — here's your week 1 vs today"

**Rule:** the app's job in month four is to show him month one.

---

## Stage 8 — Recheck and titration

**State:** wants to know if it is working, in numbers.

**GAMEPLAN:**
- Due-for-labs prompt at the clinically correct interval, one tap to book
- New results land in the app with a "what changed" comparison against the last draw
- Dose change, if any, updates the Game Plan card and drops a marker on the Stat Sheet
- Provider note in plain language explaining the why

**Rule:** every clinical decision gets a visible, understandable reason. Unexplained
changes read as guesswork.

---

## Stage 9 — Ongoing membership

**State:** either a believer or quietly drifting.

**GAMEPLAN:**
- Membership self-service: status, invoices, receipts, card update, **pause** (pause is
  a retention feature, not a churn feature — a pause you own beats a cancellation you
  don't)
- Refill requests and renewal reminders
- Referral with a tracked code. Men's-health growth is disproportionately
  locker-room word of mouth; make it one tap and attribute it
- Add-on discovery timed to his actual data, never generic upsell
- Lab PDF export to share with his primary care physician
- Annual "season review": twelve months of labs, scores, and photos in one summary

**Rule:** make leaving require a decision, and make staying show its own value.

---

## Privacy requirements (cross-cutting, all stages)

Not optional, and cheap to build in from the start:

- No clinical content in push or SMS notification previews. Ever. "Gameday: you have an
  update" — never "Your testosterone results are ready"
- Biometric / PIN lock on app open, default on
- Discreet home-screen label and icon
- "Hide sensitive data" toggle that blurs values on screen for when someone is on the
  couch next to his wife
- Neutral billing descriptor on card statements
- No clinical detail in email subject lines
