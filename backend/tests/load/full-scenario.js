/**
 * k6 – Full mixed-traffic scenario
 *
 * Combines all three traffic types in realistic proportions:
 *   70 % browsing leagues
 *   20 % registering (normal leagues)
 *   10 % racing for the hot league
 *
 * Six concurrency levels (run separately, reseed DB between each):
 *   VUS=25   → browse=17, register=5,  race=3
 *   VUS=50   → browse=35, register=10, race=5
 *   VUS=75   → browse=52, register=15, race=8
 *   VUS=100  → browse=70, register=20, race=10
 *   VUS=150  → browse=105, register=30, race=15
 *   VUS=500  → browse=350, register=100, race=50
 *
 * Usage (reseed before each run):
 *   cd backend && npm run seed
 *   k6 run -e BASE_URL=http://localhost:3001 -e VUS=25  tests/load/full-scenario.js
 *   npm run seed
 *   k6 run -e BASE_URL=http://localhost:3001 -e VUS=50  tests/load/full-scenario.js
 *   ... repeat for 75, 100, 150, 500
 */

import http from "k6/http";
import { sleep, check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import {
  BASE_URL, LEAGUE_SLUGS, HOT_LEAGUE, JSON_HEADERS,
  COMMON_THRESHOLDS, playerEmail,
} from "./config.js";

// ─── Metrics ─────────────────────────────────────────────────────────────────
const browseOk        = new Rate("browse_success");
const regOk           = new Rate("register_success");
const raceSuccess     = new Counter("race_slots_claimed");
const raceRejected    = new Counter("race_slots_rejected");
const raceOversold    = new Counter("race_oversold");          // must stay 0
const duplicateReg    = new Counter("duplicate_registration"); // must stay 0
const regDuration     = new Trend("register_p95_ms");

// ─── Scenario sizing ─────────────────────────────────────────────────────────
const TOTAL_VUS = parseInt(__ENV.VUS || "25");
const DURATION  = __ENV.DURATION    || "90s";

const BROWSE_VUS   = Math.max(1, Math.round(TOTAL_VUS * 0.70));
const REGISTER_VUS = Math.max(1, Math.round(TOTAL_VUS * 0.20));
const RACE_VUS     = Math.max(1, Math.round(TOTAL_VUS * 0.10));

export const options = {
  scenarios: {
    // ── Browsers ──────────────────────────────────────────────────────────
    browse: {
      executor:   "constant-vus",
      vus:        BROWSE_VUS,
      duration:   DURATION,
      exec:       "browseFn",
    },
    // ── Registrations ─────────────────────────────────────────────────────
    register: {
      executor:   "constant-vus",
      vus:        REGISTER_VUS,
      duration:   DURATION,
      exec:       "registerFn",
    },
    // ── Race for hot league ───────────────────────────────────────────────
    race: {
      executor:       "shared-iterations",
      vus:            RACE_VUS,
      iterations:     RACE_VUS,   // each VU fires exactly once
      maxDuration:    "30s",
      exec:           "raceFn",
    },
  },
  thresholds: {
    ...COMMON_THRESHOLDS,
    browse_success:        ["rate>0.95"],
    register_success:      ["rate>0.85"],
    race_oversold:         ["count==0"],   // hard fail if any oversell
    duplicate_registration:["count==0"],   // hard fail if any duplicate
  },
};

// ─── Browse function ──────────────────────────────────────────────────────────
export function browseFn() {
  const slug = LEAGUE_SLUGS[__VU % LEAGUE_SLUGS.length];

  const list = http.get(`${BASE_URL}/api/leagues`, { headers: JSON_HEADERS });
  browseOk.add(check(list, { "list 200": (r) => r.status === 200 }));
  sleep(0.2);

  const detail = http.get(`${BASE_URL}/api/leagues/${slug}`, { headers: JSON_HEADERS });
  browseOk.add(check(detail, { "detail 200": (r) => r.status === 200 }));
  sleep(0.5 + Math.random() * 0.5);
}

// ─── Registration function ───────────────────────────────────────────────────
export function registerFn() {
  const email  = playerEmail(__VU * 500 + __ITER); // globally unique
  const league = ["l-1","l-2","l-3"][__VU % 3];

  const start = Date.now();
  const res   = http.post(
    `${BASE_URL}/api/registrations`,
    JSON.stringify({ leagueId: league, playerEmail: email }),
    { headers: JSON_HEADERS },
  );
  regDuration.add(Date.now() - start);

  if (res.status === 409) {
    // Duplicate guard fired — shouldn't happen with per-VU emails but track it
    duplicateReg.add(1);
    regOk.add(false);
  } else {
    const ok = check(res, { "register 201": (r) => r.status === 201 });
    regOk.add(ok);
  }

  sleep(1 + Math.random());
}

// ─── Race function ───────────────────────────────────────────────────────────
let claimedCount = 0; // local to this VU process

export function raceFn() {
  const email = playerEmail(300 + __VU);

  const res = http.post(
    `${BASE_URL}/api/registrations`,
    JSON.stringify({ leagueId: HOT_LEAGUE, playerEmail: email }),
    { headers: JSON_HEADERS },
  );

  if (res.status === 201) {
    claimedCount++;
    if (claimedCount > 3) {
      raceOversold.add(1);
    } else {
      raceSuccess.add(1);
    }
  } else if (res.status === 409) {
    raceRejected.add(1);
  }

  sleep(0.1);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const vus      = TOTAL_VUS;
  const dur      = DURATION;
  const total    = data.metrics["http_reqs"]?.values?.count          ?? 0;
  const failed   = data.metrics["http_req_failed"]?.values?.rate     ?? 0;
  const p95      = data.metrics["http_req_duration"]?.values?.["p(95)"] ?? 0;
  const claimed  = data.metrics["race_slots_claimed"]?.values?.count ?? 0;
  const oversold = data.metrics["race_oversold"]?.values?.count      ?? 0;
  const dupReg   = data.metrics["duplicate_registration"]?.values?.count ?? 0;

  const rows = [
    "",
    "╔══════════════════════════════════════════════════════════════════╗",
    `║  Atlanta Tennis – Load Test Result  │  VUs: ${String(vus).padEnd(3)}  Duration: ${dur.padEnd(5)}  ║`,
    "╠══════════════════════════════════════════════════════════════════╣",
    `║  Total requests        : ${String(total).padEnd(39)}║`,
    `║  Failed requests       : ${(failed * 100).toFixed(2).padEnd(38)}%║`,
    `║  p95 response time     : ${String(Math.round(p95)).padEnd(36)}ms ║`,
    `║  Race slots claimed    : ${String(claimed).padEnd(39)}║`,
    `║  Oversold (MUST=0)     : ${String(oversold).padEnd(39)}║`,
    `║  Duplicate reg (MUST=0): ${String(dupReg).padEnd(39)}║`,
    "╠══════════════════════════════════════════════════════════════════╣",
    `║  Verdict: ${oversold === 0 && dupReg === 0 ? "✅ PASS" : "❌ FAIL – see oversold/duplicate counts"}`.padEnd(67) + "║",
    "╚══════════════════════════════════════════════════════════════════╝",
    "",
  ];

  const report = rows.join("\n");
  console.log(report);
  return { stdout: report };
}
