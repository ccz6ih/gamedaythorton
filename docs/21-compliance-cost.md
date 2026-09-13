# 21 — What Compliance Actually Costs

Researched September 2026. **Every figure here needs a written quote before you
budget on it** — compliance pricing moves, and two of the numbers below changed
inside the last eighteen months.

Read `20-hipaa-readiness.md` for what is built. This is what the rest costs.

---

## Ask this before costing anything

**HIPAA attaches to a *covered entity*** — for a clinic, a provider who transmits
health information electronically in connection with a HIPAA-standard transaction:
a claim, an eligibility check, a prior authorisation. It is the *insurance
transaction* that triggers it, not the presence of health records.

**Gameday does not bill insurance** — their EMR was built around that fact. **The
Med Bar is cash-pay aesthetics.** If neither ever performs a covered electronic
transaction, neither may be a covered entity, and most of the bill below may not be
legally required.

Three things keep this honest:

1. **It is contested and fact-specific.** Much of the compliance industry takes the
   conservative position that any licensed provider storing records electronically
   is covered. They are not being dishonest.
2. **Not-HIPAA is not unregulated.** The FTC Health Breach Notification Rule reaches
   health apps outside HIPAA; Colorado privacy law and medical-board retention rules
   apply regardless.
3. **An attorney answers this. An engineer does not.** Including this one.

It costs an hour of legal time to ask and may remove $20k from the first year. It
belongs first in the sequence, not after the hosting decision.

---

## The headline

> **Hosting is the smallest line item, and the one everybody optimises.**

A realistic first year, for one practice:

| | Low | Likely | High |
|---|---|---|---|
| Hosting + database with BAAs | $5,000 | $8,000 | $17,000 |
| Security risk assessment | $0 | $3,000 | $15,000 |
| Penetration test | $4,000 | $7,000 | $15,000 |
| Legal — BAAs, policies, controlled-substance log | $1,500 | $4,000 | $8,000 |
| Cyber liability insurance | $1,000 | $2,000 | $4,000 |
| Policies, training, incident runbook | $500 | $1,500 | $4,000 |
| **First year total** | **$12,000** | **$25,500** | **$63,000** |
| **Ongoing per year after** | **$6,000** | **$11,000** | **$22,000** |

So the hosting decision is worth roughly $12k/year at the extremes. The
*non-hosting* items are worth $20k+ and nobody sells them as a monthly plan.

That is the thing to internalise before comparing VPS tiers.

---

## About that hosting table

The tiers you found are real prices — for a different product.

> Entry-Level VPS / Starter · $30–120 · *Solo practices, medical marketing
> websites with simple patient intake or contact forms.*
>
> Managed WordPress / Small Clinic · $120–500 · *Small medical practices utilizing
> medical plugins, appointment setting, and basic patient databases.*

**That table is about brochure websites.** A marketing site with a contact form
holds a name and a phone number for as long as it takes to email them. This system
holds lab values, treatment records, units of injectable per anatomical area, lot
numbers, and progress photographs. Same industry, different risk class entirely.

Three specific problems with using it to budget:

**1. Cheap hosting is not compliant hosting, and a VPS moves the work to you.**
On a $40 VPS you are personally responsible for every technical safeguard in the
HIPAA Security Rule: encryption at rest, access control, audit logging, automatic
logoff, integrity controls, backup and tested restore, patching, intrusion
detection. That is not $40 of work per month. And most budget VPS providers will
not sign a BAA at all — without one, using them for PHI is a violation regardless
of how well you configure the box.

**2. "Basic patient databases" in WordPress is the risky part, not the cheap part.**
A WordPress patient database inherits the plugin supply chain — every plugin, and
every plugin's update, runs with database access. Some managed WordPress hosts
(WP Engine among them) do offer BAAs, so it is not automatically disqualifying.
But a plugin table is a far weaker posture than row-level security enforced inside
Postgres, which is what you already have: a cross-tenant or cross-patient read is
refused by the database, and `scripts/db-test.cjs` proves it by deliberately
trying.

**3. It omits the expensive half.** No hosting tier includes a risk assessment, a
penetration test, legal review, or insurance. Those are most of the bill.

---

## Hosting options, with real numbers

### What you are on now, made compliant

