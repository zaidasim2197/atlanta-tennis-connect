/**
 * Phase 4 – Historical-Winner Flow Simulation
 * Demonstrates historical winner lookup and flagging for manual review.
 */
import "dotenv/config";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"]);

import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { Player } from "../src/models/Player";
import { League } from "../src/models/League";
import { TournamentHistory } from "../src/models/TournamentHistory";
import { Reservation } from "../src/models/Reservation";
import { AuditLog } from "../src/models/AuditLog";
import { createReservation } from "../src/lib/reservationService";

async function simulateHistoricalWinner() {
  console.log("🏆 Phase 4 – Simulating Historical-Winner Registration Flow...");
  await connectDB();

  // 1. Find a real seeded champion matching an active league
  const championHistory = await TournamentHistory.findOne({
    finish: "champion",
    skillLevel: { $in: ["3.0", "3.5", "4.0", "4.5", "5.0"] },
    year: { $gte: 2024 },
  });
  if (!championHistory) throw new Error("No seeded champion record found matching league levels");

  console.log("\n[Step 1] Picked Real Seeded Winner Record from DB:");
  console.log(`  • Player Email:    ${championHistory.playerEmail}`);
  console.log(`  • Player Name:     ${championHistory.playerName}`);
  console.log(`  • Tournament:      ${championHistory.tournamentName}`);
  console.log(`  • Finish:          ${championHistory.finish.toUpperCase()}`);
  console.log(`  • Division/Skill:  ${championHistory.division} (${championHistory.skillLevel})`);
  console.log(`  • Year:            ${championHistory.year}`);

  // Find matching league (e.g. Midtown Tuesday Singles l-1 is 3.5 skill level)
  const targetLeague = await League.findOne({ skillLevel: championHistory.skillLevel, spotsRemaining: { $gt: 0 } });
  if (!targetLeague) throw new Error("No open league found matching skill level");

  console.log("\n[Step 2] Target League for Registration:");
  console.log(`  • League Slug:     ${targetLeague.slug}`);
  console.log(`  • League Name:     ${targetLeague.name}`);
  console.log(`  • Skill Level:     ${targetLeague.skillLevel}`);
  console.log(`  • Spots Remaining: ${targetLeague.spotsRemaining}`);

  // 2. Clean up any existing test reservation for this player in this league
  await Reservation.deleteMany({ playerEmail: championHistory.playerEmail, leagueSlug: targetLeague.slug });

  // 3. Attempt registration via reservationService
  console.log("\n[Step 3] Executing createReservation() for champion player...");
  const result = await createReservation({
    leagueSlug: targetLeague.slug,
    playerEmail: championHistory.playerEmail,
  });

  const reservationDoc = await Reservation.findById(result.reservation.id);
  const auditDoc = await AuditLog.findOne({ reservationId: result.reservation.id, action: "reservation.created" });

  console.log("\n[Step 4] Verification of Flag & Review Reason:");
  console.log(`  • Reservation ID:       ${result.reservation.id}`);
  console.log(`  • Status:               ${result.reservation.status} (Allowed through – NOT hard blocked)`);
  console.log(`  • Flagged for Review:   ${result.reservation.flaggedForReview ? "🚩 YES (TRUE)" : "❌ NO"}`);
  console.log(`  • Review Reason:        "${result.reservation.reviewReason}"`);
  console.log(`  • Audit Log Flagged:    ${auditDoc?.meta?.flaggedForReview ? "✅ Recorded in AuditLog" : "❌ Missing in AuditLog"}`);
  console.log(`  • Final Decision Type:  Manual Organiser Review Pending (NO hardcoded automatic block/move)`);

  if (result.reservation.flaggedForReview && result.reservation.status !== "failed") {
    console.log("\n✅ PHASE 4 PASS: Historical winner correctly detected and flagged for organiser review without hardcoded block.");
  } else {
    console.log("\n❌ PHASE 4 FAIL: Historical winner flag verification failed.");
  }

  await mongoose.disconnect();
}

simulateHistoricalWinner().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
