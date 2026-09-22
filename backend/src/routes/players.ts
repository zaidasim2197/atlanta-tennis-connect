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
import { wrap, ok, err } from "../lib/apiResponse";
import { requireAuth, ownsEmail } from "../lib/auth";

const router = Router();
router.use(requireAuth);

const SkillLevel = z.enum(["2.5", "3.0", "3.5", "4.0", "4.5+"]);

const PlayerBody = z.object({
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  email:     z.string().email(),
  phone:     z.string().optional().default(""),
  ntrp:      SkillLevel,
  city:      z.string().optional().default(""),
}).strict();

function playerToFrontend(p: InstanceType<typeof Player>) {
  return {
    id: p.slug,
    firstName: p.firstName,
    lastName:  p.lastName,
    email:     p.email,
    phone:     p.phone,
    ntrp:      p.ntrp,
    city:      p.city,
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
        $set: { firstName: d.firstName, lastName: d.lastName, phone: d.phone, ntrp: d.ntrp, city: d.city },
      },
      { new: true, runValidators: true },
    );

    if (!player) return err(res, "Player not found", 404);
    ok(res, playerToFrontend(player));
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
