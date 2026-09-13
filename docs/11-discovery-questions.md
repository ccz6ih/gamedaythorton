# 11 — Discovery Questions

Answers go inline. Anything still blank at Gate B is a risk carried into production.

---

## 1. Franchise (BLOCKING — Gate 0)

- [ ] Does the franchise agreement permit an independently built patient-facing system?
- [ ] Does it permit independent payment processing, or is a processor mandated?
- [ ] Are there restrictions on independent websites, subdomains, or apps using the
      Gameday name or marks?
- [ ] Is there a required technology stack, EMR, or vendor list?
- [ ] Are there data-ownership clauses covering patient records?
- [ ] **Have an owner log in and show you what corporate actually provides today.**
      Press coverage (Sept 2026) describes a custom EMR built with Lobbie and a
      patient app "coming soon" — but that is marketing copy, and owners shopping
      for alternatives suggests otherwise. Five minutes of screen-share settles it
- [ ] Does corporate have a patient portal on its roadmap? *(If yes, everything changes
      — see Phase D)*
- [ ] Who at corporate is the right contact? Is the Franchise Advisory Council a route?
- [ ] Any restriction on brand asset use — logo, colours, typography?

## 2. Current systems

- [ ] What EMR or charting system is in use? Version? Cloud or local?
- [ ] Does it have an API? Documented? Who administers it?
- [ ] What is used for scheduling today — the EMR, paper, Google Calendar, phone only?
- [ ] What processes payments? Card reader model? Recurring billing handled how?
- [ ] What sends SMS today? The (970) 804-4263 number — what platform is behind it?
- [ ] Any CRM or marketing automation? Where do the corporate form leads actually land?
- [ ] Is there a shared inbox, or does the owner get lead emails personally?
- [ ] What tracks inventory today? Spreadsheet? Paper log?
- [ ] **Photograph every paper form currently in use.** These are the real requirements

## 3. Labs

- [ ] Which analyser or lab vendor for the same-day panel?
- [ ] Which analytes are on the standard panel? On the extended panel?
- [ ] How do results arrive — printed, PDF, portal, direct interface?
- [ ] Is there any electronic output at all (HL7, CSV, API)?
- [ ] Which send-out labs are used and how do those results arrive?
- [ ] **Actual target ranges used by this clinic**, per analyte — not reference ranges
- [ ] **Actual safety thresholds:** hematocrit ceiling, PSA velocity, estradiol range
- [ ] Standard monitoring interval — 6wk? 8wk? Then quarterly?

## 4. Clinical protocol

- [ ] Standard TRT starting doses and titration steps
- [ ] Which services genuinely need progress photos — hair, body comp, both?
- [ ] Is there a body composition device? Which one? Any data export?
- [ ] Standard consent forms in use — collect copies
- [ ] Who signs off on protocol changes? Is there an MD review step?
- [ ] Are validated instruments (ADAM, IIEF-5) used today, or would they be new?

## 5. Business model

- [ ] Membership tiers and prices
- [ ] What is included in a membership vs billed separately?
- [ ] Add-on price list — all services in `01-audit-findings.md`
- [ ] Is there a first-visit or consult fee?
- [ ] Current no-show rate? Any deposit policy today?
- [ ] Contract length — month to month? Annual?
- [ ] Cancellation and pause policy as it stands
- [ ] Discount or promotional structures in use

## 6. Baseline metrics (capture or the project cannot prove value)

- [ ] Monthly lead volume
- [ ] Lead -> booked consult rate
- [ ] Show rate
- [ ] Consult -> member conversion rate
- [ ] Current active member count
- [ ] Current MRR
- [ ] **Average months retained** *(the headline number — most clinics do not know it)*
- [ ] No-show rate
- [ ] Average revenue per member per month
- [ ] Current average lead response time

## 7. Team & operations

- [ ] Staff count and roles
- [ ] Who works which days? Coverage on Mon–Fri 9–5?
- [ ] Number of treatment rooms
- [ ] Who answers the phone? Who answers texts? After hours?
- [ ] Is the owner also the clinic director, or separate?
- [ ] How tech-comfortable is each staff member, honestly?
- [ ] Are weekend or evening hours possible? *(Mon–Fri 9–5 is narrow for the working
      men this clinic targets — waitlist and self-serve booking matter more because of it)*

## 8. Marketing & the NAP problem

- [ ] Who manages the Google Business Profile — franchise or corporate?
- [ ] **Can the Thornton / Northglenn / Westminster inconsistency be fixed, and by whom?**
- [ ] Who manages the Facebook page (/gamedaythorton)?
- [ ] Current ad spend and channels?
- [ ] Which of the 16 "how did you hear about us" sources actually produce volume?
- [ ] Is there any review-generation process today?
- [ ] Who owns the (970) text number and the (720) voice number?

## 9. Technical & brand

- [ ] Preferred domain for the portal? *(`portal.gamedaythorton.com` needs a domain the
      franchise controls — does one exist?)*
- [ ] Exact brand accent hex — the red used on the corporate site
- [ ] Official typography from the franchise brand kit
- [ ] Clinic photography available, or do we need a shoot? *(The corporate page is
      currently using another location's default image)*
- [ ] Provider headshots and bios *(the "Meet Your Thornton Clinicians" CMS collection
      is empty — we need these regardless)*
- [ ] Any existing Google Workspace / IT setup to integrate with?

## 10. Current platform — GlossGenius (added; see `12-glossgenius-parity.md`)

The clinic runs on GlossGenius today and this build replaces it. **We have not seen the
account**, so every "today" claim in the parity matrix is inferred rather than observed.

- [ ] **Sit with the front desk for one morning and watch.** Note every click and every
      workaround. Workarounds are requirements. *This is the highest-value hour available
      in this project*
- [ ] Which features are used daily, weekly, never?
- [ ] Monthly cost and contract term?
- [ ] **Will GlossGenius sign a BAA?** Ask them directly, in writing
- [ ] What clinical information currently lives in client notes?
- [ ] Can the client list be exported? With notes? **With photos?** What format?
- [ ] How many future appointments sit on the calendar at any time?
- [ ] Gift cards, packages, or prepaid series sold? Any outstanding? *(These are real
      liabilities that must be honoured across a cutover)*
- [ ] Is recurring membership billing run through GlossGenius or separately?
- [ ] **Which payment processor sits underneath it?** *(This single answer decides whether
      every member has to re-enter a card at cutover — which is a churn event, not a
      technical detail. See ADR-011)*
- [ ] Which card reader hardware? Owned or leased?
- [ ] Does anyone rely on Google Calendar sync?
- [ ] Are email or SMS campaigns actually being sent, or is the feature dormant?
- [ ] Who administers the account? Who holds the password?
- [ ] **What does the owner like about it?** Ask genuinely. Whatever he names is a hard
      requirement, and it is far cheaper to hear now than at Gate B
- [ ] What makes staff swear at it? Those are the features to beat
- [ ] What are the record-retention obligations on anything in there that functioned as a
      clinical record? *(Ask counsel before deleting anything)*

## 11. Risk & appetite

- [ ] Budget range for Phases A–C?
- [ ] Timeline expectation?
- [ ] Who decides — owner alone, or partners involved?
- [ ] Appetite for the Phase C compliance spend? *(Ask early. If the answer is "we'd
      rather not," that is a fundamental problem and better known now)*
- [ ] Is he interested in the multi-franchise play, or purely solving Thornton?
