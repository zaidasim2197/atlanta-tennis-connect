/**
 * Shared configuration for all k6 load test scripts.
 *
 * BASE_URL env var overrides the default so the same scripts run against
 * local, staging, or any other deployment without editing test files:
 *
 *   k6 run -e BASE_URL=https://your-staging.vercel.app tests/load/browse.js
 */

export const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";

/**
 * League slugs present after a fresh seed run.
 * l-hot is the race-condition target (3 spots).
 */
export const LEAGUE_SLUGS = ["l-1", "l-2", "l-3", "l-4", "l-hot"];
export const HOT_LEAGUE    = "l-hot";

/**
 * 500 seeded player emails follow the pattern below.
 * k6 VUs pick a unique index so two VUs never share the same email
 * (avoiding the duplicate-reservation unique-index rejection skewing results).
 */
export function playerEmail(vuIndex) {
  return `seed.player${String(vuIndex % 500).padStart(4, "0")}@loadtest.atl`;
}

/** Standard headers for JSON API calls */
export const JSON_HEADERS = { "Content-Type": "application/json" };

/** Thresholds shared across scenarios */
export const COMMON_THRESHOLDS = {
  http_req_failed:   ["rate<0.05"],   // <5 % error rate
  http_req_duration: ["p(95)<2000"],  // p95 < 2 s
};
