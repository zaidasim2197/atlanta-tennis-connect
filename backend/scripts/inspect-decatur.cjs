const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

async function viewDecatur() {
  await mongoose.connect(process.env.MONGODB_URI);
  const League = mongoose.model('League', new mongoose.Schema({}, { strict: false }));
  const leagues = await League.find({
    $or: [
      { area: 'Decatur' },
      { slug: /decatur/ },
      { name: /decatur/i },
      { venue: /decatur/i },
      { venue: /mckoy/i },
      { venue: /dekalb/i }
    ]
  });
  console.log(JSON.stringify(leagues, null, 2));
  await mongoose.disconnect();
}
viewDecatur().catch(console.error);
