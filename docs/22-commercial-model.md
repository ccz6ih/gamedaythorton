# 22 — The Commercial Model

**Internal. Not for the client.** `21-compliance-cost.md` is the costing; this is
what to do about it commercially, and it exists because the honest reading of that
document is *"at one clinic, compliance eats the entire fee."*

That is true at *one* clinic. **It is not one clinic** — see the deal shape below,
which is the single most important fact in this document and changes the arithmetic
before it starts.

---

## The deal shape (as told by Craig, Sept 2026)

This was never a single-location project. Recorded here because none of it is
derivable from the code, and every number in this document depends on it.

| Who | What they own | Practice type |
|---|---|---|
| The owner who made contact | A med spa **and** a Gameday franchise | both |
| **Joni** | A Gameday franchise — Thornton and/or Northglenn | `mens_health` |
| **Jamie Salazar** | Works with the med spa; now involved with Gameday too | `med_spa` |

Craig and his wife know Jamie personally. That relationship is how this started,
and it is why the Med Bar fixtures are real services at real prices rather than
invented ones.

**Three or four locations across two practice types, from day one, owned by people
who already own multiples.** Multi-location owners are the ideal first customer:
they feel per-location software cost directly, and the expansion path is inside
their own portfolio rather than a cold sale.

**Every one is cash-pay** — cash and card, no insurance billing. That is what makes
the covered-entity question below worth asking rather than academic.

*Unresolved:* whether the two-franchise owner who made contact is Joni or a third
person, and exactly which locations are Thornton vs Northglenn. Ask before anything
client-facing names them.

### What this changes immediately

- **The multi-tenancy is not theoretical any more.** `clinic_id` on every table and
  the `practice_type` module map were built for a hypothetical second tenant. There
  are now three or four real ones, spanning both practice types already modelled.
- **Payments are a must-have, not a nice-to-have.** The stated use is card
  processing across all locations. That is GlossGenius's core value and the thing a
  replacement cannot be missing.
- **Separate legal entities need separate payout accounts.** A franchise LLC and a
  med spa LLC cannot share one Stripe account. This means Stripe Connect, or one
  account per clinic keyed off `clinic_id` — an architecture decision worth making
  before the Stripe work goes deeper, not after. Not yet in `18-decisions.md`.

---

## What changed this week

Three findings from September 2026 research, one of which I got wrong.

### 1. Corporate's software: unverified, and probably less real than the press says

Press coverage (Refresh Miami, Sept 2026) says Gameday built a purpose-built EMR
with software partner **Lobbie** — labs, telehealth notes, inventory, charting —
and that a patient mobile app for scheduling, results and messaging is "coming
soon." They are at ~400 clinics targeting 1,000 by 2027.

**Weight that correctly. It is a PR article, not a product demo.** And it is
contradicted by the single strongest piece of evidence available:

> **Multiple Gameday franchise owners are actively shopping for alternatives.**
> People do not do that when the first-party system exists, works, and is
> mandated.

"Coming soon" in franchise marketing can mean shipped, in beta, or on a slide.
Craig's read from direct contact with owners is that little of it is in their hands
today, and that is a better source than coverage.

**What to do with it:**

- **Do not design around the press release**, in either direction. Do not concede
  the record because an article says an EMR exists, and do not assume a clear field
  because owners are unhappy.
- **Ask an owner to log in and show you** what corporate actually provides. One
  screen-share resolves what no amount of research will.
- **The product thesis is unaffected either way.** Charted lab trends + weekly
  scores + dose markers on one axis, photo series, retention economics, and the
  entire aesthetics side. Nothing described anywhere covers that, and it is the
  part `CLAUDE.md` says to prioritise.

Gate 0 in `08-roadmap.md` now carries this as an open question rather than a
settled fact. **I previously logged it as a materialised risk on the strength of
that article. That was wrong, and it is corrected.**

### 2. The covered-entity question was never asked

HIPAA attaches to a *covered entity*: a provider who transmits health information
electronically in connection with a HIPAA-standard transaction — claims,
eligibility, prior auth. **Gameday does not bill insurance. The Med Bar is cash-pay
aesthetics.**

If neither performs a covered electronic transaction, neither may be a covered
entity, and the Security Rule obligations that make up most of `21`'s bill may not
be legally required.

**Do not oversell this.** It is contested, fact-specific, and much of the
compliance industry takes the conservative position that any licensed provider
storing records electronically is covered. Falling outside HIPAA also does not
mean falling outside the FTC Health Breach Notification Rule, Colorado privacy
law, or medical-board retention rules. **An attorney answers it. We do not.**

But it costs an hour of legal time to ask and potentially removes $20k from the
first year. It belongs at the top of the sequence, and it is now step 1 in the
client document.

### 3. Vercel's attestation is real, and it is not a BAA

Craig downloaded two Schellman reports from his own Vercel account: the AI Cloud
report as of 2025-06-30, and the Agentic Infrastructure Platform report as of
2026-06-30 (signed 2026-08-19). Both opine that the program conformed to the
applicable HIPAA Security and HITECH Breach Notification implementation
specifications, with **no exceptions noted** across ~164 controls.

Four things to keep straight:

- **These are Type 1 reports.** They attest that controls were *designed and
  implemented as of a single date*. They do not test operating effectiveness over
  a period — that is a Type 2. Do not describe them as a Type 2 to a client.
