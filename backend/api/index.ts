/**
 * Vercel Serverless Function entry point.
 * Wraps the Express app so all /api/* routes are handled by a single function.
 */
import "dotenv/config";
import { connectDB } from "../src/lib/db";

export const config = { api: { bodyParser: false }, maxDuration: 30 };

// Ensure DB is connected before handling any request
let dbReady: Promise<void> | null = null;
let appReady: Promise<typeof import("../src/server")["app"]> | null = null;

function getApp() {
  if (!appReady) {
    appReady = import("../src/server").then(m => m.app).catch(err => {
      console.error("FATAL: Failed to load Express app:", err);
      appReady = null;
      throw err;
    });
  }
  return appReady;
}

function ensureDB() {
  if (!dbReady) {
    dbReady = connectDB()
      .then(() => {
        console.log("MongoDB connected (serverless)");
      })
      .catch((err) => {
        console.error("MongoDB connection failed:", err);
        dbReady = null;
        throw err;
      });
  }
  return dbReady;
}

// Vercel expects a default export for the serverless function
export default async function handler(req: any, res: any) {
  try {
    await ensureDB();
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error("Handler error:", err);
    res.status(503).json({ ok: false, error: "Service temporarily unavailable" });
  }
}
