import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateRange, formatMoney, type LeagueFormat, type SkillLevel, SKILL_LEVELS } from "@/lib/tennis";
import { Lock, Unlock, Plus, Users } from "lucide-react";
import { DemoBanner } from "@/components/demo-banner";
import { toast } from "sonner";

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

  // Create League form state
  const [name, setName] = useState("");
  const [seasonId, setSeasonId] = useState(seasons[0]?.id || "");
  const [format, setFormat] = useState<LeagueFormat>("senior-singles");
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
    }
  }, [hydrated, user, navigate]);

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
        <button
          className={`pb-2 font-medium flex items-center gap-1.5 ${activeTab === "scores" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          onClick={() => setActiveTab("scores")}
        >
          Score Verification
          {results.filter((r) => r.status === "awaiting-confirmation").length > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {results.filter((r) => r.status === "awaiting-confirmation").length}
            </span>
          )}
        </button>
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
              <div className="mt-2 text-3xl font-bold">{registrations.length}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="text-sm font-medium text-muted-foreground">Total Seasons</div>
              <div className="mt-2 text-3xl font-bold">{seasons.length}</div>
            </div>
          </div>

          <h2 className="text-xl font-bold mt-8 mb-4">All Leagues</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-secondary/50 text-xs uppercase text-foreground">
                  <tr>
                    <th className="px-6 py-4">League</th>
                    <th className="px-6 py-4">Season</th>
                    <th className="px-6 py-4">Registrations</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leagues.map((league) => {
                    const season = seasons.find((s) => s.id === league.seasonId);
                    const regCount = registrations.filter((r) => r.leagueId === league.id).length;
                    return (
                      <tr key={league.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-foreground">{league.name}</td>
                        <td className="px-6 py-4">
                          <div>{season?.name}</div>
                          {league.startDate && league.endDate && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatDateRange(league.startDate, league.endDate)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <Users className="size-4" />
                            <span>{regCount} / {league.playerLimit}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {league.registrationOpen ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                              Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                              Closed
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleRegistration(league.id)}
                            className="rounded-full h-8"
                          >
                            {league.registrationOpen ? <><Lock className="mr-2 size-3" /> Close</> : <><Unlock className="mr-2 size-3" /> Open</>}
                          </Button>
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
                    <SelectItem value="junior-singles">Junior Singles</SelectItem>
                    <SelectItem value="senior-singles">Senior Singles</SelectItem>
                    <SelectItem value="junior-doubles">Junior Doubles</SelectItem>
                    <SelectItem value="senior-doubles">Senior Doubles</SelectItem>
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
    </div>
  );
}
