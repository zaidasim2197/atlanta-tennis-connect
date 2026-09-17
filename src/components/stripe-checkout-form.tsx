import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Clock,
  Clipboard,
  Check,
  AlertCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatMoney } from "@/lib/tennis";

const publishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  "pk_test_placeholder";

const stripePromise = loadStripe(publishableKey);

interface StripeCheckoutFormProps {
  clientSecret: string;
  reservationId: string;
  amountCents: number;
  expiresAt: string;
  leagueName: string;
  onSuccess: () => Promise<void> | void;
  onCancel: () => Promise<void> | void;
  onError: (errorMessage: string) => void;
}

const TEST_CARDS = [
  { label: "Successful Payment", card: "4242 4242 4242 4242", note: "Standard test card" },
  { label: "3D Secure Required", card: "4000 0000 0000 3063", note: "Prompts 3DS verification modal" },
  { label: "Generic Decline", card: "4000 0000 0000 0002", note: "Simulates issuer card decline" },
  { label: "Insufficient Funds", card: "4000 0000 0000 9995", note: "Simulates insufficient balance" },
];

function InnerPaymentForm({
  amountCents,
  expiresAt,
  leagueName,
  onSuccess,
  onCancel,
  onError,
}: Omit<StripeCheckoutFormProps, "clientSecret" | "reservationId">) {
  const stripe = useStripe();
  const elements = useElements();

  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);
  const [showTestCards, setShowTestCards] = useState(false);
  const [copiedCard, setCopiedCard] = useState<string | null>(null);

  // Countdown timer for reservation TTL
  useEffect(() => {
    const updateTimer = () => {
      const remaining = new Date(expiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        setTimeLeft("00:00");
        setIsExpired(true);
        setErrorMessage("Your reservation has expired and the spot has been released.");
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(
          `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
        );
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleCopyCard = async (card: string) => {
    try {
      await navigator.clipboard.writeText(card.replace(/\s+/g, ""));
      setCopiedCard(card);
      setTimeout(() => setCopiedCard(null), 2000);
    } catch {
      /* ignore clipboard permission errors */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || isExpired) {
      return;
    }

    setProcessing(true);
    setErrorMessage(null);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (result.error) {
        const msg = result.error.message || "Payment could not be completed.";
        setErrorMessage(msg);
        onError(msg);
      } else if (result.paymentIntent?.status === "succeeded") {
        await onSuccess();
      } else if (
        result.paymentIntent?.status === "requires_action" ||
        result.paymentIntent?.status === "processing"
      ) {
        // Handled via redirect or polling
        await onSuccess();
      } else {
        const msg = "Payment status pending. Please verify your receipt.";
        setErrorMessage(msg);
        onError(msg);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payment processing error.";
      setErrorMessage(msg);
      onError(msg);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Reservation Hold Pill */}
      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-primary">
          <Clock className="size-4 animate-pulse" />
          <span className="font-semibold">Spot held for you</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
          <span>Expires in:</span>
          <span
            className={`rounded px-1.5 py-0.5 ${
              isExpired ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
            }`}
          >
            {timeLeft || "15:00"}
          </span>
        </div>
      </div>

      {/* Stripe Payment Element */}
      <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

      {/* Test Card Quick-Helper Toggle */}
      <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs">
        <button
          type="button"
          onClick={() => setShowTestCards((open) => !open)}
          className="flex w-full items-center justify-between font-semibold text-foreground hover:text-primary transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-primary" />
            Stripe Sandbox Test Cards (Test Mode)
          </span>
          {showTestCards ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {showTestCards && (
          <div className="mt-3 space-y-2 pt-2 border-t border-border">
            <p className="text-muted-foreground text-[11px]">
              Use any future expiration date (e.g. 12/28) and any 3-digit CVC.
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {TEST_CARDS.map(({ label, card, note }) => (
                <button
                  type="button"
                  key={card}
                  onClick={() => handleCopyCard(card)}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-2 text-left transition hover:border-primary hover:bg-accent/40"
                >
                  <div>
                    <p className="font-semibold text-foreground text-xs">{label}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{card}</p>
                    <p className="text-[10px] text-muted-foreground/80">{note}</p>
                  </div>
                  <div className="ml-2 shrink-0 text-muted-foreground">
                    {copiedCard === card ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Clipboard className="size-3.5" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full font-bold shadow-md shadow-primary/20"
          disabled={processing || !stripe || !elements || isExpired}
        >
          {processing ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Confirming payment…
            </span>
          ) : (
            `Pay ${formatMoney(amountCents)} for ${leagueName}`
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground hover:text-foreground text-xs"
          disabled={processing}
          onClick={onCancel}
        >
          Cancel reservation & release spot
        </Button>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <Lock className="size-3" />
        <span>End-to-end encrypted by Stripe Elements · 256-bit SSL</span>
      </div>
    </form>
  );
}

export function StripeCheckoutForm(props: StripeCheckoutFormProps) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#166534",
            colorBackground: "#ffffff",
            colorText: "#0f172a",
            colorDanger: "#dc2626",
            fontFamily: "Manrope, system-ui, sans-serif",
            borderRadius: "10px",
          },
        },
      }}
    >
      <InnerPaymentForm
        amountCents={props.amountCents}
        expiresAt={props.expiresAt}
        leagueName={props.leagueName}
        onSuccess={props.onSuccess}
        onCancel={props.onCancel}
        onError={props.onError}
      />
    </Elements>
  );
}
