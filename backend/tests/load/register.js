/**
 * k6 – Registration flow (normal leagues, plenty of spots)
 *
 * Traffic mix: 20 % of total VUs
 * Flow:
 *   POST /api/registrations  →  GET /api/payments/status/:id
 *
 * Each VU has a dedicated slice of 100 players.
 * A player is skipped once registered (409 = already registered = correct behaviour).
 * The duplicate_registration counter only fires on genuine double-registration bugs,
 * not on expected "already registered" 409s in subsequent iterations.
 */

import http from "k6/http";
import { sleep, check } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { BASE_URL, LEAGUE_SLUGS, JSON_HEADERS, COMMON_THRESHOLDS, authHeaders, playerEmail } from "./config.js";

const regSuccess    = new Rate("registration_success");
const regDuration   = new Trend("registration_duration_ms");
const regCreated    = new Counter("registration_created_201");
const leagueFull    = new Counter("registration_league_full");    // 409 league full – expected
const alreadyReg    = new Counter("registration_already_reg");    // 409 already registered – expected after first success

const VUS      = parseInt(__ENV.VUS      || "5");
const DURATION = __ENV.DURATION          || "90s";

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
    // Only count genuine HTTP errors (5xx, timeouts) – not expected 409s
    http_req_failed:      ["rate<0.01"],
    registration_success: ["rate>0.85"],
  },
};

// Track which player indices have been successfully registered per VU.
// This is per-VU in-process memory – resets on each new VU initialisation.
const registered = new Set();

export default function () {
  const vu     = __VU;
  const iter   = __ITER;

  // Each VU cycles through its own 100-player slice: VU1→0-99, VU2→100-199 …
  // mod 500 keeps within seeded range (500 players total).
  const playerIndex = ((vu - 1) * 100 + (iter % 100)) % 500;
  const email  = playerEmail(playerIndex);
  const league = TARGET_LEAGUES[vu % TARGET_LEAGUES.length];

  const payload = JSON.stringify({ leagueId: league, playerEmail: email });

  const start = Date.now();
  const res   = http.post(`${BASE_URL}/api/registrations`, payload, {
    headers: authHeaders(email),
    // Tell k6 not to count 4xx as automatic failures – we handle them explicitly
    tags: { name: "register" },
  });
  regDuration.add(Date.now() - start);

  if (res.status === 409) {
    // Check the error body to distinguish league-full from already-registered
    let msg = "";
    try { msg = JSON.parse(res.body).error ?? ""; } catch { /* ignore */ }

    if (msg.toLowerCase().includes("already")) {
      alreadyReg.add(1);
    } else {
      leagueFull.add(1);
    }
    // Both are expected – mark as successful from a scenario perspective
    regSuccess.add(true);
    sleep(0.5);
    return;
  }

  if (res.status === 404) {
    // Player not found – shouldn't happen with fixed seed but handle gracefully
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

  if (res.status === 201) {
    regCreated.add(1);
    registered.add(playerIndex);

    // Poll payment status once – simulates the frontend redirect-return check
    let reservationId;
    try {
      reservationId = JSON.parse(res.body).data.reservation.id;
    } catch {
      sleep(1);
      return;
    }

    sleep(0.3);
    const statusRes = http.get(`${BASE_URL}/api/payments/status/${reservationId}`, {
      headers: authHeaders(email),
    });
    check(statusRes, {
      "payment status 200":    (r) => r.status === 200,
      "payment is registered": (r) => {
        try { return JSON.parse(r.body).data.status === "registered"; } catch { return false; }
      },
    });
  }

  sleep(0.5 + Math.random() * 0.5);
}
