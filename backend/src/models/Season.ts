import { Schema, model, Document } from "mongoose";

export type SeasonStatus = "upcoming" | "active" | "closed";

export interface ISeason extends Document {
  slug: string;          // e.g. "s-fall-26" – stable ID used by frontend
  name: string;
  startDate: string;     // ISO date string "YYYY-MM-DD"
  endDate: string;
  status: SeasonStatus;
}

const SeasonSchema = new Schema<ISeason>(
  {
    slug:      { type: String, required: true, unique: true, index: true },
    name:      { type: String, required: true },
    startDate: { type: String, required: true },
    endDate:   { type: String, required: true },
    status:    { type: String, enum: ["upcoming", "active", "closed"], default: "upcoming" },
  },
  { timestamps: true },
);

export const Season = model<ISeason>("Season", SeasonSchema);
