/**
 * Seed script – safe to run repeatedly.
 * Each run wipes atlanta-tennis collections and rebuilds from scratch.
 *
 * Usage:
 *   npm run seed           # normal seed
 *   npm run seed:reset     # same thing (alias)
 *
 * Produces:
 *   - 3 seasons
 *   - 5 leagues (one deliberately seeded with only 3 spots remaining)
 *   - 500 player records
 *   - Pre-existing registrations filling most leagues to ~60-80% capacity
 */

import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { Season } from "../src/models/Season";
import { League } from "../src/models/League";
import { Player } from "../src/models/Player";
import { Reservation } from "../src/models/Reservation";
import { AuditLog } from "../src/models/AuditLog";

// ─── Static seed data (matches frontend SEED_LEAGUES / SEED_SEASONS) ─────────

const SEASONS = [
  {
    slug: "s-fall-26",
    name: "Fall 2026 Metro Season",
    startDate: "2026-10-06",
    endDate: "2026-12-19",
    status: "active" as const,
  },
  {
    slug: "s-winter-27",
    name: "Winter 2027 Indoor Season",
    startDate: "2026-11-16",
    endDate: "2027-02-12",
    status: "upcoming" as const,
  },
  {
    slug: "s-spring-27",
    name: "Spring 2027 Premier Season",
    startDate: "2027-01-12",
    endDate: "2027-03-23",
    status: "upcoming" as const,
  },
];

const LEAGUES = [
  {
    slug: "l-1",
    seasonSlug: "s-fall-26",
    name: "Midtown Tuesday Singles",
    format: "senior-singles" as const,
    skillLevel: "3.5" as const,
    feeCents: 3500,
    scheduleDay: "Tuesday",
    scheduleTime: "6:30 PM",
    venue: "Piedmont Park Courts, Midtown",
    playerLimit: 24,
    spotsRemaining: 24, // will be decremented as registrations are seeded
    registrationOpen: true,
    description:
      "Ten weeks of competitive 3.5 singles under the Midtown lights. Weekly match assignments, live standings and an end-of-season playoff for the top eight.",
    startDate: "2026-10-06",
    endDate: "2026-12-15",
  },
  {
    slug: "l-2",
    seasonSlug: "s-fall-26",
    name: "Buckhead Mixed Doubles",
    format: "mixed-doubles" as const,
    skillLevel: "4.0" as const,
    feeCents: 4500,
    scheduleDay: "Thursday",
    scheduleTime: "7:00 PM",
    venue: "Bitsy Grant Tennis Center, Buckhead",
    playerLimit: 32,
    spotsRemaining: 32,
    registrationOpen: true,
    description:
      "Fast, social and genuinely competitive mixed doubles. Bring a partner or get matched by the organizers during week one.",
    startDate: "2026-10-15",
    endDate: "2026-12-17",
  },
  {
    slug: "l-3",
    seasonSlug: "s-fall-26",
    name: "Decatur Junior Singles",
    format: "junior-singles" as const,
    skillLevel: "3.0" as const,
    feeCents: 2500,
    scheduleDay: "Saturday",
    scheduleTime: "9:00 AM",
    venue: "McKoy Park Courts, Decatur",
    playerLimit: 20,
    spotsRemaining: 20,
    registrationOpen: true,
    description:
      "A supportive Saturday-morning ladder for juniors aged 12–17 building match experience with coach-supervised play.",
    startDate: "2026-10-24",
    endDate: "2026-12-19",
  },
  {
    slug: "l-4",
    seasonSlug: "s-winter-27",
    name: "Sandy Springs Indoor Singles",
    format: "senior-singles" as const,
    skillLevel: "4.5+" as const,
    feeCents: 5000,
    scheduleDay: "Monday",
    scheduleTime: "8:00 PM",
    venue: "Sandy Springs Indoor Club",
    playerLimit: 16,
    spotsRemaining: 16,
    registrationOpen: true,
    description:
      "Our most competitive flight. Sixteen players, guaranteed indoor courts all winter, and a single-elimination championship night.",
    startDate: "2026-11-16",
    endDate: "2027-01-25",
  },
  {
    // *** THE RACE-CONDITION LEAGUE ***
    // Seeded with only 3 spots left – load test hammers this one
    slug: "l-hot",
    seasonSlug: "s-fall-26",
    name: "Peachtree Last-Spots Singles",
    format: "senior-singles" as const,
    skillLevel: "4.0" as const,
    feeCents: 4000,
    scheduleDay: "Wednesday",
    scheduleTime: "7:00 PM",
    venue: "Chastain Park Tennis Center",
    playerLimit: 30,
    spotsRemaining: 3, // ← deliberately scarce – race condition target
    registrationOpen: true,
    description:
      "Championship-level 4.0 singles. Only a handful of spots remain – register before they're gone.",
    startDate: "2026-10-20",
    endDate: "2027-01-07",
  },
];

// ─── Player generation ────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Jordan","Maya","Chris","Tasha","Andre","Riley","Morgan","Alex","Casey","Jamie",
  "Taylor","Sam","Quinn","Avery","Blake","Drew","Emery","Finley","Hayden","Jesse",
  "Kendall","Logan","Micah","Noel","Parker","Reese","Sage","Skyler","Toby","Val",
  "Wren","Xander","Yara","Zane","Aria","Brynn","Cole","Dana","Ellis","Faye",
  "Glen","Hana","Ivan","June","Kira","Luca","Mika","Nash","Ora","Pax",
];

