import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FORMAT_LABELS, formatDateRange, formatMoney, type League, type Season } from "@/lib/tennis";

export function LeagueCard({
  league,
  season,
  spotsLeft,
}: {
  league: League;
  season: Season | undefined;
  spotsLeft: number;
}) {
  return (
    <article className="hover-lift group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
          {FORMAT_LABELS[league.format]}
        </span>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
          NTRP {league.skillLevel}
        </span>
        {!league.registrationOpen && (
          <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
            Registration closed
          </span>
        )}
      </div>

      <h3 className="mt-4 text-xl font-bold text-foreground">{league.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{season?.name}</p>

      <dl className="mt-5 space-y-2.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="size-4 shrink-0 text-primary" />
          <dd>
            {league.scheduleDay}s · {league.scheduleTime}
            {season ? ` · ${formatDateRange(season.startDate, season.endDate)}` : ""}
          </dd>
        </div>
        <div className="flex items-center gap-2.5">
          <MapPin className="size-4 shrink-0 text-primary" />
          <dd>{league.venue}</dd>
        </div>
        <div className="flex items-center gap-2.5">
          <Users className="size-4 shrink-0 text-primary" />
          <dd>
            {spotsLeft} of {league.playerLimit} spots left
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex items-end justify-between gap-4 border-t border-border pt-5">
        <div>
          <p className="text-2xl font-bold text-primary">{formatMoney(league.feeCents)}</p>
          <p className="text-xs text-muted-foreground">per player, per season</p>
        </div>
        <Button asChild size="sm">
          <Link to="/leagues/$leagueId" params={{ leagueId: league.id }}>
            View details <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function LeagueCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex gap-2">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-6 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <div className="mt-5 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
    </div>
  );
}
