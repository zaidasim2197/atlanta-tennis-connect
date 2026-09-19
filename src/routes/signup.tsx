import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, getApiUrl } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { SKILL_LEVELS, FORMAT_LABELS, formatMoney, type SkillLevel } from "@/lib/tennis";
import { TennisBall } from "@/components/tennis-ball";
import { MapPin, CalendarDays, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>) => ({
    leagueId:
      typeof search["leagueId"] === "string"
        ? (search["leagueId"] as string)
        : undefined,
  }),
  component: Signup,
});

const STEPS = ["League", "Sign in", "Payment", "Confirmed"] as const;

function Stepper({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-start justify-center">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={label} className="flex items-start">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ring-2 transition-all ${
                  done || active
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-background text-muted-foreground ring-border"
                }`}
              >
                {done ? (
                  <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  n
                )}
              </div>
              <span
                className={`text-[10px] font-semibold whitespace-nowrap ${
                  active
                    ? "text-primary"
                    : done
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-1.5 mt-4 h-0.5 w-10 shrink-0 rounded-full transition-all sm:w-14 ${
                  done ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Signup() {
  const { login, upsertPlayer, updatePlayer, leagueById } = useStore();
  const navigate = useNavigate();
  const { leagueId } = Route.useSearch();
  const leagueData = leagueId ? leagueById(leagueId) : undefined;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Atlanta");
  const [ntrp, setNtrp] = useState<SkillLevel>("3.0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // 1. Persist player to backend MongoDB database
      let backendPlayerId: string | undefined;
      try {
        const res = await fetch(getApiUrl("/api/players"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: normalizedEmail,
            phone: phone.trim() || undefined,
            city: city.trim() || "Atlanta",
            ntrp,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.data?.id) {
            backendPlayerId = json.data.id;
          }
        }
      } catch (apiErr) {
        console.warn("Backend player registration offline or failed, using local store:", apiErr);
      }

      // 2. Save player in local store and localStorage
      const playerRecord = {
        id: backendPlayerId || `p-${Math.random().toString(36).slice(2, 9)}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        city: city.trim() || "Atlanta",
        ntrp,
      };

      upsertPlayer(playerRecord);

      // Save custom registered credentials so the user can log in with their password later
      try {
        const registeredUsers = JSON.parse(localStorage.getItem("atl-registered-accounts") || "{}");
        registeredUsers[normalizedEmail] = {
          password,
          role: "player",
          name: `${firstName.trim()} ${lastName.trim()}`,
        };
        localStorage.setItem("atl-registered-accounts", JSON.stringify(registeredUsers));
      } catch {}

      // 3. Log in user
      const user = login("player", normalizedEmail);
      if (user.playerId) {
        updatePlayer(user.playerId, { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), city, ntrp });
      }

      // 4. Navigate to registration payment or dashboard
      if (leagueId) {
        navigate({ to: "/register/$leagueId", params: { leagueId } });
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err: unknown) {
      console.error("Signup error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[90vh] bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-lg">
        {/* Progress stepper */}
        {leagueData && <Stepper current={2} />}

        {/* Selected league card */}
        {leagueData && leagueId && (
          <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/50 px-5 py-3">
              <div className="flex items-center gap-2">
                <TennisBall className="size-4 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Your Selected League
                </span>
              </div>
              <Link
                to="/leagues/$leagueId"
                params={{ leagueId }}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                Change
              </Link>
            </div>
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold leading-tight text-foreground">
                  {leagueData.name}
                </h3>
                <span className="mt-1.5 inline-block rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                  {FORMAT_LABELS[leagueData.format]}
                </span>
                <div className="mt-2.5 flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 shrink-0 text-primary" />
                    {leagueData.scheduleDay}s at {leagueData.scheduleTime}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0 text-primary" />
                    {leagueData.venue}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  League Fee
                </p>
                <p className="mt-1 font-display text-3xl font-bold text-primary">
                  {formatMoney(leagueData.feeCents)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Signup card */}
        <div className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card)] sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {leagueData ? "Create your account" : "Create a player profile"}
            </h1>
            {leagueData && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Join{" "}
                <strong className="font-semibold text-foreground">
                  {leagueData.name}
                </strong>{" "}
                and start playing.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-foreground">
                  First Name
                </label>
                <input
                  id="firstName"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-foreground">
                  Last Name
                </label>
                <input
                  id="lastName"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Phone + City */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-medium text-foreground">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label htmlFor="city" className="mb-1 block text-sm font-medium text-foreground">
                  City (Metro ATL)
                </label>
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="block w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="block w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-10 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-foreground">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="block w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertCircle className="size-3.5 shrink-0" />
                {error}
              </p>
            )}

            {/* NTRP */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Skill Level (NTRP)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {SKILL_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setNtrp(level as SkillLevel)}
                    className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${
                      ntrp === level
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full"
              disabled={loading}
            >
              {loading
                ? "Creating account…"
                : leagueData
                ? "Create account & continue to payment →"
                : "Create Account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link
              to="/login"
              search={{ leagueId: leagueId ?? undefined }}
              className="font-semibold text-primary hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>

        {/* Safety note */}
        {leagueData && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
            <Lock className="mt-px size-3.5 shrink-0 text-primary" />
            <p>
              Your selected league will be saved while you create your account.
              You can complete your registration right after.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
