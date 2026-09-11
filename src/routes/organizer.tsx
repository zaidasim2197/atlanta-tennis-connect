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
import { formatMoney, type LeagueFormat, type SkillLevel } from "@/lib/tennis";
import { Lock, Unlock, Plus, Users } from "lucide-react";

export const Route = createFileRoute("/organizer")({
  component: OrganizerHub,
});

function OrganizerHub() {
  const { user, leagues, seasons, registrations, toggleRegistration, createLeague } = useStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"leagues" | "create">("leagues");

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
    if (!user) {
      navigate({ to: "/login" });
    } else if (user.role !== "organizer") {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

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
      </div>

      <div className="mb-8 flex gap-4 border-b border-border">
        <button
          className={`pb-2 font-medium ${activeTab === "leagues" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          onClick={() => setActiveTab("leagues")}
        >
          Manage Leagues
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
                        <td className="px-6 py-4">{season?.name}</td>
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
                    <SelectItem value="2.5">2.5</SelectItem>
                    <SelectItem value="3.0">3.0</SelectItem>
                    <SelectItem value="3.5">3.5</SelectItem>
                    <SelectItem value="4.0">4.0</SelectItem>
                    <SelectItem value="4.5+">4.5+</SelectItem>
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
