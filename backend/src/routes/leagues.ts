/**
 * GET /api/leagues
 *   Returns all leagues with spotsRemaining.
 *   Query params (all optional):
 *     format      – LeagueFormat
 *     skillLevel  – SkillLevel
 *     open        – "true" | "false"  (filter by registrationOpen)
 *     season      – season slug
 *
 * GET /api/leagues/:leagueId
 *   Returns a single league with its season.
 */
import { Router } from "express";
import { League } from "../models/League";
import { Season } from "../models/Season";
import { wrap, ok, err } from "../lib/apiResponse";

const router = Router();

// ─── Shape that matches what the frontend League type expects ───────────────

function leagueToFrontend(l: InstanceType<typeof League>) {
  const spotsRemaining = l.spotsRemaining;
  const playerLimit = l.playerLimit;
  const registeredCount = Math.max(0, playerLimit - spotsRemaining);

  return {
    id: l.slug,
    seasonId: l.seasonSlug,
    name: l.name,
    format: l.format,
    skillLevel: l.skillLevel,
    offeredSkillLevels: (l as any).offeredSkillLevels || (l.slug === "l-1" ? ["2.5", "3.0", "3.5", "4.0"] : [l.skillLevel]),
    geographicGroup: (l as any).geographicGroup || (l.venue?.toLowerCase().includes("piedmont") ? "Midtown" : "Midtown"),
    feeCents: l.feeCents,
    scheduleDay: l.scheduleDay,
    scheduleTime: l.scheduleTime,
    venue: l.venue,
    playerLimit,
    spotsRemaining,
    registeredCount,
    registrationOpen: l.registrationOpen,
    description: l.description,
    startDate: l.startDate,
    endDate: l.endDate,
  };
}

// GET /api/leagues
router.get(
  "/",
  wrap(async (req, res) => {
    const { format, skillLevel, open, season } = req.query as Record<string, string>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (format)     filter.format = format;
    if (skillLevel) filter.skillLevel = skillLevel;
    if (open !== undefined) filter.registrationOpen = open === "true";
    if (season)     filter.seasonSlug = season;

    const leagues = await League.find(filter).sort({ createdAt: 1 }).lean();

    // Enrich with season name
    const seasonSlugs = [...new Set(leagues.map((l) => l.seasonSlug))];
    const seasons = await Season.find({ slug: { $in: seasonSlugs } }).lean();
    const seasonMap = Object.fromEntries(seasons.map((s) => [s.slug, s]));

    const payload = leagues.map((l) => ({
      ...leagueToFrontend(l as unknown as InstanceType<typeof League>),
      season: seasonMap[l.seasonSlug]
        ? {
            id: seasonMap[l.seasonSlug].slug,
            name: seasonMap[l.seasonSlug].name,
            startDate: seasonMap[l.seasonSlug].startDate,
            endDate: seasonMap[l.seasonSlug].endDate,
            status: seasonMap[l.seasonSlug].status,
          }
        : null,
    }));

    ok(res, payload);
  }),
);

// GET /api/leagues/:leagueId
router.get(
  "/:leagueId",
  wrap(async (req, res) => {
    const league = await League.findOne({ slug: req.params.leagueId }).lean();
    if (!league) return err(res, "League not found", 404);

    const season = await Season.findOne({ slug: league.seasonSlug }).lean();

    ok(res, {
      ...leagueToFrontend(league as unknown as InstanceType<typeof League>),
      season: season
        ? {
            id: season.slug,
            name: season.name,
            startDate: season.startDate,
            endDate: season.endDate,
            status: season.status,
          }
        : null,
    });
  }),
);

// PATCH /api/leagues/:leagueId
router.patch(
  "/:leagueId",
  wrap(async (req, res) => {
    const { registrationOpen, spotsRemaining } = req.body;
    const update: Record<string, unknown> = {};
    if (typeof registrationOpen === "boolean") update.registrationOpen = registrationOpen;
    if (typeof spotsRemaining === "number") update.spotsRemaining = spotsRemaining;

    const league = await League.findOneAndUpdate(
      { slug: req.params.leagueId },
      { $set: update },
      { new: true },
    );
    if (!league) return err(res, "League not found", 404);

    ok(res, leagueToFrontend(league));
  }),
);

export default router;
