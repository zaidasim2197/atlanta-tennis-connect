/**
 * POST /api/registrations
 *   Atomically reserves a spot and initiates payment.
 *   Body: { leagueId, playerEmail, partnerEmail? }
 *   Returns: ReservationDTO  (matches frontend Registration shape)
 *
 * GET /api/registrations?email=
 *   Returns all active reservations for a player email.
 *
 * POST /api/registrations/admin
 *   Organiser reservation using the same capacity, TTL and payment rules.
 *   Body: { leagueId, playerEmail, partnerEmail? }
 *   Requires a server-authenticated organiser session.
 */
import { Router } from "express";
import { z } from "zod";
import {
  createReservation,
  adminRegister,
  getPlayerReservations,
} from "../lib/reservationService";
import { wrap, ok, err } from "../lib/apiResponse";
import { requireAuth, requireOrganizer, ownsEmail } from "../lib/auth";

const router = Router();
router.use(requireAuth);

const CreateBody = z.object({
  leagueId:     z.string().min(1),
  playerEmail:  z.string().email(),
  partnerEmail: z.string().email().optional(),
});

// POST /api/registrations
router.post(
  "/",
  wrap(async (req, res) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) return err(res, "Invalid request body", 400, parsed.error.flatten());

    const { leagueId, playerEmail, partnerEmail } = parsed.data;
    if (!ownsEmail(req, playerEmail)) return err(res, "You can only register your own account", 403);

    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (process.env.PAYMENT_PROVIDER !== "mock" && !publishableKey?.startsWith("pk_")) {
      return err(res, "Stripe checkout is not configured. Please contact the organizer.", 503);
    }

    const result = await createReservation({
      leagueSlug: leagueId,
      playerEmail: req.identity!.email,
      partnerEmail,
    });

    // Return shape the frontend Registration interface expects
    ok(res, { ...result, publishableKey }, 201);
  }),
);

// GET /api/registrations?email=
router.get(
  "/",
  wrap(async (req, res) => {
    const email = typeof req.query.email === "string" ? req.query.email : req.identity!.email;
    if (!ownsEmail(req, email) && req.identity!.role !== "organizer") return err(res, "Access denied", 403);

    const reservations = await getPlayerReservations(email);
    ok(res, reservations);
  }),
);

// POST /api/registrations/admin
router.post(
  "/admin",
  requireOrganizer,
  wrap(async (req, res) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) return err(res, "Invalid request body", 400, parsed.error.flatten());

    const { leagueId, playerEmail, partnerEmail } = parsed.data;
    const reservation = await adminRegister({ leagueSlug: leagueId, playerEmail, partnerEmail });

    ok(res, reservation, 201);
  }),
);

export default router;
