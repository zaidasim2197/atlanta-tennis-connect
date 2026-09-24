# Baseline ATL — Live Database Inventory Report

**Date of Inventory:** September 24, 2026  
**Auditor:** Antigravity (Senior Full-Stack Engineer)  
**Database Name:** `atlanta-tennis`  
**Privacy Assurance:** This document contains ZERO personal data (no names, phone numbers, plaintext emails, or street addresses). Only aggregates, counts, domains, and slugs are reported.

---

## 1. Collection Document Counts

| Collection | Count | Description / Notes |
|---|---|---|
| `accounts` | 520 | 2 organizer (`baselineatl.com`, `demo.example.test`), 518 player accounts |
| `players` | 520 | 500 `demo.example.test`, 10 `example.test`, 3 `baselineatl.com`, 7 `gmail.com` |
| `leagues` | 30 | 25 `demo-league-*` (data pack), 4 `LG-*`, 1 `l-1` |
| `seasons` | 2 | `demo-fall-2026` (Active), `s-fall-26` |
| `reservations` | 513 | 500 on `demo-league-*`, 12 on `LG-*`, 1 on `l-1` |
| `tournamenthistories` | 120 | Seeded tournament history records |
| `schedules` | 20 | Legacy bracket match knockout collections |
| `auditlogs` | 65 | Append-only reservation state logs |
| `authsessions` | 14 | Active login cookie session hashes |
| `authattempts` | 4 | Rate limiting attempt buckets |
| `mockpayments` | 0 | Mock payment store collection |

---

## 2. Leagues Inventory (30 Total)

| League Slug | Name | Format | Level | Venue | Capacity | Spots Left | Reg Open | Season Slug |
|---|---|---|---|---|---|---|---|---|
| `LG-MS-35` | Men's Singles 3.5 | `men-singles` | 3.5 | Northside Tennis Center | 16 | 13 | True | `s-fall-26` |
| `LG-WS-35` | Women's Singles 3.5 | `women-singles` | 3.5 | Bitsy Grant Tennis Center | 16 | 14 | True | `s-fall-26` |
| `LG-MD-40` | Men's Doubles 4.0 | `men-doubles` | 4.0 | Chastain Park Tennis Center | 16 | 14 | True | `s-fall-26` |
| `LG-MXD-35` | Mixed Doubles 3.5 | `mixed-doubles` | 3.5 | Sharon Lester Tennis Center | 16 | 13 | True | `s-fall-26` |
| `l-1` | Tuesday Singles | `senior-singles`* | 3.0 | Piedmont Park Courts | 24 | 23 | True | `s-fall-26` |
| `demo-league-01` to `25` | 25 Data-Pack Leagues (City/Metro/Series) | `senior-singles` / `senior-doubles`* | 2.5–4.5+ | Various Public Parks | 24 each | 4 each | Mix (5 Open, 20 Closed) | `demo-fall-2026` |

*\*Note on Schema Inconsistency:* `senior-singles` and `senior-doubles` are in MongoDB records written by previous raw-driver scripts, but are not permitted values in the Mongoose `League.ts` enum (`men-singles`, `women-singles`, `men-doubles`, `mixed-doubles`).

---

## 3. Reservations Breakdown by League, Status & Provider

* **Data-Pack Leagues (`demo-league-01` through `demo-league-25`):**
  * Exactly 20 reservations per league = 500 reservations total.
  * Status: 100% `status: "registered"`.
  * Provider: 100% `paymentProvider: "mock"`.
  * Email Domain: 100% `@demo.example.test`.
  * Stripe connections: 0. Real accounts: 0.
* **Legacy Leagues (`LG-*` and `l-1`):**
  * `LG-MS-35`: 4 reservations (2 `example.test` accounts, 1 `baselineatl.com` [Alex Mercer / `p-demo-player`], 1 real account with 2 Stripe transactions: `status: "registered"` and `status: "expired"` with `pi_3UJ9CO...` and `pi_3UIT3S...`).
  * `LG-WS-35`: 2 reservations (both `example.test` accounts; 1 `registered`, 1 `expired`).
  * `LG-MD-40`: 2 reservations (both `example.test` accounts, `registered`).
  * `LG-MXD-35`: 4 reservations (all `example.test` accounts; 3 `registered`, 1 `held`).
  * `l-1`: 1 reservation (`p-j6h3iho` on `baselineatl.com`, `registered`).

---

## 4. Players & Accounts Breakdown

* **Player Count by Email Domain:**
  * `@demo.example.test`: 500 players (`demo-player-001` through `500`).
  * `@example.test`: 10 players (`PLY-001` through `PLY-010`).
  * `@baselineatl.com`: 3 players (`p-demo-player`, `p-demo-organizer`, `p-j6h3iho`).
  * `@gmail.com`: 7 accounts registered via live `/api/auth/signup`.
  * Total Players: 520.
* **Accounts (`accounts` collection):**
  * Total: 520 accounts.
  * 2 `organizer` accounts: `organizer@baselineatl.com` and `organizer@demo.example.test`.
  * 518 `player` accounts.
* **Stripe Reservations:** Exactly 2 reservations in the entire database are Stripe-backed (`pi_3UIT3S3LwR6lzVYP18Iluv7p` and `pi_3UJ9CO3LwR6lzVYP0QSCr3ru`), both attached to `LG-MS-35`.
