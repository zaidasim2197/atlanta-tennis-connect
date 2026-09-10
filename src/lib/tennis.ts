// Domain model for the Atlanta tennis league platform.
// Shaped so it can be swapped for real backend tables with minimal changes.

export type SeasonStatus = "upcoming" | "active" | "closed";

export type LeagueFormat =
  | "junior-singles"
  | "senior-singles"
  | "junior-doubles"
  | "senior-doubles"
  | "mixed-doubles";

export type SkillLevel = "2.5" | "3.0" | "3.5" | "4.0" | "4.5+";

export interface Season {
  id: string;
  name: string;
  startDate: string; // ISO
  endDate: string; // ISO
  status: SeasonStatus;
}

export interface League {
  id: string;
  seasonId: string;
  name: string;
  format: LeagueFormat;
  skillLevel: SkillLevel;
  feeCents: number;
  scheduleDay: string; // e.g. "Tuesday"
  scheduleTime: string; // e.g. "6:30 PM"
  venue: string;
  playerLimit: number;
  registrationOpen: boolean;
  description: string;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  ntrp: SkillLevel;
  city: string;
}

export interface Registration {
  id: string;
  leagueId: string;
  playerId: string;
  createdAt: string;
  paymentStatus: "paid" | "pending";
  amountCents: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "player" | "organizer";
  playerId?: string | undefined;
}

export const FORMAT_LABELS: Record<LeagueFormat, string> = {
  "junior-singles": "Junior Singles",
  "senior-singles": "Senior Singles",
  "junior-doubles": "Junior Doubles",
  "senior-doubles": "Senior Doubles",
  "mixed-doubles": "Mixed Doubles",
};

export const SKILL_LEVELS: SkillLevel[] = ["2.5", "3.0", "3.5", "4.0", "4.5+"];

export const formatMoney = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

export const formatDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const formatDateRange = (a: string, b: string) =>
  `${new Date(a + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${formatDate(b)}`;

/* ------------------------------- mock data ------------------------------- */

export const SEED_SEASONS: Season[] = [
  { id: "s-fall-26", name: "Fall 2026 Metro Season", startDate: "2026-09-14", endDate: "2026-11-22", status: "active" },
  { id: "s-winter-27", name: "Winter 2027 Indoor Season", startDate: "2027-01-11", endDate: "2027-03-21", status: "upcoming" },
  { id: "s-summer-26", name: "Summer 2026 Peachtree Season", startDate: "2026-06-01", endDate: "2026-08-16", status: "closed" },
];

