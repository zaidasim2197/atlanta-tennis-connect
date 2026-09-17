/**
 * k6 – Registration flow (normal leagues, plenty of spots)
 *
 * Traffic mix: 20 % of total VUs
 * Flow:
 *   POST /api/registrations  →  GET /api/payments/status/:id
 *
 * Each VU uses a unique seeded player email so the duplicate-reservation
 * guard (compound unique index) doesn't interfere with the concurrency result.
 *
 * Run standalone:
 *   k6 run -e BASE_URL=http://localhost:3001 -e VUS=10 tests/load/register.js
 */

import http from "k6/http";
import { sleep, check } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { BASE_URL, LEAGUE_SLUGS, JSON_HEADERS, COMMON_THRESHOLDS, playerEmail } from "./config.js";

const regSuccess   = new Rate("registration_success");
const regDuration  = new Trend("registration_duration_ms");
const regConflict  = new Counter("registration_conflict_409");
const regCreated   = new Counter("registration_created_201");

const VUS      = parseInt(__ENV.VUS      || "5");
const DURATION = __ENV.DURATION          || "60s";

// Use l-1, l-2, l-3 (plenty of spots) – not the hot league
const TARGET_LEAGUES = ["l-1", "l-2", "l-3"];

export const options = {
  scenarios: {
    register: {
      executor:  "constant-vus",
      vus:       VUS,
      duration:  DURATION,
    },
  },
  thresholds: {
    ...COMMON_THRESHOLDS,
    registration_success: ["rate>0.90"],
  },
};

export default function () {
  const vu     = __VU;
  const iter   = __ITER;
  const email  = playerEmail(vu * 1000 + iter); // unique per VU per iteration
  const league = TARGET_LEAGUES[vu % TARGET_LEAGUES.length];

  const payload = JSON.stringify({ leagueId: league, playerEmail: email });

  const start = Date.now();
  const res   = http.post(`${BASE_URL}/api/registrations`, payload, {
    headers: JSON_HEADERS,
  });
  regDuration.add(Date.now() - start);

  if (res.status === 409) {
    regConflict.add(1);
    regSuccess.add(false);
    sleep(1);
    return;
  }

  if (res.status === 404) {
    // Player email not in DB – expected for emails outside the seeded range
    regSuccess.add(false);
    sleep(1);
    return;
  }

  const ok = check(res, {
    "registration 201": (r) => r.status === 201,
    "reservation id present": (r) => {
      try { return !!JSON.parse(r.body).data.reservation.id; } catch { return false; }
    },
  });
  regSuccess.add(ok);
  if (res.status === 201) regCreated.add(1);

  // Poll payment status once to simulate frontend redirect-return
  if (ok) {
    let reservationId: string;
    try {
      reservationId = JSON.parse(res.body).data.reservation.id;
    } catch {
      sleep(1);
      return;
    }
    sleep(0.5);
    const status = http.get(`${BASE_URL}/api/payments/status/${reservationId}`, {
      headers: JSON_HEADERS,
    });
    check(status, {
      "payment status 200": (r) => r.status === 200,
      "payment is registered": (r) => {
        try { return JSON.parse(r.body).data.status === "registered"; } catch { return false; }
      },
    });
  }

  sleep(1 + Math.random());
}
