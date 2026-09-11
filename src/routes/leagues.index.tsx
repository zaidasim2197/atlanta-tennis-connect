import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, RotateCw, SearchX, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/reveal";
import { LeagueCard, LeagueCardSkeleton } from "@/components/league-card";
import { useStore } from "@/lib/store";
import { FORMAT_LABELS, SKILL_LEVELS, type LeagueFormat, type SkillLevel } from "@/lib/tennis";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leagues/")({
  head: () => ({
    meta: [
      { title: "Browse Tennis Leagues in Atlanta — Baseline ATL" },
      {
        name: "description",
        content:
          "Filter Atlanta tennis leagues by format, NTRP skill level and season. See fees, schedules and open spots, then register online.",
      },
      { property: "og:title", content: "Browse Tennis Leagues in Atlanta" },
      { property: "og:description", content: "Filter by format, skill level and season. Fees, schedules and open spots." },
    ],
  }),
  component: BrowseLeagues,
});

type Status = "loading" | "error" | "ready";

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}

function BrowseLeagues() {
  const { leagues, seasons, spotsLeft, hydrated } = useStore();
  const [status, setStatus] = React.useState<Status>("loading");
  const [attempt, setAttempt] = React.useState(0);
  const [failNext, setFailNext] = React.useState(false);

  const [format, setFormat] = React.useState<LeagueFormat | "all">("all");
  const [skill, setSkill] = React.useState<SkillLevel | "all">("all");
  const [seasonId, setSeasonId] = React.useState<string | "all">("all");
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    let live = true;
    setStatus("loading");
    const t = setTimeout(() => {
      if (!live) return;
      setStatus(failNext ? "error" : "ready");
      setFailNext(false);
    }, 650);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, hydrated]);

  const results = React.useMemo(
    () =>
      leagues.filter((l) => {
        if (format !== "all" && l.format !== format) return false;
        if (skill !== "all" && l.skillLevel !== skill) return false;
        if (seasonId !== "all" && l.seasonId !== seasonId) return false;
        if (query.trim()) {
          const q = query.toLowerCase();
          const season = seasons.find((s) => s.id === l.seasonId);
          if (
            !l.name.toLowerCase().includes(q) &&
            !l.venue.toLowerCase().includes(q) &&
            !(season?.name.toLowerCase().includes(q) ?? false)
          )
            return false;
        }
        return true;
      }),
    [leagues, seasons, format, skill, seasonId, query],
  );

  const clearFilters = () => {
    setFormat("all");
    setSkill("all");
    setSeasonId("all");
    setQuery("");
  };

  return (
    <div>
      <section className="group relative overflow-hidden bg-black border-b border-border py-20 text-white sm:py-32">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1657534927924-a6fc6573a93e?q=80&w=1200&auto=format&fit=crop" 
            alt="Tennis match" 
            className="h-full w-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-1000 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-black/10" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="eyebrow text-accent drop-shadow-md">Metro Atlanta</p>
            <h1 className="mt-3 text-4xl font-bold sm:text-5xl drop-shadow-lg">Browse leagues</h1>
            <p className="mt-4 max-w-xl text-white/90 drop-shadow-md">
              Every flight currently running or opening soon, with fees, schedules and remaining spots.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Filters */}
        <Reveal className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by league, venue or season"
              aria-label="Search leagues"
              className="h-12 rounded-full pl-10"
            />
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <p className="eyebrow mb-2 text-muted-foreground">Format</p>
              <div className="flex flex-wrap gap-2">
                <Chip active={format === "all"} onClick={() => setFormat("all")}>
                  All formats
                </Chip>
                {(Object.keys(FORMAT_LABELS) as LeagueFormat[]).map((f) => (
                  <Chip key={f} active={format === f} onClick={() => setFormat(f)}>
                    {FORMAT_LABELS[f]}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="eyebrow mb-2 text-muted-foreground">Skill level</p>
                <div className="flex flex-wrap gap-2">
                  <Chip active={skill === "all"} onClick={() => setSkill("all")}>
                    Any
                  </Chip>
                  {SKILL_LEVELS.map((s) => (
                    <Chip key={s} active={skill === s} onClick={() => setSkill(s)}>
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <p className="eyebrow mb-2 text-muted-foreground">Season</p>
                <div className="flex flex-wrap gap-2">
                  <Chip active={seasonId === "all"} onClick={() => setSeasonId("all")}>
                    All seasons
                  </Chip>
                  {seasons.map((s) => (
                    <Chip key={s.id} active={seasonId === s.id} onClick={() => setSeasonId(s.id)}>
                      {s.name.replace(" Season", "")}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {status === "ready" ? `${results.length} league${results.length === 1 ? "" : "s"} found` : "Loading leagues…"}
          </p>
          <button
            type="button"
            onClick={() => {
              setFailNext(true);
              setAttempt((a) => a + 1);
            }}
            className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
          >
            Simulate a connection failure
          </button>
        </div>

        {/* States */}
        {status === "loading" && (
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <LeagueCardSkeleton key={i} />
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
            <AlertTriangle className="mx-auto size-8 text-destructive" />
            <h2 className="mt-4 text-xl font-bold">We couldn't load the leagues</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              The connection dropped before we finished loading. Your filters are still saved — try again.
            </p>
            <Button className="mt-6" onClick={() => setAttempt((a) => a + 1)}>
              <RotateCw /> Retry
            </Button>
          </div>
        )}

        {status === "ready" && results.length === 0 && (
          <div className="mt-5 rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-card)]">
            <SearchX className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-bold">No leagues match those filters</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Try widening your skill level or checking a different season — new flights open every few weeks.
            </p>
            <Button variant="outline" className="mt-6" onClick={clearFilters}>
              Clear all filters
            </Button>
          </div>
        )}

        {status === "ready" && results.length > 0 && (
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((league, i) => (
              <Reveal key={league.id} delay={Math.min(i, 5) * 50} className="h-full">
                <LeagueCard
                  league={league}
                  season={seasons.find((s) => s.id === league.seasonId)}
                  spotsLeft={spotsLeft(league.id)}
                />
              </Reveal>
            ))}
          </div>
        )}

        <p className="mt-10 text-sm text-muted-foreground">
          Organizing a flight instead?{" "}
          <Link to="/organizer" className="font-semibold text-primary underline underline-offset-4">
            Open the organizer hub
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
