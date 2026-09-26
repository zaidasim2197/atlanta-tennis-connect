/**
 * Targeted, idempotent update script to assign realistic metro areas (Issue 8)
 * and update 2-3 leagues to NTRP 5.0 (Issue 10).
 * 
 * Rules:
 * - Changes ONLY the 'area' field and specific 'skillLevel' fields.
 * - Does NOT change names, capacities, dates, formats, fees, etc.
 * - Areas used are from CITY_OPTIONS / ATLANTA_AREAS:
 *   ['Midtown', 'Buckhead', 'Decatur', 'Sandy Springs', 'Alpharetta', 'Marietta']
 * - Reassigns 2 leagues from '4.5+' (demo-league-24, demo-league-25) to '5.0'
 */
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const LEAGUE_UPDATES = [
  // 1-5 (2.5)
  { slug: 'demo-league-01', area: 'Buckhead' },      // Bitsy Grant Racquet Center
  { slug: 'demo-league-02', area: 'Buckhead' },      // Chastain Park Racquet Center
  { slug: 'demo-league-03', area: 'Midtown' },       // Joseph McGhee Racquet Center
  { slug: 'demo-league-04', area: 'Midtown' },       // Sharon Lester at Piedmont Park
  { slug: 'demo-league-05', area: 'Midtown' },       // Washington Park Racquet Center

  // 6-10 (3.0)
  { slug: 'demo-league-06', area: 'Decatur' },       // Candler Park Tennis Courts
  { slug: 'demo-league-07', area: 'Decatur' },       // Brownwood Park Tennis Courts
  { slug: 'demo-league-08', area: 'Midtown' },       // Central Park Tennis Courts
  { slug: 'demo-league-09', area: 'Decatur' },       // Grant Park Tennis Courts
  { slug: 'demo-league-10', area: 'Buckhead' },      // McClatchey Park Tennis Courts

  // 11-15 (3.5)
  { slug: 'demo-league-11', area: 'Buckhead' },      // Bitsy Grant Racquet Center
  { slug: 'demo-league-12', area: 'Sandy Springs' }, // Capital City Racquet League (Chastain Park area -> Sandy Springs)
  { slug: 'demo-league-13', area: 'Decatur' },       // Candler Park Court Sessions
  { slug: 'demo-league-14', area: 'Midtown' },       // Northside Net Masters
  { slug: 'demo-league-15', area: 'Marietta' },      // Southside Tennis -> Marietta

  // 16-20 (4.0)
  { slug: 'demo-league-16', area: 'Alpharetta' },    // Intown Autumn Rally -> Alpharetta
  { slug: 'demo-league-17', area: 'Decatur' },       // Atlanta Sunset Rally
  { slug: 'demo-league-18', area: 'Midtown' },       // The Racquet Club
  { slug: 'demo-league-19', area: 'Sandy Springs' }, // Peachtree Partners Cup -> Sandy Springs
  { slug: 'demo-league-20', area: 'Alpharetta' },    // City Lights Tennis -> Alpharetta

  // 21-25 (4.5+ / 5.0)
  { slug: 'demo-league-21', area: 'Buckhead' },      // The Autumn Court Collective (4.5)
  { slug: 'demo-league-22', area: 'Sandy Springs' }, // Atlanta Winter Warmup (4.5)
  { slug: 'demo-league-23', area: 'Marietta' },      // Neighborhood Net League (4.5)
  { slug: 'demo-league-24', area: 'Midtown', skillLevel: '5.0' },       // The Service Club -> 5.0
  { slug: 'demo-league-25', area: 'Sandy Springs', skillLevel: '5.0' }, // Metro Atlanta Racquet Series -> 5.0
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('Connected to database. Applying targeted area & skillLevel updates...');

  for (const update of LEAGUE_UPDATES) {
    const $set = { area: update.area };
    if (update.skillLevel) {
      $set.skillLevel = update.skillLevel;
    }
    const res = await db.collection('leagues').updateOne(
      { slug: update.slug },
      { $set }
    );
    console.log(`Updated ${update.slug}: matched ${res.matchedCount}, modified ${res.modifiedCount} (area=${update.area}${update.skillLevel ? `, skill=${update.skillLevel}` : ''})`);
  }

  // Verification & Distribution Report
  const leagues = await db.collection('leagues').find({}).toArray();
  const areaCounts = {};
  const skillCounts = {};
  for (const l of leagues) {
    areaCounts[l.area] = (areaCounts[l.area] || 0) + 1;
    skillCounts[l.skillLevel] = (skillCounts[l.skillLevel] || 0) + 1;
  }

  console.log('\n=== Area Distribution across 25 leagues ===');
  console.log(JSON.stringify(areaCounts, null, 2));

  console.log('\n=== Skill Level Distribution across 25 leagues ===');
  console.log(JSON.stringify(skillCounts, null, 2));

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error running update-league-areas-skills.cjs:', err);
  process.exit(1);
});