export const SEED_LEAGUES: League[] = [
  {
    id: "l-1",
    seasonId: "s-fall-26",
    name: "Midtown Tuesday Singles",
    format: "senior-singles",
    skillLevel: "3.5",
    feeCents: 12000,
    scheduleDay: "Tuesday",
    scheduleTime: "6:30 PM",
    venue: "Piedmont Park Courts, Midtown",
    playerLimit: 24,
    registrationOpen: true,
    description:
      "Ten weeks of competitive 3.5 singles under the Midtown lights. Weekly match assignments, live standings and an end-of-season playoff for the top eight.",
  },
  {
    id: "l-2",
    seasonId: "s-fall-26",
    name: "Buckhead Mixed Doubles",
    format: "mixed-doubles",
    skillLevel: "4.0",
    feeCents: 14500,
    scheduleDay: "Thursday",
    scheduleTime: "7:00 PM",
    venue: "Bitsy Grant Tennis Center, Buckhead",
    playerLimit: 32,
    registrationOpen: true,
    description:
      "Fast, social and genuinely competitive mixed doubles. Bring a partner or get matched by the organizers during week one.",
  },
  {
    id: "l-3",
    seasonId: "s-fall-26",
    name: "Decatur Junior Singles",
    format: "junior-singles",
    skillLevel: "3.0",
    feeCents: 9000,
    scheduleDay: "Saturday",
    scheduleTime: "9:00 AM",
    venue: "McKoy Park Courts, Decatur",
    playerLimit: 20,
    registrationOpen: true,
    description:
      "A supportive Saturday-morning ladder for juniors aged 12–17 building match experience with coach-supervised play.",
  },
  {
    id: "l-4",
    seasonId: "s-fall-26",
    name: "Westside Senior Doubles",
    format: "senior-doubles",
    skillLevel: "3.0",
    feeCents: 11000,
    scheduleDay: "Wednesday",
    scheduleTime: "10:00 AM",
    venue: "Washington Park Tennis Center",
    playerLimit: 28,
    registrationOpen: false,
    description:
      "Daytime doubles for the 50+ crowd. Relaxed pace, real scorekeeping, and coffee on the deck after every match day.",
  },
  {
    id: "l-5",
    seasonId: "s-winter-27",
    name: "Sandy Springs Indoor Singles",
    format: "senior-singles",
    skillLevel: "4.5+",
    feeCents: 18000,
    scheduleDay: "Monday",
    scheduleTime: "8:00 PM",
    venue: "Sandy Springs Indoor Club",
    playerLimit: 16,
    registrationOpen: true,
    description:
      "Our most competitive flight. Sixteen players, guaranteed indoor courts all winter, and a single-elimination championship night.",
  },
  {
    id: "l-6",
    seasonId: "s-winter-27",
    name: "Alpharetta Junior Doubles",
    format: "junior-doubles",
    skillLevel: "2.5",
    feeCents: 8500,
    scheduleDay: "Sunday",
    scheduleTime: "1:00 PM",
    venue: "Wills Park Recreation Center",
    playerLimit: 24,
    registrationOpen: true,
    description:
      "First-league friendly. Juniors learn doubles positioning and scoring with short-format matches every Sunday afternoon.",
  },
  {
    id: "l-7",
    seasonId: "s-winter-27",
    name: "East Atlanta Mixed Doubles",
    format: "mixed-doubles",
    skillLevel: "3.5",
    feeCents: 13000,
    scheduleDay: "Friday",
    scheduleTime: "6:00 PM",
    venue: "Brownwood Park Courts",
    playerLimit: 32,
    registrationOpen: true,
    description:
      "Friday-night mixed doubles with a rotating partner format so you play alongside everyone in the flight at least once.",
  },
  {
    id: "l-8",
    seasonId: "s-summer-26",
    name: "Peachtree Summer Singles",
    format: "senior-singles",
    skillLevel: "4.0",
    feeCents: 12500,
    scheduleDay: "Tuesday",
    scheduleTime: "7:00 PM",
    venue: "Chastain Park Tennis Center",
    playerLimit: 24,
    registrationOpen: false,
    description: "Completed summer flight. Archived for standings and history.",
  },
];

export const SEED_PLAYERS: Player[] = [
  { id: "p-1", firstName: "Jordan", lastName: "Ellis", email: "jordan@example.com", phone: "(404) 555-0142", ntrp: "3.5", city: "Atlanta" },
  { id: "p-2", firstName: "Maya", lastName: "Robinson", email: "maya@example.com", phone: "(404) 555-0119", ntrp: "4.0", city: "Decatur" },
  { id: "p-3", firstName: "Chris", lastName: "Nguyen", email: "chris@example.com", phone: "(678) 555-0187", ntrp: "3.5", city: "Smyrna" },
  { id: "p-4", firstName: "Tasha", lastName: "Bell", email: "tasha@example.com", phone: "(770) 555-0165", ntrp: "3.0", city: "Marietta" },
  { id: "p-5", firstName: "Andre", lastName: "Cole", email: "andre@example.com", phone: "(404) 555-0173", ntrp: "4.5+", city: "Sandy Springs" },
];

export const SEED_REGISTRATIONS: Registration[] = [
  { id: "r-1", leagueId: "l-1", playerId: "p-1", createdAt: "2026-08-20", paymentStatus: "paid", amountCents: 12000 },
  { id: "r-2", leagueId: "l-1", playerId: "p-3", createdAt: "2026-08-21", paymentStatus: "paid", amountCents: 12000 },
  { id: "r-3", leagueId: "l-2", playerId: "p-2", createdAt: "2026-08-19", paymentStatus: "paid", amountCents: 14500 },
  { id: "r-4", leagueId: "l-2", playerId: "p-1", createdAt: "2026-08-25", paymentStatus: "paid", amountCents: 14500 },
  { id: "r-5", leagueId: "l-3", playerId: "p-4", createdAt: "2026-08-27", paymentStatus: "paid", amountCents: 9000 },
  { id: "r-6", leagueId: "l-5", playerId: "p-5", createdAt: "2026-09-02", paymentStatus: "pending", amountCents: 18000 },
];
