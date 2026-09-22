// Domain model for the Atlanta tennis league platform.
// Shaped so it can be swapped for real backend tables with minimal changes.

export type SeasonStatus = "upcoming" | "active" | "closed";

export type LeagueFormat =
  | "junior-singles"
  | "senior-singles"
  | "junior-doubles"
  | "senior-doubles"
  | "mixed-doubles";

export type SkillLevel = "2.5" | "3.0" | "3.5" | "4.0" | "4.5" | "5.0";

export interface GeographicGroup {
  groupId: string;
  name: string;
  groupType: "metro-core" | "perimeter-north" | "perimeter-south" | "east-metro" | "west-metro" | string;
  parentGroupId?: string;
  city: string;
  status: "active" | "inactive" | "tbd";
}

export interface Season {
  id: string;
  seasonId?: string;
  name: string;
  seasonName?: string;
  startDate: string; // ISO
  endDate: string; // ISO
  status: SeasonStatus;
}

export interface League {
  id: string;
  leagueId?: string;
  seasonId: string;
  seasonName?: string;
  name: string;
  leagueName?: string;
  format: LeagueFormat;
  formatId?: LeagueFormat;
  skillLevel: SkillLevel;
  offeredSkillLevels?: SkillLevel[];
  ageCategory?: "open" | "senior" | "junior" | string;
  geographicGroup?: string;
  feeCents: number;
  registrationFee?: number;
  scheduleDay: string;
  matchDay?: string;
  scheduleTime: string;
  matchTime?: string;
  venue: string;
  playerLimit: number;
  capacity?: number;
  spotsRemaining?: number;
  registrationOpen: boolean;
  registrationStatus?: "open" | "closed" | "upcoming" | "waitlist";
  registrationClose?: string;
  description: string;
  startDate?: string;
  seasonStartDate?: string;
  endDate?: string;
  seasonEndDate?: string;
}

export interface Player {
  id: string; // System-generated Player ID (e.g. "p-demo-player")
  playerId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | undefined;
  password?: string | undefined;
  ntrp: SkillLevel; // Declared skill level (unverified)
  declaredSkillLevel?: SkillLevel | undefined;
  city: string;
  zipCode?: string | undefined;
  preferredCourt?: string | undefined;
  homeArea?: string | undefined;
  preferredFormat?: LeagueFormat | undefined;
  handedness?: "right" | "left" | undefined;
  dateOfBirth?: string | undefined;
  parentName?: string | undefined;
  parentPhone?: string | undefined;
  isJunior?: boolean | undefined;
  eligibilityStatus?: "eligible" | "pending-verification" | "ineligible" | undefined;
  privacyPreferences?: {
    showPhoneToOpponent: boolean;
    showEmailToOpponent: boolean;
  } | undefined;
  accountStatus?: "active" | "suspended" | "closed" | undefined;
  profileStatus?: "incomplete" | "complete" | "needs-review" | undefined;
  profileImage?: string | undefined;
}

export type RegistrationStatus =
  | "draft"
  | "payment-pending"
  | "paid"
  | "awaiting-review"
  | "confirmed";

export type PaymentStatus =
  | "not-started"
  | "pending"
  | "succeeded"
  | "failed"
  | "refund-pending"
  | "refunded";

export type PartnerStatus =
  | "none"
  | "search-initiated"
  | "requested"
  | "accepted"
  | "declined"
  | "replacement-needed"
  | "pending"; // backward-compatible alias for requested

export interface Registration {
  id: string;
  leagueId: string;
  playerId: string;
  createdAt: string;
  registrationStatus?: RegistrationStatus | undefined;
  paymentStatus: PaymentStatus | "paid" | "pending";
  amountCents: number;
  skillLevelSnapshot?: SkillLevel | undefined;
  doublesPartnerId?: string | undefined;
  partnerStatus?: PartnerStatus | undefined;
  preferredCourt?: string | undefined;
  paymentReference?: string | undefined;
}

export type MatchStatus =
  | "unassigned"
  | "opponent-assigned"
  | "scheduling-required"
  | "scheduled"
  | "completed";

