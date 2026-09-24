import { Schema, model, Document } from "mongoose";

export interface IGeographicGroup extends Document {
  slug: string;           // e.g. "grp-fall26-ms35-buckhead"
  leagueSlug: string;     // references League.slug
  name: string;           // e.g. "Buckhead Division"
  geographicArea: string; // e.g. "Buckhead", "Midtown", "Decatur"
  playerSlugs: string[];  // array of Player.slug
  dataSource?: string;    // e.g. "synthetic-demo"
  createdAt: Date;
  updatedAt: Date;
}

const GeographicGroupSchema = new Schema<IGeographicGroup>(
  {
    slug:           { type: String, required: true, unique: true, index: true },
    leagueSlug:     { type: String, required: true, index: true },
    name:           { type: String, required: true },
    geographicArea: { type: String, required: true },
    playerSlugs:    { type: [String], default: [] },
    dataSource:     { type: String, default: "synthetic-demo", index: true },
  },
  { timestamps: true },
);

GeographicGroupSchema.index({ leagueSlug: 1, geographicArea: 1 });

export const GeographicGroup = model<IGeographicGroup>("GeographicGroup", GeographicGroupSchema);
