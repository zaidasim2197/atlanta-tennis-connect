# Baseline ATL Operational Demo — System Audit

**Date of Audit:** September 24, 2026  
**Auditor:** Antigravity (Senior Full-Stack Engineer)  
**Branch:** `backend/staging-load-test-v1`  
**Target Environment:** Local / Staging / Vercel Serverless  

---

## 1. Repository Layout & Architecture

The codebase is organized as a unified full-stack monorepo with dual execution capabilities:

```
atlanta-tennis-platform/
├── api/                       # Vercel Serverless Function entry points (root deployment)
│   ├── _lib/handler.ts        # Shared bootstrap: connects DB & invokes backend Express app
│   ├── auth.ts, leagues.ts    # Re-exported function wrappers
│   ├── players.ts, payments.ts
│   └── registrations.ts
├── backend/                   # Standalone Express API service (used locally and for load testing)
│   ├── api/index.ts           # Standalone Vercel entrypoint
│   ├── scripts/               # Seed scripts, benchmarks, verification tools
│   │   ├── seed.ts            # DESTRUCTIVE load-test seed script (DO NOT RUN)
│   │   ├── seed-demo-users.ts # Demo user provisioner
│   │   └── verify-seed.ts     # Count & security verification script
│   └── src/
│       ├── jobs/              # expireReservations, reconcilePayments
│       ├── lib/               # db.ts, auth.ts, reservationService.ts, apiResponse.ts
│       ├── models/            # Mongoose models (Player, League, Season, Reservation, etc.)
│       ├── payment/           # PaymentProvider abstraction (stripeProvider, mockProvider)
│       ├── routes/            # auth.ts, leagues.ts, registrations.ts, players.ts, payments.ts
│       └── server.ts          # Express application entrypoint
├── src/                       # Frontend application (TanStack Start / React 19 / Vite)
│   ├── components/            # UI components (Radix primitives, Lucide icons, Recharts)
│   ├── lib/                   # store.tsx (state & fallback), tennis.ts (domain types)
│   └── routes/                # TanStack Router file-based pages
└── tests/                     # Vitest test suite (browse-leagues, auth-store, signup)
```

---

## 2. Models, Enums, and Database Indexes

Inspection of the active MongoDB database collections and schemas revealed the following:

### 2.1 `Player` (`src/models/Player.ts`)
* **Fields:** `slug` (unique String), `firstName`, `lastName`, `email` (unique, lowercase), `phone`, `ntrp` (enum: `["2.5","3.0","3.5","4.0","4.5","5.0"]`), `city`, `zipCode` (default `"30309"`), `preferredCourt`, `preferredFormat`, `dateOfBirth`, `parentName`, `parentPhone`, `isJunior` (Boolean), `accountStatus` (enum: `["active","suspended","closed"]`), `profileStatus` (enum: `["incomplete","complete","needs-review"]`), `rating` (Number), `profileBio`, `preferredSide` (enum: `["deuce","ad","both"]`).
* **Active Indexes:**
  * `_id_`
  * `slug_1` (unique)
  * `email_1` (unique)

### 2.2 `League` (`src/models/League.ts`)
* **Fields:** `slug` (unique String), `seasonSlug`, `name`, `format` (enum: `["men-singles","women-singles","men-doubles","mixed-doubles"]`), `skillLevel` (enum: `["2.5","3.0","3.5","4.0","4.5","5.0"]`), `feeCents`, `scheduleDay`, `scheduleTime`, `venue`, `playerLimit`, `spotsRemaining`, `registrationOpen`, `description`, `startDate`, `endDate`.
* **Active Indexes:**
  * `_id_`
  * `slug_1` (unique)
  * `seasonSlug_1`
  * `registrationOpen_1_skillLevel_1_format_1`
  * `zipCode_1`

### 2.3 `Season` (`src/models/Season.ts`)
* **Fields:** `slug` (unique String), `name`, `startDate`, `endDate`, `status` (enum: `["upcoming","active","closed"]`).
* **Active Indexes:**
  * `_id_`
  * `slug_1` (unique)

