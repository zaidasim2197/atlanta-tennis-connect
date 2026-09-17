/**
 * reservationService – the single authoritative place for all reservation logic.
 *
 * The atomic slot-decrement pattern (findOneAndUpdate with $gt:0 guard) means
 * it is impossible to oversell even under high concurrency.  If two requests
 * race for the last spot, exactly one wins the decrement; the other receives
 * spotsRemaining=0 and an HTTP 409.
 */
import mongoose from "mongoose";
import { League } from "../models/League";
import { Player } from "../models/Player";
import { Reservation, type IReservation, type ReservationStatus } from "../models/Reservation";
import { AuditLog } from "../models/AuditLog";
import { getPaymentProvider } from "../payment";

const TTL_MS = () =>
  parseInt(process.env.RESERVATION_TTL_MINUTES ?? "15", 10) * 60 * 1000;

// ─── Shape returned to the frontend ─────────────────────────────────────────

export interface ReservationDTO {
  id: string;
  leagueId: string;          // league slug – matches frontend "id" field
  playerId: string;          // player slug
  createdAt: string;         // ISO
  paymentStatus: "paid" | "pending";
  amountCents: number;
  paymentIntentId?: string;
  clientSecret?: string;
  status: ReservationStatus;
  expiresAt: string;
}

function toDTO(r: IReservation): ReservationDTO {
  return {
    id: r._id.toString(),
    leagueId: r.leagueSlug,
    playerId: r.playerSlug,
    createdAt: r.heldAt.toISOString().slice(0, 10),
    paymentStatus: ["paid", "registered"].includes(r.status) ? "paid" : "pending",
    amountCents: r.amountCents,
    paymentIntentId: r.paymentIntentId,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
  };
}

// ─── Create reservation (atomic decrement) ──────────────────────────────────

export interface CreateReservationInput {
  leagueSlug: string;
  playerEmail: string;
  partnerEmail?: string;
}

export async function createReservation(
  input: CreateReservationInput,
): Promise<{ reservation: ReservationDTO; clientSecret?: string }> {
  const provider = getPaymentProvider();

  // 1. Atomically decrement spotsRemaining – the only place this happens.
  //    The $gt:0 guard is the race-condition fence.
  const league = await League.findOneAndUpdate(
    {
      slug: input.leagueSlug,
      registrationOpen: true,
      spotsRemaining: { $gt: 0 },
    },
    { $inc: { spotsRemaining: -1 } },
    { new: true },
  );

  if (!league) {
    throw Object.assign(new Error("League is full or registration is closed"), {
      statusCode: 409,
    });
  }

  // 2. Resolve player by email
  const player = await Player.findOne({ email: input.playerEmail.toLowerCase() });
  if (!player) {
    // Roll back the decrement before throwing
    await League.findOneAndUpdate(
      { slug: input.leagueSlug },
      { $inc: { spotsRemaining: 1 } },
    );
    throw Object.assign(new Error("Player not found"), { statusCode: 404 });
  }

  // 3. Resolve optional partner
  let partnerSlug: string | undefined;
  if (input.partnerEmail) {
    const partner = await Player.findOne({ email: input.partnerEmail.toLowerCase() });
    if (partner) partnerSlug = partner.slug;
  }

  // 4. Create the Reservation document
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS());
  const idempotencyKey = `res_${league.slug}_${player.slug}_${now.getTime()}`;

  let reservation: IReservation;
  try {
    reservation = await Reservation.create({
      leagueSlug: league.slug,
      playerSlug: player.slug,
      playerEmail: player.email,
      partnerSlug,
      status: "held",
      amountCents: league.feeCents,
      paymentProvider: provider.name,
      idempotencyKey,
      heldAt: now,
      expiresAt,
    });
  } catch (err: unknown) {
    // Unique-constraint violation: player already has an active reservation
    const mongoErr = err as { code?: number };
    if (mongoErr.code === 11000) {
      // Roll back decrement
      await League.findOneAndUpdate(
        { slug: input.leagueSlug },
        { $inc: { spotsRemaining: 1 } },
      );
      throw Object.assign(
        new Error("You already have an active reservation for this league"),
        { statusCode: 409 },
      );
    }
    throw err;
  }

  // 5. Audit
  await AuditLog.create({
    reservationId: reservation._id,
    leagueSlug: league.slug,
    playerEmail: player.email,
    action: "reservation.created",
    actor: "player",
    meta: { spotsRemaining: league.spotsRemaining, provider: provider.name },
  });

  // 6. Initiate payment immediately
  const payment = await provider.createPayment({
    reservationId: reservation._id.toString(),
    amountCents: league.feeCents,
    currency: "usd",
    description: `${league.name} registration`,
    playerEmail: player.email,
    metadata: {
      leagueSlug: league.slug,
      playerSlug: player.slug,
      reservationId: reservation._id.toString(),
    },
  });

  reservation.paymentIntentId = payment.paymentIntentId;
  reservation.status = payment.status === "paid" ? "paid" : "payment_pending";
  await reservation.save();

  await AuditLog.create({
    reservationId: reservation._id,
    leagueSlug: league.slug,
    playerEmail: player.email,
    action: "payment.initiated",
    actor: "system",
    meta: { paymentIntentId: payment.paymentIntentId, provider: provider.name },
  });

  // 7. For mock provider: payment resolves instantly – advance to registered
  if (provider.name === "mock" && payment.status === "paid") {
    await advanceToRegistered(reservation);
  }

  return { reservation: toDTO(reservation), clientSecret: payment.clientSecret };
}

