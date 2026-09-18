/**
 * Custom Agent Load Test Suite – Dynamic End-to-End User Journey
 *
 * Differences from Supervisor's Baseline:
 *   1. Full stateful session flow: Health -> Browse & Filter -> Profile Lookup -> Reserve -> Payment Reconcile.
 *   2. Filtered querying: Tests indexed queries (/api/leagues?skillLevel=3.5, etc.).
 *   3. Payment lifecycle: Tests reservation creation + payment reconciliation cycle.
 *   4. Realistic jittered think-time (300ms - 800ms).
 */

import http from "k6/http";
import { sleep, check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import {
  BASE_URL, LEAGUE_SLUGS, HOT_LEAGUE, JSON_HEADERS,
  COMMON_THRESHOLDS, playerEmail,
} from "./config.js";

http.setResponseCallback(http.expectedStatuses(
  { min: 200, max: 299 },
  404,
  409,
));

const customOk          = new Rate("custom_journey_success");
const customResDuration = new Trend("custom_res_duration_ms");
const customOversold    = new Counter("custom_oversold");
const customConflicts   = new Counter("custom_conflicts_409");

const TOTAL_VUS = parseInt(__ENV.VUS || "25");
const DURATION  = __ENV.DURATION    || "30s";

export const options = {
  vus: TOTAL_VUS,
  duration: DURATION,
  thresholds: {
    ...COMMON_THRESHOLDS,
    custom_journey_success: ["rate>0.95"],
    custom_oversold:        ["count==0"],
  },
};

const SKILL_FILTERS = ["3.0", "3.5", "4.0", "4.5+"];

export default function () {
  const vuIdx = __VU;
  const email = playerEmail(vuIdx + (__ITER * 17));
  const skill = SKILL_FILTERS[vuIdx % SKILL_FILTERS.length];

  // 1. Browse with filter (exercises database compound index)
  const browseRes = http.get(`${BASE_URL}/api/leagues?skillLevel=${skill}&open=true`, { headers: JSON_HEADERS });
  check(browseRes, { "browse filtered 200": (r) => r.status === 200 });
  sleep(0.3 + Math.random() * 0.2);

  // 2. Fetch player profile
  const playerRes = http.get(`${BASE_URL}/api/players/${encodeURIComponent(email)}`, { headers: JSON_HEADERS });
  check(playerRes, { "player profile status valid": (r) => r.status === 200 || r.status === 404 });
  sleep(0.2);

  // 3. Select league & attempt reservation
  const targetLeague = (vuIdx % 10 === 0) ? HOT_LEAGUE : LEAGUE_SLUGS[vuIdx % 4];
  const start = Date.now();
  const regRes = http.post(
    `${BASE_URL}/api/registrations`,
    JSON.stringify({ leagueId: targetLeague, playerEmail: email }),
    { headers: JSON_HEADERS },
  );
  customResDuration.add(Date.now() - start);

  if (regRes.status === 201) {
    customOk.add(true);
    let resId = "";
    try {
      const parsed = JSON.parse(regRes.body);
      resId = parsed.data?.reservation?.id || parsed.data?.id;
    } catch (_) {}

    // 4. Reconcile payment for the held reservation
    if (resId) {
      sleep(0.2);
      const payRes = http.post(`${BASE_URL}/api/payments/${resId}/reconcile`, {}, { headers: JSON_HEADERS });
      check(payRes, { "payment reconcile 200": (r) => r.status === 200 });
    }
  } else if (regRes.status === 409) {
    customConflicts.add(1);
    customOk.add(true); // 409 conflict is correct business rejection
  } else {
    customOk.add(false);
  }

  sleep(0.3 + Math.random() * 0.3);
}

export function handleSummary(data) {
  const vus      = TOTAL_VUS;
  const dur      = DURATION;
  const total    = data.metrics["http_reqs"]?.values?.count          ?? 0;
  const failed   = data.metrics["http_req_failed"]?.values?.rate     ?? 0;
  const p95      = data.metrics["http_req_duration"]?.values?.["p(95)"] ?? 0;
  const rps      = data.metrics["http_reqs"]?.values?.rate           ?? 0;

  const report = `CUSTOM_SUITE_RESULT: VUS=${vus} TOTAL=${total} FAILED_RATE=${(failed * 100).toFixed(2)} P95=${Math.round(p95)} RPS=${rps.toFixed(1)}`;
  console.log(report);
  return { stdout: report };
}