### 2.4 `Reservation` (`src/models/Reservation.ts`)
* **Fields:** `leagueSlug`, `playerSlug`, `playerEmail`, `partnerSlug` (optional), `status` (enum: `["held","payment_pending","paid","registered","failed","expired","cancelled","refunded","disputed"]`), `amountCents`, `paymentProvider` (enum: `["stripe","mock"]`), `paymentIntentId`, `idempotencyKey` (unique), `heldAt`, `expiresAt`, `paidAt`, `cancelledAt`, `flaggedForReview`, `reviewReason`, `lastWebhookEventId`, `webhookEventIds`.
* **Active Indexes:**
  * `_id_`
  * `leagueSlug_1`
  * `playerSlug_1`
  * `status_1`
  * `paymentIntentId_1` (sparse)
  * `idempotencyKey_1` (unique)
  * `expiresAt_1` (Standard B-tree index, NOT a TTL index)
  * `leagueSlug_1_playerEmail_1` (partial filter for active statuses `["held","payment_pending","paid","registered"]`)
  * `flaggedForReview_1`
* **TTL Assessment:** The `expiresAt_1` index in `reservations` is a standard index without `expireAfterSeconds`. MongoDB is NOT dropping reservations asynchronously via background TTL. However, `AuthSession` and `AuthAttempt` collections DO have TTL indexes (`expiresAt_1` with `expireAfterSeconds: 0`). Furthermore, the background job `expireReservations()` explicitly queries documents where `status in ["held", "payment_pending"]` and `expiresAt <= now` and marks them expired.

### 2.5 `TournamentHistory` (`src/models/TournamentHistory.ts`)
* **Fields:** `playerSlug`, `playerEmail`, `playerName`, `tournamentName`, `seasonSlug`, `division`, `skillLevel`, `year`, `finish` (enum: `["champion","finalist","semifinalist","quarterfinalist"]`), `trophyAwarded`, `partnerName`, `notes`.
* **Active Indexes:**
  * `_id_`, `playerSlug_1`, `playerEmail_1`, `seasonSlug_1`, `year_1`, `finish_1`
  * Compound: `playerEmail_1_year_-1_division_1`
  * Compound: `finish_1_division_1_year_-1`

### 2.6 `AuditLog` (`src/models/AuditLog.ts`)
* **Fields:** `reservationId` (ObjectId), `leagueSlug`, `playerEmail`, `action`, `actor` (enum: `["player","system","admin","webhook"]`), `meta` (Mixed).
* **Active Indexes:** `reservationId_1`, `leagueSlug_1`.

### 2.7 `Account` & `AuthSession` (`src/models/Auth.ts`)
* Used for real cookie session authentication (`/api/auth/*`).
* `Account`: `email`, `playerSlug`, `passwordHash` (scrypt), `role` (`"player"` | `"organizer"`), `disabled`.
* `AuthSession`: `tokenHash`, `accountId`, `expiresAt` (TTL index).

---

## 3. Existing Routes & Authentication Mechanism

| Endpoint | Method | Middleware / Auth | Purpose |
|---|---|---|---|
| `/api/auth/signup` | POST | `limitAuth` | Creates Account + Player + sets session cookie |
| `/api/auth/login` | POST | `limitAuth` | Verifies scrypt hash + sets session cookie |
| `/api/auth/me` | GET | `requireAuth` | Returns identity of active session cookie (401 if unauthenticated) |
| `/api/auth/logout` | POST | None | Clears session cookie and deletes session doc |
| `/api/leagues` | GET | None (public) | Lists leagues with `spotsRemaining` and season info |
| `/api/leagues/:id` | GET | None (public) | Single league details |
| `/api/players` | POST | `requireAuth` + `ownsEmail` | Updates player profile for active user |
| `/api/players/:email`| GET | `requireAuth` (`ownsEmail` or organizer) | Player profile lookup |
| `/api/registrations` | POST | `requireAuth` + `ownsEmail` | Creates spot hold / reservation |
| `/api/registrations` | GET | `requireAuth` (all if organizer, self if player) | List active registrations |
| `/api/registrations/admin` | POST | `requireOrganizer` (cookie role) | Manual administrative registration |
| `/api/payments/:id/checkout`| POST | `requireAuth` + `requireReservationOwner` | Resumes mock/Stripe checkout |
| `/api/payments/webhook` | POST | Raw body + signature check | Webhook processor |

