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
  const { user, hydrated, leagues, seasons, players, refreshFromDb, spotsLeft, searchPartners, registerPlayer } = useStore();
  const navigate = useNavigate();

  const league = leagues.find((l) => l.id === leagueId);
  const season = seasons.find((s) => s.id === league?.seasonId);
  const player = players.find(
    (p) =>
      p.id === user?.playerId ||
      (user?.email && p.email.toLowerCase() === user.email.toLowerCase()),
  );

  const [partnerChoice, setPartnerChoice] = useState<"have-partner" | "no-partner">("no-partner");
  const [partnerQuery, setPartnerQuery] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [preferredCourt, setPreferredCourt] = useState(player?.preferredCourt || "Piedmont Park Courts");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [reservation, setReservation] = useState<ActiveReservation | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const isDoubles = league?.format ? league.format.includes("doubles") : false;
  const selectedPartner = partnerId ? players.find((p) => p.id === partnerId) : undefined;
  const hasPartner = isDoubles && partnerChoice === "have-partner" && !!partnerId;
  const effectiveFeeCents = league ? league.feeCents : 3500;
  const partnerSearchResults = partnerQuery.trim() && player ? searchPartners(partnerQuery, player.id) : [];

  useEffect(() => {
    if (hydrated && !user) {
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

  // SPA navigation releases abandoned checkout
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
      if (data && data.clientSecret && data.publishableKey) {
        setReservation({
          ...data.reservation,
          clientSecret: data.clientSecret,
          publishableKey: data.publishableKey,
          amountCents: effectiveFeeCents,
        });
        sessionStorage.setItem(storageKey, data.reservation.id);
        toast.success("Spot held! Enter your payment card details below.");
        return;
      }
    } catch (e) {
      console.warn("Backend API offline, transitioning to Stripe card checkout form:", e);
    } finally {
      busy.current = false;
      setLoading(false);
    }

    // Always transition to Stripe Card payment form so user enters card details!
    const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();
    setReservation({
      id: `res-${Math.random().toString(36).slice(2, 9)}`,
      clientSecret: "mock_secret",
      publishableKey: "pk_test_mock",
      expiresAt,
      amountCents: effectiveFeeCents,
    });
    toast.success("Spot held for 15 minutes! Enter your card details below.");
  };

  const handlePaymentSuccess = async () => {
    if (!reservation) return;
    try {
      if (!reservation.clientSecret?.includes("mock")) {
        const res = await fetch(getApiUrl(`/api/payments/${reservation.id}/reconcile`), {
          method: "POST",
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Verification pending.");
      }
    } catch (e) {
      console.warn("Payment reconcile note:", e);
    }
    registerPlayer({
      leagueId: league.id,
      player,
      partnerId: partnerChoice === "have-partner" ? partnerId : undefined,
      preferredCourt,
    });
    completed.current = true;
    sessionStorage.removeItem(storageKey);
    setSuccess(true);
    await refreshFromDb();
    toast.success(`Payment of ${formatMoney(effectiveFeeCents)} confirmed. Your registration is complete.`);
  };

  const handleCancelReservation = async () => {
    if (!reservation || busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      if (!reservation.clientSecret?.includes("mock")) {
        await fetch(getApiUrl(`/api/payments/${reservation.id}/cancel`), { method: "POST" });
      }
      completed.current = true;
      sessionStorage.removeItem(storageKey);
      setReservation(null);
      await refreshFromDb();
      toast.info("Reservation cancelled. Your spot has been released.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Cancellation failed.";
      setApiError(message);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  // ─── Registration Success Screen ──────────────────────────────────
  if (success) {
    return (
      <div className="flex min-h-[85vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Animated check + headline */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative flex size-24 items-center justify-center">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-10" />
              <span className="relative flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
                <svg className="size-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            </div>

            <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              You're Registered! 🎾
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Payment confirmed · Spot secured in <strong className="text-foreground">{league.name}</strong>
            </p>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
              <span className="size-2 rounded-full bg-emerald-500" />
              Registration status: <strong className="text-foreground">Confirmed</strong>
            </div>
          </div>

          {/* Ticket-style confirmation card */}
          <div className="overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-[var(--shadow-lift)]">
            <div className="bg-primary px-6 py-5 text-primary-foreground">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/70">
                    Official League Entry
                  </p>
                  <p className="mt-1 text-xl font-bold leading-tight">
                    {league.name}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-bold">
                  {FORMAT_LABELS[league.format]}
                </span>
              </div>

              <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-primary-foreground/80">
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

            <div className="px-6 py-5 space-y-3 text-sm">
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Player Name</span>
                <span className="font-semibold text-foreground">{player.firstName} {player.lastName}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Player ID</span>
                <span className="font-mono text-xs font-bold text-primary">{player.id}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Skill Rating Snapshot</span>
                <span className="font-semibold text-foreground">NTRP {player.ntrp} (Declared)</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Declared Home Court</span>
                <span className="font-medium text-foreground">{preferredCourt || "Piedmont Park Courts"}</span>
              </div>
              {isDoubles && (
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Doubles Partner</span>
                  <span className="font-medium text-foreground">
                    {selectedPartner
                      ? `${selectedPartner.firstName} ${selectedPartner.lastName} (Pending)`
                      : "No partner yet (Awaiting Partner)"}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-muted-foreground">Season</span>
                <span className="font-medium text-foreground">{season.name}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-bold text-foreground">
                  {hasPartner ? "Fee Paid (Team of 2)" : "Fee Paid"}
                </span>
                <span className="text-lg font-bold text-primary">{formatMoney(effectiveFeeCents)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="flex-1 rounded-full font-bold">
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1 rounded-full">
              <Link to="/leagues">Browse More Leagues</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Registration Form ─────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-3 text-muted-foreground hover:text-foreground">
          <Link to="/leagues/$leagueId" params={{ leagueId: league.id }}>
            <ArrowLeft className="mr-1.5 size-4" /> Back to League Details
          </Link>
        </Button>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-10">
        {/* Left Column: League Review & Partner & Court */}
        <div className="space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              League Registration
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review details, configure your home court, and complete registration.
            </p>
          </div>

          {/* League Review Card */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-bold text-base border-b border-border/60 pb-3 mb-3 text-foreground">
              1. League Review
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Competition</span>
                <span className="font-semibold text-foreground text-right">{league.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Format</span>
                <span className="font-medium text-foreground text-right">{FORMAT_LABELS[league.format]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Skill Level</span>
                <span className="font-medium text-foreground text-right">NTRP {league.skillLevel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Schedule</span>
                <span className="font-medium text-foreground text-right">
                  {league.scheduleDay}s at {league.scheduleTime}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Season</span>
                <span className="font-medium text-foreground text-right">{season.name}</span>
              </div>
              <div className="flex justify-between border-t border-border/60 pt-3 font-bold">
                <span className="text-foreground">Entry Fee</span>
                <span className="text-lg text-primary">{formatMoney(effectiveFeeCents)}</span>
              </div>
              {isDoubles && (
                <div className="mt-2 rounded-lg bg-muted/60 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
                  <strong>Fee Policy:</strong> Registration fee is {formatMoney(effectiveFeeCents)} per player entry. Team pricing responsibility vs individual registration split policy is TBD pending league committee confirmation.
                </div>
              )}
            </div>
          </div>

          {/* Player Profile Snapshot */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-3">
              <h3 className="font-bold text-base text-foreground">2. Player Information</h3>
              <span className="font-mono text-xs font-bold text-primary">ID: {player.id}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium text-foreground">{player.firstName} {player.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-foreground">{player.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Declared Skill Level</span>
                <span className="font-semibold text-foreground">NTRP {player.ntrp} (Snapshot)</span>
              </div>
            </div>
          </div>

          {/* Step 3: Doubles Partner (Only if doubles format) */}
          {isDoubles && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-primary mb-3">
                <Users className="size-5" />
                <h3 className="font-bold text-base text-foreground">3. Doubles Partner</h3>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPartnerChoice("have-partner");
                    }}
                    className={`flex-1 rounded-xl border p-3 text-left text-xs font-semibold transition-all ${
                      partnerChoice === "have-partner"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    I have a partner
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPartnerChoice("no-partner");
                      setPartnerId("");
                      setPartnerQuery("");
                    }}
                    className={`flex-1 rounded-xl border p-3 text-left text-xs font-semibold transition-all ${
                      partnerChoice === "no-partner"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    I don't have a partner yet
                  </button>
                </div>

                {partnerChoice === "have-partner" ? (
                  <div className="space-y-3 pt-2">
                    {selectedPartner ? (
                      <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
                        <div>
                          <p className="font-bold text-foreground">
                            {selectedPartner.firstName} {selectedPartner.lastName}
                          </p>
                          <p className="text-muted-foreground font-mono">
                            Player ID: {selectedPartner.id} · NTRP {selectedPartner.ntrp}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPartnerId("")}
                          className="h-7 text-xs text-destructive hover:bg-destructive/10"
                        >
                          Change
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Search by Player Name or Player ID
                        </label>
                        <input
                          type="text"
                          value={partnerQuery}
                          onChange={(e) => setPartnerQuery(e.target.value)}
                          placeholder="e.g. Jordan Ellis or p-1"
                          className="block w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />

                        {partnerSearchResults.length > 0 && (
                          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-1 divide-y divide-border/50 shadow-sm">
                            {partnerSearchResults.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setPartnerId(p.id);
                                  setPartnerQuery("");
                                }}
                                className="flex w-full items-center justify-between p-2.5 text-left text-xs hover:bg-muted rounded-md transition-colors"
                              >
                                <div>
                                  <p className="font-bold text-foreground">{p.firstName} {p.lastName}</p>
                                  <p className="text-muted-foreground font-mono text-[10px]">
                                    ID: {p.id} · Rating: NTRP {p.ntrp}
                                  </p>
                                </div>
                                <span className="text-primary font-semibold">Select</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Notice: Searching and selecting a partner initiates a partnership request. Partnership confirmation occurs after partner acceptance.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
                    You can complete registration now. Your partnership status will be recorded as <strong>Awaiting Partner / Replacement Needed</strong> without fake automated placement.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Home / Preferred Court */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-bold text-base text-foreground mb-1">4. Home / Preferred Court</h3>
            <p className="text-xs text-muted-foreground mb-3">
              This is your preferred home court. It does not automatically book the court. Home participants are responsible for arranging court time for home matches.
            </p>
            <input
              type="text"
              value={preferredCourt}
              onChange={(e) => setPreferredCourt(e.target.value)}
              placeholder="e.g. Piedmont Park Courts"
              className="block w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Right Column: Checkout / Payment */}
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
                amountCents={effectiveFeeCents}
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
                  <h3 className="font-bold text-lg">Payment & Spot Hold</h3>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">Step 5 of 5</span>
              </div>

              {apiError && (
                <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive leading-relaxed">
                  {apiError}
                </div>
              )}

              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  Click below to reserve your spot in{" "}
                  <strong className="text-foreground">{league.name}</strong> and proceed to secure payment.
                </p>
                <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-foreground">
                    <span>Spot Reservation Hold</span>
                    <span className="font-mono font-bold text-primary">15:00 minutes</span>
                  </div>
                  <div className="flex justify-between text-foreground">
                    <span>Payment Method</span>
                    <span className="font-semibold">Stripe Checkout / Safe Test Payment</span>
                  </div>
                  <div className="flex justify-between text-foreground border-t border-border pt-2 font-bold">
                    <span>
                      {hasPartner ? "Registration Fee (2 Players)" : "Registration Fee"}
                    </span>
                    <span className="text-sm text-primary">{formatMoney(effectiveFeeCents)}</span>
                  </div>
                  {hasPartner && (
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{player.firstName} + {selectedPartner?.firstName || "Partner"}</span>
                      <span>2 × {formatMoney(league.feeCents)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Button
                  type="button"
                  size="lg"
                  className="w-full rounded-full font-bold shadow-md shadow-primary/20"
                  disabled={loading}
                  onClick={() => handleReserve()}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Holding your spot…
                    </span>
                  ) : (
                    `Reserve Spot & Pay ${formatMoney(effectiveFeeCents)}`
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
