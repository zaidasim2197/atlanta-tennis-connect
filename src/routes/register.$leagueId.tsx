import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useStore, getApiUrl } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FORMAT_LABELS, formatMoney, formatDateRange } from "@/lib/tennis";
import {
  ArrowLeft,
  CreditCard,
  Lock,
  Users,
  CalendarDays,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { StripeCheckoutForm } from "@/components/stripe-checkout-form";

export const Route = createFileRoute("/register/$leagueId")({
  component: RegisterLeague,
});

interface ActiveReservation {
  id: string;
  clientSecret?: string;
  publishableKey: string;
  expiresAt: string;
  amountCents: number;
}

function RegisterLeague() {
  const { leagueId } = Route.useParams();
  const { user, hydrated, leagues, seasons, players, refreshFromDb, spotsLeft } = useStore();
  const navigate = useNavigate();

  const league = leagues.find((l) => l.id === leagueId);
  const season = seasons.find((s) => s.id === league?.seasonId);
  const player = players.find(
    (p) =>
      p.id === user?.playerId ||
      (user?.email && p.email.toLowerCase() === user.email.toLowerCase()),
  );

  const [partnerId, setPartnerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [reservation, setReservation] = useState<ActiveReservation | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !user) {
      // Pass leagueId so login/signup pages can show league context and redirect back here.
      navigate({ to: "/login", search: { leagueId } });
    }
  }, [user, hydrated, navigate, leagueId]);

  const busy = useRef(false);
  const paying = useRef(false);
  const completed = useRef(false);
  const storageKey = `checkout:${leagueId}:${user?.email || ""}`;

  // Restore checkout after refresh without creating another hold or charge.
  useEffect(() => {
    if (!user) return;
    const id = sessionStorage.getItem(storageKey);
    if (!id) return;
    let disposed = false;
    setLoading(true);
    fetch(getApiUrl(`/api/payments/${id}/checkout`))
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Could not restore checkout");
        if (disposed) return;
        if (json.data.reservation.status === "registered") {
          completed.current = true;
          sessionStorage.removeItem(storageKey);
          setSuccess(true);
          void refreshFromDb();
        } else if (json.data.clientSecret) {
          setReservation({
            ...json.data.reservation,
            clientSecret: json.data.clientSecret,
            publishableKey: json.data.publishableKey,
          });
        } else {
          sessionStorage.removeItem(storageKey);
          setApiError("Your previous reservation has ended. You can reserve a new spot.");
        }
      })
      .catch((e) => {
        if (!disposed) setApiError(e.message);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [storageKey, user?.email, refreshFromDb]);

  // SPA navigation releases an abandoned checkout promptly. Full refreshes retain
  // the ID for recovery; closed tabs are reclaimed by the server expiry job.
  useEffect(() => {
    if (!reservation) return;
    completed.current = false;
    const id = reservation.id;
    return () => {
      if (!completed.current && !paying.current) {
        void fetch(getApiUrl(`/api/payments/${id}/cancel`), { method: "POST", keepalive: true });
      }
    };
  }, [reservation?.id]);

  if (!league || !season || !user || !player) {
    return null;
  }

  const handleReserve = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setApiError(null);
    const partner = partnerId ? players.find((p) => p.id === partnerId) : undefined;
    try {
      const res = await fetch(getApiUrl("/api/registrations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: league.id,
          playerEmail: user.email,
          ...(partner?.email ? { partnerEmail: partner.email } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not reserve a spot.");
      const data = json.data;
      if (!data.clientSecret || !data.publishableKey)
        throw new Error("Stripe checkout is unavailable. Please contact the organizer.");
      setReservation({
        ...data.reservation,
        clientSecret: data.clientSecret,
        publishableKey: data.publishableKey,
      });
      sessionStorage.setItem(storageKey, data.reservation.id);
      toast.success("Your spot is held for 15 minutes. Complete your payment below.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not start checkout. Please retry.";
      setApiError(message);
      toast.error(message);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    if (!reservation) return;
    const res = await fetch(getApiUrl(`/api/payments/${reservation.id}/reconcile`), {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok || !json.ok)
      throw new Error(json.error || "Could not verify payment. Please retry verification.");
    if (json.data.status !== "registered")
      throw new Error(
        "Payment is still pending. Please check payment status again; do not start another payment.",
      );
    completed.current = true;
    sessionStorage.removeItem(storageKey);
    setSuccess(true);
    await refreshFromDb();
    toast.success("Payment confirmed. Your registration is complete.");
  };

  const handleCancelReservation = async () => {
    if (!reservation || busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/payments/${reservation.id}/cancel`), {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.ok || !json.data.released)
        throw new Error(json.error || "Cancellation is not confirmed. Please retry.");
      completed.current = true;
      sessionStorage.removeItem(storageKey);
      setReservation(null);
      await refreshFromDb();
      toast.info("Reservation cancelled. Your spot has been released.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Cancellation failed. Please retry.";
      setApiError(message);
      toast.error(message);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  // ─── Premium Registration Success Screen ──────────────────────────────────
  if (success) {
    return (
      <div className="flex min-h-[85vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Animated check + headline */}
          <div className="flex flex-col items-center text-center mb-10">
            <div className="relative flex size-28 items-center justify-center">
              {/* Ping ring */}
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-10" />
              {/* Outer ring */}
              <span className="absolute size-24 rounded-full border-2 border-emerald-200" />
              {/* Icon circle */}
              <span className="relative flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
                <svg
                  className="size-10 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            </div>

            <h1 className="mt-7 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              You're in! 🎾
            </h1>
            <p className="mt-3 max-w-sm text-base text-muted-foreground leading-relaxed">
              Your spot in <strong className="text-foreground">{league.name}</strong> is officially
              confirmed.
            </p>

            {/* Spots pill */}
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-sm">
              <span className="size-2 rounded-full bg-emerald-500" />
              {spotsLeft(league.id)} spots remaining after your registration
            </div>
          </div>

          {/* Ticket-style confirmation card */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-[var(--shadow-lift)]">
            {/* Ticket header */}
            <div className="bg-primary px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/60">
                    Registration Confirmed
                  </p>
                  <p className="mt-1.5 text-xl font-bold text-primary-foreground leading-tight">
                    {league.name}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-bold text-primary-foreground">
                  {FORMAT_LABELS[league.format]}
                </span>
              </div>

              {/* Mini details row */}
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-primary-foreground/80">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" />
                  {league.scheduleDay}s at {league.scheduleTime}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {league.venue}
                </span>
              </div>
            </div>

            {/* Perforation divider */}
            <div className="relative flex items-center">
              <div className="-ml-3.5 size-7 rounded-full bg-background border border-border shrink-0" />
              <div className="flex-1 border-t border-dashed border-border mx-1" />
              <div className="-mr-3.5 size-7 rounded-full bg-background border border-border shrink-0" />
            </div>

            {/* Ticket body */}
            <div className="px-6 py-5 space-y-3.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Player</span>
                <span className="font-medium text-foreground">
                  {player.firstName} {player.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">NTRP Rating</span>
                <span className="font-medium text-foreground">{player.ntrp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Season</span>
                <span className="font-medium text-foreground">{season.name}</span>
              </div>
              {((league.startDate && league.endDate) || (season.startDate && season.endDate)) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dates</span>
                  <span className="font-medium text-foreground">
                    {formatDateRange(
                      league.startDate || season.startDate,
                      league.endDate || season.endDate,
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-dashed border-border pt-3.5 mt-1.5">
                <span className="font-bold text-foreground">Amount Paid</span>
                <span className="text-lg font-bold text-primary">
                  {formatMoney(league.feeCents)}
                </span>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="flex-1 rounded-full">
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1 rounded-full">
              <Link to="/leagues">Browse more leagues</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Registration Form ─────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-4 text-muted-foreground">
          <Link to="/leagues/$leagueId" params={{ leagueId: league.id }}>
            <ArrowLeft className="mr-2 size-4" /> Back to League
          </Link>
        </Button>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Complete Registration
          </h1>

          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-bold text-lg border-b border-border pb-4 mb-4">Summary</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">League</span>
                <span className="font-medium text-foreground text-right">{league.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Season</span>
                <span className="font-medium text-foreground text-right">{season.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Schedule</span>
                <span className="font-medium text-foreground text-right">
                  {league.scheduleDay}s at {league.scheduleTime}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Player</span>
                <span className="font-medium text-foreground text-right">
                  {player.firstName} {player.lastName} (NTRP {player.ntrp})
                </span>
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-4 flex justify-between items-end">
              <span className="font-bold text-foreground">Total Due</span>
              <span className="text-2xl font-bold text-primary">
                {formatMoney(league.feeCents)}
              </span>
            </div>
          </div>

          {league.format.includes("doubles") && (
            <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-primary mb-4">
                <Users className="size-5" />
                <h3 className="font-bold text-lg">Doubles Partner</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                This is a doubles league. Please select your partner. They must already be
                registered on the platform.
              </p>
              <Select
                disabled={Boolean(reservation)}
                value={partnerId}
                onValueChange={setPartnerId}
              >
                <SelectTrigger className="h-11 px-4 text-sm bg-background">
                  <SelectValue placeholder="Select a partner" />
                </SelectTrigger>
                <SelectContent>
                  {players
                    .filter((p) => p.id !== player.id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} (NTRP {p.ntrp})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div>

          {apiError && reservation && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {apiError}
            </p>
          )}
          {reservation && reservation.clientSecret ? (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between mb-5 border-b border-border pb-4">
                <div className="flex items-center gap-2 text-primary">
                  <CreditCard className="size-5" />
                  <h3 className="font-bold text-lg">Secure Stripe Checkout</h3>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <Lock className="size-3" /> Stripe Elements
                </span>
              </div>

              <StripeCheckoutForm
                key={reservation.id}
                publishableKey={reservation.publishableKey}
                busy={loading}
                clientSecret={reservation.clientSecret}
                reservationId={reservation.id}
                amountCents={reservation.amountCents}
                expiresAt={reservation.expiresAt}
                leagueName={league.name}
                onSuccess={handlePaymentSuccess}
                onCancel={handleCancelReservation}
                onError={(err) => setApiError(err)}
                onProcessingChange={(value) => {
                  paying.current = value;
                }}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between mb-4 border-b border-border pb-4">
                <div className="flex items-center gap-2 text-primary">
                  <CreditCard className="size-5" />
                  <h3 className="font-bold text-lg">Reservation & Payment</h3>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">Step 1 of 2</span>
              </div>

              {apiError && (
                <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive leading-relaxed">
                  {apiError}
                </div>
              )}

              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  Clicking below atomically reserves your spot in{" "}
                  <strong className="text-foreground">{league.name}</strong> for 15 minutes while
                  you complete secure payment.
                </p>
                <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-foreground">
                    <span>Spot Reservation Hold</span>
                    <span className="font-mono font-bold text-primary">15:00 minutes</span>
                  </div>
                  <div className="flex justify-between text-foreground">
                    <span>Payment Processing</span>
                    <span className="font-semibold">Stripe Elements (Cards & 3DS)</span>
                  </div>
                  <div className="flex justify-between text-foreground border-t border-border pt-2 font-bold">
                    <span>Registration Fee</span>
                    <span className="text-sm text-primary">{formatMoney(league.feeCents)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Button
                  type="button"
                  size="lg"
                  className="w-full rounded-full font-bold shadow-md shadow-primary/20"
                  disabled={loading || (league.format.includes("doubles") && !partnerId)}
                  onClick={() => handleReserve()}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Holding your spot…
                    </span>
                  ) : (
                    `Reserve Spot & Pay ${formatMoney(league.feeCents)}`
                  )}
                </Button>
              </div>

              <div className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                <span>Zero oversell guarantee · Atomic spot reservation</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
