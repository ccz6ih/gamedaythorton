# 19 — Environment, Database & Deployment

How to run this, how to deploy it, and what has to be set where.

---

## Quick start

```bash
npm install
cp .env.example .env.local          # then fill it in, see below
node scripts/db-connect-test.cjs    # which Postgres route works from here
npm run db:migrate                  # apply supabase/migrations/*.sql
npm run db:seed                     # both synthetic tenants
node scripts/db-users.cjs           # pilot sign-in accounts
npm run dev                         # http://localhost:3000
```

Then sign in with any account listed on the sign-in page. The password is your
`PILOT_DEMO_PASSWORD`.

The Phase A prototype is at `/prototype/index.html` and needs no backend at all.

---

## Verify everything

```bash
npm run verify        # fixtures + prototype smoke + typecheck
npm run test:db       # 35 database control checks (throwaway tenants, rolled back)
npm run test:auth     # 16 sign-in + RLS checks through the real API
npm run test:app      # 21 HTTP checks (needs a running server)
```

`test:db` and `test:auth` are the ones that matter most. They prove the
compliance controls hold rather than assuming the SQL looked right — including a
deliberate cross-tenant read attempt, which `06-architecture.md` requires.

---

## The environment variables

### Required everywhere

| Variable | What it does |
|---|---|
| `PILOT_MODE` | The master switch. `true` keeps the banner on, keeps Stripe on test keys, makes the webhook acknowledge without applying, and keeps the database refusing non-synthetic patient rows |
| `PILOT_PASSCODE` | Shared passcode gating the deployment. **Required while `PILOT_MODE=true`** — see below |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key. Safe in the browser; RLS is what protects data |

**`PILOT_PASSCODE` fails closed.** If it is missing while `PILOT_MODE=true`, the
middleware returns 503 on every route rather than skipping the gate. An unset
control must not read as "no control needed" — that is the failure mode where a
pre-compliance clinical app ends up publicly browsable because one hosting
setting was forgotten.

### Scripts only — never needed by the app

| Variable | Used by |
|---|---|
| `SUPABASE_PROJECT_REF` | every `scripts/db-*.cjs` |
| `SUPABASE_DB_PASSWORD` | migrate, seed, users, tests |
| `SUPABASE_DB_HOST` / `_PORT` / `_USER` | optional overrides when the direct host is unreachable |
| `PILOT_DEMO_PASSWORD` | `db-users.cjs`, `auth-test.cjs`. Minimum 12 characters |
| `SUPABASE_SERVICE_ROLE_KEY` | nothing yet. Nothing in the request path may use it |

### Payments

| Variable | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | **`sk_test_…` only.** `lib/stripe.ts` refuses to initialise with a live key while `PILOT_MODE` is on |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | Without it the webhook returns 503 rather than trusting an unsigned request |

Payments are optional. With no Stripe keys the app runs; checkout is simply not
available.

### Deliberately absent

**No SMS or email credentials.** `PILOT_MODE` logs every message instead of
sending it. Adding real credentials to a build with no BAAs in place would make
the first accidental send a reportable event. Twilio and Resend (or SES) get
wired in Phase B behind the same flag, and only get real BAAs in Phase C.

---

## Deploying to Vercel

The repo is connected to Vercel and builds on push to `main`.

### `vercel.json` — why `framework` is declared there

This project was imported into Vercel **before** `package.json` existed, so its Framework
Preset was `null`. Once the Next.js app landed, Vercel kept using a generic build: it
emitted `middleware.js` as ESM but loaded it as CommonJS, and every request died with

```
SyntaxError: Cannot use import statement outside a module
500 MIDDLEWARE_INVOCATION_FAILED
```

Declaring `"framework": "nextjs"` in `vercel.json` fixes it in the repository rather than
in the dashboard, so it survives a re-import or a recreated project.

**`vercel.json` rejects unknown top-level keys.** A `"//"` pseudo-comment — a common
trick in other JSON configs — fails schema validation, and the deployment then fails
*before* building with state `ERROR` and **no build logs at all**. Empty build logs on a
failed deployment almost always mean invalid `vercel.json` rather than a broken build.
That is why this explanation lives here and not in the file.

**Set these in Vercel → Settings → Environment Variables** (Production and
Preview both). Until they are set, every route returns a 503 that names what is
missing — which is the intended behaviour, not a failure:

```
PILOT_MODE                      true
PILOT_PASSCODE                  <something long; change before sharing>
NEXT_PUBLIC_SUPABASE_URL        https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   sb_publishable_...
```

Optional, once payments are wanted:

```
STRIPE_SECRET_KEY                    sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   pk_test_...
STRIPE_WEBHOOK_SECRET                whsec_...
```

Do **not** put `SUPABASE_DB_PASSWORD` in Vercel. The app never connects to
Postgres directly; only the local scripts do.

The build runs `scripts/copy-prototype.cjs` first, which publishes the Phase A
prototype to `/prototype/`. `public/prototype/` is gitignored because it is build
output.

### What Vercel is not yet

Vercel offers a BAA as a self-serve **$350/mo add-on on Pro** (it needed an
Enterprise contract before 2025). **This deployment does not have one**, which is
exactly why no real patient data may reach it.

