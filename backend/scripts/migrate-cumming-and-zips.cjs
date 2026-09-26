const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

const APPROVED_ATLANTA_ZIPS = [
  "30004", "30005", "30008", "30009", "30022", "30023", "30028", "30040", "30041", "30060",
  "30062", "30064", "30066", "30067", "30068",
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
  "l-cumming-ms35": "Cumming",
  "l-cumming-mxd35": "Cumming",
  "l-decatur-ms35": "Cumming",
  "l-decatur-ws35": "Cumming",
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

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas");

  const Player = mongoose.model('Player', new mongoose.Schema({}, { strict: false }));
  const League = mongoose.model('League', new mongoose.Schema({}, { strict: false }));
  const Reservation = mongoose.model('Reservation', new mongoose.Schema({}, { strict: false }));

  // 1. Update Decatur leagues to Cumming (names, venues, area, geographicGroup)
  console.log("\n--- Converting Decatur leagues to Cumming ---");
  const updateL1 = await League.updateOne(
    { slug: "l-decatur-ms35" },
    {
      $set: {
        name: "Cumming Central Park Singles",
        venue: "Central Park Tennis Complex",
        area: "Cumming",
        geographicGroup: "Cumming",
        description: "Cumming tennis league hosted at Central Park Tennis Complex.",
      },
    }
  );
  console.log("Updated l-decatur-ms35:", updateL1);

  const updateL2 = await League.updateOne(
    { slug: "l-decatur-ws35" },
    {
      $set: {
        name: "Cumming City Park Women Evening",
        venue: "Cumming City Park Tennis Center",
        area: "Cumming",
        geographicGroup: "Cumming",
        description: "Active evening women singles league in the heart of Cumming.",
      },
    }
  );
  console.log("Updated l-decatur-ws35:", updateL2);

  // Update area for all leagues
  for (const [slug, area] of Object.entries(LEAGUE_AREA_MAP)) {
    await League.updateOne({ slug }, { $set: { area } });
  }

  // 2. Ensure all players in MongoDB have valid zipCodes in APPROVED_ATLANTA_ZIPS
  // Distribute new Alpharetta, Cumming, and Marietta zip codes across some players
  const allPlayers = await Player.find({});
  console.log(`Checking ${allPlayers.length} players for approved zip codes...`);

  const newZips = [
    "30004", "30005", "30008", "30009", "30022", "30023", "30028", "30040", "30041", "30060",
    "30062", "30064", "30066", "30067", "30068"
  ];

  // Assign new zips to players registered in Cumming, Alpharetta, and Marietta leagues
  const cummingReservations = await Reservation.find({
    leagueSlug: { $in: ["l-cumming-ms35", "l-cumming-mxd35", "l-decatur-ms35", "l-decatur-ws35"] },
  });
  const cummingEmails = [...new Set(cummingReservations.map((r) => r.playerEmail))];
  const cummingZips = ["30028", "30040", "30041"];
  for (let i = 0; i < cummingEmails.length; i++) {
    await Player.updateOne(
      { email: cummingEmails[i] },
      { $set: { zipCode: cummingZips[i % cummingZips.length], city: "Cumming" } }
    );
  }

  const alpharettaReservations = await Reservation.find({
    leagueSlug: { $in: ["l-alpharetta-ms40", "l-alpharetta-ws30", "l-johnscreek-ms45", "l-johnscreek-ws35"] },
  });
  const alpharettaEmails = [...new Set(alpharettaReservations.map((r) => r.playerEmail))];
  const alpharettaZips = ["30004", "30005", "30009", "30022", "30023"];
  for (let i = 0; i < alpharettaEmails.length; i++) {
    await Player.updateOne(
      { email: alpharettaEmails[i] },
      { $set: { zipCode: alpharettaZips[i % alpharettaZips.length], city: "Alpharetta" } }
    );
  }

  const mariettaReservations = await Reservation.find({
    leagueSlug: { $in: ["l-marietta-md35", "l-marietta-ms40", "l-smyrna-ms35", "l-smyrna-mxd30"] },
  });
  const mariettaEmails = [...new Set(mariettaReservations.map((r) => r.playerEmail))];
  const mariettaZips = ["30008", "30060", "30062", "30064", "30066", "30067", "30068"];
  for (let i = 0; i < mariettaEmails.length; i++) {
    await Player.updateOne(
      { email: mariettaEmails[i] },
      { $set: { zipCode: mariettaZips[i % mariettaZips.length], city: "Marietta" } }
    );
  }

  // Ensure every player in DB has a valid zip
  const playersAfter = await Player.find({});
  for (let i = 0; i < playersAfter.length; i++) {
    const p = playersAfter[i];
    if (!APPROVED_ATLANTA_ZIPS.includes(p.zipCode)) {
      const fallbackZip = APPROVED_ATLANTA_ZIPS[i % APPROVED_ATLANTA_ZIPS.length];
      await Player.updateOne({ _id: p._id }, { $set: { zipCode: fallbackZip } });
    }
  }

  // 3. Verifications
  const finalPlayers = await Player.countDocuments();
  const invalidZipPlayers = await Player.countDocuments({ zipCode: { $nin: APPROVED_ATLANTA_ZIPS } });
  const remainingDecaturLeagues = await League.countDocuments({
    $or: [
      { area: "Decatur" },
      { name: { $regex: /decatur/i } },
      { venue: { $regex: /decatur/i } },
      { venue: { $regex: /mckoy/i } },
      { venue: { $regex: /dekalb/i } },
    ],
  });

  const allLeagues = await League.find({}).sort({ slug: 1 });
  console.log("\n=== ALL 21 LEAGUES POST-MIGRATION ===");
  allLeagues.forEach((l) => console.log(`${l.slug} | Name: "${l.name}" | Area: ${l.area} | Venue: "${l.venue}"`));

  console.log("\n=== FINAL VERIFICATION ===");
  console.log(`Total Players: ${finalPlayers} (Target: 500)`);
  console.log(`Invalid Zip Players: ${invalidZipPlayers} (Target: 0)`);
  console.log(`Remaining Decatur Leagues: ${remainingDecaturLeagues} (Target: 0)`);

  const cummingLeagues = await League.find({ area: "Cumming" });
  console.log(`Total Cumming Leagues: ${cummingLeagues.length}`);

  if (finalPlayers !== 500 || invalidZipPlayers !== 0 || remainingDecaturLeagues !== 0) {
    throw new Error("Verification failed!");
  }

  console.log("\nSUCCESS! Decatur leagues converted to Cumming and zip codes verified.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
