import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Settings, LogOut, CheckCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { formatDateRange, formatMoney, type League } from "@/lib/tennis";
import { DemoBanner } from "@/components/demo-banner";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    // We can't access hooks in beforeLoad directly easily here without passing it, 
    // so we will handle the redirect inside the component if user is null.
  },
  component: Dashboard,
});

function Dashboard() {
  const { user, players, registrations, leagues, seasons, logout } = useStore();

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl font-bold">Please sign in to view your dashboard</h1>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/login" search={{ leagueId: undefined }}>Sign In</Link>
        </Button>
      </div>
    );
  }

  const currentPlayer = players.find((p) => p.id === user.playerId) || {
    firstName: user.name.split(" ")[0] || "Player",
    lastName: user.name.split(" ")[1] || "",
    email: user.email,
    phone: "(404) 555-0100",
    ntrp: "3.5" as const,
    city: "Atlanta",
  };

  const myRegistrations = registrations.filter((r) => r.playerId === user.playerId);

  const getLeagueDetails = (leagueId: string) => {
    const league = leagues.find((l) => l.id === leagueId);
    const season = seasons.find((s) => s.id === league?.seasonId);
    return { league, season };
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Welcome back, {currentPlayer.firstName}!
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your leagues, view schedules, and track your tennis progress.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/profile">
              <Settings className="mr-2 size-4" /> Edit Profile
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={logout} className="rounded-full text-muted-foreground">
            <LogOut className="mr-2 size-4" /> Sign Out
          </Button>
        </div>
      </div>

      <DemoBanner
        message="Your dashboard, registered leagues and payment history are all simulated demo data."
        className="mt-6"
      />

      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">My Leagues</h2>
            <Button asChild variant="link">
              <Link to="/leagues">Browse more</Link>
            </Button>
          </div>

          <div className="mt-6 space-y-4">
            {myRegistrations.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <p className="text-muted-foreground">You haven't registered for any leagues yet.</p>
                <Button asChild className="mt-4 rounded-full">
                  <Link to="/leagues">Find a league</Link>
                </Button>
              </div>
            ) : (
              myRegistrations.map((reg) => {
                const { league, season } = getLeagueDetails(reg.leagueId);
                if (!league) return null;
                
                return (
                  <div key={reg.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                          {season?.name}
                        </span>
                        {reg.paymentStatus === "paid" && (
                          <span className="flex items-center text-xs font-medium text-emerald-600">
                            <CheckCircle className="mr-1 size-3" /> Paid
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-lg font-bold text-foreground">
                        <Link to="/leagues/$leagueId" params={{ leagueId: league.id }} className="hover:underline">
                          {league.name}
                        </Link>
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {league.scheduleDay}s at {league.scheduleTime}
                        {league.startDate && league.endDate ? ` · ${formatDateRange(league.startDate, league.endDate)}` : ""}
                        {" · "}{league.venue}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <Button asChild variant="outline" size="sm" className="rounded-full">
                        <Link to="/leagues/$leagueId" params={{ leagueId: league.id }}>View details</Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold">Upcoming Matches</h2>
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">
              {myRegistrations.length > 0 
                ? "Match schedules are being finalized. Check back soon." 
                : "Register for a league to see your schedule."}
            </p>
          </div>
          
          <div className="mt-8 rounded-3xl bg-secondary p-6">
            <h3 className="font-bold text-foreground">Profile Status</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Contact Info</span>
                {currentPlayer?.phone ? <CheckCircle className="size-4 text-emerald-600" /> : <span className="text-xs text-amber-600">Missing</span>}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Skill Level</span>
                {currentPlayer?.ntrp ? <CheckCircle className="size-4 text-emerald-600" /> : <span className="text-xs text-amber-600">Missing</span>}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Payment Method</span>
                <span className="text-xs text-muted-foreground">Not saved</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
