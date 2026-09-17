/**
 * MockProvider – deterministic, instant, in-process payment simulation.
 *
 * Used ONLY during load tests (PAYMENT_PROVIDER=mock).
 * Real Stripe sandbox must never receive synthetic load.
 *
 * Behaviour:
 *  - createPayment  → always succeeds instantly, returns a fake intentId
 *  - retrievePayment → returns "paid" immediately (no async delay)
 *  - refundPayment  → always succeeds
 *  - parseWebhookEvent → parses the fake webhook body emitted by this provider
 *
 * Failure injection:
 *  Set MOCK_FAILURE_RATE=0.05 (env) to simulate 5 % payment failures.
 *  This lets load tests exercise the failure + slot-restore path.
 */
import { randomUUID } from "crypto";
import type {
  PaymentProvider,
  CreatePaymentInput,
  CreatePaymentResult,
  RetrievePaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
  WebhookEventResult,
  PaymentStatus,
} from "./types";

// In-memory store of mock intents (survives only within one function invocation;
// that is intentional for stateless serverless – real state lives in Reservation docs)
const mockStore = new Map<string, { status: PaymentStatus; amountCents: number }>();

function shouldFail(): boolean {
  const rate = parseFloat(process.env.MOCK_FAILURE_RATE ?? "0");
  return !isNaN(rate) && Math.random() < rate;
}

export class MockProvider implements PaymentProvider {
  readonly name = "mock" as const;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    // Idempotent: same reservationId → same intentId
    const paymentIntentId = `mock_pi_${input.reservationId}`;
    const status: PaymentStatus = shouldFail() ? "failed" : "paid";
    mockStore.set(paymentIntentId, { status, amountCents: input.amountCents });

    return { paymentIntentId, clientSecret: undefined, status };
  }

  async retrievePayment(paymentIntentId: string): Promise<RetrievePaymentResult> {
    const entry = mockStore.get(paymentIntentId);
    return {
      paymentIntentId,
      status: entry?.status ?? "paid",
      amountCents: entry?.amountCents ?? 0,
    };
  }

  async cancelPayment(paymentIntentId: string): Promise<void> {
    const entry = mockStore.get(paymentIntentId);
    if (entry) entry.status = "cancelled";
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const entry = mockStore.get(input.paymentIntentId);
    if (entry) entry.status = "refunded";
    return { refundId: `mock_re_${randomUUID()}`, status: "succeeded" };
  }

  /**
   * The mock webhook body shape:
   * { eventId, type, paymentIntentId, status }
   * Posted by the reservation route itself after createPayment resolves,
   * or by test scripts to simulate async transitions.
   */
  async parseWebhookEvent(
    rawBody: Buffer,
    _signature: string,
  ): Promise<WebhookEventResult | null> {
    try {
      const payload = JSON.parse(rawBody.toString()) as {
        eventId?: string;
        type?: string;
        paymentIntentId?: string;
        status?: PaymentStatus;
      };

      if (!payload.paymentIntentId || !payload.status) return null;

      return {
        eventId: payload.eventId ?? `mock_evt_${randomUUID()}`,
        type: payload.type ?? "mock.payment_update",
        paymentIntentId: payload.paymentIntentId,
        status: payload.status,
      };
    } catch {
      return null;
    }
  }
}
