import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Users,
  Trophy,
  Clock,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { useStore } from "@/lib/store";
import { FORMAT_LABELS, formatDate, formatDateRange, formatMoney } from "@/lib/tennis";

export const Route = createFileRoute("/leagues/$leagueId")({
  head: () => ({
    meta: [
      { title: "League Details — Baseline ATL Atlanta Tennis Leagues" },
      {
        name: "description",
        content: "Format, skill level, schedule, venue and fee for this Atlanta tennis league, plus online registration.",
      },
      { property: "og:title", content: "League Details — Baseline ATL" },
      { property: "og:description", content: "Format, skill level, schedule, venue and fee, plus online registration." },
    ],
  }),
  component: LeagueDetail,
});

const MATCH_DAY = [
  { time: "15 min before", title: "Warm up", body: "Meet your opponent, split a short warm-up and confirm the scoring format." },
  { time: "Match play", title: "Two sets + tiebreak", body: "Best of two sets with a 10-point match tiebreak if you split." },
  { time: "After", title: "Report the score", body: "Either player reports the result; standings update the same evening." },
];

function LeagueDetail() {
  const { leagueId } = useParams({ from: "/leagues/$leagueId" });
  const { leagueById, seasonById, spotsLeft, registrationsForLeague } = useStore();
  const league = leagueById(leagueId);

  if (!league) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-3xl font-bold">League not found</h1>
        <p className="mt-3 text-muted-foreground">This league may have been closed or removed.</p>
        <Button asChild className="mt-6">
          <Link to="/leagues">Back to all leagues</Link>
        </Button>
      </div>
    );
  }

  const season = seasonById(league.seasonId);
  const left = spotsLeft(league.id);
  const registered = registrationsForLeague(league.id).length;
  const canRegister = league.registrationOpen && left > 0;

  return (
    <div>
      <section className="court-lines bg-primary-deep pb-14 pt-8 text-white sm:pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-white/60">
            <Link to="/" className="transition-colors hover:text-accent">Home</Link>
            <ChevronRight className="size-3.5" />
            <Link to="/leagues" className="transition-colors hover:text-accent">Leagues</Link>
            <ChevronRight className="size-3.5" />
            <span className="text-white/90">{league.name}</span>
          </nav>

          <div className="animate-rise mt-8 max-w-3xl">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                {FORMAT_LABELS[league.format]}
              </span>
              <span className="rounded-full border border-white/25 px-3 py-1 text-xs font-semibold">
                NTRP {league.skillLevel}
              </span>
              <span className="rounded-full border border-white/25 px-3 py-1 text-xs font-semibold">
                {season?.status === "active" ? "Season in progress" : season?.status === "upcoming" ? "Upcoming season" : "Closed season"}
              </span>
            </div>
            <h1 className="mt-5 text-4xl font-bold sm:text-5xl">{league.name}</h1>
            <p className="mt-4 text-lg leading-relaxed text-white/75">{league.description}</p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-8">
          <Reveal className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: CalendarDays, label: "Match night", value: `${league.scheduleDay}s at ${league.scheduleTime}` },
              { icon: MapPin, label: "Venue", value: league.venue },
              {
                icon: Clock,
                label: "Season dates",
                value: season ? formatDateRange(season.startDate, season.endDate) : "TBA",
              },
              { icon: Users, label: "Flight size", value: `${registered} registered · ${league.playerLimit} max` },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <item.icon className="size-4 text-primary" />
                  <p className="eyebrow">{item.label}</p>
                </div>
                <p className="mt-2 font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </Reveal>

          <Reveal>
            <h2 className="text-2xl font-bold">What a match day looks like</h2>
            <ol className="mt-5 space-y-4">
              {MATCH_DAY.map((step, i) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary font-display font-bold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <p className="eyebrow text-muted-foreground">{step.time}</p>
                    <h3 className="mt-1 font-bold">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal className="rounded-2xl border border-border bg-secondary/60 p-6">
            <div className="flex items-start gap-3">
              <Trophy className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed text-secondary-foreground">
                The top four players in this flight advance to the season playoff at{" "}
                {season ? formatDate(season.endDate) : "the end of the season"}. Standings update within hours of every
                reported result.
              </p>
            </div>
          </Reveal>
        </div>

        {/* Sticky signup card */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Reveal className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-lift)]">
            <p className="eyebrow text-muted-foreground">Season fee</p>
            <p className="mt-1 font-display text-4xl font-bold text-primary">{formatMoney(league.feeCents)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Covers court fees, balls and playoff entry.</p>

            <div className="mt-5 rounded-xl bg-secondary/70 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Spots remaining</span>
                <span className="font-bold text-foreground">
                  {left} / {league.playerLimit}
                </span>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${Math.min(100, (registered / league.playerLimit) * 100)}%` }}
                />
              </div>
            </div>

            {canRegister ? (
              <Button asChild size="lg" className="mt-5 w-full">
                <Link to="/register/$leagueId" params={{ leagueId: league.id }}>
                  Sign up and pay
                </Link>
              </Button>
            ) : (
              <Button size="lg" className="mt-5 w-full" disabled>
                {left === 0 ? "Flight is full" : "Registration closed"}
              </Button>
            )}

            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />
              Secure payment · Full refund before week one
            </p>

            <Link
              to="/leagues"
              className="mt-5 flex items-center justify-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-deep"
            >
              <ArrowLeft className="size-4" /> Back to all leagues
            </Link>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
