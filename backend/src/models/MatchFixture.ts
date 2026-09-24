import { Schema, model, Document } from "mongoose";

export type MatchFixtureStatus =
  | "scheduling-required"
  | "scheduled"
  | "completed"
  | "reschedule_requested"
  | "cancelled";

export interface IMatchFixture extends Document {
  slug: string;                 // unique slug e.g. "fix-fall26-ms35-r1-m1"
  leagueSlug: string;           // references League.slug
  groupSlug: string;            // references GeographicGroup.slug
  round: number;
  homePlayerSlug: string;       // references Player.slug (or team lead)
  awayPlayerSlug: string;       // references Player.slug (or team lead)
  homeDoublesPartnerSlug?: string;
  awayDoublesPartnerSlug?: string;
  homeCourtName: string;        // e.g. "Bitsy Grant Tennis Center" or "Court TBC"
  courtArea: string;
  scheduledDate?: string;       // ISO "YYYY-MM-DD"
  scheduledTime?: string;       // e.g. "6:30 PM"
  status: MatchFixtureStatus;
  courtBookingOwner: "home" | "away";
  scoreData?: string;           // e.g. "6-3, 4-6, [10-7]"
  winnerSlug?: string;          // Player.slug of winner
  dataSource?: string;          // e.g. "synthetic-demo"
  createdAt: Date;
  updatedAt: Date;
}

const MatchFixtureSchema = new Schema<IMatchFixture>(
  {
    slug:                   { type: String, required: true, unique: true, index: true },
    leagueSlug:             { type: String, required: true, index: true },
    groupSlug:              { type: String, required: true, index: true },
    round:                  { type: Number, required: true, index: true },
    homePlayerSlug:         { type: String, required: true, index: true },
    awayPlayerSlug:         { type: String, required: true, index: true },
    homeDoublesPartnerSlug: { type: String },
    awayDoublesPartnerSlug: { type: String },
    homeCourtName:          { type: String, required: true, default: "Court TBC" },
    courtArea:              { type: String, default: "" },
    scheduledDate:          { type: String },
    scheduledTime:          { type: String },
    status:                 {
      type: String,
      enum: ["scheduling-required", "scheduled", "completed", "reschedule_requested", "cancelled"],
      default: "scheduled",
      index: true,
    },
    courtBookingOwner:      { type: String, enum: ["home", "away"], default: "home" },
    scoreData:              { type: String },
    winnerSlug:             { type: String },
    dataSource:             { type: String, default: "synthetic-demo", index: true },
  },
  { timestamps: true },
);

MatchFixtureSchema.index({ leagueSlug: 1, groupSlug: 1, round: 1 });
MatchFixtureSchema.index({ homePlayerSlug: 1, status: 1 });
MatchFixtureSchema.index({ awayPlayerSlug: 1, status: 1 });

export const MatchFixture = model<IMatchFixture>("MatchFixture", MatchFixtureSchema);
