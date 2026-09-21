/**
 * Express server entry point.
 * Runs locally with `npm run dev`.
 * For Vercel: each api/*.ts file imports the app and re-exports a handler.
 */
import "dotenv/config";
import dns from "node:dns";
import express from "express";
import cors from "cors";

// TODO: REMOVE/STUB BEFORE COMMITTING - Custom DNS resolution for MongoDB Atlas SRV
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"]);

import { connectDB } from "./lib/db";
import leaguesRouter from "./routes/leagues";
import registrationsRouter from "./routes/registrations";
import paymentsRouter from "./routes/payments";
import playersRouter from "./routes/players";
import { expireReservations } from "./jobs/expireReservations";
import { reconcilePayments } from "./jobs/reconcilePayments";
import { wrap, ok, err } from "./lib/apiResponse";

export const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps/curl),
      // any localhost port, or the production frontend
      if (
        !origin ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        origin === process.env.CLIENT_URL ||
        /\.vercel\.app$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
    credentials: true,
  }),
);

// Webhook route needs raw body BEFORE json parser
app.use(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
);

app.use(express.json());

// ─── Health check ────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), env: process.env.NODE_ENV });
});

// ─── Routes ─────────────────────────────────────────────────────────────────

app.use("/api/leagues", leaguesRouter);
app.use("/api/registrations", registrationsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/players", playersRouter);
app.get("/api/cron/:job", wrap(async (req, res) => {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return err(res, "Unauthorized", 401);
  }
  if (req.params.job === "expire") return ok(res, await expireReservations());
  if (req.params.job === "reconcile") return ok(res, await reconcilePayments());
  return err(res, "Unknown job", 404);
}));

// ─── 404 catch-all ──────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

// ─── Start (local only) ──────────────────────────────────────────────────────

if (require.main === module) {
  const PORT = parseInt(process.env.PORT ?? "3001", 10);
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Atlanta Tennis API running on http://localhost:${PORT}`);
        console.log(`Payment provider: ${process.env.PAYMENT_PROVIDER ?? "mock"}`);
      });
    })
    .catch((err) => {
      console.error("Failed to connect to MongoDB:", err);
      process.exit(1);
    });
}
