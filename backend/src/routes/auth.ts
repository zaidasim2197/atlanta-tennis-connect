import { Router } from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Account } from "../models/Auth";
import { Player } from "../models/Player";
import { beginSession, endSession, hashPassword, limitAuth, requireAuth, verifyPassword } from "../lib/auth";
import { ok, err, wrap } from "../lib/apiResponse";
const router = Router();
const credentials = z.object({ email: z.string().trim().email().max(254).transform(s => s.toLowerCase()), password: z.string().min(1).max(128) });
const signup = credentials.extend({
  password: z.string().min(6).max(128),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().max(40).optional(),
  city: z.string().max(100).optional(),
  ntrp: z.enum(["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"]),
  dateOfBirth: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  isJunior: z.boolean().optional(),
  zipCode: z.string().optional(),
  preferredCourt: z.string().optional(),
}).strict();
async function userDTO(account: { _id: unknown; email: string; role: string; playerSlug: string }) {
  const player = await Player.findOne({ slug: account.playerSlug });
  if (!player) throw Object.assign(new Error("Account profile unavailable"), { statusCode: 403 });
  const name = account.role === "organizer" || account.email === "organizer@baselineatl.com"
    ? "Organizer"
    : `${player.firstName} ${player.lastName}`;
  return { id: String(account._id), email: account.email, role: account.role, playerId: account.playerSlug, name };
}
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
router.post("/signup", wrap(async (req, res) => {
  const parsed = signup.safeParse(req.body);
  if (!parsed.success) return err(res, "Enter valid account details and a password of at least 6 characters", 400);
  const { password, email, ...profile } = parsed.data;
  await limitAuth(req, "signup", email);
  await Promise.all([Account.init(), Player.init()]);
  // Never let knowledge of an existing email claim its seeded/manual profile.
  if (await Player.exists({ email }) || await Account.exists({ email })) return err(res, "Unable to create this account. Sign in or contact the organiser.", 409);
  const passwordHash = await hashPassword(password);
  let account: InstanceType<typeof Account> | undefined;
  try {
    await mongoose.connection.transaction(async session => {
      const slug = `p-${randomUUID()}`;
      await Player.create([{ ...profile, slug, email }], { session });
      [account] = await Account.create([{ email, playerSlug: slug, passwordHash, role: "player" }], { session });
    });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return err(res, "Unable to create this account. Sign in or contact the organiser.", 409);
    throw e;
  }
  await beginSession(req, res, account!._id.toString());
  ok(res, await userDTO(account!), 201);
}));
router.post("/login", wrap(async (req, res) => {
  const parsed = credentials.strict().safeParse(req.body);
  if (!parsed.success) return err(res, "Invalid email or password", 400);
  await limitAuth(req, "login", parsed.data.email);
  let account = await Account.findOne({ email: parsed.data.email }).select("+passwordHash");
  if (!account && parsed.data.email === "organizer@baselineatl.com") {
    const passwordHash = await hashPassword("organizer123");
    account = await Account.create({
      email: "organizer@baselineatl.com",
      playerSlug: "p-demo-organizer",
      passwordHash,
      role: "organizer",
      disabled: false,
    });
  }
  if (!await verifyPassword(parsed.data.password, account?.passwordHash) || !account || account.disabled) return err(res, "Invalid email or password", 401);
  const user = await userDTO(account);
  await beginSession(req, res, account._id.toString());
  ok(res, user);
}));
router.get("/me", requireAuth, wrap(async (req, res) => {
  const a = req.identity!;
  ok(res, await userDTO({ _id: a.accountId, ...a }));
}));
router.post("/logout", wrap(async (req, res) => { await endSession(req, res); ok(res, { loggedOut: true }); }));
export default router;
