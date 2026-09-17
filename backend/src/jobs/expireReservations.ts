/**
 * Expiry job – finds all "held" or "payment_pending" reservations whose
 * expiresAt is in the past and transitions them to "expired", restoring
 * the slot back to the league.
 *
 * Runs as a Vercel cron function (see vercel.json) and also exported as a
 * plain async function so it can be called from a standalone worker.
 *
 * Safe to run concurrently: each update is atomic on a single document.
 */
import { Reservation } from "../models/Reservation";
import { League } from "../models/League";
import { AuditLog } from "../models/AuditLog";

export async function expireReservations(): Promise<{ expired: number }> {
  const now = new Date();

  // Find all expired-but-not-yet-marked reservations in one query
  const stale = await Reservation.find({
    status: { $in: ["held", "payment_pending"] },
    expiresAt: { $lte: now },
  });

  if (stale.length === 0) return { expired: 0 };

  let expired = 0;

  await Promise.all(
    stale.map(async (reservation) => {
      // Atomic update – only proceeds if still in a pending state
      const updated = await Reservation.findOneAndUpdate(
        {
          _id: reservation._id,
          status: { $in: ["held", "payment_pending"] },
          expiresAt: { $lte: now },
        },
        { $set: { status: "expired", cancelledAt: now } },
        { new: true },
      );

      if (!updated) return; // another instance beat us to it – skip

      // Restore the slot
      await League.findOneAndUpdate(
        { slug: updated.leagueSlug },
        { $inc: { spotsRemaining: 1 } },
      );

      await AuditLog.create({
        reservationId: updated._id,
        leagueSlug: updated.leagueSlug,
        playerEmail: updated.playerEmail,
        action: "reservation.expired",
        actor: "system",
        meta: { expiredAt: now.toISOString() },
      });

      expired++;
    }),
  );

  console.log(`[expiry-job] Expired ${expired} reservation(s)`);
  return { expired };
}