// ─── Confirm payment (called by webhook or polling) ─────────────────────────

export async function confirmPayment(
  paymentIntentId: string,
  incomingStatus: ReservationStatus,
  webhookEventId?: string,
): Promise<void> {
  const reservation = await Reservation.findOne({ paymentIntentId });
  if (!reservation) return; // already processed or unknown

  // Idempotency: skip if we've already processed this event
  if (webhookEventId && reservation.lastWebhookEventId === webhookEventId) return;

  // Only advance forward – never go backwards in the state machine
  const terminalStates: ReservationStatus[] = ["registered", "refunded", "disputed", "cancelled", "expired"];
  if (terminalStates.includes(reservation.status)) return;

  if (incomingStatus === "paid" || incomingStatus === "registered") {
    await advanceToRegistered(reservation, webhookEventId);
  } else if (incomingStatus === "failed" || incomingStatus === "cancelled") {
    await failReservation(reservation, incomingStatus, webhookEventId);
  } else if (incomingStatus === "refunded") {
    reservation.status = "refunded";
    if (webhookEventId) reservation.lastWebhookEventId = webhookEventId;
    await reservation.save();
    await AuditLog.create({
      reservationId: reservation._id,
      leagueSlug: reservation.leagueSlug,
      playerEmail: reservation.playerEmail,
      action: "payment.refunded",
      actor: "webhook",
      meta: { webhookEventId },
    });
  } else if (incomingStatus === "disputed") {
    reservation.status = "disputed";
    if (webhookEventId) reservation.lastWebhookEventId = webhookEventId;
    await reservation.save();
    await AuditLog.create({
      reservationId: reservation._id,
      leagueSlug: reservation.leagueSlug,
      playerEmail: reservation.playerEmail,
      action: "payment.disputed",
      actor: "webhook",
      meta: { webhookEventId },
    });
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

async function advanceToRegistered(
  reservation: IReservation,
  webhookEventId?: string,
): Promise<void> {
  const now = new Date();
  reservation.status = "registered";
  reservation.paidAt = now;
  if (webhookEventId) reservation.lastWebhookEventId = webhookEventId;
  await reservation.save();

  await AuditLog.create({
    reservationId: reservation._id,
    leagueSlug: reservation.leagueSlug,
    playerEmail: reservation.playerEmail,
    action: "registration.confirmed",
    actor: "system",
    meta: { paidAt: now.toISOString(), webhookEventId },
  });
}

async function failReservation(
  reservation: IReservation,
  status: "failed" | "cancelled",
  webhookEventId?: string,
): Promise<void> {
  reservation.status = status;
  reservation.cancelledAt = new Date();
  if (webhookEventId) reservation.lastWebhookEventId = webhookEventId;
  await reservation.save();

  // Restore the slot
  await League.findOneAndUpdate(
    { slug: reservation.leagueSlug },
    { $inc: { spotsRemaining: 1 } },
  );

  await AuditLog.create({
    reservationId: reservation._id,
    leagueSlug: reservation.leagueSlug,
    playerEmail: reservation.playerEmail,
    action: status === "failed" ? "payment.failed" : "reservation.cancelled",
    actor: "webhook",
    meta: { webhookEventId },
  });
}

// ─── Admin / manual registration (reuses same reservation logic) ─────────────

export async function adminRegister(input: CreateReservationInput): Promise<ReservationDTO> {
  // Force the payment through as paid immediately regardless of provider
  const { reservation } = await createReservation(input);

  // If somehow still pending (e.g. Stripe slow), advance manually
  if (reservation.status !== "registered") {
    const doc = await Reservation.findById(reservation.id);
    if (doc) {
      await advanceToRegistered(doc);
      await AuditLog.create({
        reservationId: doc._id,
        leagueSlug: doc.leagueSlug,
        playerEmail: doc.playerEmail,
        action: "admin.manual_registration",
        actor: "admin",
        meta: {},
      });
      return toDTO(doc);
    }
  }
  return reservation;
}

// ─── Get reservations for a player ──────────────────────────────────────────

export async function getPlayerReservations(playerEmail: string): Promise<ReservationDTO[]> {
  const reservations = await Reservation.find({
    playerEmail: playerEmail.toLowerCase(),
    status: { $in: ["held", "payment_pending", "paid", "registered"] },
  }).sort({ heldAt: -1 });

  return reservations.map(toDTO);
}
