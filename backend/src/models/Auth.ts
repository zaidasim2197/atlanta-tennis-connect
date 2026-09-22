import { Schema, model } from "mongoose";
// Roles are assigned by an operator, never by a signup or profile request.
export const Account = model("Account", new Schema({
  email: { type: String, required: true, unique: true },
  playerSlug: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["player", "organizer"], default: "player", required: true },
  disabled: { type: Boolean, default: false },
}, { timestamps: true }));
export const AuthSession = model("AuthSession", new Schema({
  tokenHash: { type: String, required: true, unique: true },
  accountId: { type: Schema.Types.ObjectId, required: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true }));
export const AuthAttempt = model("AuthAttempt", new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}));
