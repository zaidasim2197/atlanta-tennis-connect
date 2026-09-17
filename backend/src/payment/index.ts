/**
 * Returns the configured PaymentProvider singleton.
 * Reads PAYMENT_PROVIDER env at runtime so the same build can run
 * with either "stripe" or "mock" without recompiling.
 */
import type { PaymentProvider } from "./types";

let _provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (_provider) return _provider;

  const name = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();

  if (name === "stripe") {
    // Lazy-require so Stripe SDK is never imported in mock-only environments
    const { StripeProvider } = require("./stripeProvider") as typeof import("./stripeProvider");
    _provider = new StripeProvider();
  } else {
    const { MockProvider } = require("./mockProvider") as typeof import("./mockProvider");
    _provider = new MockProvider();
  }

  return _provider!;
}

export type { PaymentProvider, PaymentStatus } from "./types";