The larger cost is Supabase, whose HIPAA floor is the Team plan at $599/mo plus an
unpublished add-on. Full costing against AWS, Render and Aptible is in
`21-compliance-cost.md`. Decide at the *start* of Phase C, not the end.

---

## The database

### Migrations

Files in `supabase/migrations/`, applied in filename order, tracked by SHA in
`app.migration`, one transaction each.

```bash
npm run db:migrate              # apply anything pending
node scripts/db-migrate.cjs --status
node scripts/db-migrate.cjs --reset     # guarded, see below
```

**Migrations are append-only.** If you edit a file that has already been applied,
the runner warns and skips it. Add a new file instead. `0007` and `0008` exist
because of exactly this rule.

**`--reset` refuses to run** if any patient row is not marked synthetic, or if any
clinic has `pilot_mode = false`. Both mean real patient data might be present, at
which point a destructive reset is a data-loss incident rather than a dev
convenience. `--force` overrides it, deliberately awkwardly.

### Connecting

Supabase's direct host (`db.<ref>.supabase.co`) is IPv6-only on projects created
after early 2024, so it silently fails on plenty of Windows networks. The pooler
hostname varies by region. Guessing wrong looks exactly like a wrong password,
which is an easy hour to lose:

```bash
node scripts/db-connect-test.cjs
```

It tries the direct host and four pooler shapes and prints the one that works.

### Seeding

```bash
npm run db:seed             # idempotent
node scripts/db-seed.cjs --wipe   # remove both tenants first
```

Fixture keys hash to stable UUIDv5 values, so re-running updates rows in place.
Dates shift forward by whole weeks at seed time so the data is always "this week"
while weekday alignment survives — which matters because The Med Bar is only open
Monday, Wednesday and Friday.

### Region

The project is currently in **`ca-central-1`**. For a US practice that is worth
revisiting: HIPAA imposes no data-residency requirement, but PHI held in Canada
pulls in PIPEDA and complicates the BAA story. **Moving an empty project costs
minutes; migrating a live one with PHI in it does not.** See `18-decisions.md`.

---

## Pilot sign-in accounts

```bash
node scripts/db-users.cjs            # create / reset passwords
node scripts/db-users.cjs --delete   # before Phase C
```

Magic links remain the production design (`04-feature-backlog.md` P03). These
password accounts exist because a pilot has to be usable on a clinic iPad without
waiting on an inbox. They are ordinary Supabase accounts using the same bcrypt
hashing GoTrue uses, not a bypass.

**They must not survive Phase C.** Shared credentials are on the deferred list
(`09-compliance-register.md` C10). Before a real patient exists: delete them,
require per-user accounts, turn on MFA for staff.

### One trap worth knowing

`auth.users` has four nullable token columns — `confirmation_token`,
`recovery_token`, `email_change`, `email_change_token_new` — with no defaults.
GoTrue scans them into Go strings rather than pointers, so a row with NULLs there
makes every sign-in fail with **"Database error querying schema"**, which looks
exactly like a wrong password. They must be empty strings.

---

## Project layout

```
app/                    Next.js App Router
  console/              staff console (staff only, enforced in middleware)
  portal/               patient / client side (patients only)
  gate/                 the pilot passcode
  sign-in/
  about-pilot/          the compliance explainer, never behind a login
  api/stripe/webhook/
components/             Brand, PilotBanner, PilotAccountPicker
lib/
  supabase/             server + browser clients, viewer resolution
  db/queries.ts         every derived metric, defined once
  phi/                  the serialiser allowlist
  stripe.ts             payments, test-key guard
  format.ts             display helpers, mirrors the prototype's GD.fmt
middleware.ts           gate, session, role separation, fail-closed config check
supabase/migrations/    0001-0008
prototype/              Phase A prototype. Its CSS is the design system
scripts/                generators, migrations, seeds, tests
```

### One copy of the design system

`app/layout.tsx` imports `prototype/assets/tokens.css` and `app.css` directly
rather than copying them into `styles/`. The prototype and the production app
cannot drift apart, and rebranding stays a token swap. `15-branding.md`.

---

## Common failures

| Symptom | Cause |
|---|---|
| Every route returns 503 naming a variable | That variable is not set. Intended behaviour |
| "Database error querying schema" on sign-in | NULL token columns in `auth.users`. Re-run `db-users.cjs` |
| Seed fails on `appointment_no_double_book` | Fixtures contain overlapping appointments for one provider. Fix the generator, not the seeder |
| "record new has no field synthetic" | A table carries the pilot guard but lacks the column. `0007` asserts against this |
| "PILOT MODE: … not marked synthetic" | Working as designed. Set `synthetic = true`, or ask why real data is being inserted |
| "PHI leak blocked in payment.descriptor" | Working as designed. Use `paymentDescriptor()` from `lib/phi` |
| Stripe refuses to initialise | A live key with `PILOT_MODE=true`. Use a test key |
| `npm run build` fails on the Stripe API version | The `stripe` package was upgraded. Read its changelog, then update the pinned version in `lib/stripe.ts` |
