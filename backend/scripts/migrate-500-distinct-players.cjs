const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

const APPROVED_ATLANTA_ZIPS = [
  "30303", "30305", "30306", "30307", "30308", "30309", "30310", "30311", "30312", "30313",
  "30314", "30315", "30316", "30317", "30318", "30319", "30324", "30326", "30327", "30328",
  "30329", "30331", "30332", "30334", "30336", "30337", "30338", "30339", "30340", "30341",
  "30342", "30344", "30345", "30349", "30350", "30354", "30360", "30363",
];

const LEAGUE_AREA_MAP = {
  "l-alpharetta-ms40": "Alpharetta",
  "l-alpharetta-ws30": "Alpharetta",
  "l-buckhead-ms45": "Buckhead",
  "l-buckhead-mxd40": "Buckhead",
  "l-cumming-ms35": "Alpharetta",
  "l-cumming-mxd35": "Alpharetta",
  "l-decatur-ms35": "Decatur",
  "l-decatur-ws35": "Decatur",
  "l-hot": "Midtown",
  "l-johnscreek-ms45": "Alpharetta",
  "l-johnscreek-ws35": "Alpharetta",
  "l-marietta-md35": "Marietta",
  "l-marietta-ms40": "Marietta",
  "l-midtown-ms35": "Midtown",
  "l-midtown-ws30": "Midtown",
  "l-roswell-ms35": "Sandy Springs",
  "l-roswell-mxd40": "Sandy Springs",
  "l-sandysprings-ms40": "Sandy Springs",
  "l-sandysprings-mxd35": "Sandy Springs",
  "l-smyrna-ms35": "Marietta",
  "l-smyrna-mxd30": "Marietta",
};

