# Baseline ATL Operational Demo — Revised Implementation Plan

**Target Meeting:** Today, 5:00 PM PKT  
**Branch:** `backend/staging-load-test-v1`  
**Guiding Principle:** Quality, consistency, credibility beat quantity. Combine with existing data without breaking live accounts.

---

## 1. Timeline & Journey Design (Client-Approved Framing)

The demo illustrates the complete player and organizer lifecycle:
```
1. Registration (adults & juniors, with gender)
      ↓
2. Grouping (players assigned to real geographic divisions e.g. Buckhead, Midtown, Decatur)
      ↓
3. Home/Away Assignment (balanced schedule, home player hosts)
      ↓
4. Court Assignment (home player's preferred court, or "Court TBC")
      ↓
5. Fixture Lifecycle (scheduling-required → scheduled → completed with score)
      ↓
6. Dynamic Standings & Playoff Qualification Demonstration
```

### Seasons Across the Timeline:
* **Summer 2026 (`s-summer-26`):** Completed season (Jun 1 – Aug 22, 2026). Powers prior tournament history, champion/runner-up records, and historical context.
* **Fall 2026 (`s-fall-26`):** Active season (started Sep 8, 2026, 8-week run). Rounds 1–2 complete with realistic scores, round 3 in progress, rounds 4–7 scheduled or scheduling-required. Powers the live fixture view and dynamic standings.
* **Winter 2027 (`s-winter-27`):** Upcoming season (registration open, matches start Nov 16, 2026). Powers capacity bars, live spot decrement, payment state breakdown, and hold statuses.

---

## 2. Exact Entities, Counts & Additive Schema Changes

All schema changes are **strictly additive and optional**:

### 2.1 Schema Additions (Additive & Optional Only)
1. **`Player` (`models/Player.ts`):**
   * `gender?: "male" | "female" | "non-binary" | "prefer-not-to-say"`
   * `dataSource?: string` (e.g. `"synthetic-demo"`)
2. **`League` (`models/League.ts`):**
   * `ageCategory?: "open" | "junior"` (default: `"open"`)
   * `ageMin?: number`
   * `ageMax?: number`
   * `dataSource?: string`
3. **New Collection `GeographicGroup` (`models/GeographicGroup.ts`):**
   * `slug`: unique string (e.g. `grp-fall26-ms35-buckhead`)
   * `leagueSlug`: string
   * `name`: string (e.g. "Buckhead Division", "Midtown Division", "Decatur Division")
   * `geographicArea`: string
   * `playerSlugs`: string[]
4. **New Collection `MatchFixture` (`models/MatchFixture.ts`):**
   * `slug`: unique string (e.g. `fix-fall26-ms35-r1-m1`)
   * `leagueSlug`: string
   * `groupSlug`: string
   * `round`: number
   * `homePlayerSlug`: string
   * `awayPlayerSlug`: string
   * `homeCourtName`: string (or `"Court TBC"`)
   * `scheduledDate`: string (ISO "YYYY-MM-DD")
   * `scheduledTime`: string (e.g. "6:30 PM")
   * `status`: `"scheduling-required" | "scheduled" | "completed" | "reschedule_requested" | "cancelled"`
   * `courtBookingOwner`: `"home"` | `"away"`
   * `scoreData?: string` (e.g. `"6-3, 4-6, [10-7]"`)
   * `winnerSlug?: string`
   * `dataSource`: `"synthetic-demo"`

### 2.2 Entity Counts:
* **Synthetic Players:** Exactly 500 (`p-syn-0001` through `p-syn-0500`).
  * Adult/Junior Split: ~430 adults (86%), ~70 juniors (14%, ages 13–17).
  * 500 unique full names sampled without replacement from 60 first × 60 last curated Atlanta names.
  * Deterministic Mulberry32 PRNG.
  * Emails: `first.last.NNN@synthetic.baselineatl.test`.
  * Phones: `(404) 555-0100` to `(404) 555-0199`.
  * Junior Guardian fields: `parentName` + `parentPhone` (masked in UI list views).
* **Leagues (9 Real-Named Synthetic Leagues prefixed `bl-`):**
  * `bl-buckhead-ms-35`: Buckhead Men's Singles 3.5 (Adult, bitsy grant, 24 cap)
  * `bl-midtown-ws-35`: Midtown Women's Singles 3.5 (Adult, sharon lester, 24 cap)
  * `bl-decatur-ms-40`: Decatur Men's Singles 4.0 (Adult, dekalb tennis center, 24 cap)
  * `bl-chastain-ws-40`: Chastain Women's Singles 4.0 (Adult, chastain park, 24 cap)
  * `bl-metro-md-40`: Atlanta Metro Men's Doubles 4.0 (Adult, 32 cap, partner links)
  * `bl-intown-mxd-35`: Intown Mixed Doubles 3.5 (Adult, 32 cap, male+female pairs)
  * `bl-piedmont-mxd-45`: Piedmont Open Singles 4.5+ (Adult, 16 cap)
  * `bl-decatur-jr-boys-30`: Decatur Junior Boys' Singles 3.0 (Junior 13–17, mckoy park, 16 cap)
  * `bl-buckhead-jr-girls-30`: Buckhead Junior Girls' Singles 3.0 (Junior 13–17, bitsy grant, 16 cap)
* **Venues:** 12 verified real metro Atlanta facilities (see `docs/demo/VENUES.md`).

---

