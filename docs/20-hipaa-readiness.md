# 20 — HIPAA Readiness

The brief is "close to HIPAA so it is ready when we get there." This document says
exactly how close, what is genuinely done, and what is not — so nobody has to
guess and nobody can be surprised.

**Read `09-compliance-register.md` first.** It is the document that gets shown to
the client. This one is the engineering view of the same ground.

---

## Where this actually stands

> **This system is not HIPAA compliant and must not hold real patient data.**

That is not a caveat at the bottom of an otherwise reassuring page. It is the
headline, and it stays the headline until every row in
`09-compliance-register.md` is closed.

What "close to ready" honestly means here:

- The **technical controls** that are expensive to retrofit are built and tested.
- The **contractual controls** — BAAs — are not signed, and no amount of code
  changes that.
- The **operational controls** — training, risk assessment, incident response —
  do not exist yet.

A system can be architecturally ready and still be unlawful to use. That is
precisely the position this is in, on purpose, and the gap is paperwork and money
rather than a rewrite.

---

## Built and verified

Each of these is enforced rather than documented, and each has a test.

| Control | How | Test |
|---|---|---|
| **Tenant isolation** | RLS on all 33 tables, keyed to `staff_user` / `patient` linkage | `db-test.cjs` — deliberate cross-tenant read AND write attempt |
| **Patient isolation** | A patient sees exactly one record and cannot enumerate staff or read the audit log | `db-test.cjs`, `auth-test.cjs` |
| **Least privilege by default** | Every query in the request path runs as the signed-in user. There is no service-role client in any page | — |
| **No column escalation** | A patient may change their phone; not their status, clinic, or clinical linkage | `db-test.cjs` |
| **Audit log** | Append-only, `UPDATE`/`DELETE` revoked, records which columns changed rather than their values | `db-test.cjs` |
| **No PHI to the payment processor** | `lib/phi` allowlist + a DB trigger on `payment.descriptor` and `.metadata` | `db-test.cjs` |
| **No clinical content in notifications** | Same term list, DB trigger on `automation_run.payload_preview`, word-boundary matched | `db-test.cjs` |
| **No third-party code behind login** | CSP allows no external script origin at all. No analytics, no pixels, no session replay, no chat widget | `app-test.cjs` |
| **Not indexable** | `X-Robots-Tag` header + `robots.txt` + per-page metadata | `app-test.cjs` |
| **No referrer leakage** | `Referrer-Policy: no-referrer` — a patient id in a URL must not travel | `app-test.cjs` |
| **Not framable** | `frame-ancestors 'none'` + `X-Frame-Options: DENY` | `app-test.cjs` |
| **EXIF stripped from images** | Canvas re-encode on ingest drops all metadata including GPS | — |
| **Log scrubbing** | `scrubForLog()` keeps shapes, drops values. Error monitoring is the most-forgotten PHI egress point | — |
| **Consent evidence** | Text version, timestamp, IP per consent; transactional and marketing SMS separate because they legally are | — |
| **Template versioning** | A consent signed against v3 is reproducible as v3 forever | — |
| **Fails closed** | Missing `PILOT_PASSCODE` returns 503 on every route rather than skipping the gate | `app-test.cjs` |
| **Real data is refused** | While `pilot_mode` is true, every PHI table rejects rows not marked synthetic | `db-test.cjs` |

### Not a control, and not claimed as one

The **pilot passcode** is a hedge against casual discovery. It is a shared secret
in a cookie. It is not authentication and nothing downstream treats it as any.

The **synthetic-data guard** can be defeated by setting `synthetic = true` on real
data. It is friction plus an audit trail. Its job is to stop the accident and the
casual "let's just try one real patient" — the thing the risk register names as
the most likely way this project goes wrong.

---

## Not built — and what each one needs

