# Atlanta Tennis Connect – Backend

Real Express/MongoDB backend for the Atlanta Tennis Connect platform.  
Lives on branch `backend/staging-load-test-v1` inside the frontend repo.  
Deployed as Vercel serverless functions under `/api/*`.

---

## Architecture

```
atlanta-tennis-connect/
├── api/                        Vercel serverless function handlers
│   ├── _lib/handler.ts         DB bootstrap + Express delegation
│   ├── health.ts
│   ├── leagues.ts
│   ├── registrations.ts
│   ├── payments.ts
│   ├── players.ts
│   └── cron/
│       ├── expire.ts           Runs every 2 min – expires stale reservations
│       └── reconcile.ts        Runs every 5 min – reconciles missed webhooks
├── backend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── db.ts           Cached mongoose connection (serverless-safe)
│   │   │   ├── apiResponse.ts  ok() / err() / wrap() helpers
│   │   │   └── reservationService.ts  All reservation + payment logic
│   │   ├── models/
│   │   │   ├── Season.ts
│   │   │   ├── League.ts       spotsRemaining field – atomically decremented
│   │   │   ├── Player.ts
│   │   │   ├── Reservation.ts  Full state machine (held → registered / expired)
│   │   │   └── AuditLog.ts     Append-only audit trail
│   │   ├── payment/
│   │   │   ├── types.ts        PaymentProvider interface + state machine types
│   │   │   ├── stripeProvider.ts  Real Stripe SDK adapter
│   │   │   ├── mockProvider.ts    Instant deterministic adapter for load tests
│   │   │   └── index.ts        Factory – reads PAYMENT_PROVIDER env at runtime
│   │   ├── routes/
│   │   │   ├── leagues.ts
│   │   │   ├── registrations.ts
│   │   │   ├── payments.ts
│   │   │   └── players.ts
│   │   ├── jobs/
│   │   │   ├── expireReservations.ts
│   │   │   └── reconcilePayments.ts
│   │   └── server.ts           Express app (also entry point for local dev)
│   └── scripts/
│       └── seed.ts             Safe-to-rerun seed script
├── tests/load/
│   ├── config.js               Shared k6 config, helpers, thresholds
│   ├── browse.js               70 % traffic – browse leagues + detail
│   ├── register.js             20 % traffic – full registration flow
│   ├── race.js                 10 % traffic – race for the 3-spot hot league
│   ├── full-scenario.js        Combined scenario for all six concurrency levels
│   └── run-all-levels.sh       Shell script – reseed + run all 6 levels
└── vercel.json                 Route rewrites + cron schedule
```

---

## Database

