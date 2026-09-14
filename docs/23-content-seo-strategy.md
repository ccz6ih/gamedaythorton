# 23 — Content & SEO/AEO strategy for medbarco.com

Written after an audit of the live storefront (`app/c/[slug]`) on 13 Sept 2026, in
response to a request to make the site rank for what it actually is — a PRF-forward med
spa — in both Google and AI answer engines (ChatGPT, Google AI Overviews, Perplexity).

This is the plan. What was actually built in this pass is marked **[BUILT]**; everything
else is scoped and ordered but not yet done.

---

## 1. What was true before this pass

- 7 indexable pages total: home, services, shop, packages, about, book, enquire.
- No page has its own URL for a specific treatment. All three PRF treatments live as
  three rows inside one long `/services` page, behind `<details>` accordions. A search
  for "PRF under eye Loveland" or a citation from an AI answer engine has nowhere
  specific to land or point to.
- **Zero structured data.** No `LocalBusiness`, no `Service`, no `FAQPage`, no
  `MedicalWebPage`. Both classic Google (rich results, local pack) and AI answer engines
  (which lean on schema + extractable Q&A far more than classic ranking signals) get
  nothing to parse.
- Several Facials rows read "Description to be supplied by the practice" — thin/duplicate
  content that actively works against ranking the pages that do have copy.
- `robots.txt` and the sitemap are otherwise in good shape (generated, not hand-maintained
  — see `app/c/[slug]/sitemap.ts`), so the gap is content and schema depth, not crawlability.

## 2. What "ranking for PRF" actually requires

Four separate things have to happen, roughly in this order of leverage:

1. **A page whose whole job is the query.** "What is PRF", "PRF vs PRP", "is PRF safe" —
   none of these can be answered by a menu row. They need a page that reads like the
   single best answer on the internet to that question, because that is genuinely what
   both Google and an LLM are trying to find.
2. **Structured data that says what the page says, twice.** `FAQPage` schema doesn't
   change what a human reads; it lets a crawler lift the Q&A pairs verbatim, which is
   the difference between "ranks" and "gets quoted." Same logic for `LocalBusiness` (the
   local pack) and `MedicalWebPage`/`Service` (rich results, and the entity graph an AI
   engine uses to decide a page is authoritative on a medical topic).
3. **Internal links that tell the crawler this page matters.** A pillar page linked only
   from a URL bar is invisible. It needs to be reachable from primary nav, from the
   specific service rows it explains, and ideally from the homepage.
4. **Off-site signals** (Google Business Profile completeness, reviews, local citations,
   backlinks). Real, and probably the single biggest lever for the local pack — but it is
   an owner/marketing action, not a code change, so it is listed in §5 rather than built.

## 3. The compliance constraint that shapes everything else

`scripts/medbar-copy.cjs` establishes the rule already in force for this site: **every
clinical claim on the storefront is the practice's own claim, condensed from copy she has
already published, never invented on her behalf, and needs her sign-off before it is
shown to a client.**

A "why PRF works" page multiplies the clinical copy on the site several times over, so it
has to satisfy that rule, not create an exception to it. The approach taken:

- Content is written as **general educational information about PRF as a treatment
  modality** — mechanism, terminology, what it is and is not — using hedged, non-superlative
  language ("is intended to," "may," "results vary"), the same register her existing
  approved copy already uses. It makes no claim about her specific outcomes and no
  promise of a result.
- It **reuses her already-approved language verbatim** wherever the same ground is
  covered (the draw → spin → place → build process copy on the homepage, the per-service
  `details` copy), rather than restating it in a way that could drift from what she has
  actually signed off.
- It does not claim regulatory approval PRF does not have. PRF is a point-of-care
  processed autologous blood preparation, not an FDA-approved drug or device indication —
  the page says what it is (a same-visit lab process using an FDA-cleared collection
  tube/centrifuge) without overstating that into "FDA-approved treatment."
- No outcome statistics, before/afters, or testimonials are invented. None exist in the
  fixtures, and none are fabricated here.
- **Before this page is unhidden from Jamie's own review, it should get the same
  sign-off pass as any other clinical copy on the site.** It is written to already pass
  that review, not to pre-empt it.

## 4. Content inventory, prioritised

### Tier 1 — built this pass

| Page | URL | Purpose |
|---|---|---|
| PRF pillar page **[BUILT]** | `/prf` | The comprehensive "what PRF is, what it isn't, why it works, is it right for you" page — the single asset meant to rank for every generic PRF query and be citable by an AI answer engine. Links out to all three bookable PRF services and to `/services`. |

