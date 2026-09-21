import { Reservation } from "../models/Reservation";
import { cancelReservation } from "../lib/reservationService";
import { getPaymentProvider } from "../payment";

export async function expireReservations(): Promise<{ expired: number }> {
  const stale = await Reservation.find({
    paymentProvider: getPaymentProvider().name,
    status: { $in: ["held", "payment_pending"] },
    expiresAt: { $lte: new Date() },
  })
    .sort({ expiresAt: 1 })
    .limit(100);
  let expired = 0;
  // Bound provider traffic and retain uncertain payments for retry on the next run.
  for (const r of stale) {
    try {
      if ((await cancelReservation(r._id.toString(), "expired")).released) expired++;
    } catch (e) {
      console.error(
        `[expiry-job] Retaining reservation ${r._id} for retry`,
        e instanceof Error ? e.message : "Unknown error",
      );
    }
  }
  return { expired };
}