### The `x-admin-key` Header Status
In older versions of the codebase, `POST /api/registrations/admin` checked `req.headers["x-admin-key"] === process.env.ADMIN_KEY`. In the recent commit on `backend/staging-load-test-v1`, `POST /api/registrations/admin` was refactored to use `requireOrganizer` (checking `req.identity?.role === "organizer"` via session cookie). However, `ADMIN_KEY` remains configured in environment variables and can be leveraged for dedicated read-only administrative reporting endpoints.

---

## 4. Frontend Store, API Calls, & LocalStorage Behavior

* **API URL resolution (`src/lib/store.tsx`):**
  `getApiUrl(path)` returns relative paths (e.g. `/api/leagues`). In local Vite development, requests are proxied; in production on Vercel, requests hit the same-origin serverless endpoints (`https://atlanta-tennis.vercel.app/api/...`), avoiding cross-domain cookies and CORS preflights.
* **Storage Sync (`src/lib/store.tsx`):**
  Hydrates from `localStorage.getItem("atl-tennis-league-state-v6")`. If the backend is reachable, `fetchDbData` overrides in-memory league state with live data from `GET /api/leagues`.
* **Fallback Behavior:**
  If `fetch(/api/leagues)` throws or fails, `store.tsx` sets `fallbackActive: true`, displaying mock data from `src/lib/tennis.ts` (`FALLBACK_MOCK_LEAGUES`, etc.) and warning in the console.

---

## 5. Audit of Known Problems (Section 2 Verification)

| Problem Reported | Confirmed? | Code Evidence |
|---|---|---|
| 1. `Math.random()` used for ratings | **CONFIRMED** | `seed.ts` line 189: `rating = Math.round((baseRating + (Math.random() * 0.4 - 0.2)) * 100) / 100;` |
| 2. Only 50 unique names repeated 10x | **CONFIRMED** | `seed.ts` lines 184-186: `FIRST_NAMES[i % 50]` and `LAST_NAMES[i % 50]`. |
| 3. NTRP & ZIP mechanically tied | **CONFIRMED** | `seed.ts` lines 187-194: `NTRP_LEVELS[i % 6]` and `ATLANTA_ZIPS[i % 10]`. |
| 4. Fictional phone numbers violate standard | **CONFIRMED** | `seed.ts` line 200: `(404) 555-${1000 + (i % 9000)}` (only 0100–0199 is safe). |
| 5. History references non-existent seasons & duplicate champions | **CONFIRMED** | `seed.ts` lines 215-220 reference `s-spring-25`, `s-summer-25`, `s-fall-25`, which are not in the `SEASONS` list. |
| 6. Fall 2026 active but starts after current date | **CONFIRMED** | `SEASONS` has `startDate: "2026-10-06"`, but status is `"active"`. |
| 7. Seeded registrations have `expiresAt` in the past | **CONFIRMED** | `seed.ts` line 349: `expiresAt = heldAt + 15 min`, so any historical registration already has an expired timestamp. |
| 8. Senior & junior singles formats mixed | **CONFIRMED** | `LEAGUES` contains `senior-singles` and `junior-singles`. |
| 9. `l-hot` load test fixture | **CONFIRMED** | `seed.ts` lines 135-151 contains `l-hot` with 3 spots remaining. Must remain untouched. |

---

## 6. Existing Collections and Concepts

* **`AuditLog`:** Exists (`models/AuditLog.ts`). Tracks reservation state transitions.
* **`TournamentHistory`:** Exists (`models/TournamentHistory.ts`). Stores historical event records.
* **`Division` / `Fixture` / `Team`:**
  * No dedicated Mongoose models exist for `Division` or `Team`.
  * A legacy collection named `schedules` exists in MongoDB with raw knockout bracket trees, but no clean relational model exists for regular season round-robin fixtures.
  * Adding an additive, optional `Division` and `Fixture` collection is recommended.
* **Doubles Partner in Reservation:**
  `Reservation.ts` currently has `partnerSlug?: string`. It can hold a reference to a doubles partner's player slug.

---

## 7. UI Kit & Reusable Elements

The frontend is built with:
* Tailwind CSS v4 + Radix UI primitives (`@radix-ui/react-dialog`, `select`, `tabs`, `progress`, etc.)
* Lucide React icons
* Recharts (`recharts` 2.15.4) installed and functional for data visualization
* Sonner for toast notifications
* Existing components: `DemoBanner`, `TennisBall`, `SiteHeader`, `SiteFooter`, Radix tables and cards.
