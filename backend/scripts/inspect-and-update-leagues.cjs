const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const League = mongoose.model('League', new mongoose.Schema({}, { strict: false }));
  const leagues = await League.find({ name: { $regex: /flight/i } });
  console.log('Leagues with flight in name count:', leagues.length);
  leagues.forEach(l => console.log(l.slug, ':', l.name));

  console.log('\nAll 21 league names:');
  const all = await League.find({}).sort({ slug: 1 });
  all.forEach(l => console.log(l.slug, ':', l.name));

  await mongoose.disconnect();
}
check().catch(console.error);
