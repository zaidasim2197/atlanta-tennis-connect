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
import { formatMoney, type League } from "@/lib/tennis";
import { ArrowLeft, CreditCard, Lock, Users } from "lucide-react";
import { toast } from "sonner";

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
      navigate({ to: "/login" });
    }
  }, [user, navigate]);

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
        partnerId: partnerId || undefined,
      });
      setLoading(false);
      setSuccess(true);
      toast.success("Successfully registered for league!");
    }, 1500); // Simulate payment processing delay
  };

  if (success) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-6">
          <svg className="size-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Registration Complete!
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          You are now registered for <strong>{league.name}</strong>.
          We have sent a confirmation receipt to your email.
        </p>
        <div className="mt-4 inline-flex items-center rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground shadow-sm">
          There are {spotsLeft(league.id)} spots remaining in this flight.
        </div>
        <div className="mt-8 flex gap-4">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full">
            <Link to="/leagues">Browse more</Link>
          </Button>
        </div>
      </div>
    );
  }

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
                  {loading ? "Processing..." : `Pay ${formatMoney(league.feeCents)}`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