export interface Match {
  id: string;
  matchId?: string;
  seasonId: string;
  leagueId: string;
  geographicGroupId?: string;
  playerId: string;
  opponentId?: string;
  opponentName?: string;
  opponentLevel?: SkillLevel;
  homeAway?: "home" | "away";
  matchDate?: string;
  matchTime?: string;
  court?: string;
  matchStatus: MatchStatus;
  scheduleSource?: "system" | "manual" | "mutual";
  courtBookingStatus?: "not-booked" | "booked" | "pending";
  courtBookingOwner?: string;
  rescheduleStatus?: "none" | "requested" | "rescheduled";
}

export interface MatchResult {
  resultId: string;
  matchId: string;
  submittedBy: string;
  scoreData: string;
  winnerId: string;
  status: "not-available" | "submitted" | "awaiting-confirmation" | "accepted" | "disputed";
  submittedAt?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  disputeReason?: string;
}

export interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number; // percentage e.g. 75
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

export const FORMAT_DETAILS: Record<LeagueFormat, { teamSize: number; partnerRequired: boolean }> = {
  "junior-singles": { teamSize: 1, partnerRequired: false },
  "senior-singles": { teamSize: 1, partnerRequired: false },
  "junior-doubles": { teamSize: 2, partnerRequired: true },
  "senior-doubles": { teamSize: 2, partnerRequired: true },
  "mixed-doubles": { teamSize: 2, partnerRequired: true },
};

