/**
 * POST /api/players
 *   Update the authenticated player; signup is handled by /api/auth/signup.
 *   Body: { firstName, lastName, email, phone?, ntrp, city? }
 *
 * GET /api/players/:email
 *   Look up self, or a player for an authenticated organiser.
 */
import { Router } from "express";
import { z } from "zod";
import { Player } from "../models/Player";
import { Account } from "../models/Auth";
import { APPROVED_ATLANTA_ZIPS } from "../lib/constants";
import { wrap, ok, err } from "../lib/apiResponse";
import { requireAuth, ownsEmail } from "../lib/auth";

const router = Router();
router.use(requireAuth);

const SkillLevel = z.enum(["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"]);

const PlayerBody = z.object({
  firstName:       z.string().min(1),
  lastName:        z.string().min(1),
  email:           z.string().email(),
  phone:           z.string().optional().default(""),
  ntrp:            SkillLevel,
  city:            z.string().optional().default(""),
  zipCode:         z.enum(APPROVED_ATLANTA_ZIPS).optional().default("30309"),
  preferredCourt:  z.string().optional().default(""),
  preferredFormat: z.string().optional().default("men-singles"),
  dateOfBirth:     z.string().optional().default(""),
  parentName:      z.string().optional().default(""),
  parentPhone:     z.string().optional().default(""),
  isJunior:        z.boolean().optional().default(false),
  gender:          z.enum(["male", "female", "prefer-not-to-say"]).optional(),
}).strict();

function playerToFrontend(p: InstanceType<typeof Player>) {
  return {
    id:              p.slug,
    firstName:       p.firstName,
    lastName:        p.lastName,
    email:           p.email,
    phone:           p.phone,
    ntrp:            p.ntrp,
    city:            p.city,
    zipCode:         p.zipCode,
    preferredCourt:  p.preferredCourt,
    preferredFormat: p.preferredFormat,
    dateOfBirth:     p.dateOfBirth,
    parentName:      p.parentName,
    parentPhone:     p.parentPhone,
    isJunior:        p.isJunior,
    gender:          p.gender,
    accountStatus:   p.accountStatus,
    profileStatus:   p.profileStatus,
  };
}

// POST /api/players
router.post(
  "/",
  wrap(async (req, res) => {
    const parsed = PlayerBody.safeParse(req.body);
    if (!parsed.success) return err(res, "Invalid request body", 400, parsed.error.flatten());

    const d = parsed.data;
    if (!ownsEmail(req, d.email)) return err(res, "You can only update your own profile", 403);

    const player = await Player.findOneAndUpdate(
      { slug: req.identity!.playerSlug, email: req.identity!.email },
      {
        $set: {
          firstName: d.firstName,
          lastName: d.lastName,
          phone: d.phone,
          ntrp: d.ntrp,
          city: d.city,
          zipCode: d.zipCode,
          preferredCourt: d.preferredCourt,
          preferredFormat: d.preferredFormat,
          dateOfBirth: d.dateOfBirth,
          parentName: d.parentName,
          parentPhone: d.parentPhone,
          isJunior: d.isJunior,
          ...(d.gender ? { gender: d.gender } : {}),
        },
      },
      { new: true, runValidators: true },
    );

    if (!player) return err(res, "Player not found", 404);
    ok(res, playerToFrontend(player));
  }),
);

// GET /api/players/count
router.get(
  "/count",
  wrap(async (_req, res) => {
    const count = await Player.countDocuments();
    ok(res, { count });
  }),
);

// GET /api/players/search?q=&exclude=&rating=
router.get(
  "/search",
  wrap(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const exclude = typeof req.query.exclude === "string" ? req.query.exclude.trim() : (req.identity?.playerSlug || "");
    const excludeEmail = req.identity?.email || "";
    const rating = typeof req.query.rating === "string" ? req.query.rating.trim() : (typeof req.query.ntrp === "string" ? req.query.ntrp.trim() : "");

    const filter: Record<string, unknown> = {
      accountStatus: { $ne: "suspended" },
    };

    const andConditions: any[] = [];
    if (exclude) {
      andConditions.push({ slug: { $ne: exclude } });
    }
    if (excludeEmail) {
      andConditions.push({ email: { $ne: excludeEmail.toLowerCase() } });
    }

    // Exclude all organizers completely from partner selection
    const organizerAccounts = await Account.find({ role: "organizer" }).select("email playerSlug").lean();
    const organizerEmails = new Set<string>(
      organizerAccounts.map((a: any) => (a.email ? a.email.toLowerCase() : "")).filter(Boolean),
    );
    organizerEmails.add("organizer@baselineatl.com");
    const organizerSlugs = organizerAccounts.map((a: any) => a.playerSlug).filter(Boolean);

    if (organizerEmails.size > 0) {
      andConditions.push({ email: { $nin: Array.from(organizerEmails) } });
    }
    if (organizerSlugs.length > 0) {
      andConditions.push({ slug: { $nin: organizerSlugs } });
    }

    // Filter by required league rating if specified
    if (rating) {
      andConditions.push({ ntrp: rating });
    }

    if (q) {
      const sanitized = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(sanitized, "i");
      andConditions.push({
        $or: [
          { firstName: regex },
          { lastName: regex },
          { slug: regex },
          { email: regex },
        ],
      });
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    const matches = await Player.find(filter)
      .limit(15)
      .select("slug firstName lastName email phone ntrp city preferredCourt rating");

    const results = matches.map((p) => ({
      id: p.slug,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      ntrp: p.ntrp,
      city: p.city,
      preferredCourt: p.preferredCourt,
      rating: p.rating,
    }));

    ok(res, results);
  }),
);

// GET /api/players/:email
router.get(
  "/:email",
  wrap(async (req, res) => {
    const email = String(req.params.email).toLowerCase();
    if (!ownsEmail(req, email) && req.identity!.role !== "organizer") return err(res, "Access denied", 403);
    const player = await Player.findOne({
      email,
    });
    if (!player) return err(res, "Player not found", 404);
    ok(res, playerToFrontend(player));
  }),
);

export default router;
