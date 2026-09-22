/**
 * POST /api/players
 *   Create or upsert a player record (used during signup flow).
 *   Body: { firstName, lastName, email, phone?, ntrp, city? }
 *
 * GET /api/players/:email
 *   Look up a player by email.
 */
import { Router } from "express";
import { z } from "zod";
import { Player } from "../models/Player";
import { wrap, ok, err } from "../lib/apiResponse";
import { randomUUID } from "crypto";

const router = Router();

const SkillLevel = z.enum(["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"]);

const PlayerBody = z.object({
  firstName:       z.string().min(1),
  lastName:        z.string().min(1),
  email:           z.string().email(),
  phone:           z.string().optional().default(""),
  ntrp:            SkillLevel,
  city:            z.string().optional().default(""),
  zipCode:         z.string().optional().default("30309"),
  preferredCourt:  z.string().optional().default(""),
  preferredFormat: z.string().optional().default("senior-singles"),
  dateOfBirth:     z.string().optional().default(""),
  parentName:      z.string().optional().default(""),
  parentPhone:     z.string().optional().default(""),
  isJunior:        z.boolean().optional().default(false),
});

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
    const slug = `p-${randomUUID().slice(0, 8)}`;

    const player = await Player.findOneAndUpdate(
      { email: d.email.toLowerCase() },
      {
        $setOnInsert: { slug },
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
        },
      },
      { upsert: true, new: true },
    );

    ok(res, playerToFrontend(player), 201);
  }),
);

// GET /api/players/:email
router.get(
  "/:email",
  wrap(async (req, res) => {
    const player = await Player.findOne({
      email: decodeURIComponent(req.params.email as string).toLowerCase(),
    });
    if (!player) return err(res, "Player not found", 404);
    ok(res, playerToFrontend(player));
  }),
);

export default router;