| | Monthly |
|---|---|
| Vercel Pro | ~$20/user |
| Vercel HIPAA BAA add-on | **$350** |
| Supabase Team (floor for HIPAA) | **$599** |
| Supabase HIPAA add-on | **~$350** (not published; quoted figure) |
| Point-in-time recovery (required for HIPAA) | from **$100** |
| Compute (Small minimum) | from **$15** |
| **Total** | **≈ $1,430/mo · ~$17,200/yr** |

Two corrections to what I told you earlier, both in your favour and against it:

- **Vercel's BAA is no longer Enterprise-only.** It is a self-serve $350/mo add-on
  on Pro. Before 2025 the same thing needed an Enterprise contract at roughly
  $45k/year. My earlier docs said Enterprise; they were out of date and are now
  fixed.
- **Supabase's HIPAA floor is the Team plan at $599/mo**, and the add-on on top is
  not published. A maintainer has quoted $350/mo; treat that as indicative and get
  it in writing.

Migration cost: zero. This is the do-nothing option.

#### What the Vercel attestation does and does not prove

Vercel publishes independent Schellman attestations to account holders — the AI
Cloud report as of 2025-06-30 and the Agentic Infrastructure Platform report as of
2026-06-30 — opining that the security and breach-notification program conformed to
the applicable HIPAA Security and HITECH implementation specifications, with **no
exceptions noted** across ~164 controls.

Four qualifications that matter:

- **They are Type 1 reports.** Controls were designed and implemented *as of a
  single date*. Operating effectiveness over a period is a Type 2, which these are
  not. Do not describe them as one.
- **The attestation is not the BAA.** The $350/mo Pro add-on is what produces a
  signed agreement. Holding the report is not holding the contract.
- **AWS and Microsoft are excluded from scope** as subservice organisations.
- **They are restricted-use and watermarked per downloader.** Both state they should
  not be used by anyone other than specified parties and prohibit redistribution.
  Cite that Vercel maintains the attestation; do not forward the PDF. A client's
  counsel can request it through Vercel.

### The cheaper paths

| Option | Monthly | Migration effort | What you give up |
|---|---|---|---|
| **Vercel Pro + Neon Scale** | ~$420–500 | Medium–high | Supabase Auth and Storage. Neon is HIPAA-eligible on Scale with no separate HIPAA fee |
| **Render (Scale workspace)** | ~$200–400 | Medium | One vendor for app + database + one BAA. 20% usage premium on HIPAA workspaces; the old $250/mo minimum was removed in April 2026 |
| **AWS** | ~$150–400 | High | Most control, most ops work. **The BAA is self-serve through AWS Artifact at no separate charge** — you pay only for HIPAA-eligible services |
| **Aptible Production** | $499 + usage | Medium | Buys the controls rather than building them: "100% of HIPAA controls applied automatically" |

**The migration cost is the catch on all of them.** Your RLS policies are standard
Postgres and port anywhere, which was deliberate. Supabase **Auth** and **Storage**
do not — replacing those is real work, call it 40–80 hours. At $17k/yr versus
$5k/yr, moving pays back inside a year, but only if the hours are cheap or yours.

### If you want the least worry per dollar

**Aptible** or **Render**. Aptible exists to be the compliant substrate — you get
the BAA, the controls, and someone else's SOC 2 report, and you stop thinking about
intrusion detection. Render is cheaper and covers app plus database under one BAA,
which halves the vendor paperwork.

### If you want the lowest bill

**AWS**, because the BAA costs nothing and you pay only for what you run. But you
inherit the operational burden, and an unpatched RDS instance with a free BAA is
worse than a managed platform with a paid one.

---

## The cheapest compliance strategy is not a hosting choice

In rough order of value per pound spent:

**1. Hold less PHI.** The single biggest lever, and it costs nothing. Already
partly done — no prescribing, no insurance claims, no duplicate medical record.
Go further if the clinic will tolerate it: progress photographs are the highest
sensitivity asset in the system and the hardest to delete convincingly. A version
that does not store photos is materially cheaper to make compliant.

**Gameday makes this concretely available.** Corporate already runs a purpose-built
EMR (developed with Lobbie) covering labs, telehealth notes, inventory and
charting. If the clinical record stays there and this system is the progress and
retention layer, it holds a fraction of the PHI — and cost scales with what is
held. See `22-commercial-model.md`.

