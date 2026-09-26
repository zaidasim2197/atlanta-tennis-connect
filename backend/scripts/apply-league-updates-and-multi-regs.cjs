const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas");

  const Player = mongoose.model('Player', new mongoose.Schema({}, { strict: false }));
  const Reservation = mongoose.model('Reservation', new mongoose.Schema({}, { strict: false }));
  const League = mongoose.model('League', new mongoose.Schema({}, { strict: false }));

  // ─── 1. Remove the word "flight" from any league names ───
  console.log("\n--- Updating League Names ---");
  const flightLeagues = await League.find({ name: { $regex: /flight/i } });
  console.log(`Found ${flightLeagues.length} leagues with 'flight' in their name.`);

  for (const league of flightLeagues) {
    const oldName = league.name;
    // Remove "flight" case-insensitively and normalize spaces
    const cleanName = oldName
      .replace(/\bflight\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    await League.updateOne({ _id: league._id }, { $set: { name: cleanName } });
    console.log(`Updated: "${oldName}" -> "${cleanName}"`);
  }

  // ─── 2. Increase League Registrations by 55 (50-60 range) ───
  console.log("\n--- Adding Multi-League Registrations ---");
  const initialRegCount = await Reservation.countDocuments({ status: "registered" });
  const totalPlayersCount = await Player.countDocuments();
  console.log(`Current registered reservations: ${initialRegCount}`);
  console.log(`Current distinct players: ${totalPlayersCount}`);

  const targetIncrease = 55;
  const players = await Player.find({}).limit(targetIncrease * 2);
  const allLeagues = await League.find({}).sort({ slug: 1 });

  let added = 0;
  for (let i = 0; i < players.length && added < targetIncrease; i++) {
    const p = players[i];
    // Find existing league registrations for this player
    const existingReservations = await Reservation.find({
      playerEmail: p.email,
      status: { $in: ["held", "payment_pending", "paid", "registered"] },
    });
    const registeredLeagueSlugs = new Set(existingReservations.map((r) => r.leagueSlug));

    // Pick a league they are NOT currently in
    const targetLeague = allLeagues.find((l) => !registeredLeagueSlugs.has(l.slug));
    if (!targetLeague) continue;

    const resId = new mongoose.Types.ObjectId();
    const now = new Date();

    await Reservation.create({
      _id: resId,
      leagueSlug: targetLeague.slug,
      playerSlug: p.slug,
      playerEmail: p.email,
      status: "registered",
      amountCents: targetLeague.feeCents || 4500,
      paymentProvider: "mock",
      idempotencyKey: `multi-reg-${resId.toString()}`,
      heldAt: now,
      paidAt: now,
      expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      flaggedForReview: false,
    });

    added++;
  }

  console.log(`Successfully added ${added} second-league registrations.`);

  // ─── 3. Recalculate capacity for all leagues ───
  console.log("\n--- Syncing League Capacities ---");
  for (const l of allLeagues) {
    const regCount = await Reservation.countDocuments({
      leagueSlug: l.slug,
      status: { $in: ["registered", "paid", "held"] },
    });
    const bufferSpots = 6;
    const newLimit = regCount + bufferSpots;
    await League.updateOne(
      { _id: l._id },
      {
        $set: {
          playerLimit: newLimit,
          spotsRemaining: bufferSpots,
          registrationOpen: true,
        },
      }
    );
  }

  // ─── 4. Verification ───
  const finalTotalPlayers = await Player.countDocuments();
  const finalDistinctRegEmails = (await Reservation.distinct('playerEmail')).length;
  const finalTotalReservations = await Reservation.countDocuments({ status: "registered" });
  const remainingFlightLeagues = await League.countDocuments({ name: { $regex: /flight/i } });
  const netIncrease = finalTotalReservations - initialRegCount;

  console.log("\n=== FINAL VERIFICATION ===");
  console.log(`Distinct Players in DB: ${finalTotalPlayers} (Should be 500)`);
  console.log(`Distinct Registered Players: ${finalDistinctRegEmails} (Should be 500)`);
  console.log(`Total League Registrations: ${finalTotalReservations} (Increased by ${netIncrease})`);
  console.log(`Leagues with 'flight' in name: ${remainingFlightLeagues} (Should be 0)`);

  if (finalTotalPlayers !== 500 || finalDistinctRegEmails !== 500 || netIncrease !== 55 || remainingFlightLeagues !== 0) {
    throw new Error("Verification conditions not met!");
  }

  console.log("\nAll tasks completed and verified successfully!");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
