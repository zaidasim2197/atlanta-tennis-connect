const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: 'backend/.env' });

// Simple scrypt hash matching backend/src/lib/auth.ts
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  const dataPackRaw = fs.readFileSync('Baseline_ATL_Demo_Data_Pack.json', 'utf8');
  const dataPack = JSON.parse(dataPackRaw);

  const db = mongoose.connection.db;

  // Format mapping from Demo Data Pack
  // FMT-MS -> men-singles
  // FMT-WS -> women-singles
  // FMT-MD -> men-doubles
  // FMT-MXD -> mixed-doubles
  const formatMap = {
    'FMT-MS': 'men-singles',
    'FMT-WS': 'women-singles',
    'FMT-MD': 'men-doubles',
    'FMT-MXD': 'mixed-doubles',
  };

  const courtMap = {
    'LG-MS-35': 'Northside Tennis Center',
    'LG-WS-35': 'Midtown Court',
    'LG-MD-40': 'Brookhaven Area Court',
    'LG-MXD-35': 'Piedmont Area Court',
  };

  // 1. Seasons
  console.log('Seeding Seasons...');
  await db.collection('seasons').deleteMany({});
  const seasonsToInsert = [
    {
      slug: 's-fall-26',
      name: 'Fall 2026',
      startDate: '2026-10-10',
      endDate: '2026-12-19',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];
  await db.collection('seasons').insertMany(seasonsToInsert);

  // 2. Leagues
  console.log('Seeding Leagues...');
  await db.collection('leagues').deleteMany({});
  const leaguesToInsert = dataPack.leagues.map((lg) => {
    const season = dataPack.seasons.find((s) => s.league_id === lg.league_id) || dataPack.seasons[0];
    const format = formatMap[lg.format_id] || 'men-singles';
    const cleanName = lg.name.replace(/^Baseline\s+/i, '');
    const spotsLeft = Math.max(0, season.capacity - season.registered_count);

    return {
      slug: lg.league_id,
      seasonSlug: 's-fall-26',
      name: cleanName,
      format,
      skillLevel: (lg.offered_skill_levels[0] || 'SKL-35').replace('SKL-', '').replace(/(\d)(\d)/, '$1.$2'),
      feeCents: season.entry_price * 100,
      scheduleDay: season.known_play_day,
      scheduleTime: season.known_play_time.split(' - ')[0] || '9:00 AM',
      venue: courtMap[lg.league_id] || 'Northside Tennis Center',
      playerLimit: season.capacity,
      spotsRemaining: spotsLeft,
      registrationOpen: season.registration_status === 'open',
      description: lg.organiser_notes || 'Official Baseline ATL Flight.',
      startDate: season.start_date,
      endDate: season.end_date,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });
  await db.collection('leagues').insertMany(leaguesToInsert);

  // 3. Players
  console.log('Seeding Players...');
  await db.collection('players').deleteMany({});
  const playersToInsert = dataPack.players.map((p) => {
    const profile = dataPack.playerProfiles.find((pr) => pr.player_id === p.player_id) || {};
    const skillLevel = profile.declared_skill_level_id
      ? profile.declared_skill_level_id.replace('SKL-', '').replace(/(\d)(\d)/, '$1.$2')
      : '3.5';

    return {
      slug: p.player_id,
      firstName: p.first_name,
      lastName: p.last_name,
      email: p.email.toLowerCase(),
      phone: p.phone,
      ntrp: skillLevel,
      city: 'Atlanta',
      zipCode: profile.zip_code || '30309',
      preferredCourt: profile.home_court ? profile.home_court.replace(' - Demo', '') : 'Northside Tennis Center',
      preferredFormat: formatMap[profile.preferred_format_id] || 'men-singles',
      accountStatus: p.account_status,
      profileStatus: profile.profile_status || 'complete',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  // Add demo accounts
  playersToInsert.push({
    slug: 'p-demo-player',
    firstName: 'Alex',
    lastName: 'Mercer',
    email: 'player@baselineatl.com',
    phone: '(404) 555-0100',
    ntrp: '3.5',
    city: 'Atlanta',
    zipCode: '30305',
    preferredCourt: 'Northside Tennis Center',
    preferredFormat: 'men-singles',
    accountStatus: 'active',
    profileStatus: 'complete',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  playersToInsert.push({
    slug: 'p-demo-organizer',
    firstName: 'Organizer',
    lastName: '',
    email: 'organizer@baselineatl.com',
    phone: '(404) 555-0199',
    ntrp: '4.0',
    city: 'Atlanta',
    zipCode: '30309',
    preferredCourt: 'Northside Tennis Center',
    preferredFormat: 'men-singles',
    accountStatus: 'active',
    profileStatus: 'complete',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('players').insertMany(playersToInsert);

  // 4. Accounts (for auth)
  console.log('Seeding Accounts...');
  await db.collection('accounts').deleteMany({});
  const defaultPlayerPassword = await hashPassword('player123');
  const defaultOrgPassword = await hashPassword('organizer123');

  const accountsToInsert = playersToInsert.map((p) => ({
    email: p.email,
    playerSlug: p.slug,
    passwordHash: p.email === 'organizer@baselineatl.com' ? defaultOrgPassword : defaultPlayerPassword,
    role: p.email === 'organizer@baselineatl.com' ? 'organizer' : 'player',
    disabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  await db.collection('accounts').insertMany(accountsToInsert);

  // 5. Registrations / Reservations
  console.log('Seeding Registrations...');
  await db.collection('reservations').deleteMany({});
  
  // Season to League mapping
  const seasonToLeague = {
    'SEA-F26-MS35': 'LG-MS-35',
    'SEA-F26-WS35': 'LG-WS-35',
    'SEA-F26-MD40': 'LG-MD-40',
    'SEA-F26-MXD35': 'LG-MXD-35',
  };

  const reservationsToInsert = dataPack.registrations.map((r) => {
    const leagueSlug = seasonToLeague[r.season_id] || 'LG-MS-35';
    const isPaid = r.payment_status === 'succeeded';
    const status = isPaid ? 'completed' : r.payment_status === 'failed' ? 'expired' : 'active';
    const league = leaguesToInsert.find((l) => l.slug === leagueSlug);

    return {
      leagueSlug,
      playerSlug: r.player_id,
      skillLevel: r.skill_level_snapshot ? r.skill_level_snapshot.replace('SKL-', '').replace(/(\d)(\d)/, '$1.$2') : '3.5',
      status,
      amountCents: league ? league.feeCents : 3000,
      idempotencyKey: 'seed-reg-' + r.registration_id,
      createdAt: new Date(r.registered_at),
      updatedAt: new Date(r.confirmed_at || r.registered_at),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  });
  await db.collection('reservations').insertMany(reservationsToInsert);

  console.log('Seeding completed successfully!');
  console.log(`Seeded ${leaguesToInsert.length} leagues, ${playersToInsert.length} players, ${reservationsToInsert.length} registrations.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error seeding data pack:', err);
  process.exit(1);
});
