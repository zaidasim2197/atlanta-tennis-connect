/**
 * Vercel cron function – runs every 2 minutes.
 * Expires stale reservations and restores slots.
 * Secured by CRON_SECRET env var checked as Authorization header.
 */
import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDB } from "../../backend/src/lib/db";
import { expireReservations } from "../../backend/src/jobs/expireReservations";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel passes the secret as "Bearer <CRON_SECRET>"
  const auth = req.headers.authorization ?? "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    await connectDB();
    const result = await expireReservations();
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron/expire]", e);
    res.status(500).json({ ok: false, error: "Internal error" });
  }
}