const FIRST_NAMES = [
  "Liam", "Noah", "Oliver", "James", "Elijah", "Mateo", "Theodore", "Henry", "Lucas", "William",
  "Benjamin", "Levi", "Sebastian", "Jack", "Ezra", "Michael", "Daniel", "Leo", "Owen", "Samuel",
  "Hudson", "Alexander", "Asher", "John", "David", "Julian", "Jackson", "Anthony", "Dylan", "Carter",
  "Olivia", "Emma", "Charlotte", "Amelia", "Sophia", "Mia", "Isabella", "Ava", "Evelyn", "Luna",
  "Harper", "Sofia", "Camila", "Eleanor", "Elizabeth", "Violet", "Scarlett", "Emily", "Hazel", "Chloe"
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts"
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas");

  const Player = mongoose.model('Player', new mongoose.Schema({}, { strict: false }));
  const Reservation = mongoose.model('Reservation', new mongoose.Schema({}, { strict: false }));
  const League = mongoose.model('League', new mongoose.Schema({}, { strict: false }));

  // Step 1: Update League Areas
  console.log("Updating league areas...");
  for (const [slug, area] of Object.entries(LEAGUE_AREA_MAP)) {
    await League.updateOne({ slug }, { $set: { area } });
  }

  // Step 2: Remove all players who are not registered in any league
  const registeredEmails = await Reservation.distinct('playerEmail');
  console.log(`Currently registered distinct emails: ${registeredEmails.length}`);

  const deleteResult = await Player.deleteMany({ email: { $nin: registeredEmails } });
  console.log(`Deleted ${deleteResult.deletedCount} unregistered players.`);

  // Step 3: Ensure existing players have valid zip codes from APPROVED_ATLANTA_ZIPS
  const existingPlayers = await Player.find({});
  for (let i = 0; i < existingPlayers.length; i++) {
    const p = existingPlayers[i];
    if (!APPROVED_ATLANTA_ZIPS.includes(p.zipCode)) {
      const assignedZip = APPROVED_ATLANTA_ZIPS[i % APPROVED_ATLANTA_ZIPS.length];
      await Player.updateOne({ _id: p._id }, { $set: { zipCode: assignedZip } });
    }
  }

  // Step 4: Calculate how many more distinct players are needed to reach exactly 500
  let currentDistinctCount = await Player.countDocuments();
  console.log(`Current distinct player count: ${currentDistinctCount}`);

  const targetCount = 500;
  const needed = targetCount - currentDistinctCount;
  console.log(`Players needed to reach 500: ${needed}`);

  if (needed > 0) {
    const leagues = await League.find({}).sort({ slug: 1 });
    console.log(`Distributing ${needed} new registered players across ${leagues.length} leagues...`);

    let added = 0;
    let leagueIdx = 0;

    while (added < needed) {
      const currentLeague = leagues[leagueIdx % leagues.length];
      const playerNum = currentDistinctCount + added + 1;
      const fName = FIRST_NAMES[(added * 7 + 3) % FIRST_NAMES.length];
      const lName = LAST_NAMES[(added * 11 + 5) % LAST_NAMES.length];
      const email = `player${playerNum}@atlantatennis.org`.toLowerCase();
      const slug = `p-atl-${playerNum}`;
      const zipCode = APPROVED_ATLANTA_ZIPS[added % APPROVED_ATLANTA_ZIPS.length];

      // Create Player
      await Player.create({
        slug,
        firstName: fName,
        lastName: lName,
        email,
        phone: `(404) 555-${String(1000 + added).slice(-4)}`,
        ntrp: currentLeague.skillLevel || "3.5",
        city: "Atlanta",
        zipCode,
        preferredCourt: currentLeague.venue || "Piedmont Park Courts",
        preferredFormat: currentLeague.format || "men-singles",
        accountStatus: "active",
        profileStatus: "complete",
        rating: parseFloat(currentLeague.skillLevel || "3.5"),
        preferredSide: "both",
      });

      // Create confirmed registration for this player in currentLeague
      const resId = new mongoose.Types.ObjectId();
      const now = new Date();
      await Reservation.create({
        _id: resId,
        leagueSlug: currentLeague.slug,
        playerSlug: slug,
        playerEmail: email,
        status: "registered",
        amountCents: currentLeague.feeCents || 4500,
        paymentProvider: "mock",
        idempotencyKey: `seed-idemp-${resId.toString()}`,
        heldAt: now,
        paidAt: now,
        expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        flaggedForReview: false,
      });

      added++;
      leagueIdx++;
    }
    console.log(`Successfully added and registered ${added} new players!`);
  }

  // Step 5: Recalculate and update league playerLimit and spotsRemaining
  const allLeagues = await League.find({});
  for (const l of allLeagues) {
    const regCount = await Reservation.countDocuments({ leagueSlug: l.slug, status: { $in: ['registered', 'paid', 'held'] } });
    const bufferSpots = 6; // Leave 6 spots open for registrations
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
    console.log(`League ${l.slug}: registered=${regCount}, spotsRemaining=${bufferSpots}, playerLimit=${newLimit}, area=${l.area || LEAGUE_AREA_MAP[l.slug]}`);
  }

  // Step 6: Final assertions and verification
  const finalPlayerCount = await Player.countDocuments();
  const finalDistinctRegEmails = (await Reservation.distinct('playerEmail')).length;
  const finalDistinctRegSlugs = (await Reservation.distinct('playerSlug')).length;
  const unregisteredLeft = await Player.countDocuments({ email: { $nin: await Reservation.distinct('playerEmail') } });

  console.log("=== FINAL VERIFICATION ===");
  console.log(`Total Players in DB: ${finalPlayerCount} (Target: 500)`);
  console.log(`Distinct Registered Emails: ${finalDistinctRegEmails} (Target: 500)`);
  console.log(`Distinct Registered Slugs: ${finalDistinctRegSlugs} (Target: 500)`);
  console.log(`Unregistered Players Remaining: ${unregisteredLeft} (Target: 0)`);

  if (finalPlayerCount !== 500 || unregisteredLeft !== 0 || finalDistinctRegEmails !== 500) {
    throw new Error(`Verification failed! finalPlayerCount=${finalPlayerCount}, unregisteredLeft=${unregisteredLeft}`);
  }

  console.log("SUCCESS! All database constraints and counts verified.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
