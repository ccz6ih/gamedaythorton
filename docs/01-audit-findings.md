# 01 — Audit Findings

Crawl date: 2026-09-12. Source: gamedaymenshealth.com/thornton-co and its service pages.
Platform: Webflow. Two GTM containers active (GTM-K87FNCK3, GTM-KL8M63ZT).
Mapbox account: `gamedaymarketing` (corporate-owned).

## The headline finding

**There is no booking system.**

The "Book Appointment" CTA appears eleven times on the location homepage. Every
instance links to `/thornton-co/appointment`, which is a Webflow form collecting:

- Full name (required)
- Email (required)
- Phone number
- "How did you hear about us?" — 16 options
- Three consent checkboxes (transactional SMS, marketing SMS, email-only opt-out)

Submission returns: *"Our team at Thornton will review your information and contact you
directly to book your visit."*

No calendar. No availability. No confirmation. No deposit. No service selection.
**Every booking CTA on the site terminates in a callback queue.**

Implication: as long as this is the front door, **lead response time is the conversion
rate.** Speed-to-lead automation is the highest-ROI single intervention available.

## No patient-facing system exists

Nothing for labs, documents, messaging, refills, progress, or membership.

The site makes these promises:
- "Immediate lab testing with same-visit results"
- "Ongoing performance tracking and protocol optimization"
- "Direct access to your clinician between visits"
- "A frictionless, concierge-level experience"
- "Transparent cash-pay pricing"

All five are currently delivered by phone, text, paper, or not at all. No pricing is
published anywhere on the location pages. The gap between the promise and the delivery
mechanism *is* the product opportunity.

## Defects found on the live corporate pages

Not ours to fix, but worth reporting to the owner — these are conversion leaks he can
escalate to corporate, and it builds credibility.

| Defect | Location |
|---|---|
| "Meet Your Thornton Clinicians" renders **"No items found"** — empty CMS collection | Location homepage |
| Blog card "read article" link points to `#` | Location homepage |
| Live **lorem ipsum** in production copy | `/thornton-co/anti-aging-clinic` |
| Hero clinic photo filename is `flatiron-clinic-default` — another location's stock image | Location homepage |
| "Gameday vs Everyone Else" comparison table duplicated twice with mismatched icon rows | Location homepage |
| 4.9 rating footnoted "across +400 clinics" — corporate aggregate, not Thornton's. One testimonial shown | Location homepage |
| ED service page copy references **Northglenn** mid-paragraph on a Thornton page | `/thornton-co/ed-treatment` |

## NAP inconsistency — three cities, one address

Suite 10701 Melody Dr #315 is listed as:

- **Thornton** — URL slug, page titles, all body copy, brand name
- **Northglenn** — the page's own footer address block
- **Westminster** — Yelp listing

This splits local-SEO authority across three city entities and fragments reviews across
listings. It is a real ranking cost on the highest-intent queries ("TRT clinic near me",
"low testosterone Thornton"). Fixing it is cheap and should be sequenced before any
review-generation automation, or the reviews land on the wrong profiles.

## Service catalogue (for data model seeding)

- **Testosterone:** cypionate injections, pellets, Clomid/Enclomiphene, oral (Kyzatrex)
- **Sexual wellness / ED:** shockwave, P-Shot, Trimix, Viagra/Cialis, PT-141
- **Weight loss / metabolic:** GLP-1, tirzepatide, phentermine, MIC lipotropic + B12,
  body composition scans
- **Peptides / vitamins:** B12, B-complex, vitamin C, glutathione, tri-amino, sermorelin
- **Anti-aging / longevity:** NAD+, sermorelin, glutathione
- **Hair loss:** finasteride, minoxidil, PRP
- **Sports injury:** shockwave

## Operating facts

- Hours: Mon–Fri 9:00–17:00, closed weekends (narrow — waitlist and after-hours
  self-serve booking matter more than usual)
- Voice: +1 (720) 967-4263 — Text: +1 (970) 804-4263 (separate numbers already in use)
- Cash-pay, no insurance, no referral required
- First visit 45–60 min, follow-ups shorter
- Same-day lab results claimed (~15 min turnaround per ED page)
- Facebook: /gamedaythorton (note: misspelled slug, matches Craig's folder name)
