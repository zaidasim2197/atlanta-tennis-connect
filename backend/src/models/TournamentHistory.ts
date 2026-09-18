import { Schema, model, Document } from "mongoose";

export type TournamentFinish = "champion" | "finalist" | "semifinalist" | "quarterfinalist";

export interface ITournamentHistory extends Document {
  playerSlug: string;
  playerEmail: string;
  playerName: string;
  tournamentName: string;
  seasonSlug: string;
  division: string;
  skillLevel: string;
  year: number;
  finish: TournamentFinish;
  trophyAwarded: boolean;
  partnerName?: string;
  notes?: string;
  createdAt: Date;
}

const TournamentHistorySchema = new Schema<ITournamentHistory>(
  {
    playerSlug:     { type: String, required: true, index: true },
    playerEmail:    { type: String, required: true, lowercase: true, trim: true, index: true },
    playerName:     { type: String, required: true },
    tournamentName: { type: String, required: true },
    seasonSlug:     { type: String, required: true, index: true },
    division:       { type: String, required: true },
    skillLevel:     { type: String, required: true },
    year:           { type: Number, required: true, index: true },
    finish:         {
      type: String,
      enum: ["champion", "finalist", "semifinalist", "quarterfinalist"],
      required: true,
      index: true,
    },
    trophyAwarded:  { type: Boolean, default: false },
    partnerName:    { type: String },
    notes:          { type: String },
  },
  { timestamps: true },
);

// Compound index for rapid eligibility & historical champion lookups
TournamentHistorySchema.index({ playerEmail: 1, year: -1, division: 1 });
TournamentHistorySchema.index({ finish: 1, division: 1, year: -1 });

export const TournamentHistory = model<ITournamentHistory>(
  "TournamentHistory",
  TournamentHistorySchema,
);
