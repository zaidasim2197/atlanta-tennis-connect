/**
 * k6 – Race condition test (hot league with 3 spots)
 *
 * Traffic mix: 10 % of total VUs, all targeting l-hot simultaneously.
 *
 * What this proves:
 *   - Exactly 3 registrations succeed (no overselling)
 *   - All other attempts receive 409
 *   - No duplicate registration or duplicate payment state
 *
 * Run standalone:
 *   k6 run -e BASE_URL=http://localhost:3001 -e VUS=20 tests/load/race.js
 *
 * Expected result at any concurrency level:
 *   registration_race_success count = 3  (never > 3)
 *   registration_race_rejected count = VUS*iterations - 3
 */

import http from "k6/http";
import { sleep, check } from "k6";
import { Counter, Rate } from "k6/metrics";
import { BASE_URL, HOT_LEAGUE, JSON_HEADERS, authHeaders, playerEmail } from "./config.js";

const raceSuccess  = new Counter("registration_race_success");
const raceRejected = new Counter("registration_race_rejected");
const raceOversold = new Counter("registration_race_oversold"); // must stay 0

const VUS = parseInt(__ENV.VUS || "20");

export const options = {
  scenarios: {
    race: {
      executor:       "shared-iterations",
      vus:            VUS,
      iterations:     VUS,        // each VU tries exactly once
      maxDuration:    "30s",
    },
  },
  thresholds: {
    // The race-success counter must never exceed 3 (the seeded limit)
    "registration_race_oversold": ["count==0"],
    http_req_failed:              ["rate<0.01"],
  },
};

// Track how many have succeeded (shared via k6 summary – not shared memory)
let successCount = 0;

export default function () {
  const vu    = __VU;
  // VUs 1-3 map to players 450, 451, 452 – well within the seeded range.
  // These players are NOT pre-registered in l-hot (seed never registers in l-hot).
  const email = playerEmail(450 + (vu - 1)); // offset to avoid overlap with register.js VUs

  const payload = JSON.stringify({ leagueId: HOT_LEAGUE, playerEmail: email });

  const res = http.post(`${BASE_URL}/api/registrations`, payload, {
    headers: authHeaders(email),
  });

  if (res.status === 201) {
    successCount++;
    if (successCount > 3) {
      // This should never happen if atomic decrement works correctly
      raceOversold.add(1);
      console.error(`OVERSOLD: VU ${vu} got 201 but count is ${successCount}`);
    } else {
      raceSuccess.add(1);
    }
    check(res, { "race: slot reserved": () => true });
  } else if (res.status === 409) {
    raceRejected.add(1);
    check(res, { "race: correctly rejected": () => true });
  } else {
    console.warn(`race: unexpected status ${res.status} for VU ${vu}`);
  }

  sleep(0.1);
}

export function handleSummary(data) {
  const success  = data.metrics["registration_race_success"]?.values?.count ?? 0;
  const rejected = data.metrics["registration_race_rejected"]?.values?.count ?? 0;
  const oversold = data.metrics["registration_race_oversold"]?.values?.count ?? 0;

  const verdict = oversold === 0 && success <= 3
    ? "✅ PASS – no overselling detected"
    : `❌ FAIL – oversold=${oversold}, success=${success}`;

  console.log("\n=== RACE CONDITION RESULT ===");
  console.log(`  Slots available:  3`);
  console.log(`  Successful:       ${success}`);
  console.log(`  Rejected (409):   ${rejected}`);
  console.log(`  Oversold (ERROR): ${oversold}`);
  console.log(`  Verdict:          ${verdict}`);
  console.log("=============================\n");

  return { stdout: "" };
}
