const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const TARGET_LEAGUES = [
  { slug: 'LG-WS-35', name: "Women's Singles 3.5", season: 'Fall 2026', venue: 'Midtown Court' },
  { slug: 'LG-MD-40', name: "Men's Doubles 4.0", season: 'Fall 2026', venue: 'Brookhaven Area Court' },
  { slug: 'LG-MS-35', name: "Men's Singles 3.5", season: 'Fall 2026', venue: 'Northside Tennis Center' },
  { slug: 'LG-MXD-35', name: "Mixed Doubles 3.5", season: 'Fall 2026', venue: 'Piedmont Area Court' },
  { slug: 'l-1', name: "Tuesday Singles (Men's Singles)", season: 'Fall 2026', venue: 'Piedmont Park Courts' }
];

const isDryRun = process.argv.includes('--dry-run');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  console.log(`Connected to database: ${db.databaseName}`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (No changes will be written)' : 'LIVE EXECUTION (Deleting records inside transactions)'}`);
  console.log('----------------------------------------------------');

  const leagueSlugs = TARGET_LEAGUES.map(l => l.slug);

  // 1. Dry run / counting phase
  const countsPerLeague = {};
  for (const league of TARGET_LEAGUES) {
    const slug = league.slug;
    const leagueDoc = await db.collection('leagues').findOne({ slug });
    const leagueIdStr = leagueDoc ? leagueDoc._id.toString() : null;

    // Check reservations (references leagueSlug or leagueId)
    const reservationQuery = {
      $or: [
        { leagueSlug: slug },
        ...(leagueIdStr ? [{ leagueId: leagueDoc._id }, { leagueId: leagueIdStr }] : [])
      ]
    };
    const reservationsCount = await db.collection('reservations').countDocuments(reservationQuery);

    // Check registrations (if exists)
    let registrationsCount = 0;
    try {
      registrationsCount = await db.collection('registrations').countDocuments({
        $or: [{ leagueSlug: slug }, ...(leagueIdStr ? [{ leagueId: leagueDoc._id }, { leagueId: leagueIdStr }] : [])]
      });
    } catch (e) {}

    // Check schedules / fixtures
    let fixturesCount = 0;
    try {
      fixturesCount = await db.collection('schedules').countDocuments({
        $or: [{ leagueSlug: slug }, ...(leagueIdStr ? [{ leagueId: leagueDoc._id }, { leagueId: leagueIdStr }] : [])]
      });
    } catch (e) {}

    // Check audit logs (AuditLog schema uses `leagueSlug` and `reservationId`)
    const auditQuery = {
      $or: [
        { leagueSlug: slug },
        { targetId: slug },
        { 'details.leagueSlug': slug },
        ...(leagueIdStr ? [{ targetId: leagueIdStr }, { 'details.leagueId': leagueIdStr }] : [])
      ]
    };
    const auditLogsCount = await db.collection('auditlogs').countDocuments(auditQuery);

    countsPerLeague[slug] = {
      name: league.name,
      leagueDocFound: !!leagueDoc,
      leagueId: leagueIdStr,
      reservations: reservationsCount,
      registrations: registrationsCount,
      fixtures: fixturesCount,
      auditlogs: auditLogsCount
    };
  }

  console.log('TARGET LEAGUES INVENTORY TO DELETE:');
  console.table(countsPerLeague);

  if (isDryRun) {
    console.log('Dry run complete. No records were modified or deleted.');
    await mongoose.disconnect();
    return;
  }

  // Live execution inside MongoDB transaction per league
  console.log('\n--- EXECUTING CASCADING DELETIONS PER LEAGUE TRANSACTION ---');
  for (const league of TARGET_LEAGUES) {
    const slug = league.slug;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      console.log(`\nProcessing transaction for league: ${league.name} (${slug})...`);
      const leagueDoc = await db.collection('leagues').findOne({ slug }, { session });
      const leagueIdStr = leagueDoc ? leagueDoc._id.toString() : null;

      // 1. Fixtures / Schedules
      try {
        const fixtureRes = await db.collection('schedules').deleteMany({
          $or: [{ leagueSlug: slug }, ...(leagueIdStr ? [{ leagueId: leagueDoc._id }, { leagueId: leagueIdStr }] : [])]
        }, { session });
        console.log(`  - Deleted ${fixtureRes.deletedCount} schedules/fixtures`);
      } catch (err) {}

      // 2. Reservations
      const resRes = await db.collection('reservations').deleteMany({
        $or: [
          { leagueSlug: slug },
          ...(leagueIdStr ? [{ leagueId: leagueDoc._id }, { leagueId: leagueIdStr }] : [])
        ]
      }, { session });
      console.log(`  - Deleted ${resRes.deletedCount} reservations`);

      // 3. Registrations (if any)
      try {
        const regRes = await db.collection('registrations').deleteMany({
          $or: [{ leagueSlug: slug }, ...(leagueIdStr ? [{ leagueId: leagueDoc._id }, { leagueId: leagueIdStr }] : [])]
        }, { session });
        console.log(`  - Deleted ${regRes.deletedCount} registrations`);
      } catch (err) {}

      // 4. Audit logs
      const auditRes = await db.collection('auditlogs').deleteMany({
        $or: [
          { leagueSlug: slug },
          { targetId: slug },
          { 'details.leagueSlug': slug },
          ...(leagueIdStr ? [{ targetId: leagueIdStr }, { 'details.leagueId': leagueIdStr }] : [])
        ]
      }, { session });
      console.log(`  - Deleted ${auditRes.deletedCount} audit logs`);

      // 5. League document
      const leagueRes = await db.collection('leagues').deleteOne({ slug }, { session });
      console.log(`  - Deleted ${leagueRes.deletedCount} league document`);

      await session.commitTransaction();
      console.log(`Transaction COMMITTED successfully for ${slug}.`);
    } catch (error) {
      await session.abortTransaction();
      console.error(`Transaction ABORTED for ${slug} due to error:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  console.log('\nAll 5 leagues and dependent documents have been successfully deleted.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Fatal error during execution:', err);
  process.exit(1);
});
