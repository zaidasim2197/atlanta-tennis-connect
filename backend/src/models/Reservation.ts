/**
 * Reservation – the atomic unit that holds a league slot.
 *
 * State machine (matches the Stripe PoC PaymentProvider contract):
 *
 *   available → held → payment_pending → paid → registered
 *                  ↓          ↓
 *               expired     failed
 *                             ↓
 *                          cancelled | refunded | disputed
 *
 * "available" is not stored as a document – it is implied by
 * League.spotsRemaining > 0.
 *
 * The first write that decrements spotsRemaining also creates the
 * Reservation in "held" state. From there the frontend completes
 * payment and the webhook/mock transitions it forward.
 */
import { Schema, model, Document, Types } from "mongoose";

export type ReservationStatus =
  | "held"
  | "payment_pending"
  | "paid"
  | "registered"
  | "failed"
  | "expired"
  | "cancelled"
  | "refunded"
  | "disputed";

export interface IReservation extends Document {
  _id: Types.ObjectId;
  leagueSlug: string;
  playerSlug: string;
  playerEmail: string;
  partnerSlug?: string;

  status: ReservationStatus;
  amountCents: number;

  // Payment provider fields
  paymentProvider: "stripe" | "mock";
  paymentIntentId?: string;    // Stripe PaymentIntent ID or mock equivalent
  idempotencyKey: string;      // keyed on reservationId – prevents duplicate charges

  // Timestamps
  heldAt: Date;
  expiresAt: Date;             // heldAt + RESERVATION_TTL_MINUTES
  paidAt?: Date;
  cancelledAt?: Date;

  // Webhook event deduplication
  lastWebhookEventId?: string;
  webhookEventIds?: string[];
}

const ReservationSchema = new Schema<IReservation>(
  {
    leagueSlug:       { type: String, required: true, index: true },
    playerSlug:       { type: String, required: true, index: true },
    playerEmail:      { type: String, required: true, lowercase: true },
    partnerSlug:      { type: String },

    status:           {
      type: String,
      enum: ["held","payment_pending","paid","registered","failed","expired","cancelled","refunded","disputed"],
      default: "held",
      index: true,
    },
    amountCents:      { type: Number, required: true, min: 0 },

    paymentProvider:  { type: String, enum: ["stripe","mock"], required: true },
    paymentIntentId:  { type: String, index: true, sparse: true },
    idempotencyKey:   { type: String, required: true, unique: true },

    heldAt:           { type: Date, required: true, default: () => new Date() },
    expiresAt:        { type: Date, required: true, index: true },
    paidAt:           { type: Date },
    cancelledAt:      { type: Date },

    lastWebhookEventId: { type: String },
    webhookEventIds:    { type: [String], default: [] },
  },
  { timestamps: true },
);

// Compound unique: one active reservation per player per league
ReservationSchema.index(
  { leagueSlug: 1, playerEmail: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["held", "payment_pending", "paid", "registered"] },
    },
  },
);

export const Reservation = model<IReservation>("Reservation", ReservationSchema);
