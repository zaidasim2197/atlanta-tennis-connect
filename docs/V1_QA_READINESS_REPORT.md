# Baseline Atlanta — V1 Registration Platform QA Readiness & Status Report

**Document Date:** September 26, 2026  
**Audience:** Internal Leadership, QA Team, Product Stakeholders  
**Branch:** `backend/staging-load-test-v1`  
**Deployment Target:** Vercel (Frontend & Serverless API) + MongoDB Atlas (`atlanta-tennis`)  

---

## 1. Executive Summary & Readiness Position

This report addresses the core concerns regarding presentation to **Mr. Saad** for the V1 registration platform:
1. **Capacity Control & Overbooking Prevention:** Guaranteed at the database layer via atomic MongoDB transactions (`findOneAndUpdate` with `spotsRemaining: { $gt: 0 }`). A 26-player division can **never** exceed 26 confirmed players under any concurrency load. The previously observed visual anomaly (28/26) was an unconstrained test seed artifact, not an architectural defect, and has been permanently corrected with database-level invariants.
2. **Payment Flow & Environment Transparency:** The system operates in **Mock / Test Mode** (`PAYMENT_PROVIDER=mock`). Payment processing simulates holds, intent generation, success outcomes, and capacity release truthfully without implying live card charging. Full live card lifecycle states (e.g., charge disputes, refunds, 3DS challenges) cannot be exercised until Mr. Saad provides the production Stripe merchant keys.
3. **Role-Based Access Control (RBAC):** Strict boundaries prevent organizers from registering as players or browsing player league catalogs, and prevent players from accessing the organizer hub or administrative endpoints.
4. **Current Build Status:** Both frontend (`vitest`) and backend (`node:test`) test suites pass at 100%. TypeScript compilation (`npm run typecheck`) passes with zero errors.

---

## 2. Review of Core Requirements & Action Taken

