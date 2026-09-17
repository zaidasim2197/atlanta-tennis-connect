/**
 * Reconciliation job – catches any "payment_pending" reservations where
 * the webhook was missed or delayed.  Polls the payment provider directly
 * and advances state accordingly.
 *
 * Runs as a Vercel cron function and as a standalone callable.
 * Safe to run concurrently with the expiry job.
 */
import { Reservation } from "../models/Reservation";
import { getPaymentProvider } from "../payment";
import { confirmPayment } from "../lib/reservationService";

// Only look back this many minutes to avoid hammering the provider
const LOOK_BACK_MINUTES = 60;

export async function reconcilePayments(): Promise<{ reconciled: number; errors: number }> {
  // Skip reconciliation when using the mock provider – state is always current
  const provider = getPaymentProvider();
  if (provider.name === "mock") {
    return { reconciled: 0, errors: 0 };
  }

  const cutoff = new Date(Date.now() - LOOK_BACK_MINUTES * 60 * 1000);

  const pending = await Reservation.find({
    status: "payment_pending",
    paymentIntentId: { $exists: true, $ne: null },
    heldAt: { $gte: cutoff },
  });

  if (pending.length === 0) return { reconciled: 0, errors: 0 };

  let reconciled = 0;
  let errors = 0;

  await Promise.all(
    pending.map(async (reservation) => {
      try {
        if (!reservation.paymentIntentId) return;

        const result = await provider.retrievePayment(reservation.paymentIntentId);

        // Only act on terminal states – leave "payment_pending" alone
        if (["paid", "failed", "cancelled", "refunded"].includes(result.status)) {
          await confirmPayment(
            reservation.paymentIntentId,
            result.status as import("../models/Reservation").ReservationStatus,
          );
          reconciled++;
        }
      } catch (e) {
        console.error(`[reconcile-job] Error reconciling ${reservation._id.toString()}:`, e);
        errors++;
      }
    }),
  );

  console.log(`[reconcile-job] Reconciled ${reconciled}, errors ${errors}`);
  return { reconciled, errors };
}