Supporting technical work done alongside it:

- `LocalBusiness`/`MedicalBusiness` **[BUILT]** JSON-LD on every storefront page (name,
  address, phone, hours, URL — all fields the clinic record already carries, nothing
  invented), for the local pack and for AI engines building an entity profile of the
  practice.
- `FAQPage` + `MedicalWebPage` JSON-LD **[BUILT]** on `/prf` itself.
- `/prf` added to the sitemap, to `STOREFRONT_PATHS` (so it is public on medbarco.com and
  gets the storefront CSP, matching every other public page), and linked from primary nav
  and from the Injectables section of `/services`. **[BUILT]**

### Tier 2 — next, and each needs Jamie's sign-off before publishing

1. **A dedicated URL per PRF treatment** `/prf/under-eye`, `/prf/microneedling`,
   `/prf/hair-restoration` **[BUILT]** — each with its own `Service` + `FAQPage` +
   `BreadcrumbList` schema and its own meta title/description, so "PRF hair restoration
   Loveland" and "PRF under eye Loveland" can rank as two different results instead of
   two rows on one page competing with each other for the same URL. Built as
   `app/c/[slug]/prf/[treatment]/page.tsx`, matched against `service.name` rather than a
   new slug column (three known rows, no migration needed — see `lib/prf-content.ts`).
   Linked from `/prf`'s own treatment list and from each matching row on `/services`.
   The service's own `description`/`details` (the practice's actual, already-approved
   copy) render unchanged; the surrounding intro/FAQ text is the same general,
   hedged register as the pillar page and needs the same sign-off pass before go-live.
2. **The seven Facials rows with no copy.** These are real duplicate/thin-content risk
   today (an empty box next to nine others), and every one of them is bookable revenue
   Jamie is not getting found for. This is pure "ask Jamie for the words," not a content
   generation exercise — see the `needs_copy` flag already in the data model. **Still
   not built — blocked on the practice's own copy, not on code.**
3. **A short FAQ block for every other treatment category** (Injectables/Jeuveau,
   Paramedical, Skin, Lashes) on the same pattern as the PRF page, now that Tier 2.1 has
   proven the pattern works. **Not yet built.**


### Tier 3 — medium-term content

- A **PRF aftercare** page (what to expect the first 48 hours, when results begin) — high
  search volume from people who have already booked, good internal-link target from
  booking confirmation.
- A **local landing page** for "med spa in Loveland, CO" style queries, separate from the
  brand-name homepage — useful once the practice has enough reviews to cite.
- **"PRF vs Botox/filler"** comparison content — a real, extremely common search that the
  current site has nothing to answer.

### Tier 4 — off-site, not a code change

- Claim and fully complete the Google Business Profile (categories, service list,
  hours, photos) with NAP exactly matching what `LocalBusiness` schema now emits.
- Review generation from real clients (the product deliberately keeps client reviews out
  of the app itself — see `04-feature-backlog.md` — precisely so they land on Google).
- Local citations (Loveland/Northern Colorado directories) with identical NAP.
- A handful of backlinks from real, relevant local sources (chamber of commerce, local
  press, aesthetics associations) — the strongest single ranking signal left, and the
  slowest to build.

## 5. What to check before shipping new clinical copy

- [ ] Read against `scripts/medbar-copy.cjs`'s provenance rule — nothing here should say
      more than the practice's own existing copy already says.
- [ ] No outcome guarantee, no specific percentage, no "clinically proven to," no implied
      regulatory approval PRF does not have.
- [ ] No invented before/after, testimonial, or patient story.
- [ ] Jamie has actually seen and approved the page before `clinic.live` / robots allow
      indexing of it (same gate every other page on this site already uses).
- [ ] `npm run test:routes` and `npm run typecheck` pass — new pages are real routes with
      no dead nav links.

## 6. How to tell if this is working

Not built here (no analytics beyond what already exists — the compliance rules in
`CLAUDE.md` bar third-party trackers on authenticated routes, and the storefront already
carries none), but the practical check is:

- Google Search Console (external, free, no code) — impressions/clicks for "PRF" queries
  once the pillar page is live and indexed, typically 2–8 weeks after publish.
- Manual query: ask ChatGPT/Perplexity "what is PRF" and "PRF under eye treatment
  Loveland Colorado" periodically and see whether medbarco.com is cited.
- Google Business Profile insights, once Tier 4 is done, for "how customers find you."
