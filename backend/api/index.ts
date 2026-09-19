/**
 * Vercel Serverless Function entry point.
 * Wraps the Express app so all /api/* routes are handled by a single function.
 */
import "dotenv/config";
import { connectDB } from "../src/lib/db";
import { app } from "../src/server";

// Ensure DB is connected before handling any request
let dbReady: Promise<void> | null = null;

function ensureDB() {
  if (!dbReady) {
    dbReady = connectDB()
      .then(() => {
        console.log("MongoDB connected (serverless)");
      })
      .catch((err) => {
        console.error("MongoDB connection failed:", err);
        dbReady = null; // Allow retry on next invocation
        throw err;
      });
  }
  return dbReady;
}

// Vercel expects a default export for the serverless function
export default async function handler(req: any, res: any) {
  await ensureDB();
  return app(req, res);
}
