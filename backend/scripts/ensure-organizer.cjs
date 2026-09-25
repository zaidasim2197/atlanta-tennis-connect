const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { hashPassword } = require('../dist/lib/auth.js');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const passwordHash = await hashPassword('organizer123');

  await mongoose.connection.collection('players').updateOne(
    { email: 'organizer@atlantatennis.com' },
    {
      $set: {
        slug: 'p-organizer-atlanta',
        firstName: 'Organizer',
        lastName: 'Admin',
        email: 'organizer@atlantatennis.com',
        phone: '(404) 555-0199',
        ntrp: '4.5',
        city: 'Atlanta',
        zipCode: '30309',
        preferredCourt: 'Bitsy Grant Tennis Center',
        accountStatus: 'active',
        profileStatus: 'complete',
        updatedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );

  await mongoose.connection.collection('accounts').updateOne(
    { email: 'organizer@atlantatennis.com' },
    {
      $set: {
        email: 'organizer@atlantatennis.com',
        playerSlug: 'p-organizer-atlanta',
        passwordHash,
        role: 'organizer',
        disabled: false,
        updatedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );

  // Also ensure organizer@baselineatl.com has fresh known password hash
  await mongoose.connection.collection('accounts').updateOne(
    { email: 'organizer@baselineatl.com' },
    {
      $set: {
        passwordHash,
        role: 'organizer',
        disabled: false,
        updatedAt: new Date()
      }
    }
  );

  console.log('Successfully configured organizer accounts: organizer@atlantatennis.com and organizer@baselineatl.com');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
