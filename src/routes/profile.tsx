import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { SKILL_LEVELS, type SkillLevel } from "@/lib/tennis";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

function Profile() {
  const { user, players, updatePlayer } = useStore();
  const navigate = useNavigate();
  
  const player = players.find(p => p.id === user?.playerId);

  const [firstName, setFirstName] = useState(player?.firstName || "");
  const [lastName, setLastName] = useState(player?.lastName || "");
  const [email, setEmail] = useState(player?.email || user?.email || "");
  const [phone, setPhone] = useState(player?.phone || "");
  const [city, setCity] = useState(player?.city || "");
  const [ntrp, setNtrp] = useState<SkillLevel>(player?.ntrp || "3.0");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate({ to: "/login", search: { leagueId: undefined } });
    }
  }, [user, navigate]);

  if (!user || !player) {
    return null; // Will redirect or just show blank
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    setTimeout(() => {
      updatePlayer(player.id, {
        firstName,
        lastName,
        phone,
        city,
        ntrp,
      });
      setLoading(false);
      toast.success("Profile updated successfully");
    }, 500);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Button asChild variant="ghost" size="sm" className="-ml-4 mb-4 text-muted-foreground">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 size-4" /> Back to Dashboard
          </Link>
        </Button>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Profile Settings
        </h1>
        <p className="mt-2 text-muted-foreground">
          Update your personal details and tennis rating.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-foreground">First Name</label>
              <input
                id="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-foreground">Last Name</label>
              <input
                id="lastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">Email address</label>
            <input
              id="email"
              type="email"
              required
              readOnly
              value={email}
              className="mt-1 block w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground shadow-sm focus:outline-none"
            />
            <p className="mt-1 text-xs text-muted-foreground">Email cannot be changed in this demo.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-foreground">Phone Number</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-foreground">City (Metro ATL)</label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ntrp" className="block text-sm font-medium text-foreground">Skill Level (NTRP)</label>
            <select
              id="ntrp"
              value={ntrp}
              onChange={(e) => setNtrp(e.target.value as SkillLevel)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {SKILL_LEVELS.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">Changes to NTRP may affect league eligibility.</p>
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <Button type="submit" className="rounded-full" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
