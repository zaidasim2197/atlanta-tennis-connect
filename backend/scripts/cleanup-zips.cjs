const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: 'backend/.env' });
const mongoose = require('mongoose');

const APPROVED_ATLANTA_ZIPS = [
  "30303", "30305", "30306", "30307", "30308", "30309", "30310", "30311", "30312", "30313",
  "30314", "30315", "30316", "30317", "30318", "30319", "30324", "30326", "30327", "30328",
  "30329", "30331", "30332", "30334", "30336", "30337", "30338", "30339", "30340", "30341",
  "30342", "30344", "30345", "30349", "30350", "30354", "30360", "30363",
];
const approvedSet = new Set(APPROVED_ATLANTA_ZIPS);

async function cleanupZips() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'atlanta-tennis' });
  const playersCol = mongoose.connection.collection('players');

  const invalidPlayers = await playersCol.find({ zipCode: { $nin: APPROVED_ATLANTA_ZIPS } }).toArray();
  console.log(`Found ${invalidPlayers.length} players with non-approved ZIP codes.`);

  for (const player of invalidPlayers) {
    console.log(`Updating player ${player.email} (${player.slug}) from zip "${player.zipCode}" to "30309"`);
    await playersCol.updateOne({ _id: player._id }, { $set: { zipCode: "30309" } });
  }

  const remainingInvalid = await playersCol.countDocuments({ zipCode: { $nin: APPROVED_ATLANTA_ZIPS } });
  console.log(`Post-cleanup invalid ZIP count: ${remainingInvalid} (must be 0)`);
  if (remainingInvalid !== 0) {
    throw new Error(`Failed assertions: ${remainingInvalid} players still have invalid ZIPs`);
  }

  console.log('✅ ZIP cleanup completed and validated successfully.');
  await mongoose.disconnect();
}

cleanupZips().catch((err) => {
  console.error(err);
  process.exit(1);
});
