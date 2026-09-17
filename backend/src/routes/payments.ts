/**
 * POST /api/payments/webhook
 *   Receives Stripe or mock webhook events and advances reservation state.
 *   Uses atomic claim pattern: the lastWebhookEventId field prevents
 *   duplicate processing of replayed events.
 *
 * GET /api/payments/status/:reservationId
 *   Polls current payment state for a reservation.
 *   Used by the frontend after returning from the Stripe checkout redirect.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { getPaymentProvider } from "../payment";
import { confirmPayment } from "../lib/reservationService";
import { Reservation } from "../models/Reservation";
import { wrap, ok, err } from "../lib/apiResponse";

const router = Router();

// POST /api/payments/webhook
// express.raw() must be applied BEFORE this route so rawBody is a Buffer
router.post("/webhook", async (req: Request, res: Response) => {
  const provider = getPaymentProvider();
  const sig = (req.headers["stripe-signature"] as string) ?? "";

  let event;
  try {
    event = await provider.parseWebhookEvent(req.body as Buffer, sig);
  } catch {
    return err(res, "Webhook parse error", 400);
  }

  if (!event) {
    // Not relevant to us – acknowledge so provider doesn't retry
    return ok(res, { received: true });
  }

  try {
    await confirmPayment(
      event.paymentIntentId,
      event.status as import("../models/Reservation").ReservationStatus,
      event.eventId,
    );
  } catch (e) {
    console.error("confirmPayment error", e);
    // Still return 200 – we don't want Stripe to retry a bad event
  }

  ok(res, { received: true });
});

// GET /api/payments/status/:reservationId
router.get(
  "/status/:reservationId",
  wrap(async (req, res) => {
    const reservation = await Reservation.findById(req.params.reservationId).lean();
    if (!reservation) return err(res, "Reservation not found", 404);

    ok(res, {
      id: reservation._id.toString(),
      status: reservation.status,
      paymentStatus: ["paid", "registered"].includes(reservation.status) ? "paid" : "pending",
      leagueId: reservation.leagueSlug,
      playerId: reservation.playerSlug,
      amountCents: reservation.amountCents,
      expiresAt: reservation.expiresAt,
      paidAt: reservation.paidAt ?? null,
    });
  }),
);

export default router;
