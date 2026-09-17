/**
 * StripeProvider – wraps the Stripe Node SDK.
 * Ported from the Stripe PoC; adapted to the PaymentProvider interface.
 * Used ONLY when PAYMENT_PROVIDER=stripe.
 * Never called during load tests.
 */
import Stripe from "stripe";
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

function stripeStatusToPaymentStatus(status: Stripe.PaymentIntent.Status): PaymentStatus {
  switch (status) {
    case "succeeded":
      return "paid";
    case "processing":
      return "payment_pending";
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
      return "payment_pending";
    case "canceled":
      return "cancelled";
    default:
      return "failed";
  }
}

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;

  private client: Stripe;
  private webhookSecret: string;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    this.client = new Stripe(key, { apiVersion: "2026-08-26.dahlia" as Stripe.LatestApiVersion });
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    // Idempotency key = reservationId so duplicate calls return the same intent
    const intent = await this.client.paymentIntents.create(
      {
        amount: input.amountCents,
        currency: input.currency,
        description: input.description,
        receipt_email: input.playerEmail,
        metadata: input.metadata,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      },
      { idempotencyKey: input.reservationId },
    );

    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret ?? undefined,
      status: stripeStatusToPaymentStatus(intent.status),
    };
  }

  async retrievePayment(paymentIntentId: string): Promise<RetrievePaymentResult> {
    const intent = await this.client.paymentIntents.retrieve(paymentIntentId);
    return {
      paymentIntentId: intent.id,
      status: stripeStatusToPaymentStatus(intent.status),
      amountCents: intent.amount,
    };
  }

  async cancelPayment(paymentIntentId: string): Promise<void> {
    const intent = await this.client.paymentIntents.retrieve(paymentIntentId);
    if (["requires_payment_method", "requires_confirmation", "requires_action", "requires_capture", "processing"].includes(intent.status)) {
      await this.client.paymentIntents.cancel(paymentIntentId);
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const refund = await this.client.refunds.create({
      payment_intent: input.paymentIntentId,
      ...(input.amountCents !== undefined ? { amount: input.amountCents } : {}),
      ...(input.reason ? { reason: input.reason as Stripe.RefundCreateParams.Reason } : {}),
    });
    return {
      refundId: refund.id,
      status: refund.status === "succeeded" ? "succeeded"
            : refund.status === "pending"   ? "pending"
            : "failed",
    };
  }

  async parseWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): Promise<WebhookEventResult | null> {
    if (!this.webhookSecret) {
      console.warn("STRIPE_WEBHOOK_SECRET not configured – skipping signature check");
    }

    let event: Stripe.Event;
    try {
      event = this.webhookSecret
        ? this.client.webhooks.constructEvent(rawBody, signature, this.webhookSecret)
        : (JSON.parse(rawBody.toString()) as Stripe.Event);
    } catch {
      return null;
    }

    const relevantTypes = new Set([
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "payment_intent.canceled",
      "charge.dispute.created",
      "charge.refunded",
    ]);

    if (!relevantTypes.has(event.type)) return null;

    let intentId: string;
    let status: PaymentStatus;

    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        intentId = pi.id;
        status = "paid";
        break;
      }
      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        intentId = pi.id;
        status = event.type === "payment_intent.canceled" ? "cancelled" : "failed";
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        intentId = charge.payment_intent as string;
        status = "refunded";
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        intentId = (dispute.charge as Stripe.Charge).payment_intent as string
                ?? dispute.payment_intent as string;
        status = "disputed";
        break;
      }
      default:
        return null;
    }

    return { eventId: event.id, type: event.type, paymentIntentId: intentId, status };
  }
}