## 3. Removal Plan & Impact Assessment

* **Proposed for Removal:** 25 data-pack leagues (`demo-league-01` to `25`) containing 500 mock reservations from `@demo.example.test`.
* **Verified Safe:** 0 Stripe charges, 0 real human accounts.
* **Preserved:** All 5 existing leagues (`l-1`, `LG-MS-35`, `LG-WS-35`, `LG-MD-40`, `LG-MXD-35`), all real user accounts (`@gmail.com`), and all Stripe transactions.
* **Controlled Script:** `backend/scripts/demo-remove.ts` will strictly read `docs/demo/APPROVED_REMOVALS.json` and back up documents before deletion.
* **Load Test Impact Notice:** `backend/tests/load/config.js` references `l-1` and `l-hot`. Because `l-1` is preserved and `l-hot` is not in the database, load test configs targeting `l-hot` were already broken by previous data-pack scripts. We will document this in pre-launch issues.

---

## 4. Gender Option Set & Signup Integration

* **Gender Field at Signup (`src/routes/signup.tsx`):**
  * Required field with option set:
    * `male`: "Male"
    * `female`: "Female"
    * `non-binary`: "Non-binary"
    * `prefer-not-to-say`: "Prefer not to say"
  * Storage: Stored on `Player` model as `gender`.
  * Pass-through: Added to `backend/src/routes/auth.ts` (`signup` zod schema) and `backend/src/routes/players.ts`.
  * Visibility: Shown only to the user themself and to organizers on admin endpoints.
  * Non-enforcement note: No automatic gender-based exclusion is enforced at the API level (preserved per non-negotiable guardrails).

---

## 5. Endpoints & File-by-File Changes

### Backend Endpoints (`backend/src/routes/admin.ts`):
* `GET /api/admin/overview`: KPIs with source composition (`synthetic`, `live`, `demo`), fill chart, recent activity feed.
* `GET /api/admin/players`: Paginated player directory with filters (`search`, `ntrp`, `gender`, `isJunior`, `source`), plus player detail drawer data.
* `GET /api/admin/leagues`: League roster breakdown, capacity bars, geographic groups.
* `GET /api/admin/registrations`: Financial breakdown (labelled synthetic) and reservation state table.
* `GET /api/admin/geography`: ZIP code and home area distribution aggregations.
* `GET /api/admin/fixtures`: Group round-robin fixtures and dynamically computed standings.
* `GET /api/matches/mine`: Endpoint for showcase player (`p-demo-player` / Alex Mercer) to view their own assigned matches on their personal dashboard.

### Frontend Pages:
* `src/routes/admin.tsx`: Layout with top truth mode badge ("Connected to backend", "Synthetic demo data" banner) and navigation.
* `src/routes/admin/index.tsx`: Overview KPI dashboard with source badges.
* `src/routes/admin/players.tsx`: Filterable player table with drawer view (junior phone masking).
* `src/routes/admin/leagues.tsx`: Real-named leagues, capacities, group rosters.
* `src/routes/admin/registrations.tsx`: Reservation and payment states.
* `src/routes/admin/geography.tsx`: Area distribution bars.
* `src/routes/admin/fixtures.tsx`: Round-by-round match schedule, scores, and derived standings.
* `src/routes/admin/bracket.tsx`: Playoff Bracket Demonstration (Phase 5 visual concept only).

---

## 6. Time-Boxed Execution Schedule (Target: 5:00 PM PKT)

* **16:58 – 17:08 PKT:** Gate 1 approval & Gate 2 removal (`demo:remove`) of 25 demo leagues.
* **17:08 – 17:20 PKT:** Run `seed-demo.ts` (deterministic generation of 500 players, 9 leagues, groups, fixtures).
* **17:20 – 17:35 PKT:** Implement `/api/admin/*` backend routes & gender signup field.
* **17:35 – 17:50 PKT:** Build Admin Dashboard UI pages with Recharts & truth badges.
* **17:50 – 17:58 PKT:** Visual bracket demonstration & end-to-end verification (`npm test`, build check).
* **17:58 – 18:00 PKT:** Final walkthrough script & client-ready operational demo handoff.

---

## 7. Plain-Language Answers to Key Questions (Section 13)

1. **What "home code" means in this plan:**
   It means **ZIP Code** (`zipCode`), from which a **Home Area** is derived via lookup. Home Court (`preferredCourt`) is separate named facility data.
2. **Admin Flow Authentication:**
   Real backend access using the existing session cookie authenticated via `requireAuth` + `requireOrganizer`.
3. **Exact Entities Created, Removed, and Untouched:**
   * *Removed:* 25 data-pack placeholder leagues (`demo-league-01..25`) and their 500 mock reservations.
   * *Created:* 500 synthetic players (430 adults, 70 juniors), 9 real-named metro Atlanta leagues, geographic divisions, and regular-season fixtures.
   * *Untouched:* All 5 existing leagues (`l-1`, `LG-*`), all real human `@gmail.com` accounts, the 2 Stripe reservations, and both demo accounts (`p-demo-player`, `p-demo-organizer`).
4. **Verified Complete:**
   Live database connectivity, deterministic data generation, capacity arithmetic, round-robin fixture generation, dynamic standings, and responsive admin UI.
5. **Deliberately NOT Implemented:**
   Production RBAC, live payment processing, automated tournament scheduler, court booking engine, match reschedule workflow, push notifications, and automated playoff advancement.