export const SKILL_LEVELS: SkillLevel[] = ["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

export const formatMoney = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

export const formatDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const formatDateRange = (a: string, b: string) =>
  `${new Date(a + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${formatDate(b)}`;

/* ----------------------- FALLBACK MOCK DATA (Fallback Only) -----------------------
 * This data is used STRICTLY as an offline fallback when the backend database/API
 * is unreachable. Primary data fetching must always query the MongoDB API first.
 */

export const FALLBACK_MOCK_SEASONS: Season[] = [
  { id: "s-fall-26", name: "Fall 2026", startDate: "2026-10-06", endDate: "2026-12-19", status: "active" },
  { id: "s-winter-27", name: "Winter 2027", startDate: "2026-11-16", endDate: "2027-02-12", status: "upcoming" },
  { id: "s-spring-27", name: "Spring 2027", startDate: "2027-01-12", endDate: "2027-03-23", status: "upcoming" },
];
export const SEED_SEASONS = FALLBACK_MOCK_SEASONS;

export const FALLBACK_MOCK_LEAGUES: League[] = [
  {
    id: "l-1",
    seasonId: "s-fall-26",
    name: "Tuesday Singles",
    format: "senior-singles",
    skillLevel: "3.0",
    offeredSkillLevels: ["2.5", "3.0", "3.5", "4.0"],
    geographicGroup: "Midtown",
    feeCents: 3500,
    scheduleDay: "Tuesday",
    scheduleTime: "6:30 PM",
    venue: "Piedmont Park Courts, Midtown",
    playerLimit: 24,
    registrationOpen: true,
    description:
      "Ten weeks of competitive singles under the lights at Piedmont Park. Weekly match assignments, live standings and an end-of-season playoff for the top eight.",
    startDate: "2026-10-06",
    endDate: "2026-12-15",
  },
  {
    id: "l-2",
    seasonId: "s-fall-26",
    name: "Thursday Mixed Doubles",
    format: "mixed-doubles",
    skillLevel: "4.0",
    geographicGroup: "Buckhead",
    feeCents: 4500,
    scheduleDay: "Thursday",
    scheduleTime: "7:00 PM",
    venue: "Bitsy Grant Tennis Center",
    playerLimit: 32,
    registrationOpen: true,
    description:
      "Fast, social and genuinely competitive mixed doubles. Bring a partner or get matched by the organizers during week one.",
    startDate: "2026-10-15",
    endDate: "2026-12-17",
  },
  {
    id: "l-3",
    seasonId: "s-fall-26",
    name: "Saturday Junior Singles",
    format: "junior-singles",
    skillLevel: "3.0",
    geographicGroup: "Decatur",
    feeCents: 2500,
    scheduleDay: "Saturday",
    scheduleTime: "9:00 AM",
    venue: "McKoy Park Courts",
    playerLimit: 20,
    registrationOpen: true,
    description:
      "A supportive Saturday-morning ladder for juniors aged 12–17 building match experience with coach-supervised play.",
    startDate: "2026-10-24",
    endDate: "2026-12-19",
  },
  {
    id: "l-4",
    seasonId: "s-fall-26",
    name: "Wednesday Senior Doubles",
    format: "senior-doubles",
    skillLevel: "3.0",
    geographicGroup: "Midtown",
    feeCents: 3000,
    scheduleDay: "Wednesday",
    scheduleTime: "10:00 AM",
    venue: "Washington Park Tennis Center",
    playerLimit: 28,
    registrationOpen: false,
    description:
      "Daytime doubles for the 50+ crowd. Relaxed pace, real scorekeeping, and coffee on the deck after every match day.",
    startDate: "2026-11-04",
    endDate: "2027-01-13",
  },
  {
    id: "l-5",
    seasonId: "s-winter-27",
    name: "Monday Singles",
    format: "senior-singles",
    skillLevel: "4.5",
    geographicGroup: "Sandy Springs",
    feeCents: 5000,
    scheduleDay: "Monday",
    scheduleTime: "8:00 PM",
    venue: "Sandy Springs Tennis Center",
    playerLimit: 16,
    registrationOpen: true,
    description:
      "Our most competitive flight. Sixteen players, guaranteed indoor courts all winter, and a single-elimination championship night.",
    startDate: "2026-11-16",
    endDate: "2027-01-25",
  },
  {
    id: "l-6",
    seasonId: "s-winter-27",
    name: "Sunday Junior Doubles",
    format: "junior-doubles",
    skillLevel: "2.5",
    geographicGroup: "Alpharetta",
    feeCents: 2500,
    scheduleDay: "Sunday",
    scheduleTime: "1:00 PM",
    venue: "Wills Park Recreation Center",
    playerLimit: 24,
    registrationOpen: true,
    description:
      "First-league friendly. Juniors learn doubles positioning and scoring with short-format matches every Sunday afternoon.",
    startDate: "2026-11-29",
    endDate: "2027-02-07",
  },
  {
    id: "l-7",
    seasonId: "s-winter-27",
    name: "Friday Mixed Doubles",
    format: "mixed-doubles",
    skillLevel: "3.5",
    geographicGroup: "Midtown",
    feeCents: 3500,
    scheduleDay: "Friday",
    scheduleTime: "6:00 PM",
    venue: "Brownwood Park Courts",
    playerLimit: 32,
    registrationOpen: true,
    description:
      "Friday-night mixed doubles with a rotating partner format so you play alongside everyone in the flight at least once.",
    startDate: "2026-12-04",
    endDate: "2027-02-12",
  },
  {
    id: "l-8",
    seasonId: "s-spring-27",
    name: "Tuesday Premier Singles",
    format: "senior-singles",
    skillLevel: "4.0",
    geographicGroup: "Midtown",
    feeCents: 4000,
    scheduleDay: "Tuesday",
    scheduleTime: "7:00 PM",
    venue: "Chastain Park Tennis Center",
    playerLimit: 24,
    registrationOpen: true,
    description:
      "Championship-level 4.0 singles under the lights at Chastain Park. Ten weeks of top-tier matches leading into the spring tournament.",
    startDate: "2027-01-12",
    endDate: "2027-03-23",
  },
];
export const SEED_LEAGUES = FALLBACK_MOCK_LEAGUES;

export const FALLBACK_MOCK_PLAYERS: Player[] = [
  { id: "p-demo-player", firstName: "Alex", lastName: "Mercer", email: "player@baselineatl.com", phone: "(404) 555-0100", ntrp: "3.5", city: "Atlanta", zipCode: "30305", preferredCourt: "Piedmont Park Courts", accountStatus: "active", profileStatus: "complete" },
  { id: "p-1", firstName: "Jordan", lastName: "Ellis", email: "jordan@example.com", phone: "(404) 555-0142", ntrp: "3.5", city: "Atlanta", zipCode: "30309", preferredCourt: "Piedmont Park Courts", accountStatus: "active", profileStatus: "complete" },
  { id: "p-2", firstName: "Maya", lastName: "Robinson", email: "maya@example.com", phone: "(404) 555-0119", ntrp: "4.0", city: "Decatur", zipCode: "30030", preferredCourt: "Glenlake Tennis Center", accountStatus: "active", profileStatus: "complete" },
  { id: "p-3", firstName: "Chris", lastName: "Nguyen", email: "chris@example.com", phone: "(678) 555-0187", ntrp: "3.5", city: "Smyrna", zipCode: "30080", preferredCourt: "Bitsy Grant Tennis Center", accountStatus: "active", profileStatus: "complete" },
  { id: "p-4", firstName: "Tasha", lastName: "Bell", email: "tasha@example.com", phone: "(770) 555-0165", ntrp: "3.0", city: "Marietta", zipCode: "30060", preferredCourt: "Fair Oaks Tennis Center", accountStatus: "active", profileStatus: "complete" },
  { id: "p-5", firstName: "Andre", lastName: "Cole", email: "andre@example.com", phone: "(404) 555-0173", ntrp: "4.5", city: "Sandy Springs", zipCode: "30328", preferredCourt: "Sandy Springs Tennis Center", accountStatus: "active", profileStatus: "complete" },
];
export const SEED_PLAYERS = FALLBACK_MOCK_PLAYERS;

export const FALLBACK_MOCK_REGISTRATIONS: Registration[] = [
  { id: "r-demo-1", leagueId: "l-1", playerId: "p-demo-player", createdAt: "2026-09-28", registrationStatus: "confirmed", paymentStatus: "paid", amountCents: 3500, skillLevelSnapshot: "3.5", preferredCourt: "Piedmont Park Courts" },
  { id: "r-1", leagueId: "l-1", playerId: "p-1", createdAt: "2026-10-01", registrationStatus: "confirmed", paymentStatus: "paid", amountCents: 3500, skillLevelSnapshot: "3.5" },
  { id: "r-2", leagueId: "l-1", playerId: "p-3", createdAt: "2026-10-02", registrationStatus: "confirmed", paymentStatus: "paid", amountCents: 3500, skillLevelSnapshot: "3.5" },
  { id: "r-3", leagueId: "l-2", playerId: "p-2", createdAt: "2026-10-03", registrationStatus: "confirmed", paymentStatus: "paid", amountCents: 4500, skillLevelSnapshot: "4.0", doublesPartnerId: "p-1", partnerStatus: "accepted" },
  { id: "r-4", leagueId: "l-2", playerId: "p-1", createdAt: "2026-10-05", registrationStatus: "confirmed", paymentStatus: "paid", amountCents: 4500, skillLevelSnapshot: "3.5", doublesPartnerId: "p-2", partnerStatus: "accepted" },
  { id: "r-5", leagueId: "l-3", playerId: "p-4", createdAt: "2026-10-08", registrationStatus: "confirmed", paymentStatus: "paid", amountCents: 2500, skillLevelSnapshot: "3.0" },
  { id: "r-6", leagueId: "l-5", playerId: "p-5", createdAt: "2026-10-12", registrationStatus: "awaiting-review", paymentStatus: "pending", amountCents: 5000, skillLevelSnapshot: "4.5" },
];
export const SEED_REGISTRATIONS = FALLBACK_MOCK_REGISTRATIONS;

export const FALLBACK_MOCK_MATCHES: Match[] = [
  {
    id: "m-1",
    seasonId: "s-fall-26",
    leagueId: "l-1",
    playerId: "p-demo-player",
    opponentId: "p-1",
    opponentName: "Jordan Ellis",
    opponentLevel: "3.5",
    homeAway: "home",
    matchDate: "2026-10-14",
    matchTime: "6:30 PM",
    court: "Piedmont Park Courts - Court 2",
    matchStatus: "scheduled",
    courtBookingOwner: "Alex Mercer (Home Player)",
  },
];

export const FALLBACK_MOCK_RESULTS: MatchResult[] = [
  {
    resultId: "res-1",
    matchId: "m-past-1",
    submittedBy: "p-demo-player",
    scoreData: "6-4, 7-5",
    winnerId: "p-demo-player",
    status: "accepted",
  },
];
