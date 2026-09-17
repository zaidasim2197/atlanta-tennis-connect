/**
 * Express server entry point.
 * Runs locally with `npm run dev`.
 * For Vercel: each api/*.ts file imports the app and re-exports a handler.
 */
import express from "express";
import cors from "cors";

import { connectDB } from "./lib/db";
import leaguesRouter from "./routes/leagues";
import registrationsRouter from "./routes/registrations";
import paymentsRouter from "./routes/payments";
import playersRouter from "./routes/players";

export const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
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
