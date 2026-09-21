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
 *   Manual/admin registration – same underlying logic, bypasses TTL.
 *   Body: { leagueId, playerEmail, partnerEmail? }
 *   Header: x-admin-key (checked against ADMIN_KEY env var)
 */
import { Router } from "express";
import { z } from "zod";
import {
  createReservation,
  adminRegister,
  getPlayerReservations,
} from "../lib/reservationService";
import { wrap, ok, err } from "../lib/apiResponse";

const router = Router();

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

    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (process.env.PAYMENT_PROVIDER !== "mock" && !publishableKey?.startsWith("pk_")) {
      return err(res, "Stripe checkout is not configured. Please contact the organizer.", 503);
    }

    const result = await createReservation({
      leagueSlug: leagueId,
      playerEmail,
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
    const email = req.query.email as string | undefined;
    if (!email) return err(res, "email query param required", 400);

    const reservations = await getPlayerReservations(email);
    ok(res, reservations);
  }),
);

// POST /api/registrations/admin
router.post(
  "/admin",
  wrap(async (req, res) => {
    // Lightweight key check – not full RBAC (out of scope per spec)
    const key = req.headers["x-admin-key"];
    const expected = process.env.ADMIN_KEY;
    if (!expected || key !== expected) {
      return err(res, "Unauthorized", 401);
    }

    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) return err(res, "Invalid request body", 400, parsed.error.flatten());

    const { leagueId, playerEmail, partnerEmail } = parsed.data;
    const reservation = await adminRegister({ leagueSlug: leagueId, playerEmail, partnerEmail });

    ok(res, reservation, 201);
  }),
);

export default router;
