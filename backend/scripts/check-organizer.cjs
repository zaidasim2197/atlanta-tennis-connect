const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

async function checkOrganizer() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Account = mongoose.model('Account', new mongoose.Schema({}, { strict: false }));
  const Player = mongoose.model('Player', new mongoose.Schema({}, { strict: false }));

  const orgAccount = await Account.findOne({ email: 'organizer@baselineatl.com' }).select('+passwordHash');
  console.log('Organizer Account:', orgAccount);

  if (orgAccount) {
    const orgPlayer = await Player.findOne({ slug: orgAccount.playerSlug });
    console.log('Organizer Player by slug:', orgPlayer);

    const orgPlayerByEmail = await Player.findOne({ email: 'organizer@baselineatl.com' });
    console.log('Organizer Player by email:', orgPlayerByEmail);
  }

  await mongoose.disconnect();
}
checkOrganizer().catch(console.error);
