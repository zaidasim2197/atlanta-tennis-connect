const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const TARGET_LEAGUES = [
  { slug: 'LG-WS-35', name: "Women's Singles 3.5" },
  { slug: 'LG-MD-40', name: "Men's Doubles 4.0" },
  { slug: 'LG-MS-35', name: "Men's Singles 3.5" },
  { slug: 'LG-MXD-35', name: "Mixed Doubles 3.5" },
  { slug: 'l-1', name: "Tuesday Singles (Men's Singles)" }
];

async function verify() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const slugs = TARGET_LEAGUES.map(l => l.slug);

  const leagueDocs = await db.collection('leagues').find({ slug: { $in: slugs } }).toArray();
  const resDocs = await db.collection('reservations').find({ leagueSlug: { $in: slugs } }).toArray();
  const auditDocs = await db.collection('auditlogs').find({
    $or: [
      { leagueSlug: { $in: slugs } },
      { targetId: { $in: slugs } },
      { 'details.leagueSlug': { $in: slugs } }
    ]
  }).toArray();
  
  let fixtureDocs = [];
  try {
    fixtureDocs = await db.collection('schedules').find({ leagueSlug: { $in: slugs } }).toArray();
  } catch(e) {}

  console.log('VERIFICATION RESULTS:');
  console.log(`Leagues remaining:       ${leagueDocs.length}`);
  console.log(`Reservations remaining:  ${resDocs.length}`);
  console.log(`Audit logs remaining:    ${auditDocs.length}`);
  console.log(`Fixtures remaining:      ${fixtureDocs.length}`);

  const allClear = (leagueDocs.length === 0 && resDocs.length === 0 && auditDocs.length === 0 && fixtureDocs.length === 0);
  console.log(`STATUS: ${allClear ? '✅ PERFECT - All 5 leagues completely eliminated from database.' : '❌ FAILED'}`);

  await mongoose.disconnect();
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});
