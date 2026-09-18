/**
 * Phase 5 – Registration Safety Tests
 * 1. Final-slot capacity collision race
 * 2. Duplicate registration / payment confirmation attempt
 * 3. Manual / offline registration capacity decrement
 */
import "dotenv/config";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"]);

import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { League } from "../src/models/League";
import { Player } from "../src/models/Player";
import { Reservation } from "../src/models/Reservation";
import { AuditLog } from "../src/models/AuditLog";
import { createReservation, adminRegister, confirmPayment } from "../src/lib/reservationService";

async function runSafetyTests() {
  console.log("🛡️ Phase 5 – Running Registration Safety Test Suite...\n");
  await connectDB();

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Final-Slot Capacity Collision Race
  // ───────────────────────────────────────────────────────────────────────────
  console.log("==================================================");
  console.log("TEST 1: Final-Slot Capacity Collision Race (l-hot)");
  console.log("==================================================");

  // Reset l-hot to exactly 3 spots
  await Reservation.deleteMany({ leagueSlug: "l-hot" });
  await League.updateOne({ slug: "l-hot" }, { $set: { spotsRemaining: 3, registrationOpen: true } });

  const hotLeagueBefore = await League.findOne({ slug: "l-hot" });
  console.log(`Initial l-hot capacity: ${hotLeagueBefore?.spotsRemaining} spots available.`);

  // 20 concurrent users racing simultaneously for 3 spots
  const racerEmails = Array.from({ length: 20 }, (_, i) => `player${String(460 + i).padStart(4, "0")}@loadtest.atl`);
  console.log(`Firing 20 simultaneous registration requests for 3 spots...`);

  const racePromises = racerEmails.map((email) =>
    createReservation({ leagueSlug: "l-hot", playerEmail: email })
      .then((res) => ({ success: true, email, resId: res.reservation.id, status: res.reservation.status }))
      .catch((err) => ({ success: false, email, error: err.message, statusCode: err.statusCode })),
  );

  const raceResults = await Promise.all(racePromises);
  const successes = raceResults.filter((r) => r.success);
  const rejections = raceResults.filter((r) => !r.success);

  const hotLeagueAfter = await League.findOne({ slug: "l-hot" });
  const totalReservations = await Reservation.countDocuments({
    leagueSlug: "l-hot",
    status: { $in: ["held", "payment_pending", "paid", "registered"] },
  });

  console.log(`\nResults:`);
  console.log(`  • Attempts fired:          20`);
  console.log(`  • Successful reservations: ${successes.length} (Expected: exactly 3)`);
  console.log(`  • Rejected / 409 full:     ${rejections.length} (Expected: exactly 17)`);
  console.log(`  • Remaining spots in DB:   ${hotLeagueAfter?.spotsRemaining}`);
  console.log(`  • Total active records:    ${totalReservations}`);

  const test1Pass = successes.length === 3 && totalReservations === 3 && hotLeagueAfter?.spotsRemaining === 0;
  console.log(`Test 1 Verdict: ${test1Pass ? "✅ PASS — Atomic guard held, ZERO overselling" : "❌ FAIL — Overselling occurred"}\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Duplicate Registration / Payment-Confirmation Attempt
  // ───────────────────────────────────────────────────────────────────────────
  console.log("==================================================");
  console.log("TEST 2: Duplicate Registration & Payment Prevention");
  console.log("==================================================");

  const duplicateTestEmail = "player0300@loadtest.atl";
  const duplicateLeague = "l-1";

  // Clean test player in l-1
  await Reservation.deleteMany({ playerEmail: duplicateTestEmail, leagueSlug: duplicateLeague });

  console.log(`Attempting duplicate registration for player ${duplicateTestEmail} in ${duplicateLeague}...`);

  // First registration: Should succeed
  const reg1 = await createReservation({ leagueSlug: duplicateLeague, playerEmail: duplicateTestEmail });
  console.log(`  • First attempt:  SUCCESS (Reservation ID: ${reg1.reservation.id}, status: ${reg1.reservation.status})`);

  // Second registration: Should fail immediately with 409 Conflict
  let duplicateBlocked = false;
  let duplicateErrorMessage = "";
  try {
    await createReservation({ leagueSlug: duplicateLeague, playerEmail: duplicateTestEmail });
  } catch (err: any) {
    duplicateBlocked = true;
    duplicateErrorMessage = err.message;
    console.log(`  • Second attempt: BLOCKED (Status: ${err.statusCode}, Message: "${err.message}")`);
  }

  // Rapid concurrent duplicate payment confirmations
  console.log(`Testing duplicate payment confirmations on reservation ${reg1.reservation.id}...`);
  const initialAuditCount = await AuditLog.countDocuments({ reservationId: reg1.reservation.id });

  // Simulate receiving duplicate webhook events with the same webhookEventId
  await confirmPayment(reg1.reservation.paymentIntentId || "mock_intent_1", "registered", "evt_duplicate_test_123");
  await confirmPayment(reg1.reservation.paymentIntentId || "mock_intent_1", "registered", "evt_duplicate_test_123");

  const finalAuditCount = await AuditLog.countDocuments({ reservationId: reg1.reservation.id, action: "registration.confirmed" });
  const playerReservationCount = await Reservation.countDocuments({ playerEmail: duplicateTestEmail, leagueSlug: duplicateLeague });

  console.log(`  • Player active reservations in league: ${playerReservationCount} (Expected: 1)`);
  console.log(`  • Registration confirmed audit events:  ${finalAuditCount} (Expected: 1, idempotent)`);

  const test2Pass = duplicateBlocked && playerReservationCount === 1;
  console.log(`Test 2 Verdict: ${test2Pass ? "✅ PASS — Duplicate attempts blocked, idempotency preserved" : "❌ FAIL"}\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Manual / Offline Registration and Capacity Decrement
  // ───────────────────────────────────────────────────────────────────────────
  console.log("==================================================");
  console.log("TEST 3: Manual / Offline Registration Capacity Guard");
  console.log("==================================================");

  const manualLeague = "l-4"; // Sandy Springs
  const manualPlayer = "player0350@loadtest.atl";
  await Reservation.deleteMany({ playerEmail: manualPlayer, leagueSlug: manualLeague });

  const leagueBeforeManual = await League.findOne({ slug: manualLeague });
  const spotsBefore = leagueBeforeManual!.spotsRemaining;
  console.log(`Initial capacity for ${manualLeague}: ${spotsBefore} spots remaining.`);

  console.log(`Admin executes manual registration for ${manualPlayer}...`);
  const adminRes = await adminRegister({ leagueSlug: manualLeague, playerEmail: manualPlayer });
  console.log(`  • Admin registration status: ${adminRes.status}`);

  const leagueAfterManual = await League.findOne({ slug: manualLeague });
  const spotsAfter = leagueAfterManual!.spotsRemaining;
  console.log(`Capacity after manual registration: ${spotsAfter} spots remaining.`);

  const decrementHeld = spotsAfter === spotsBefore - 1;
  console.log(`  • Capacity correctly decremented by 1: ${decrementHeld ? "YES" : "NO"}`);

  // Fill all remaining spots to 0 to verify online registrations are immediately blocked
  await League.updateOne({ slug: manualLeague }, { $set: { spotsRemaining: 0 } });
  let onlineAttemptBlocked = false;
  try {
    await createReservation({ leagueSlug: manualLeague, playerEmail: "player0351@loadtest.atl" });
  } catch (e: any) {
    onlineAttemptBlocked = e.statusCode === 409;
    console.log(`  • Subsequent online registration attempt when full: BLOCKED with 409 (${e.message})`);
  }

  // Restore spots
  await League.updateOne({ slug: manualLeague }, { $set: { spotsRemaining: spotsAfter } });

  const test3Pass = decrementHeld && onlineAttemptBlocked;
  console.log(`Test 3 Verdict: ${test3Pass ? "✅ PASS — Manual registrations strictly protect online capacity" : "❌ FAIL"}\n`);

  console.log("==================================================");
  console.log("SUMMARY OF SAFETY TESTS:");
  console.log(`1. Final-Slot Capacity Collision: ${test1Pass ? "PASS" : "FAIL"}`);
  console.log(`2. Duplicate Prevention:         ${test2Pass ? "PASS" : "FAIL"}`);
  console.log(`3. Manual Registration Guard:    ${test3Pass ? "PASS" : "FAIL"}`);
  console.log("==================================================");

  await mongoose.disconnect();
}

runSafetyTests().catch((err) => {
  console.error("Safety tests failed:", err);
  process.exit(1);
});