- **Cluster**: Same MongoDB Atlas cluster as the Stripe PoC  
- **Database**: `atlanta-tennis` (isolated from the Stripe PoC's database)  
- **Never** point `MONGODB_URI` at the Stripe PoC database name

---

## Local setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env – paste the real MONGODB_URI and set PAYMENT_PROVIDER=mock
```

### 3. Seed the database

```bash
npm run seed
```

Output confirms:
- 500 players created
- 5 leagues seeded (l-1 through l-4 at ~70 % capacity, **l-hot with exactly 3 spots**)
- Safe to rerun at any time – wipes and rebuilds from scratch

### 4. Start the server

```bash
npm run dev
# API available at http://localhost:3001
```

### 5. Verify

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/leagues
curl http://localhost:3001/api/leagues/l-hot
```

---

## API Reference

All responses follow `{ ok: true, data: … }` or `{ ok: false, error: "…" }`.

### Leagues

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/leagues` | List all leagues. Query: `format`, `skillLevel`, `open`, `season` |
| GET | `/api/leagues/:leagueId` | Single league with season info and `spotsRemaining` |

### Registrations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/registrations` | Atomically reserve a slot + initiate payment. Body: `{ leagueId, playerEmail, partnerEmail? }` |
| GET | `/api/registrations?email=` | Active reservations for a player |
| POST | `/api/registrations/admin` | Admin manual registration (same logic). Header: `x-admin-key` |

### Payments

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/payments/webhook` | Stripe or mock webhook endpoint. Raw body required |
| GET | `/api/payments/status/:reservationId` | Poll reservation payment state |

### Players

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/players` | Create or upsert player. Body: `{ firstName, lastName, email, phone?, ntrp, city? }` |
| GET | `/api/players/:email` | Look up player by email |

---

## Reservation state machine

```
                   ┌─────────────────────────┐
                   │  spotsRemaining > 0      │
                   │  (slot available)        │
                   └───────────┬─────────────┘
                               │ POST /api/registrations
                               │ findOneAndUpdate $gt:0
                               ▼
                           ┌────────┐
                           │  held  │ ◄── TTL starts (default 15 min)
                           └───┬────┘
                               │ createPayment()
                               ▼
                     ┌──────────────────┐
                     │ payment_pending  │
                     └────────┬─────────┘
             ┌────────────────┼────────────────┐
             │ webhook: paid  │                │ webhook: failed / TTL expires
             ▼                │                ▼
         ┌────────┐           │          ┌─────────┐  ┌─────────┐
         │  paid  │           │          │ failed  │  │ expired │
         └───┬────┘           │          └────┬────┘  └────┬────┘
             │                │               │            │
             ▼                │               └────────────┘
      ┌────────────┐          │           slot restored via $inc +1
      │ registered │          │
      └────────────┘          │
             │                │
    ┌────────┴────────┐       │
    │ refunded │ disputed │   │
    └──────────┴──────────┘   │
```

**Oversell guarantee**: the `$gt:0` guard in `findOneAndUpdate` means only one writer
can decrement the last slot. All concurrent losers receive HTTP 409.

---

## Load testing

### Prerequisites

Install k6: https://k6.io/docs/getting-started/installation/

### Running a single level

```bash
# Always reseed before each run
npm run seed

# Run at 25 VUs (replace with 50, 75, 100, 150, 500)
k6 run \
  -e BASE_URL=http://localhost:3001 \
  -e VUS=25 \
  tests/load/full-scenario.js
```

### Running all six levels automatically

```bash
cd backend
BASE_URL=http://localhost:3001 bash tests/load/run-all-levels.sh
```

Results are written to `tests/load/results/summary-vus-<N>.json`.

### Traffic mix per run

| Scenario | VUs (%) | What it tests |
|----------|---------|---------------|
| Browse | 70 % | `GET /api/leagues`, `GET /api/leagues/:id` |
| Register | 20 % | `POST /api/registrations` → `GET /api/payments/status` |
| Race | 10 % | All VUs target `l-hot` (3 spots) simultaneously |

### Concurrency levels

| Level | Total VUs | Browse | Register | Race |
|-------|-----------|--------|----------|------|
| 1     | 25        | 17     | 5        | 3    |
| 2     | 50        | 35     | 10       | 5    |
| 3     | 75        | 52     | 15       | 8    |
| 4     | 100       | 70     | 20       | 10   |
| 5     | 150       | 105    | 30       | 15   |
| 6     | 500       | 350    | 100      | 50   |

### What to record for every level

| Metric | Where in k6 output |
|--------|--------------------|
| Total requests | `http_reqs` count |
| Successful requests | `http_reqs` count × (1 − `http_req_failed` rate) |
| Failed requests | `http_req_failed` count |
| Error rate | `http_req_failed` rate |
| p95 response time | `http_req_duration` p(95) |
| DB / connection errors | server logs |
| Oversold (must = 0) | `race_oversold` counter |
| Duplicate registrations (must = 0) | `duplicate_registration` counter |
| Infrastructure used | Vercel region, Atlas tier, pool size |

### Payment adapter during load tests

`PAYMENT_PROVIDER` **must be set to `mock`** for all load test runs.  
The real Stripe sandbox must never receive synthetic concurrent traffic.  
The existing Stripe correctness tests (duplicate payment, webhook replay, 3D Secure)
remain unchanged in the Stripe PoC repository and are not part of these runs.

---

## Deploying to Vercel staging

```bash
# Install Vercel CLI if needed
npm i -g vercel

# From the repo root (not /backend)
vercel --env MONGODB_URI="<atlas-uri>/atlanta-tennis" \
       --env PAYMENT_PROVIDER=mock \
       --env CRON_SECRET=<secret> \
       --env ADMIN_KEY=<secret> \
       --env NODE_ENV=production

# Point load tests at the staging URL
BASE_URL=https://your-project.vercel.app bash backend/tests/load/run-all-levels.sh
```

**Important**: deploy to a separate Vercel project (not the frontend's production project)
so load testing cannot affect live users.

---

## Background jobs (cron)

| Job | Schedule | What it does |
|-----|----------|--------------|
| `/api/cron/expire` | Every 2 min | Expires `held`/`payment_pending` reservations past their TTL; restores slots |
| `/api/cron/reconcile` | Every 5 min | Polls Stripe for any `payment_pending` reservations whose webhook was missed (no-op when `PAYMENT_PROVIDER=mock`) |

Both jobs are secured by `CRON_SECRET` (Vercel passes it as `Authorization: Bearer <secret>`).

---

## Out of scope (per spec)

The following are intentionally not built here:

- Player match history or standings
- Division eligibility rules or geographic matching  
- Full RBAC (role-based access control)
- Email / push notifications
- Player-facing profile management API

These remain business workshop items for a later phase.