- **The report is not the BAA.** Having the attestation does not mean an agreement
  is in place. The $350/mo Pro add-on is what produces the signed BAA.
- **AWS and Microsoft are excluded** from scope as subservice organisations. Their
  controls are carried by their own reports.
- **Restricted use.** Both reports state they are intended solely for Vercel and
  its user entities and "should not be used by anyone other than these specified
  parties," with redistribution prohibited. **Do not forward the PDF to Gameday or
  Jamie.** Say that Vercel maintains an independent Schellman HIPAA/HITECH
  attestation and offers a BAA, and let the client's own counsel request it
  through Vercel if they want to read it.

Each page is watermarked with `craigcarda2@gmail.com` and the org name, which is
exactly the mechanism that makes forwarding traceable.

---

## Why one clinic never works

Compliance cost is **almost entirely fixed**. It does not scale with the number of
practices on the system — one risk assessment, one penetration test, one set of
policies, one hosting bill covers many tenants. The schema has carried `clinic_id`
since day one specifically so this is true.

Per-practice cost of the $17k/yr infrastructure path:

| Practices | Per practice / month | Versus GlossGenius (~$48–148) |
|---|---|---|
| 1 | **$1,430** | 10–30× more expensive |
| 3 | $477 | Still worse |
| 10 | $143 | **Competitive** |
| 25 | $57 | Cheaper, with far more product |
| 100 | $14 | Irrelevant as a line item |

**The break-even is somewhere between 5 and 10 practices.** Below that, selling a
hosted compliant service is selling at a loss. Above it, the economics are better
than the incumbent's because the fixed cost is already paid.

**Starting at three or four changes the conversation.** It does not reach break-even
on its own, but it is close enough that one more location — and these owners own
multiples — crosses it. Combined with model A below, where the client carries the
infrastructure bill directly, the arithmetic works from the first location rather
than from the tenth.

This is the whole argument for the multi-tenant discipline, and it is why
`08-roadmap.md` calls multi-tenancy "the difference between a client project and a
product."

---

## Three ways to get paid

### A. Licence and build — client owns the accounts · **recommended**

The practice holds its own Vercel team and Supabase organisation, signs the BAAs
directly, and pays those invoices at cost. We build, configure, support.

- **Compliance cost to us: near zero.** We are not the primary custodian.
- We likely still need a BAA with the practice, because support access can reach
  PHI — but our obligation is our own policies, training and insurance, not
  $17k/yr of infrastructure.
- The client gets lower total cost, owns its data outright, and is not locked to
  us. That is a genuinely better offer, not a concession.
- **We charge for work**: a build fee, then a monthly support and development
  retainer.

This is the answer to "there is no money in it for me." The infrastructure bill
stops being ours.

Keep support access disciplined even so: named accounts, logged, and ideally
break-glass rather than standing. That is what keeps our own obligations small.

### B. Hosted service — we own the accounts

One invoice, simplest for the client, and how most SaaS works. But it makes us a
Business Associate in our own right with direct HITECH liability, and the fee has
to carry infrastructure plus our own assessment, insurance and training.

**Only viable at 10+ practices.** Below that the monthly price required is higher
than any single clinic will pay.

### C. Expand inside the portfolio, then to corporate

Gameday has ~400 clinics, buys and builds software, and already proved it will
commission a custom system. The fixed compliance cost divided across 400 clinics
is a rounding error.

The pitch is not "replace your EMR" — it is the retention layer their EMR and
their forthcoming app do not cover, priced per clinic.

**The nearer version of this is the portfolio itself.** These owners already hold
multiple locations across both practice types; every additional one is a warm
expansion, not a sale. Corporate is the ceiling, not the next step.

A working pilot with several real franchisees is also the strongest possible
introduction to corporate when that time comes, and the Med Bar tenant proves the
same code serves an entirely different practice type.

---

## What to do now

1. **Stay in pilot.** It costs nothing and the guard makes it safe.
2. **Get the covered-entity answer in writing** before quoting any compliance
   number. It may change the number by an order of magnitude.
3. **Reposition the pitch** away from system-of-record and onto the progress
   engine. Smaller claim, undefended ground, much less PHI.
4. **Quote model A** when the time comes. Never absorb the infrastructure bill.
5. **Never quote a hosted monthly price to a single clinic** that assumes
   compliance cost can be recovered. It cannot.
6. **Treat Thornton and the Med Bar as reference customers**, priced for the
   reference value — build fee plus modest retainer — with the compliance
   conversation deferred until the covered-entity answer lands.

---

## What not to do

- **Do not forward the Vercel attestation PDFs.** Restricted use, watermarked.
- **Do not describe the Type 1 attestation as proof of ongoing effectiveness.**
- **Do not say the system is "HIPAA compliant"** or "HIPAA ready" in any
  marketing. It is neither, and `20-hipaa-readiness.md` says exactly why.
- **Do not agree to "just one real patient"** to close the deal. It is named in
  `08-roadmap.md` as the most likely way this project goes wrong, and the database
  will refuse it anyway.
- **Do not compete with the corporate patient app.** Scheduling and messaging are
  lost ground. The progress engine is not.

---

## Client-facing version

`Before the First Patient` — published artifact, written for the clinic owner and
the practitioner. It covers status, the covered-entity question, the cost ranges,
who holds the risk, the Gameday scope split, the sequence, and the decisions we
need from them.

It deliberately omits: the per-practice break-even table, the corporate play, and
anything about our own margin. Those are commercial position, not client
information.
