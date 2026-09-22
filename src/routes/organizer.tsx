import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useStore, getApiUrl } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatDateRange,
  formatMoney,
  type LeagueFormat,
  type SkillLevel,
  SKILL_LEVELS,
  FORMAT_LABELS,
  type League,
} from "@/lib/tennis";
import {
  Lock,
  Unlock,
  Plus,
  Users,
  Search,
  Mail,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Calendar,
  MapPin,
  Trophy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DemoBanner } from "@/components/demo-banner";
import { toast } from "sonner";

function cleanLeagueName(name: string): string {
  if (!name) return "";
  return name
    .replace(/^(Midtown|Buckhead|Decatur|Sandy Springs|Alpharetta|Dunwoody|Roswell|Brookhaven|Smyrna|Marietta|Atlanta|Intown|Downtown)\s+/i, "")
    .trim();
}

function cleanVenue(venue: string): string {
  if (!venue) return "";
  return venue
    .replace(/,\s*(Midtown|Buckhead|Decatur|Sandy Springs|Alpharetta|Dunwoody|Roswell|Brookhaven|Smyrna|Marietta|Atlanta|Intown|Downtown)\b/gi, "")
    .trim();
}

export const Route = createFileRoute("/organizer")({
  component: OrganizerHub,
});

function OrganizerHub() {
  const {
    hydrated,
    user,
    leagues,
    seasons,
    registrations,
    toggleRegistration,
    createLeague,
    matches,
    results,
    confirmMatchResult,
    disputeMatchResult,
    submitMatchScore,
    players,
  } = useStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"leagues" | "scores" | "create">("leagues");
  const [directScoreMatchId, setDirectScoreMatchId] = useState<string | null>(null);
  const [directScoreText, setDirectScoreText] = useState("6-4, 6-3");
  const [directWinnerId, setDirectWinnerId] = useState("");

  // League Roster / Participant modal state
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [allRegistrations, setAllRegistrations] = useState<any[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "held">("all");
  const [copiedEmails, setCopiedEmails] = useState(false);

  // Create League form state
  const [name, setName] = useState("");
  const [seasonId, setSeasonId] = useState(seasons[0]?.id || "");
  const [format, setFormat] = useState<LeagueFormat>("men-singles");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("3.5");
  const [feeCents, setFeeCents] = useState(10000);
  const [scheduleDay, setScheduleDay] = useState("Tuesday");
  const [scheduleTime, setScheduleTime] = useState("7:00 PM");
  const [venue, setVenue] = useState("");
  const [playerLimit, setPlayerLimit] = useState(24);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      navigate({ to: "/login", search: { leagueId: undefined } });
    } else if (user.role !== "organizer") {
      toast.error("Access denied. You do not have organizer privileges.");
      navigate({ to: "/dashboard" });
    } else {
      // Fetch live registrations for all leagues as organizer
      setLoadingRegistrations(true);
      fetch(getApiUrl("/api/registrations"), { credentials: "include" })
        .then(async (res) => {
          const json = await res.json();
          if (res.ok && json.ok && Array.isArray(json.data)) {
            setAllRegistrations(json.data);
          }
        })
        .catch((e) => console.warn("Failed to fetch organizer registrations:", e))
        .finally(() => setLoadingRegistrations(false));
    }
  }, [hydrated, user, navigate]);

  // Combine live registrations with local store and persisted registrations
  const effectiveRegistrations = useMemo(() => {
    const list: any[] = [...allRegistrations];
    const seen = new Set<string>();
    list.forEach((r) => {
      seen.add(`${r.leagueId}:${r.email?.toLowerCase() || r.playerId}`);
      if (r.id) seen.add(r.id);
    });

    registrations.forEach((r) => {
      const p = players.find((player) => player.id === r.playerId);
      const email = (p?.email || "").toLowerCase();
      const key = `${r.leagueId}:${email || r.playerId}`;
      if (!seen.has(key) && !seen.has(r.id)) {
        seen.add(key);
        seen.add(r.id);
        const isPaid = r.paymentStatus === "paid" || r.registrationStatus === "confirmed";
        list.push({
          id: r.id,
          leagueId: r.leagueId,
          playerId: r.playerId,
          name: p ? `${p.firstName} ${p.lastName}`.trim() : "Registered Player",
          email: p?.email || "player@example.com",
          phone: p?.phone || "(404) 555-0100",
          ntrp: p?.ntrp || r.skillLevelSnapshot || "3.5",
          city: p?.city || "Atlanta",
          status: isPaid ? "registered" : "held",
          paymentStatus: isPaid ? "paid" : "held",
          amountCents: r.amountCents || 3500,
          createdAt: r.createdAt || new Date().toISOString(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });
      }
    });

    try {
      const saved = JSON.parse(localStorage.getItem("atl-user-registrations") || "[]");
      if (Array.isArray(saved)) {
        saved.forEach((sr: any) => {
          const email = (sr.player?.email || sr.email || "").toLowerCase();
          const key = `${sr.leagueId}:${email || sr.playerId}`;
          if (!seen.has(key) && (!sr.id || !seen.has(sr.id))) {
            if (sr.id) seen.add(sr.id);
            seen.add(key);
            const isPaid = sr.paymentStatus === "paid" || sr.registrationStatus === "confirmed";
            list.push({
              id: sr.id || `local-${Math.random()}`,
              leagueId: sr.leagueId,
              playerId: sr.playerId || sr.player?.id,
              name: sr.player ? `${sr.player.firstName} ${sr.player.lastName}`.trim() : sr.name || "Registered Player",
              email: sr.player?.email || sr.email || "player@example.com",
              phone: sr.player?.phone || sr.phone || "(404) 555-0100",
              ntrp: sr.player?.ntrp || sr.ntrp || sr.skillLevelSnapshot || "3.5",
              city: sr.player?.city || sr.city || "Atlanta",
              status: isPaid ? "registered" : "held",
              paymentStatus: isPaid ? "paid" : "held",
              amountCents: sr.amountCents || 3500,
              createdAt: sr.createdAt || new Date().toISOString(),
              expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            });
          }
        });
      }
    } catch { }

    return list;
  }, [allRegistrations, registrations, players]);

  if (!user || user.role !== "organizer") return null;

  const handleCreateLeague = (e: React.FormEvent) => {
    e.preventDefault();
    createLeague({
      seasonId,
      name,
      format,
      skillLevel,
      feeCents,
      scheduleDay,
      scheduleTime,
      venue,
      playerLimit,
      registrationOpen: true,
      description,
    });
    setActiveTab("leagues");
    // reset form
    setName("");
    setVenue("");
    setDescription("");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Organizer Hub
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage seasons, leagues, and player registrations.
        </p>
        <DemoBanner
          message="All league data, player registrations and statistics shown here are simulated for this prototype."
          className="mt-4"
        />
      </div>

      <div className="mb-8 flex gap-4 border-b border-border">
        <button
          className={`pb-2 font-medium ${activeTab === "leagues" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          onClick={() => setActiveTab("leagues")}
        >
          Manage Leagues
        </button>
        {/* <button
          className={`pb-2 font-medium flex items-center gap-1.5 ${activeTab === "scores" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          onClick={() => setActiveTab("scores")}
        >
          Score Verification
          {results.filter((r) => r.status === "awaiting-confirmation").length > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {results.filter((r) => r.status === "awaiting-confirmation").length}
            </span>
          )}
        </button> */}
        <button
          className={`pb-2 font-medium ${activeTab === "create" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          onClick={() => setActiveTab("create")}
        >
          Create League
        </button>
      </div>

      {activeTab === "leagues" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-sm font-medium text-muted-foreground">Total Active Leagues</div>
              <div className="mt-2 text-3xl font-bold">{leagues.length}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-sm font-medium text-muted-foreground">Total Registrations</div>
              <div className="mt-2 text-3xl font-bold text-primary">
                {effectiveRegistrations.filter((r) => r.paymentStatus === "paid" || r.paymentStatus === "held").length}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {effectiveRegistrations.filter((r) => r.paymentStatus === "held").length > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    ({effectiveRegistrations.filter((r) => r.paymentStatus === "held").length} currently on 15m hold)
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-sm font-medium text-muted-foreground">Total Seasons</div>
              <div className="mt-2 text-3xl font-bold">{seasons.length}</div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-8 mb-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">All Leagues</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click on any league to view registered participants, contact details, and real-time payment hold statuses.
              </p>
            </div>
          </div>

          {/* Mobile League Cards (<lg) */}
          <div className="space-y-3.5 lg:hidden">
            {leagues.map((league) => {
              const season = seasons.find((s) => s.id === league.seasonId);
              const leagueRegs = effectiveRegistrations.filter((r) => r.leagueId === league.id);
              const paidCount = leagueRegs.filter((r) => r.paymentStatus === "paid").length;
              const heldCount = leagueRegs.filter((r) => r.paymentStatus === "held").length;

              return (
                <div
                  key={league.id}
                  onClick={() => setSelectedLeague(league)}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm active:scale-[0.99] transition-all cursor-pointer space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-foreground leading-tight">{cleanLeagueName(league.name)}</h3>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                          {FORMAT_LABELS[league.format] || league.format}
                        </span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-foreground">
                          NTRP {league.skillLevel}
                        </span>
                      </div>
                    </div>
                    {league.registrationOpen ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 shrink-0">
                        Open
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                        Closed
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border/50">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-primary shrink-0" />
                      <span>{season?.name || "Season"}{league.startDate && league.endDate ? ` (${formatDateRange(league.startDate, league.endDate)})` : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-primary shrink-0" />
                      <span className="truncate">{cleanVenue(league.venue)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-muted/50 p-2.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                      <Users className="size-3.5 text-primary" />
                      <span>{paidCount} / {league.playerLimit} confirmed</span>
                    </div>
                    {heldCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5">
                        <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                        {heldCount} on 15m hold
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        {Math.max(0, league.playerLimit - paidCount)} spots left
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedLeague(league)}
                      className="flex-1 rounded-full text-xs font-semibold h-9"
                    >
                      <Users className="size-3.5 mr-1.5 text-primary" /> View Participants ({paidCount + heldCount})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleRegistration(league.id)}
                      className="rounded-full text-xs h-9 px-3"
                    >
                      {league.registrationOpen ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (>=lg) */}
          <div className="hidden lg:block overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-secondary/50 text-xs uppercase text-foreground">
                  <tr>
                    <th className="px-6 py-4">League</th>
                    <th className="px-6 py-4">Season</th>
                    <th className="px-6 py-4">Participants</th>
                    <th className="px-6 py-4">Registration</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leagues.map((league) => {
                    const season = seasons.find((s) => s.id === league.seasonId);
                    const leagueRegs = effectiveRegistrations.filter((r) => r.leagueId === league.id);
                    const paidCount = leagueRegs.filter((r) => r.paymentStatus === "paid").length;
                    const heldCount = leagueRegs.filter((r) => r.paymentStatus === "held").length;

                    return (
                      <tr
                        key={league.id}
                        onClick={() => setSelectedLeague(league)}
                        className="hover:bg-muted/60 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {cleanLeagueName(league.name)}
                            </span>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              {FORMAT_LABELS[league.format] || league.format}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <span>NTRP {league.skillLevel}</span>
                            <span>•</span>
                            <span>{cleanVenue(league.venue)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{season?.name}</div>
                          {league.startDate && league.endDate && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatDateRange(league.startDate, league.endDate)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              <Users className="size-4 text-primary" />
                              <span>
                                {paidCount} / {league.playerLimit} confirmed
                              </span>
                            </div>
                            {heldCount > 0 && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-bold px-2.5 py-0.5 w-fit">
                                <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                                {heldCount} on 15m hold
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {league.registrationOpen ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                              Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-800 dark:text-slate-300">
                              Closed
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedLeague(league)}
                              className="rounded-full h-8 text-xs font-semibold"
                            >
                              <Users className="size-3.5 mr-1.5 text-primary" />
                              Roster
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleRegistration(league.id)}
                              className="rounded-full h-8 text-xs"
                            >
                              {league.registrationOpen ? (
                                <>
                                  <Lock className="mr-1.5 size-3" /> Close
                                </>
                              ) : (
                                <>
                                  <Unlock className="mr-1.5 size-3" /> Open
                                </>
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "scores" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-sm font-medium text-muted-foreground">Pending Player Scores</div>
              <div className="mt-2 text-3xl font-bold text-amber-600">
                {results.filter((r) => r.status === "awaiting-confirmation").length}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-sm font-medium text-muted-foreground">Official Confirmed Results</div>
              <div className="mt-2 text-3xl font-bold text-emerald-600">
                {results.filter((r) => r.status === "accepted").length}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-sm font-medium text-muted-foreground">Total Active Fixtures</div>
              <div className="mt-2 text-3xl font-bold">{matches.length}</div>
            </div>
          </div>

          {/* Section 1: Pending Approvals */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-2">Scores Awaiting Verification</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Player-reported match scores. Scores will not display in official player stats until you verify and confirm them here.
            </p>

            {results.filter((r) => r.status === "awaiting-confirmation").length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
                ✓ No pending match scores to review. All submitted results have been verified.
              </div>
            ) : (
              <div className="space-y-3">
                {results
                  .filter((r) => r.status === "awaiting-confirmation")
                  .map((res) => {
                    const match = matches.find((m) => m.id === res.matchId);
                    const submitter = players.find((p) => p.id === res.submittedBy);
                    const winner = players.find((p) => p.id === res.winnerId);

                    return (
                      <div
                        key={res.resultId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-sm"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                              Needs Verification
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Reported by: <strong>{submitter ? `${submitter.firstName} ${submitter.lastName}` : res.submittedBy}</strong>
                            </span>
                          </div>
                          <p className="font-bold text-base text-foreground">
                            {match?.court || "Piedmont Park"} · {match?.matchDate || "Scheduled Date"}
                          </p>
                          <div className="text-xs text-muted-foreground">
                            Reported Score: <strong className="font-mono text-sm text-foreground">{res.scoreData}</strong> · Winner: <strong>{winner ? `${winner.firstName} ${winner.lastName}` : (res.winnerId === res.submittedBy ? "Reporter" : "Opponent")}</strong>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                            onClick={() => {
                              confirmMatchResult(res.resultId);
                              toast.success("Match result verified! Official stats updated for players.");
                            }}
                          >
                            ✓ Verify & Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                            onClick={() => {
                              const reason = window.prompt("Enter dispute reason:", "Score mismatch reported by opponent or incomplete fixture.");
                              if (reason && reason.trim()) {
                                disputeMatchResult(res.resultId, reason.trim());
                                toast.info("Result marked as disputed. It will not count toward official player stats.");
                              }
                            }}
                          >
                            Dispute Score
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Sub-section: Disputed Results */}
            {results.some((r) => r.status === "disputed") && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-bold text-destructive flex items-center gap-1.5">
                  <span>⚠️ Disputed Results Under Committee Review</span>
                </h3>
                {results
                  .filter((r) => r.status === "disputed")
                  .map((res) => {
                    const match = matches.find((m) => m.id === res.matchId);
                    return (
                      <div
                        key={res.resultId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs"
                      >
                        <div>
                          <span className="font-bold text-foreground">
                            {match?.court || "Atlanta Court"} · Score: {res.scoreData}
                          </span>
                          <p className="text-destructive mt-1">
                            <strong>Reason:</strong> {res.disputeReason || "Contested score"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full text-xs self-start sm:self-auto"
                          onClick={() => {
                            confirmMatchResult(res.resultId);
                            toast.success("Dispute resolved and result accepted.");
                          }}
                        >
                          Resolve & Confirm
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Section 2: Direct Score Entry for All Scheduled Fixtures */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-2">Direct Official Score Entry</h2>
            <p className="text-sm text-muted-foreground mb-4">
              As an organizer, you can directly record official verified match scores for any scheduled fixture.
            </p>

            <div className="space-y-3">
              {matches.map((m) => {
                const res = results.find((r) => r.matchId === m.id);
                const player1 = players.find((p) => p.id === m.playerId);
                const isSelected = directScoreMatchId === m.id;

                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">
                            {player1 ? `${player1.firstName} ${player1.lastName}` : "Player 1"} vs {m.opponentName || "Opponent"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({m.court || "Piedmont Park"})
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {m.matchDate} at {m.matchTime} · Status: <strong className="capitalize">{m.matchStatus}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {res?.status === "accepted" ? (
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-700">
                            ✓ {res.scoreData} (Verified)
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full text-xs"
                            onClick={() => {
                              setDirectScoreMatchId(isSelected ? null : m.id);
                              setDirectWinnerId(m.playerId);
                            }}
                          >
                            {isSelected ? "Cancel" : "Enter Official Score"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-4 border-t border-border pt-3 space-y-3 bg-muted/40 p-3 rounded-lg">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-foreground block mb-1">
                              Match Score (Sets)
                            </label>
                            <input
                              type="text"
                              value={directScoreText}
                              onChange={(e) => setDirectScoreText(e.target.value)}
                              placeholder="e.g. 6-4, 6-3 or 6-3, 4-6, 10-7"
                              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-foreground block mb-1">
                              Match Winner
                            </label>
                            <select
                              value={directWinnerId}
                              onChange={(e) => setDirectWinnerId(e.target.value)}
                              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                            >
                              <option value={m.playerId}>
                                {player1 ? `${player1.firstName} ${player1.lastName}` : "Home Player"}
                              </option>
                              <option value={m.opponentId || "opponent"}>
                                {m.opponentName || "Opponent"}
                              </option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            className="rounded-full"
                            onClick={() => {
                              submitMatchScore({
                                matchId: m.id,
                                submittedBy: "organizer",
                                scoreData: directScoreText,
                                winnerId: directWinnerId || m.playerId,
                                role: "organizer",
                              });
                              toast.success("Official score recorded and verified!");
                              setDirectScoreMatchId(null);
                            }}
                          >
                            Save & Confirm Official Score
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "create" && (
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-bold mb-6">Create New League</h2>
          <form onSubmit={handleCreateLeague} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">League Name</label>
                <input required value={name} onChange={e => setName(e.target.value)} className="block w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Season</label>
                <Select value={seasonId} onValueChange={setSeasonId}>
                  <SelectTrigger className="h-11 px-4 text-sm bg-background">
                    <SelectValue placeholder="Select a season" />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Format</label>
                <Select value={format} onValueChange={(val) => setFormat(val as LeagueFormat)}>
                  <SelectTrigger className="h-11 px-4 text-sm bg-background">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="men-singles">Men's Singles</SelectItem>
                    <SelectItem value="women-singles">Women's Singles</SelectItem>
                    <SelectItem value="men-doubles">Men's Doubles</SelectItem>
                    <SelectItem value="mixed-doubles">Mixed Doubles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Skill Level</label>
                <Select value={skillLevel} onValueChange={(val) => setSkillLevel(val as SkillLevel)}>
                  <SelectTrigger className="h-11 px-4 text-sm bg-background">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILL_LEVELS.map((lvl) => (
                      <SelectItem key={lvl} value={lvl}>
                        {lvl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Player Limit</label>
                <input type="number" required value={playerLimit} onChange={e => setPlayerLimit(Number(e.target.value))} className="block w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Fee (Cents)</label>
                <input type="number" required value={feeCents} onChange={e => setFeeCents(Number(e.target.value))} className="block w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50" />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Day</label>
                <input required value={scheduleDay} onChange={e => setScheduleDay(e.target.value)} placeholder="e.g. Tuesday" className="block w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Time</label>
                <input required value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} placeholder="e.g. 7:00 PM" className="block w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Venue</label>
                <input required value={venue} onChange={e => setVenue(e.target.value)} className="block w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Description</label>
              <textarea required value={description} onChange={e => setDescription(e.target.value)} rows={3} className="block w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-primary/50" />
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" size="lg" className="rounded-full shadow-md">
                <Plus className="mr-2 size-4" /> Create League
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ─── League Participants Dialog Modal ─────────────────────────────── */}
      <Dialog open={Boolean(selectedLeague)} onOpenChange={(open) => { if (!open) { setSelectedLeague(null); setSearchQuery(""); setStatusFilter("all"); } }}>
        <DialogContent className="w-[calc(100vw-1.25rem)] sm:w-full sm:max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl border-border">
          {selectedLeague && (() => {
            const season = seasons.find((s) => s.id === selectedLeague.seasonId);
            const leagueParticipants = effectiveRegistrations.filter((r) => r.leagueId === selectedLeague.id || ((selectedLeague as any).slug && r.leagueId === (selectedLeague as any).slug));
            const paidParticipants = leagueParticipants.filter((r) => r.paymentStatus === "paid");
            const heldParticipants = leagueParticipants.filter((r) => r.paymentStatus === "held");
            const spotsRemaining = Math.max(0, selectedLeague.playerLimit - paidParticipants.length - heldParticipants.length);

            const filteredParticipants = leagueParticipants.filter((p) => {
              if (statusFilter === "paid" && p.paymentStatus !== "paid") return false;
              if (statusFilter === "held" && p.paymentStatus !== "held") return false;
              if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = p.name?.toLowerCase().includes(q);
                const matchEmail = p.email?.toLowerCase().includes(q);
                const matchPhone = p.phone?.toLowerCase().includes(q);
                return matchName || matchEmail || matchPhone;
              }
              return true;
            });

            const copyAllEmails = () => {
              const emails = filteredParticipants.map((p) => p.email).filter(Boolean).join(", ");
              if (!emails) {
                toast.error("No participant emails to copy");
                return;
              }
              navigator.clipboard.writeText(emails);
              setCopiedEmails(true);
              toast.success(`Copied ${filteredParticipants.length} participant emails to clipboard`);
              setTimeout(() => setCopiedEmails(false), 2000);
            };

            const formatHoldTime = (expiresAt?: string) => {
              if (!expiresAt) return "Checkout in progress";
              const diffMs = new Date(expiresAt).getTime() - Date.now();
              if (diffMs <= 0) return "Hold expired";
              const mins = Math.ceil(diffMs / (60 * 1000));
              return `~${mins} min left on hold`;
            };

            return (
              <div className="flex flex-col overflow-y-auto overflow-x-hidden max-h-[92vh]">
                {/* Modal Header */}
                <div className="border-b border-border/80 bg-muted/40 p-4 sm:p-7 pr-10 sm:pr-7">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                          {FORMAT_LABELS[selectedLeague.format] || selectedLeague.format}
                        </span>
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">
                          NTRP {selectedLeague.skillLevel}
                        </span>
                        <span className="rounded-full bg-muted border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {formatMoney(selectedLeague.feeCents)} per player
                        </span>
                      </div>
                      <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground break-words leading-tight">
                        {cleanLeagueName(selectedLeague.name)}
                      </DialogTitle>
                      <DialogDescription className="mt-1.5 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-wrap">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Calendar className="size-3.5 text-primary shrink-0" />
                          {season?.name || "Season"}{selectedLeague.startDate && selectedLeague.endDate ? ` (${formatDateRange(selectedLeague.startDate, selectedLeague.endDate)})` : ""}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3.5 text-primary shrink-0" />
                          <span className="truncate">{cleanVenue(selectedLeague.venue)}</span>
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5 text-primary shrink-0" />
                          <span>{selectedLeague.scheduleDay}s at {selectedLeague.scheduleTime}</span>
                        </span>
                      </DialogDescription>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyAllEmails}
                        className="rounded-full text-xs font-semibold h-8 sm:h-9 w-full sm:w-auto"
                      >
                        {copiedEmails ? (
                          <>
                            <Check className="size-3.5 mr-1.5 text-emerald-600" /> Copied Emails
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5 mr-1.5 text-muted-foreground" /> Copy Emails
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* KPI Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-4 sm:mt-6">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 sm:p-3 text-left">
                      <div className="text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider truncate">
                        Paid (Confirmed)
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5 flex items-baseline">
                        {paidParticipants.length}
                        <span className="text-[11px] sm:text-xs font-normal text-muted-foreground ml-1">
                          / {selectedLeague.playerLimit}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-2.5 sm:p-3 text-left">
                      <div className="text-[10px] sm:text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1 truncate">
                        <Clock className="size-3 shrink-0" />
                        <span className="truncate">15m Holds</span>
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-amber-800 dark:text-amber-300 mt-0.5 flex items-baseline gap-1">
                        {heldParticipants.length}
                        <span className="text-[10px] sm:text-[11px] font-normal text-amber-600 dark:text-amber-400 truncate hidden xs:inline">
                          in progress
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2 sm:col-span-1 rounded-xl border border-border bg-background p-2.5 sm:p-3 text-left">
                      <div className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                        Spots Remaining
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-foreground mt-0.5 flex items-baseline">
                        {spotsRemaining}
                        <span className="text-[11px] sm:text-xs font-normal text-muted-foreground ml-1.5">
                          open of {selectedLeague.playerLimit}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-3 sm:p-5 border-b border-border bg-card/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search name, email, phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-full border border-border bg-background pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                        statusFilter === "all"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      All ({leagueParticipants.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("paid")}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                        statusFilter === "paid"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Paid ({paidParticipants.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("held")}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                        statusFilter === "held"
                          ? "bg-amber-600 text-white shadow-sm"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      On Hold ({heldParticipants.length})
                    </button>
                  </div>
                </div>

                {/* Participants Roster List / Table */}
                <div className="p-3 sm:p-6">
                  {filteredParticipants.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 sm:p-12 text-center">
                      <Users className="size-10 mx-auto text-muted-foreground/50 mb-3" />
                      <h4 className="font-bold text-sm text-foreground">No participants found</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        {searchQuery || statusFilter !== "all"
                          ? "No players match your active search or filter criteria."
                          : "No participants have registered for this league yet. Players will appear here once they reserve or complete checkout."}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile Participant Cards (<md) */}
                      <div className="space-y-3 md:hidden">
                        {filteredParticipants.map((p, idx) => {
                          const isPaid = p.paymentStatus === "paid";
                          const isHeld = p.paymentStatus === "held";
                          const initials = (p.name || "Player")
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase();

                          return (
                            <div
                              key={p.id || idx}
                              className="rounded-xl border border-border bg-card p-3.5 shadow-sm space-y-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Avatar className="size-9 border border-primary/20 shrink-0">
                                    <AvatarFallback className="bg-primary font-bold text-primary-foreground text-xs">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <div className="font-bold text-sm text-foreground truncate">{p.name}</div>
                                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground">
                                        NTRP {p.ntrp || "3.5"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Status Badge */}
                                <div className="shrink-0">
                                  {isPaid ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                                      <CheckCircle2 className="size-3" />
                                      Paid
                                    </span>
                                  ) : isHeld ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/70 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                                      <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                                      15m Hold
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                                      Expired
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Contact Information */}
                              <div className="text-xs space-y-1 pt-2 border-t border-border/60">
                                <a
                                  href={`mailto:${p.email}`}
                                  className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors truncate"
                                  title={p.email}
                                >
                                  <Mail className="size-3.5 text-muted-foreground shrink-0" />
                                  <span className="truncate">{p.email}</span>
                                </a>
                                {p.phone && p.phone !== "Not provided" && (
                                  <a
                                    href={`tel:${p.phone}`}
                                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-[11px]"
                                  >
                                    <Phone className="size-3 shrink-0" />
                                    <span>{p.phone}</span>
                                  </a>
                                )}
                                {p.preferredCourt && (
                                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                                    <MapPin className="size-3 shrink-0 text-primary" />
                                    <span className="truncate">{cleanVenue(p.preferredCourt)}</span>
                                  </div>
                                )}
                              </div>

                              {/* Footer note: timestamp & hold timer */}
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t border-border/40">
                                <span>
                                  {p.createdAt
                                    ? `Registered ${new Date(p.createdAt).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                      })}`
                                    : "Registered"}
                                </span>
                                {isHeld && (
                                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                                    {formatHoldTime(p.expiresAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table (>=md) */}
                      <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-muted-foreground">
                            <thead className="bg-secondary/60 text-[11px] uppercase tracking-wider text-foreground font-semibold">
                              <tr>
                                <th className="px-5 py-3.5">Participant</th>
                                <th className="px-5 py-3.5">Contact Information</th>
                                <th className="px-5 py-3.5">Rating</th>
                                <th className="px-5 py-3.5">Payment Status</th>
                                <th className="px-5 py-3.5 text-right">Registered</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {filteredParticipants.map((p, idx) => {
                                const isPaid = p.paymentStatus === "paid";
                                const isHeld = p.paymentStatus === "held";
                                const initials = (p.name || "Player")
                                  .split(" ")
                                  .map((n: string) => n[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase();

                                return (
                                  <tr key={p.id || idx} className="hover:bg-muted/40 transition-colors">
                                    {/* Name */}
                                    <td className="px-5 py-4">
                                      <div className="flex items-center gap-3">
                                        <Avatar className="size-9 border border-primary/20 shrink-0">
                                          <AvatarFallback className="bg-primary font-bold text-primary-foreground text-xs">
                                            {initials}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div>
                                          <div className="font-bold text-sm text-foreground">{p.name}</div>
                                          {p.preferredCourt && (
                                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                              {cleanVenue(p.preferredCourt)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    {/* Contact */}
                                    <td className="px-5 py-4">
                                      <div className="flex flex-col gap-1">
                                        <a
                                          href={`mailto:${p.email}`}
                                          className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors truncate max-w-[200px]"
                                          title={p.email}
                                        >
                                          <Mail className="size-3.5 text-muted-foreground shrink-0" />
                                          <span className="truncate">{p.email}</span>
                                        </a>
                                        {p.phone && p.phone !== "Not provided" && (
                                          <a
                                            href={`tel:${p.phone}`}
                                            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-[11px]"
                                          >
                                            <Phone className="size-3 shrink-0" />
                                            <span>{p.phone}</span>
                                          </a>
                                        )}
                                      </div>
                                    </td>

                                    {/* NTRP */}
                                    <td className="px-5 py-4">
                                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-mono text-xs font-bold text-foreground">
                                        NTRP {p.ntrp || "3.5"}
                                      </span>
                                    </td>

                                    {/* Payment / Hold Status */}
                                    <td className="px-5 py-4">
                                      {isPaid ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                          <CheckCircle2 className="size-3.5" />
                                          Paid &amp; Confirmed
                                        </span>
                                      ) : isHeld ? (
                                        <div className="flex flex-col gap-0.5">
                                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/70 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 w-fit">
                                            <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                                            On Hold (15 min)
                                          </span>
                                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold pl-1">
                                            {formatHoldTime(p.expiresAt)}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                                          Hold Expired
                                        </span>
                                      )}
                                    </td>

                                    {/* Registered date */}
                                    <td className="px-5 py-4 text-right">
                                      <div className="text-foreground font-medium">
                                        {p.createdAt
                                          ? new Date(p.createdAt).toLocaleDateString("en-US", {
                                              month: "short",
                                              day: "numeric",
                                              year: "numeric",
                                            })
                                          : "—"}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground mt-0.5">
                                        {p.createdAt
                                          ? new Date(p.createdAt).toLocaleTimeString("en-US", {
                                              hour: "numeric",
                                              minute: "2-digit",
                                            })
                                          : ""}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
