import { useEffect, useMemo, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/tennis";

interface Props {
  publishableKey: string;
  clientSecret: string;
  reservationId: string;
  amountCents: number;
  expiresAt: string;
  leagueName: string;
  busy: boolean;
  onSuccess: () => Promise<void> | void;
  onCancel: () => Promise<void> | void;
  onError: (message: string) => void;
  onProcessingChange: (value: boolean) => void;
}
function PaymentForm(props: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(props.expiresAt).getTime() - Date.now()),
  );
  const expiryRequested = useRef(false);
  const lock = useRef(false);
  useEffect(() => {
    const timer = setInterval(
      () => setRemaining(Math.max(0, new Date(props.expiresAt).getTime() - Date.now())),
      1000,
    );
    return () => clearInterval(timer);
  }, [props.expiresAt]);
  useEffect(() => {
    if (remaining > 0 || processing || submitted || expiryRequested.current) return;
    expiryRequested.current = true;
    void props.onCancel();
  }, [remaining, processing, submitted, props.onCancel]);
  const verify = async () => {
    if (lock.current) return;
    lock.current = true;
    setProcessing(true);
    try {
      await props.onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed. Please retry.");
    } finally {
      lock.current = false;
      setProcessing(false);
    }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || remaining <= 0 || lock.current || submitted) return;
    lock.current = true;
    setProcessing(true);
    props.onProcessingChange(true);
    setError("");
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (result.error)
        throw new Error(result.error.message || "Payment failed. Please try again.");
      if (
        ["succeeded", "processing", "requires_capture"].includes(result.paymentIntent?.status || "")
      ) {
        setSubmitted(true);
        // Keep navigation cleanup from cancelling an uncertain successful charge.
        await props.onSuccess();
      } else throw new Error("Payment needs additional action. Please try again.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Payment could not be completed.";
      setError(message);
      props.onError(message);
    } finally {
      lock.current = false;
      setProcessing(false);
      props.onProcessingChange(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex justify-between rounded-xl bg-primary/5 p-4 text-sm" aria-live="off">
        <span>{remaining > 0 ? "Your spot is reserved" : "Reservation time has ended"}</span>
        <span className="font-mono">
          {String(Math.floor(remaining / 60000)).padStart(2, "0")}:
          {String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}
        </span>
      </div>
      {props.publishableKey.startsWith("pk_test_") && (
        <p className="text-sm text-muted-foreground">
          Stripe test mode — no real money is charged.
        </p>
      )}
      {!submitted && (
        <PaymentElement
          onReady={() => setReady(true)}
          onLoadError={() =>
            setError(
              "Stripe could not load. Check your connection and refresh, or cancel your reservation.",
            )
          }
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {submitted ? (
        <Button
          type="button"
          className="w-full"
          disabled={processing || props.busy}
          onClick={verify}
        >
          {processing ? "Verifying payment…" : "Check payment status"}
        </Button>
      ) : (
        <Button
          type="submit"
          className="w-full"
          disabled={!stripe || !elements || !ready || processing || props.busy || remaining <= 0}
        >
          {processing
            ? "Confirming payment…"
            : `Pay ${formatMoney(props.amountCents)} for ${props.leagueName}`}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={processing || props.busy}
        onClick={props.onCancel}
      >
        {props.busy ? "Updating reservation…" : "Cancel reservation & release spot"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Payments are securely processed by Stripe.
      </p>
    </form>
  );
}
export function StripeCheckoutForm(props: Props) {
  const stripe = useMemo(() => loadStripe(props.publishableKey), [props.publishableKey]);
  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret: props.clientSecret,
        appearance: {
          theme: "stripe",
          variables: { colorPrimary: "#166534", borderRadius: "10px" },
        },
      }}
    >
      <PaymentForm {...props} />
    </Elements>
  );
}
