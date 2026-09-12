# 10 — Demo & Feedback Session Script

**The purpose of this session is not to sell the software. It is to find out what is
wrong with it.** If they love everything, the session failed — you learned nothing and
you will build the wrong Phase B.

Target: 10+ substantive change requests. Say that goal out loud at the start.

---

## Before the session

- Reset fixtures to a clean state
- Load the month-4 doubter patient (`fixtures/patients.json` -> `p_04_doubter`) as the
  default — that is the patient the whole product exists for
- Have `04-feature-backlog.md` printed or on a tablet, one row per line, three
  checkboxes: **Must / Nice / Don't care**
- Bring `09-compliance-register.md`. You will need it
- Interview the three roles **separately** if at all possible. Front desk will not
  contradict the owner in front of the owner, and front desk knows where the real
  friction is

## Framing (say this, roughly)

> "This is a prototype on fake data. Nothing here is a finished decision. I built it so
> you'd have something concrete to argue with instead of me describing it. The most
> useful thing you can do today is tell me what's wrong, what's missing, and what you'd
> never use. I'm trying to leave here with a list of ten things to change."

---

## Part 1 — Owner (30 min)

**Do not narrate. Hand him the phone and say nothing.**

1. Open the Scoreboard. Watch where his eyes go first, and what he asks about.
   - Q: "Which number on here would you look at first every morning?"
   - Q: "What number do you want that isn't here?"
   - Q: "Do you know your average months retained right now?" *(if no — that is the
     headline finding, and the reason the whole build exists)*
2. Walk the pipeline funnel.
   - Q: "Where do you think you're losing people today?"
   - Q: "Do you currently know which lead sources actually turn into members?"
3. Churn cohorts with reason codes.
   - Q: "Why do you think men cancel?" — then compare his answer to what the reason
     codes would show. The gap between belief and data is the sales argument for Phase B
4. At-risk list.
   - Q: "If I handed you this list Monday morning, what would you do with it?"
     *(If the answer is "nothing," the feature is wrong and needs rebuilding)*

## Part 2 — Clinic director / provider (30 min)

Most important interview. They will use this all day and they can kill adoption alone.

1. Today's patient list.
   - Q: "How do you know who's coming in today right now?"
2. Patient timeline on the doubter patient.
   - Q: "Is this how you think about a patient, or is it organised wrong?"
   - Q: "What's missing that you'd need before walking into the room?"
3. Lab entry grid — **have them actually type a panel in, timed.**
   - Q: "How long does this take you today versus that?"
   - Q: "Which analytes do you actually track? Which of these do you never use?"
   - This directly validates or kills the analyte seed list in `05-data-model.md`
4. Protocol builder + change history.
   - Q: "Would you write the patient-facing reason, or should it be generated for you?"
5. Safety queue.
   - Q: "What thresholds do you actually use for hematocrit and PSA?" **Get real
     numbers. Do not ship our assumptions.**
   - Q: "What else should be flagging that isn't?"
6. Check-in score trend.
   - Q: "Would this change how you titrate?" *(If yes, this is the killer feature and
     you should hear it here first)*

## Part 3 — Front desk / MA (20 min)

Knows where the actual pain is. Ask about their day, not the software.

1. Q: "Walk me through a normal Tuesday. Where does it go wrong?"
2. Q: "How many calls a day are 'can I book' versus 'what were my results'?"
   *(This quantifies the entire portal business case in one answer)*
3. Check-in board and checkout.
   - Q: "What do you have to do today that this doesn't cover?"
4. Rebook prompt.
   - Q: "Do men book their next visit before leaving now? What percentage?"
5. Q: "What do you use today — paper, a spreadsheet, the EMR, a text thread?"
   **Photograph anything paper. Paper forms are the real requirements document.**

## Part 4 — Patient app, all three together (20 min)

1. Booking flow start to finish. Time it.
   - Q: "Would a 55-year-old guy get through that without calling you?"
2. Check-in screen.
   - Q: "Would your patients do this weekly? Honestly?"
   - Q: "Is 60 seconds too long?"
3. **Stat Sheet — the moment that matters.**
   - Show the doubter's four-month trend. Say nothing. Watch their faces.
   - Q: "Would this change a cancellation conversation?"
4. Lab trends with plain-language reads.
   - Q: "Is that language right? Too much? Would it scare anyone?"
   - Q: "Should patients see hematocrit and PSA, or does that generate calls?"
     *(Real disagreement lives here — hear their view before deciding)*
5. Game Film.
   - Q: "Which services would actually use photos? Hair? Body comp? Both?"

## Part 5 — Close (20 min)

1. **Backlog sort.** Every row: Must / Nice / Don't care. All three roles.
2. Q: "If I could only build three things, which three?"
3. Q: "What did I completely miss?"
4. Run `11-discovery-questions.md` on anything still open.
5. **Cover the data rule.** Walk `09-compliance-register.md`. Say it directly: *no real
   patients until Phase C is signed off.* Expect pushback; hold the line. Get the
   acknowledgement.
6. Agree the next checkpoint date.

---

## Capture

- Record with permission. You will not remember it accurately
- One `scoping/feedback-YYYY-MM-DD.md` per session
- Photograph every paper form, whiteboard, and sticky note
- Log every verbatim complaint. Complaints are the requirements

## Watch for

| Signal | What it means |
|---|---|
| "Can we start using this next week?" | Adoption enthusiasm — good. Then Gate C conversation, firmly |
| "We already do that in [X]" | Find out what X is. You may be rebuilding something that works |
| Silence on a feature | Not a good sign. Probe it; silence usually means irrelevant |
| Reaching for the phone to show you something | They are engaged. Follow that thread |
| "Corporate is building something like this" | **Stop and dig.** Changes the whole strategy — see Phase D |