**2. Stay on synthetic data until the product is right.** Every month in pilot is a
month not paying for compliance on features that might get cut. The pilot guard in
the database is what makes that safe rather than merely intended.

**3. Do the risk assessment yourself first.** HHS and ONC publish a free Security
Risk Assessment Tool. For a single practice, a thorough self-assessment is
legitimate and satisfies the Security Rule requirement that one exists. Pay a
consultant for a review of your assessment, not to write it from scratch — that is
often a third of the price.

**4. Choose one vendor for as much as possible.** Every additional vendor touching
PHI is another BAA, another subprocessor on your inventory, and another SOC 2
report to read. Render or Aptible doing app + database + storage beats four
separate BAAs.

**5. Don't buy the penetration test twice.** Do it once, after the feature set
settles. A pen test against a product that changes next month is money spent on a
snapshot.

---

## The part that is easy to miss

**You are a Business Associate.** If you build and operate this for the clinic,
you are not a neutral vendor — you are handling PHI on their behalf. That means:

- **You need a BAA with the clinic**, not just with your own vendors.
- **You need BAAs with every subprocessor** (host, database, SMS, email, error
  monitoring), and you are accountable for them.
- **You need your own policies, training records, and incident response.** A
  Business Associate is directly liable under HITECH, not merely contractually.
- **You should carry cyber liability insurance** with a limit that reflects the
  breach cost, not the project fee. Breach notification alone — mail, credit
  monitoring, legal — runs into the tens of thousands for a few hundred patients.

This is the item most likely to be discovered late, and it changes the economics of
"I'll just host it for them."

---

## What I would actually recommend

1. **Get the covered-entity question answered in writing**, by an attorney, before
   costing anything. It is the cheapest step here and may remove most of the rest.
2. **Stay in pilot.** Nothing here is urgent until a real patient exists, and the
   database currently refuses to let one exist.
3. **Move the Supabase project to a US region now**, while it holds nothing that
   matters. Minutes today, a migration with PHI later.
4. **Before Phase C, get three written quotes:** Supabase's HIPAA add-on, Render
   Scale for your actual workload, and Aptible. Then decide with real numbers
   rather than these ranges.
5. **Budget $25k for the first year**, not $500/mo. If that number is a problem,
   the honest conversation is about scope — fewer PHI-bearing features — rather
   than about cheaper hosting.
6. **Do the free HHS self-assessment in Phase B**, before spending anything. It
   will tell you which of the expensive items you actually need and often reveals
   that the answer is fewer than you feared.

---

## Sources

Checked September 2026. Prices change; get quotes.

- [Supabase pricing](https://supabase.com/pricing) — Free / Pro $25 / Team $599 / Enterprise; HIPAA is a paid add-on on Team and above
- [Is Supabase HIPAA Compliant? BAA, Plans, Cost](https://axonbuild.com/blog/is-supabase-hipaa-compliant/) — HIPAA add-on quoted around $350/mo, plus PITR and compute minimums
- [HIPAA BAAs are now available to Pro teams](https://vercel.com/changelog/hipaa-baas-are-now-available-to-pro-teams) — Vercel BAA on Pro, self-serve
- [Vercel supports HIPAA compliance](https://vercel.com/blog/vercel-supports-hipaa-compliance) — the $350/mo Pro add-on
- [AWS HIPAA compliance](https://aws.amazon.com/compliance/hipaa-compliance/) — BAA accepted self-serve via AWS Artifact; customer must keep PHI in HIPAA-eligible services
- [HIPAA on Render](https://render.com/docs/hipaa-compliance) and [Render now supports HIPAA-compliant workspaces](https://render.com/blog/introducing-hipaa-enabled-workspaces) — Scale or Enterprise workspace, 20% usage premium
- [Updated plans for Render workspaces](https://render.com/changelog/updated-plans-for-render-workspaces) — April 2026, HIPAA workspace minimum fee removed
- [Aptible pricing](https://www.aptible.com/pricing) — Production $499/mo base, HIPAA controls applied automatically
- [Neon pricing / Scale tier](https://vela.run/articles/neon-serverless-postgres-pricing-2026/) — HIPAA eligibility on Scale, usage-based, no monthly minimum since December 2025
- [HIPAA-compliant Supabase + Vercel 2026](https://gautamkhorana.com/blog/hipaa-compliant-supabase-vercel-2026/) — independent walkthrough of the combined cost
