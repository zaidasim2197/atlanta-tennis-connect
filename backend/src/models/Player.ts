import { Schema, model, Document } from "mongoose";
import type { SkillLevel } from "./League";

export interface IPlayer extends Document {
  slug: string;       // stable frontend ID e.g. "p-1"
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  ntrp: SkillLevel;
  city: string;
}

const PlayerSchema = new Schema<IPlayer>(
  {
    slug:      { type: String, required: true, unique: true, index: true },
    firstName: { type: String, required: true },
    lastName:  { type: String, required: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone:     { type: String, default: "" },
    ntrp:      { type: String, enum: ["2.5","3.0","3.5","4.0","4.5+"], required: true },
    city:      { type: String, default: "" },
  },
  { timestamps: true },
);

export const Player = model<IPlayer>("Player", PlayerSchema);
