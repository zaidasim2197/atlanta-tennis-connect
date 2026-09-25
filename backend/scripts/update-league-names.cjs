const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.collection('leagues');

  await col.updateOne({ slug: 'l-2' }, { $set: { name: 'Thursday Mixed Doubles', venue: 'Bitsy Grant Tennis Center' } });
  await col.updateOne({ slug: 'l-3' }, { $set: { name: 'Saturday Junior Singles', venue: 'McKoy Park Courts' } });
  await col.updateOne({ slug: 'l-4' }, { $set: { name: 'Monday Indoor Singles', venue: 'Sandy Springs Indoor Club' } });
  await col.updateOne({ slug: 'l-hot' }, { $set: { name: 'Last-Spots Singles', venue: 'Chastain Park Tennis Center' } });

  const updated = await col.find({}).toArray();
  console.log('UPDATED LEAGUES:', JSON.stringify(updated.map(l => ({ id: l.slug, name: l.name, venue: l.venue })), null, 2));
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
