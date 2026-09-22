/**
 * Shared bootstrap for every Vercel serverless function.
 * Caches the DB connection across warm invocations.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDB } from "../../backend/src/lib/db";
import { app } from "../../backend/src/server";

let dbReady: Promise<unknown> | null = null;

export async function bootstrap(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  try {
    if (!dbReady) {
      dbReady = connectDB().catch((err) => {
        dbReady = null;
        console.error("MongoDB connection failed:", err);
        throw err;
      });
    }
    await dbReady;
    app(req as unknown as import("express").Request, res as unknown as import("express").Response);
  } catch (err: any) {
    console.error("Vercel API error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Internal server error" });
  }
}
