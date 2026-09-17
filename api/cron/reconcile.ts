/**
 * Vercel cron function – runs every 5 minutes.
 * Polls the payment provider for any payment_pending reservations
 * whose webhook was missed.
 */
import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDB } from "../../backend/src/lib/db";
import { reconcilePayments } from "../../backend/src/jobs/reconcilePayments";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization ?? "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    await connectDB();
    const result = await reconcilePayments();
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron/reconcile]", e);
    res.status(500).json({ ok: false, error: "Internal error" });
  }
}
