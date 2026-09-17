/**
 * Shared bootstrap for every Vercel serverless function.
 * Caches the DB connection across warm invocations.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDB } from "../../backend/src/lib/db";
import { app } from "../../backend/src/server";

let ready = false;

export async function bootstrap(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (!ready) {
    await connectDB();
    ready = true;
  }
  app(req as unknown as import("express").Request, res as unknown as import("express").Response);
}
