/**
 * k6 – Browse leagues + league detail
 *
 * Traffic mix:  70 % of total VUs (the "browsers")
 * Flows covered:
 *   - GET /api/health
 *   - GET /api/leagues  (list all)
 *   - GET /api/leagues?open=true  (filter open only)
 *   - GET /api/leagues/:id  (random league detail)
 *
 * Run standalone:
 *   k6 run -e BASE_URL=http://localhost:3001 -e VUS=25 tests/load/browse.js
 */

import http from "k6/http";
import { sleep, check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { BASE_URL, LEAGUE_SLUGS, JSON_HEADERS, COMMON_THRESHOLDS } from "./config.js";

// Custom metrics
const leagueListOk   = new Rate("league_list_success");
const leagueDetailOk = new Rate("league_detail_success");
const leagueDetailMs = new Trend("league_detail_duration");

const VUS      = parseInt(__ENV.VUS  || "25");
const DURATION = __ENV.DURATION      || "60s";

export const options = {
  scenarios: {
    browse: {
      executor:  "constant-vus",
      vus:       VUS,
      duration:  DURATION,
    },
  },
  thresholds: {
    ...COMMON_THRESHOLDS,
    league_list_success:   ["rate>0.95"],
    league_detail_success: ["rate>0.95"],
  },
};

export default function () {
  const vu = __VU;

  // 1. Health
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { "health 200": (r) => r.status === 200 });

  sleep(0.2);

  // 2. List all leagues
  const list = http.get(`${BASE_URL}/api/leagues`, { headers: JSON_HEADERS });
  const listOk = check(list, {
    "league list 200":        (r) => r.status === 200,
    "league list has data":   (r) => {
      try { return JSON.parse(r.body).data.length > 0; } catch { return false; }
    },
  });
  leagueListOk.add(listOk);

  sleep(0.3);

  // 3. Filter open only
  http.get(`${BASE_URL}/api/leagues?open=true`, { headers: JSON_HEADERS });

  sleep(0.2);

  // 4. Random league detail
  const slug    = LEAGUE_SLUGS[vu % LEAGUE_SLUGS.length];
  const start   = Date.now();
  const detail  = http.get(`${BASE_URL}/api/leagues/${slug}`, { headers: JSON_HEADERS });
  leagueDetailMs.add(Date.now() - start);

  const detailOk = check(detail, {
    "league detail 200":          (r) => r.status === 200,
    "league detail has spotsRemaining": (r) => {
      try { return typeof JSON.parse(r.body).data.spotsRemaining === "number"; } catch { return false; }
    },
  });
  leagueDetailOk.add(detailOk);

  sleep(0.5 + Math.random() * 0.5);
}
