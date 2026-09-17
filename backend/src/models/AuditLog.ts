/**
 * Append-only audit trail.
 * Every state transition on a Reservation writes one entry here.
 * Never update or delete audit log records.
 */
import { Schema, model, Document, Types } from "mongoose";

export type AuditAction =
  | "reservation.created"
  | "reservation.expired"
  | "reservation.cancelled"
  | "payment.initiated"
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refunded"
  | "payment.disputed"
  | "registration.confirmed"
  | "admin.manual_registration";

export interface IAuditLog extends Document {
  reservationId: Types.ObjectId;
  leagueSlug: string;
  playerEmail: string;
  action: AuditAction;
  actor: "player" | "system" | "admin" | "webhook";
  meta: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    reservationId: { type: Schema.Types.ObjectId, required: true, index: true },
    leagueSlug:   { type: String, required: true, index: true },
    playerEmail:  { type: String, required: true },
    action:       { type: String, required: true },
    actor:        { type: String, enum: ["player","system","admin","webhook"], required: true },
    meta:         { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // no updatedAt – append only
  },
);

export const AuditLog = model<IAuditLog>("AuditLog", AuditLogSchema);
