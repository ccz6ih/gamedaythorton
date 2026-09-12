# Scoping & Estimate — Gameday Thornton Platform

Fill after Gate A. Hours are placeholders until the backlog is sorted by the client.

---

## How this is priced

Phases 0, A, and B are sold as **discovery and prototyping**, not as a product.
The deliverable of A/B is a decision, not a launch. Say that in the proposal — it sets
the expectation that Phase B output is not going live, which is what prevents the
"can we use it with real patients" conversation later.

Phase C is where the cost profile changes, because it includes third-party contracts
that are not developer hours.

---

## Phase 0 — Discovery

| Item | Hours | Notes |
|---|---|---|
| Franchise agreement review | | Attorney review recommended separately |
| Current-state systems inventory | | |
| Staff shadowing (half day) | | |
| Baseline metric capture | | May require building measurement if none exists |
| Discovery write-up | | |
| **Subtotal** | | |

## Phase A — Clickable pilot

| Item | Hours | Notes |
|---|---|---|
| Project setup, tokens, design system | | |
| Synthetic fixture dataset (12 patients, edge cases) | | |
| Booking flow | | |
| Intake | | |
| Patient dashboard + Game Plan card | | |
| Weekly check-in | | |
| **Stat Sheet** | | Highest-value component in the build |
| **Lab trends** | | |
| Staff: Scoreboard | | |
| Staff: pipeline funnel | | |
| Staff: today's patients + timeline | | |
| Staff: lab entry grid | | |
| Staff: protocol builder | | |
| Staff: due-for-labs + rebook prompt | | |
| Pilot-mode safety rails | | |
| Demo prep | | |
| **Subtotal** | | |

## Phase B — Functional pilot

Scoped after Gate A. Do not estimate before the client has sorted the backlog.

| Item | Hours | Notes |
|---|---|---|
| *(from Gate A Must list)* | | |
| **Subtotal** | | |

## Phase C — Compliance + production

| Item | Hours / Cost | Notes |
|---|---|---|
| Hosting migration (if Vercel Enterprise BAA is prohibitive) | | Decide at phase start |
| BAA procurement + review — 6 vendors | | Mostly coordination time |
| Supabase HIPAA add-on | $/mo | Verify current pricing |
| RLS implementation + adversarial testing | | |
| Audit logging | | |
| Column encryption | | |
| MFA, RBAC, session policy, break-glass | | |
| Backups + tested restore | | |
| Security risk assessment | | Consultant or documented self-assessment |
| Penetration test | $ | Third party |
| Incident response + BCDR runbooks | | |
| Staff training + records | | |
| Legal review — controlled-substance log | $ | Attorney |
| Remaining Phase C features (see roadmap) | | |
| Fixture purge + `PILOT_MODE` removal + verification | | |
| **Subtotal** | | |

## Recurring (production)

| Item | Monthly |
|---|---|
| Hosting (BAA tier) | |
| Database + storage (HIPAA add-on) | |
| SMS (Twilio, usage-based) | |
| Email | |
| Payment processing (% of volume) | |
| Error monitoring | |
| Maintenance retainer | |
| **Total** | |

---

## The business case to present

Frame against the owner's own baseline numbers from `docs/11-discovery-questions.md` §6,
not against generic industry claims. The three arguments, in order of strength:

1. **Every booking CTA currently ends in a callback queue.** Self-serve booking plus
   sub-60-second lead response converts inbound that is being lost today. Use his actual
   lead volume and booked rate.
2. **Months retained is the whole business and he probably cannot state it.** A one-month
   improvement in average retention, multiplied by his member count and MRR, is usually
   larger than the entire build cost. Compute it with his real numbers in the room.
3. **Nobody in the system has this.** 400+ franchisees, an active Franchise Advisory
   Council looking for system-wide wins, and no patient portal anywhere. If it works at
   Thornton, the multi-tenant path is a second business — and the schema already supports
   it at no extra cost.

Do not lead with feature counts. Lead with the retention arithmetic.
