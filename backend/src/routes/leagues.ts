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
  return {
    id: l.slug,
    seasonId: l.seasonSlug,
    name: l.name,
    format: l.format,
    skillLevel: l.skillLevel,
    feeCents: l.feeCents,
    scheduleDay: l.scheduleDay,
    scheduleTime: l.scheduleTime,
    venue: l.venue,
    playerLimit: l.playerLimit,
    spotsRemaining: l.spotsRemaining,
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

export default router;