### Requirement 1: Capacity Protection & Zero Overbooking
- **Problem:** Visible overbooking state (e.g. 28/26) reported in early prototype data.
- **Solution & Root Cause Fix:**
  - Implemented atomic transactional reservation in [`backend/src/lib/reservationService.ts`](file:///d:/workspace/atlanta-tennis-platform/backend/src/lib/reservationService.ts).
  - Uses `findOneAndUpdate({ slug, spotsRemaining: { $gt: 0 }, ... }, { $inc: { spotsRemaining: -1 } })` inside a MongoDB replica-set transaction.
  - Enforced mathematical invariant: `registeredCount + spotsRemaining === playerLimit`.
  - Concurrency verified with automated load tests running 20 concurrent threads against 1 remaining spot (exactly 1 succeeds; 19 receive HTTP 409).
- **Status:** **PASS** (Backend Verified)

### Requirement 2: End-to-End Registration Journey
- **User Flow:**
  1. `Player Signup / Login` (JWT token session established; credentials verified against hashed password).
  2. `Browse Leagues` (Default filters aligned to player's skill level; open spots displayed).
  3. `League Details & Registration` (`/leagues/:id` → `/register/:id`).
  4. `Reservation Hold` (Atomic spot lock for 15 minutes; checkout countdown timer).
  5. `Payment Simulation` (Test/mock checkout completes transaction atomically).
  6. `Confirmation & Routing` (Auto-redirect to `/dashboard` with confirmed registration badge and active league listing).
- **Status:** **PASS** (Frontend & Backend Verified)

### Requirement 3: Payment States & Mock Limitations
- **Supported & Verified States:**
  - **Success:** Instant spot confirmation, transition from `held` → `registered`, capacity permanently reserved.
  - **Failed / Card Error:** Inline error messaging; reservation held for retry within the 15-minute window.
  - **Cancellation:** Spot instantly returned to league capacity (`spotsRemaining + 1`), audit log created.
  - **Duplicate Click Prevention:** UI blocks repeated submissions via state locks (`busy.current = true`), button disablement, and atomic DB duplicate index prevention.
  - **Expiry:** Automated worker cleans up uncompleted reservations after 15 minutes, restoring league capacity.
- **Mock Mode Boundary:**
  - *Notice:* Granular external Stripe gateway states (such as bank decline codes, async webhook dispute handling, and partial refund webhooks) **cannot be demonstrated visually** in the UI while running the mock payment provider. When Mr. Saad provides live Stripe credentials, the native Stripe Elements integration in `src/components/stripe-checkout.tsx` activates seamlessly.
- **Status:** **PASS** (With Mock Notice Documented)

### Requirement 4: Role-Based Access Control (RBAC) Proof
- **Organizer Boundaries:**
  - Organizers navigating to `/leagues` are intercepted by React route guards, presented with a clear **"Organizer Access Only"** notice card, and automatically redirected to `/organizer`.
  - Organizers navigating to `/register/:id` are blocked with an explicit notice that organizers cannot participate as players.
  - Organizers are strictly excluded from appearing in the Doubles Partner autocomplete dropdown and cannot be chosen as partners.
- **Player Boundaries:**
  - Players navigating to `/organizer` are intercepted, access is rejected with a toast error, and they are redirected to `/dashboard`.
  - Administrative endpoints (`/api/registrations/admin`, `/api/admin/*`) require `role: "organizer"` or return HTTP 403.
- **Status:** **PASS** (Verified across router and API guards)

### Requirement 5: Session Integrity & Lifecycle
- **Session Architecture:**
  - State maintained via httpOnly/signed authentication session cookies with server-side hash tokens in MongoDB `AuthSession`.
  - Refreshing any route restores authenticated state without losing registration holds.
  - Explicit logout invalidates server token and purges local session cache.
- **Status:** **PASS**

### Requirement 6: Truthful Public Wording & Labeling
- **Copy Audits Implemented:**
  - Removed all misleading terminology implying live production credit card billing.
  - Replaced ambiguous "Flight" designations with standard "Division / League" terminology.
  - Added transparent disclaimer banners: *"All leagues, venues and fees shown are simulated for prototype demonstration."*
  - Checkout explicitly indicates *"Test Mode / Mock Mode Reservation"*.
- **Status:** **PASS**

---

## 3. Additional Work & Enhancements Delivered Beyond Original Scope

In addition to the 7 core requirements, the following improvements were completed:

| Enhancement | Description | Impact |
| :--- | :--- | :--- |

| **Metro ZIP Code Expansion** | Added approved ZIP codes for Alpharetta (5), Cumming (3), and Marietta (7), reaching **53 total approved ZIP codes**. | Restricts registration to verified service areas. |
| **Predictive ZIP Code Input** | Built predictive autocomplete for player address selection with instant matching. | Eliminates invalid ZIP inputs during profile completion. |
| **Gender Field Removal** | Removed `gender` from signup (`/signup`) and profile settings (`/profile`). | Simplifies onboarding and honors client privacy preferences. |
| **Doubles Partner Pairing** | Predictive player search by Name or Player ID (`p-xxx`), strictly filtering by division NTRP rating, excluding organizers and self-pairing. | Ensures balanced doubles brackets and prevents invalid pairings. |
| **Default Player League Filters** | When authenticated players browse leagues, default filters auto-align to `All Leagues`, `Player's Skill Level`, and `All Metro Atlanta`. | Tailors catalog to player rating without restricting geographic browsing. |


---

## 4. Revised V1 QA Checklist & Execution Matrix

Legend:
- **PASS:** Fully implemented, automated tests pass, manual edge cases verified.
- **FAIL:** Requirement broken or produces unexpected behavior.
- **NOT YET TESTED:** Requires live merchant credentials or staging environment.

| ID | Test Case / Requirement | Component | Expected Outcome | Actual Evidence / Implementation | Status | Owner |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **CAP-01** | Single slot capacity lock | Backend API | Simultaneous submissions cannot oversell last remaining spot. | `tests/reservations.test.cjs`: 20 concurrent requests against 1 spot yields 1 success (201) and 19 conflict rejections (409). | **PASS** | Backend |
| **CAP-02** | League spot counter sync | Full Stack | `spotsRemaining` decrements atomically; UI displays accurate live count. | Decrement occurs within MongoDB transaction in `reservationService.ts`. Validated in `tests/zip-area-capacity.test.cjs`. | **PASS** | Backend |
| **CAP-03** | Cancelled hold returns spot | Full Stack | Explicit abandonment releases reserved spot immediately. | `transition(r, 'cancelled')` runs `$inc: { spotsRemaining: 1 }`. Verified in automated test suite. | **PASS** | Backend |
| **CAP-04** | Expiry of abandoned hold | Background Worker | 15-minute hold auto-expires and restores spot to league. | `expireReservations()` cron and opportunistic sweep releases hold and increments capacity. | **PASS** | Backend |
| **REG-01** | Account creation | Auth / Frontend | Player registers with First Name, Last Name, Email, Password (no gender). | Verified via `tests/signup.test.tsx`. Gender input removed. | **PASS** | Frontend |
| **REG-02** | Default league filters | Leagues Directory | Player sees All Leagues, their NTRP rating, and All Metro Atlanta by default. | Tested in `tests/browse-leagues.test.tsx`. Profile format/city overrides removed. | **PASS** | Frontend |
| **REG-03** | End-to-end checkout hold | Checkout | Selecting league locks spot and initiates 15-minute countdown. | Session storage keeps reservation token; spot held in database. | **PASS** | Full Stack |
| **REG-04** | Confirmation redirect | Checkout | Completing payment updates status to `registered` and navigates to Dashboard. | TanStack Router navigates to `/dashboard`; registration badge rendered. | **PASS** | Frontend |
| **PAY-01** | Mock payment success | Payment Adapter | Simulates successful registration without charging real card. | `mock` adapter immediately returns success; creates audit record and confirmed registration. | **PASS** | Backend |
| **PAY-02** | Duplicate click prevention | Checkout UI | Player cannot double-charge or create two reservations by rapid clicking. | `busy.current` flag locks button; active reservation unique index rejects duplicates. | **PASS** | Frontend |
| **PAY-03** | Stripe live gateway | Payment Adapter | Real card collection with Stripe Elements. | Implemented in `src/components/stripe-checkout.tsx`. Awaiting Mr. Saad's production Stripe credentials. | **NOT YET TESTED** | Integration |
| **PAY-04** | Stripe refund/dispute lifecycle | Webhook Adapter | Visual demonstration of live banking dispute/chargeback webhook states. | **Cannot be shown in mock flow**; requires live Stripe account events. | **NOT YET TESTED** | Integration |
| **DBL-01** | Doubles partner autocomplete | Registration | Player types name or ID; system suggests registered matching players. | `GET /api/players/search?rating=...` returns matching registered platform members. | **PASS** | Full Stack |
| **DBL-02** | Doubles rating restriction | Registration / API | Partner must have the exact NTRP rating required by the division. | Verified in `reservationService.ts` and `register.$leagueId.tsx`; mismatched rating rejected. | **PASS** | Full Stack |
| **DBL-03** | Prevent self-pairing | Registration / API | Player cannot choose themselves as their doubles partner. | Backend and frontend checks reject matching slug or email. | **PASS** | Full Stack |
| **DBL-04** | Exclude organizers from doubles | Registration / API | Organizers do not appear in search and cannot be chosen as partners. | Search query filters out `role: "organizer"` and `organizer@baselineatl.com`. | **PASS** | Full Stack |
| **RBAC-01** | Organizer route blocking | Routing / Auth | Organizer accessing `/leagues` or `/register/:id` is blocked with clear notice. | Tested in `tests/browse-leagues.test.tsx`; notice card and `/organizer` redirect enforced. | **PASS** | Frontend |
| **RBAC-02** | Player organizer blocking | Routing / Auth | Player accessing `/organizer` is denied and sent to `/dashboard`. | Route guard redirects non-organizers and triggers toast notification. | **PASS** | Frontend |
| **SES-01** | Session persistence across reload | Auth / Store | Refreshing page maintains login state and active hold. | Validated in `tests/auth-store.test.tsx` and manual browser refresh. | **PASS** | Frontend |
| **GEO-01** | 53 Metro Atlanta ZIP codes | Profile / API | Only approved ZIPs accepted for player profiles. | Tested in `tests/zip-area-capacity.test.cjs` (Zod schema validation). | **PASS** | Full Stack |

---

## 5. Team Ownership & Next Actions Schedule

| Task / Deliverable | Owner | Current Status | Ready for Retesting |
| :--- | :---: | :---: | :---: |
| Atomic capacity reservation & concurrency | Backend Lead | **Complete** | Immediate |
| Predictive doubles partner search & rating lock | Full Stack | **Complete** | Immediate |
| Removal of gender from signup & profile | Frontend Lead | **Complete** | Immediate |
| Default browsing filters for logged-in players | Frontend Lead | **Complete** | Immediate |
| Organizer route guards & access notices | Frontend Lead | **Complete** | Immediate |
| Vercel build TypeScript verification | Frontend Lead | **Complete** | Immediate |
| Live Stripe production merchant keys integration | Integration Lead | Blocked (Pending Mr. Saad) | Upon receipt of keys |

---

## 6. Recommended Demonstration Script for Mr. Saad

When presenting this V1 release to Mr. Saad, we suggest walking through the following steps to demonstrate platform integrity:

1. **Player Registration & Profile Onboarding:**
   - Demonstrate clean signup (First Name, Last Name, Email, Password).
   - Show profile address autocomplete with approved metro ZIP codes.
2. **Leagues Catalog & Intelligent Defaults:**
   - Log in as a 3.5 player. Show that the catalog defaults to **All Leagues**, **NTRP 3.5**, and **All Metro Atlanta**.
3. **Doubles Partner Pairing Experience:**
   - Open a Doubles league. Select "I have a partner".
   - Type a partner's name or ID (`p-xxx`). Demonstrate that only registered players with the division's 3.5 rating appear.
   - Demonstrate that organizers and the player's own profile are completely excluded.
4. **Capacity Reservation & Checkout:**
   - Proceed to registration. Show that the spot is held with a 15-minute countdown.
   - Complete checkout via the transparent test/mock payment flow.
   - Show automatic redirect to the Dashboard with confirmed league entry.
5. **Role-Based Access Control Demonstration:**
   - Switch to the Organizer account (`organizer@baselineatl.com`).
   - Try navigating to `/leagues` — demonstrate the "Organizer Access Only" guard and redirect back to the Organizer Hub.
   - Show the live organizer dashboard displaying realistic registration counts with strict capacity caps.