const LAST_NAMES = [
  "Ellis","Robinson","Nguyen","Bell","Cole","Mitchell","Harris","Clark","Lewis","Walker",
  "Hall","Allen","Young","King","Wright","Scott","Green","Baker","Adams","Nelson",
  "Carter","Perez","Turner","Phillips","Campbell","Parker","Evans","Edwards","Collins","Stewart",
  "Sanchez","Morris","Rogers","Reed","Cook","Morgan","Bell","Murphy","Bailey","Rivera",
  "Cooper","Richardson","Cox","Howard","Ward","Torres","Peterson","Gray","Ramirez","James",
];

const NTRP_LEVELS = ["2.5","3.0","3.5","4.0","4.5+"] as const;
const CITIES = ["Atlanta","Decatur","Smyrna","Marietta","Sandy Springs","Buckhead","Alpharetta","Dunwoody","Roswell","Tucker"];

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePlayers(count: number) {
  const players = [];
  const usedEmails = new Set<string>();

  for (let i = 0; i < count; i++) {
    const first = randomItem(FIRST_NAMES);
    const last  = randomItem(LAST_NAMES);
    let email   = `${first.toLowerCase()}.${last.toLowerCase()}${i}@loadtest.atl`;

    // guarantee uniqueness
    while (usedEmails.has(email)) {
      email = `${first.toLowerCase()}.${last.toLowerCase()}${i}_${Math.floor(Math.random()*1000)}@loadtest.atl`;
    }
    usedEmails.add(email);

    players.push({
      slug:      `p-seed-${i.toString().padStart(4, "0")}`,
      firstName: first,
      lastName:  last,
      email,
      phone:     `(404) 555-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      ntrp:      randomItem(NTRP_LEVELS),
      city:      randomItem(CITIES),
    });
  }
  return players;
}

// ─── Pre-seed registrations (fills leagues to ~70 % capacity) ─────────────────

function buildRegistrations(
  players: ReturnType<typeof generatePlayers>,
  leagues: typeof LEAGUES,
) {
  const registrations: {
    leagueSlug: string;
    playerSlug: string;
    playerEmail: string;
    status: "registered";
    amountCents: number;
    paymentProvider: "mock";
    idempotencyKey: string;
    heldAt: Date;
    expiresAt: Date;
    paidAt: Date;
  }[] = [];

  const used = new Map<string, Set<string>>(); // leagueSlug → Set<playerSlug>

  for (const league of leagues) {
    // l-hot stays at exactly 3 – don't pre-fill it
    if (league.slug === "l-hot") continue;

    const target = Math.floor(league.playerLimit * 0.70);
    used.set(league.slug, new Set());

    let filled = 0;
    const shuffled = [...players].sort(() => Math.random() - 0.5);

    for (const player of shuffled) {
      if (filled >= target) break;
      if (used.get(league.slug)!.has(player.slug)) continue;

      used.get(league.slug)!.add(player.slug);
      const now = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);

      registrations.push({
        leagueSlug:     league.slug,
        playerSlug:     player.slug,
        playerEmail:    player.email,
        status:         "registered",
        amountCents:    league.feeCents,
        paymentProvider:"mock",
        idempotencyKey: `seed_${league.slug}_${player.slug}`,
        heldAt:         now,
        expiresAt:      new Date(now.getTime() + 15 * 60 * 1000),
        paidAt:         now,
      });
      filled++;
    }

    // Update spotsRemaining to reflect pre-seeded registrations
    league.spotsRemaining = league.playerLimit - filled;
  }

  return registrations;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🎾 Atlanta Tennis seed starting…");
  await connectDB();

  // Wipe only atlanta-tennis collections – never touches other databases
  console.log("  Dropping existing data…");
  await Promise.all([
    Season.deleteMany({}),
    League.deleteMany({}),
    Player.deleteMany({}),
    Reservation.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);

  // Seasons
  console.log("  Seeding seasons…");
  await Season.insertMany(SEASONS);

  // Players (500)
  console.log("  Generating 500 players…");
  const players = generatePlayers(500);
  await Player.insertMany(players);

  // Pre-existing registrations
  const registrations = buildRegistrations(players, LEAGUES);

  // Apply spotsRemaining back to league objects before inserting
  await League.insertMany(LEAGUES);

  // Update spotsRemaining in DB for pre-filled leagues
  await Promise.all(
    LEAGUES.map((l) =>
      League.updateOne({ slug: l.slug }, { $set: { spotsRemaining: l.spotsRemaining } }),
    ),
  );

  // Insert reservation docs for pre-existing registrations
  if (registrations.length > 0) {
    await Reservation.insertMany(registrations);
  }

  // Summary
  const leagueSummary = LEAGUES.map(
    (l) => `    ${l.slug.padEnd(8)} "${l.name}" → ${l.spotsRemaining}/${l.playerLimit} spots remaining`,
  ).join("\n");

  console.log(`\n✅ Seed complete`);
  console.log(`   Players:       500`);
  console.log(`   Seasons:       ${SEASONS.length}`);
  console.log(`   Leagues:       ${LEAGUES.length}`);
  console.log(`   Registrations: ${registrations.length} (pre-seeded)`);
  console.log(`\n   League capacity:\n${leagueSummary}`);
  console.log(`\n   ⚠️  l-hot has 3 spots remaining – use this for race-condition tests`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
