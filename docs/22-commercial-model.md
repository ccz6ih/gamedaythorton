# 22 — The Commercial Model

**Internal. Not for the client.** `21-compliance-cost.md` is the costing; this is
what to do about it commercially, and it exists because the honest reading of that
document is *"at one clinic, compliance eats the entire fee."*

That is true, and it has three answers. None of them is "absorb it".

---

## What changed this week

Two findings, both material, both from September 2026 research.

### 1. Gameday corporate already has the clinical system

Gameday built a purpose-built EMR with software partner **Lobbie** — in-office
labs, telehealth notes, inventory, charting. Their stated reason for building it
is that **they do not bill insurance**, so they did not need a billing-shaped EMR.
They are at ~400 clinics targeting 1,000 by 2027, and franchise support explicitly
includes "access to proprietary software."

**And a patient mobile app — scheduling, results, provider messaging — is
described as "coming soon."**

`08-roadmap.md` listed "Corporate builds their own portal mid-build" as a Medium
risk to ask about at Gate 0. **That risk has materialised.** It is no longer a
question to ask; it is a fact to design around.

What survives contact with it:

| Job | Owner | Contested? |
|---|---|---|
| Clinical record | Corporate EMR (Lobbie) | No — concede it |
| Scheduling, results, messaging | Corporate app when it ships | **Yes — do not fight this** |
| Progress engine — lab trends + weekly scores + dose markers on one axis, photo series | This system | No. Nothing described covers it |
| Retention economics — NRR, months on protocol, churn reasons, no-next-visit | This system | No |
| Med spa side — packages, prepaid liability, treatment records with lot numbers | This system | No. No corporate EMR covers aesthetics |

The product thesis in `CLAUDE.md` — *does this make improvement visible?* — is the
part nobody else is building. Everything adjacent to it is now someone else's.

**Consequence for the pitch:** stop positioning this as the system of record. It
is the progress and retention layer. That is a smaller claim, a defensible one,
and — critically — **it holds far less PHI, which is the largest cost lever
available.**

Unconfirmed and worth asking at Gate 0: whether franchisees *must* use the
corporate EMR, whether it exposes an API (Lobbie advertises HL7/FHIR
integration), and the real timeline on the patient app.

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

### C. Sell to corporate, not to Thornton

Gameday has ~400 clinics, buys and builds software, and already proved it will
commission a custom system. The fixed compliance cost divided across 400 clinics
is a rounding error.

The pitch is not "replace your EMR" — it is the retention layer their EMR and
their forthcoming app do not cover, priced per clinic.

**Thornton is the proof, not the deal.** A working pilot with a real franchisee
and real enthusiasm is the strongest possible introduction to corporate, and the
Med Bar tenant proves the same code serves an entirely different practice type.

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
