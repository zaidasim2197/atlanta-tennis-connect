const fs = require("node:fs");
const path = require("node:path");
const Stripe = require("stripe");
const dotenv = require("dotenv");

const baseUrl = process.env.TEST_BASE_URL || "https://atlanta-tennis-staging.vercel.app";
const leagueId = process.env.TEST_LEAGUE_ID || "l-hot";
const requestCount = Number(process.env.TEST_REQUEST_COUNT || 12);
const localEnv = dotenv.parse(fs.readFileSync(path.join(__dirname, "../.env")));
const secretKey = process.env.STRIPE_SECRET_KEY || localEnv.STRIPE_SECRET_KEY;

if (!secretKey?.startsWith("sk_test_")) {
  throw new Error("This evidence runner requires a Stripe test-mode secret key");
}

const stripe = new Stripe(secretKey);
const sessions = new Map();
async function createTestAccount(email) {
  const response = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: new URL(baseUrl).origin },
    body: JSON.stringify({ email, password: require("node:crypto").randomBytes(24).toString("hex"), firstName: "Stripe", lastName: "Concurrency QA", ntrp: "3.5" }),
  });
  if (response.status !== 201) throw new Error(`Test account setup failed: HTTP ${response.status}`);
  const cookie = response.headers.getSetCookie().find(value => /(?:^|;)\s*Max-Age=[1-9]/.test(value))?.split(";")[0];
  if (!cookie) throw new Error("Test session not returned");
  sessions.set(email, cookie);
}

async function league() {
  const response = await fetch(`${baseUrl}/api/leagues`);
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error(`League lookup failed: HTTP ${response.status}`);
  const target = body.data.find((item) => item.id === leagueId);
  if (!target) throw new Error(`League ${leagueId} not found`);
  return target;
}

async function register(email) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/api/registrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: new URL(baseUrl).origin, Cookie: sessions.get(email) },
    body: JSON.stringify({ leagueId, playerEmail: email }),
  });
  const body = await response.json().catch(() => ({}));
  return {
    email,
    httpStatus: response.status,
    durationMs: Date.now() - startedAt,
    reservationId: body.data?.reservation?.id,
    paymentIntentId: body.data?.reservation?.paymentIntentId,
    reservationStatus: body.data?.reservation?.status,
    error: body.error,
  };
}

async function main() {
  const before = await league();
  if (before.spotsRemaining !== 3) {
    throw new Error(
      `Expected 3 open spots in ${leagueId}; found ${before.spotsRemaining}. No requests sent.`,
    );
  }

  const runId = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const emails = Array.from({ length: requestCount }, (_, index) => `stripe-race-${runId}-${String(index + 1).padStart(2, "0")}@example.test`);
  // Provision before timing the race. Sessions are kept in memory, never logged.
  for (const email of emails) await createTestAccount(email);
  const results = await Promise.all(emails.map(register));

  const winners = results.filter((result) => result.httpStatus === 201);
  const conflicts = results.filter((result) => result.httpStatus === 409);
  const unexpected = results.filter((result) => ![201, 409].includes(result.httpStatus));
  const intentIds = winners.map((result) => result.paymentIntentId).filter(Boolean);
  const uniqueIntentIds = new Set(intentIds);
  const intents = await Promise.all(intentIds.map((id) => stripe.paymentIntents.retrieve(id)));
  const afterRace = await league();

  const evidence = {
    executedAt: new Date().toISOString(),
    environment: baseUrl,
    provider: "stripe-test-mode",
    league: {
      id: leagueId,
      capacity: before.playerLimit,
      spotsBefore: before.spotsRemaining,
      spotsAfterRace: afterRace.spotsRemaining,
    },
    requestCount,
    successCount: winners.length,
    conflictCount: conflicts.length,
    unexpectedCount: unexpected.length,
    distinctPaymentIntentCount: uniqueIntentIds.size,
    requests: results,
    stripePaymentIntents: intents.map((intent) => ({
      id: intent.id,
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
      livemode: intent.livemode,
      reservationId: intent.metadata.reservationId,
      leagueSlug: intent.metadata.leagueSlug,
    })),
  };

  const assertions = {
    exactlyThreeWinners: winners.length === 3,
    remainingRequestsConflict: conflicts.length === requestCount - 3,
    noUnexpectedResponses: unexpected.length === 0,
    capacityFullyClaimed: afterRace.spotsRemaining === 0,
    everyWinnerHasIntent: intentIds.length === winners.length,
    everyIntentDistinct: uniqueIntentIds.size === winners.length,
    everyIntentIsTestMode: intents.every((intent) => intent.livemode === false),
    everyIntentPendingPayment: intents.every(
      (intent) => intent.status === "requires_payment_method",
    ),
    metadataMatchesReservation: intents.every((intent) =>
      winners.some((winner) => winner.reservationId === intent.metadata.reservationId),
    ),
  };
  evidence.assertions = assertions;

  // Cleanup is part of the runner: cancel each reservation via the application,
  // then verify both Stripe and application capacity returned to their prior state.
  evidence.cleanup = [];
  for (const winner of winners) {
    const response = await fetch(`${baseUrl}/api/payments/${winner.reservationId}/cancel`, {
      method: "POST", headers: { Origin: new URL(baseUrl).origin, Cookie: sessions.get(winner.email) },
    });
    evidence.cleanup.push({
      reservationId: winner.reservationId,
      httpStatus: response.status,
      body: await response.json().catch(() => ({})),
    });
  }
  const afterCleanup = await league();
  const cleanedIntents = await Promise.all(
    intentIds.map((id) => stripe.paymentIntents.retrieve(id)),
  );
  evidence.league.spotsAfterCleanup = afterCleanup.spotsRemaining;
  evidence.cleanupStripeStatuses = cleanedIntents.map((intent) => ({
    id: intent.id,
    status: intent.status,
  }));
  assertions.cleanupReturnedCapacity = afterCleanup.spotsRemaining === before.spotsRemaining;
  assertions.cleanupCancelledAllIntents = cleanedIntents.every(
    (intent) => intent.status === "canceled",
  );

  console.log(JSON.stringify(evidence, null, 2));
  if (!Object.values(assertions).every(Boolean)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