| # | Item | Blocked on | Effort |
|---|---|---|---|
| C01 | BAA — hosting | Vercel Pro + $350/mo add-on, or move. Full costing in `21-compliance-cost.md`. **Decide at the start of Phase C** | Contract + possible migration |
| C02 | BAA — database | Supabase HIPAA add-on, paid plan. Verify current terms | Contract |
| C03 | BAA — file storage | Bundled with C02 | Contract |
| C04–C06 | BAA — SMS, email, error monitoring | Twilio will sign. Verify Resend; fall back to SES | Contract |
| C08 | Audit logging on **reads** | Writes are logged; reads are not. Needs a deliberate access-logging layer | Dev |
| C09 | Column encryption | `photo.storage_path`, `intake_submission.answers`, `checkin.notes_free_text` | Dev |
| C10 | Per-user accounts + staff MFA | Delete the pilot accounts, enable MFA in Supabase Auth | Dev + config |
| C11 | Session timeout | Supabase JWT expiry + an idle timeout in middleware | Config |
| C12 | Break-glass access with justification | A deliberate flow, logged | Dev |
| C13 | Encrypted backups + **tested restore** | Untested backups are not backups | Ops |
| C14 | Retention + deletion policy | Per entity. Photo-consent revocation must actually make a series inaccessible, and that path needs a test | Policy + dev |
| C15 | Security risk assessment, documented | **The Security Rule explicitly requires this.** Not optional | Consultant or thorough self-assessment |
| C16 | Incident response + breach notification runbook | Written, rehearsed | Policy |
| C17 | Staff HIPAA training records | Per person | Ops |
| C18 | Penetration test | Before the first real patient | Vendor |
| C19 | Business continuity / DR plan | Written | Policy |
| C20 | Legal review of the controlled-substance log | Before it becomes a DEA-facing record | Attorney |

### Also outstanding, and easy to overlook

- **Data residency.** The Supabase project is in `ca-central-1`. HIPAA has no
  residency rule, but PHI in Canada pulls in PIPEDA and complicates the BAA
  story for a US practice. The project is empty today, so **moving it now costs
  minutes.**
- **Supabase Auth hardening.** Leaked-password protection and MFA enforcement are
  dashboard settings, not SQL, and are currently off.
- **Storage buckets.** No bucket exists yet. When one does: private, no CDN
  caching, short-TTL signed URLs only. A cached progress photo is a copy of PHI
  outside the BAA, and cache invalidation is not deletion. `16-media-pipeline.md`.
- **Backups of the audit log** need the same retention treatment as the log.
- **Subprocessor inventory.** A list of every vendor touching PHI, with its BAA
  status, is something an auditor will ask for on day one.

---

## The Phase C sequence

Order matters. Doing these out of order wastes money.

1. **Decide the host.** Everything else gets built on it, so migrate *before*
   building if you are going to. Costed in `21-compliance-cost.md`.
2. **Start every BAA on day one.** Vendors are slow. Build while you wait.
3. **Move the database region** if it is moving. Cheapest while empty.
4. Enable read audit logging; add column encryption.
5. Per-user accounts, MFA, session timeout, break-glass.
6. Retention and deletion policy, then implement it — including photo-consent
   revocation.
7. Security risk assessment, documented.
8. Penetration test.
9. **Purge every synthetic record. Remove `PILOT_MODE`. Verify by querying for
   `synthetic = true` and getting zero rows.**
10. Training, runbook, sign-off.

Only then does a real name enter the system.

---

## Questions an auditor will ask, and where the answer lives

| Question | Answer |
|---|---|
| Who can see this patient's record? | RLS policies in `0001`–`0005`, proved by `db-test.cjs` |
| Who *did* see it? | `audit_log` — writes today, reads at C08 |
| Can one practice see another's data? | No. Tested by deliberate attempt |
| Where does PHI leave your systems? | Nowhere yet. `lib/phi` is the only egress path and it is allowlisted |
| What does the payment processor know? | An amount, an opaque id, a neutral descriptor. Enforced twice |
| What does a lock-screen notification say? | That something needs attention. Never what |
| How do you know? | `scripts/db-test.cjs`, `auth-test.cjs`, `app-test.cjs` — 72 checks |
| What is deferred, and why? | `09-compliance-register.md`, with a trigger against each row |

That last row is the one that matters. A deferred control that is *written down
with its trigger* is a decision. The same control undocumented is negligence, and
the penalty tiers treat those very differently.
