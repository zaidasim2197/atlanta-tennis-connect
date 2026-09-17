import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FORMAT_LABELS, formatMoney, formatDateRange } from "@/lib/tennis";
import { ArrowLeft, CreditCard, Lock, Users, CalendarDays, MapPin } from "lucide-react";
import { toast } from "sonner";
import { DemoBanner } from "@/components/demo-banner";

export const Route = createFileRoute("/register/$leagueId")({
  component: RegisterLeague,
});

function RegisterLeague() {
  const { leagueId } = Route.useParams();
  const { user, leagues, seasons, players, registerPlayer, spotsLeft } = useStore();
  const navigate = useNavigate();

  const league = leagues.find((l) => l.id === leagueId);
  const season = seasons.find((s) => s.id === league?.seasonId);
  const player = players.find((p) => p.id === user?.playerId);

  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) {
      // Pass leagueId so login/signup pages can show league context and redirect back here.
      navigate({ to: "/login", search: { leagueId } });
    }
  }, [user, navigate, leagueId]);

  if (!league || !season || !user || !player) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      registerPlayer({
        leagueId: league.id,
        player,
        ...(partnerId ? { partnerId } : {}),
      });
      setLoading(false);
      setSuccess(true);
      toast.success("Successfully registered for league!");
    }, 1500);
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
              Your spot in{" "}
              <strong className="text-foreground">{league.name}</strong> is
              officially confirmed. A receipt has been sent to {user.email}.
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
                <span className="font-medium text-foreground">{player.firstName} {player.lastName}</span>
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
                      league.endDate || season.endDate
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-dashed border-border pt-3.5 mt-1.5">
                <span className="font-bold text-foreground">Amount Paid</span>
                <span className="text-lg font-bold text-primary">{formatMoney(league.feeCents)}</span>
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
                <span className="font-medium text-foreground text-right">{league.scheduleDay}s at {league.scheduleTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Player</span>
                <span className="font-medium text-foreground text-right">{player.firstName} {player.lastName} (NTRP {player.ntrp})</span>
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-4 flex justify-between items-end">
              <span className="font-bold text-foreground">Total Due</span>
              <span className="text-2xl font-bold text-primary">{formatMoney(league.feeCents)}</span>
            </div>
          </div>

          {league.format.includes("doubles") && (
            <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-primary mb-4">
                <Users className="size-5" />
                <h3 className="font-bold text-lg">Doubles Partner</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                This is a doubles league. Please select your partner. They must already be registered on the platform.
              </p>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger className="h-11 px-4 text-sm bg-background">
                  <SelectValue placeholder="Select a partner" />
                </SelectTrigger>
                <SelectContent>
                  {players.filter(p => p.id !== player.id).map((p) => (
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
          <DemoBanner
            message="Payment processing is fully simulated. No real charges will be made."
            className="mb-5"
          />
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-primary">
                <CreditCard className="size-5" />
                <h3 className="font-bold text-lg">Mock Payment Information</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCardNumber("4242 4242 4242 4242");
                  setExpiry("12/28");
                  setCvc("123");
                }}
              >
                Auto-fill demo
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground">Card Number</label>
                <input
                  type="text"
                  required
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">Expiry (MM/YY)</label>
                  <input
                    type="text"
                    required
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">CVC</label>
                  <input
                    type="text"
                    required
                    placeholder="123"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <span className="flex items-center text-xs text-muted-foreground">
                  <Lock className="mr-1 size-3" /> Secure prototype payment
                </span>
                <Button
                  type="submit"
                  size="lg"
                  className="rounded-full"
                  disabled={loading || (league.format.includes("doubles") && !partnerId)}
                >
                  {loading ? "Processing…" : `Pay ${formatMoney(league.feeCents)}`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
