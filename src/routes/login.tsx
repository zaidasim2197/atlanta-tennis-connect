import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { FORMAT_LABELS, formatMoney } from "@/lib/tennis";
import { TennisBall } from "@/components/tennis-ball";
import {
  MapPin,
  CalendarDays,
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
  KeyRound,
} from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    leagueId:
      typeof search["leagueId"] === "string"
        ? (search["leagueId"] as string)
        : undefined,
  }),
  component: Login,
});

// ─── Hardcoded demo credentials ─────────────────────────────────────────────
const DEMO_CREDENTIALS = {
  player: {
    email: "player@baselineatl.com",
    password: "player123",
  },
  organizer: {
    email: "organizer@baselineatl.com",
    password: "organizer123",
  },
} as const;

// ─── Step indicator ─────────────────────────────────────────────────────────
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
                className={`whitespace-nowrap text-[10px] font-semibold ${
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

// ─── Component ───────────────────────────────────────────────────────────────
function Login() {
  const { login, leagueById } = useStore();
  const navigate = useNavigate();
  const { leagueId } = Route.useSearch();
  const leagueData = leagueId ? leagueById(leagueId) : undefined;

  const [role, setRole] = useState<"player" | "organizer">("player");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const clearErrors = () => {
    setEmailError("");
    setPasswordError("");
  };

  const handleRoleChange = (r: "player" | "organizer") => {
    setRole(r);
    setEmail("");
    setPassword("");
    clearErrors();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setPasswordError("Please enter your password.");
      return;
    }

    // 1. Check demo credentials
    const isDemoPlayer = normalizedEmail === DEMO_CREDENTIALS.player.email.toLowerCase();
    const isDemoOrganizer = normalizedEmail === DEMO_CREDENTIALS.organizer.email.toLowerCase();

    // 2. Check registered accounts from localStorage
    let registeredUsers: Record<
      string,
      { password?: string; role?: "player" | "organizer"; name?: string; playerId?: string }
    > = {};
    try {
      registeredUsers = JSON.parse(localStorage.getItem("atl-registered-accounts") || "{}");
    } catch {}

    const registeredAccount = registeredUsers[normalizedEmail];

    // 3. Determine if the account exists, its authorized role, password, and display name
    let accountExists = false;
    let expectedPassword = "";
    let authorizedRole: "player" | "organizer" = "player";
    let displayName: string | undefined = undefined;

    if (isDemoPlayer) {
      accountExists = true;
      expectedPassword = DEMO_CREDENTIALS.player.password;
      authorizedRole = "player";
      displayName = "Alex Mercer";
    } else if (isDemoOrganizer) {
      accountExists = true;
      expectedPassword = DEMO_CREDENTIALS.organizer.password;
      authorizedRole = "organizer";
      displayName = "Dana Whitfield";
    } else if (registeredAccount) {
      accountExists = true;
      expectedPassword = registeredAccount.password || "";
      authorizedRole = registeredAccount.role === "organizer" ? "organizer" : "player";
      displayName = registeredAccount.name;
    }

    // 4. Reject unknown accounts
    if (!accountExists) {
      if (role === "organizer") {
        setEmailError("No organizer account found with this email. Organizer access requires verified credentials.");
      } else {
        setEmailError("No account found with this email address. Please sign up first.");
      }
      return;
    }

    // 5. Role-Based Access Control (RBAC) Enforcement
    if (role === "organizer" && authorizedRole !== "organizer") {
      setEmailError("Access denied: This account is registered as a player and does not have organizer privileges.");
      return;
    }

    if (role === "player" && authorizedRole === "organizer") {
      setEmailError("This is an organizer account. Please switch to the Organizer tab to sign in.");
      return;
    }

    // 6. Verify password
    if (password !== expectedPassword) {
      setPasswordError("Incorrect password. Please try again.");
      return;
    }

    // 7. Successful login
    setLoading(true);
    setTimeout(() => {
      login(authorizedRole, normalizedEmail, displayName);
      if (leagueId && authorizedRole === "player") {
        navigate({ to: "/register/$leagueId", params: { leagueId } });
      } else {
        navigate({ to: authorizedRole === "organizer" ? "/organizer" : "/dashboard" });
      }
    }, 500);
  };

  const creds = DEMO_CREDENTIALS[role];

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

        {/* Auth card */}
        <div className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card)] sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {leagueData ? "Sign in to continue" : "Sign in to your account"}
            </h1>
            {leagueData && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Use your account to continue your registration for{" "}
                <strong className="font-semibold text-foreground">
                  {leagueData.name}
                </strong>
                .
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role toggle */}
            <div className="flex rounded-lg border border-border bg-muted p-1">
              {(["player", "organizer"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleChange(r)}
                  className={`flex-1 rounded-md py-2 text-sm font-semibold capitalize transition-all ${
                    role === r
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "player" ? "Player" : "Organizer"}
                </button>
              ))}
            </div>

            {/* Demo credentials hint */}
            <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-3">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Demo credentials
                </span>{" "}
                for{" "}
                <span className="font-semibold capitalize text-primary">
                  {role}
                </span>
                :
                <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono text-[11px]">
                  <span className="text-muted-foreground">Email</span>
                  <button
                    type="button"
                    onClick={() => { setEmail(creds.email); clearErrors(); }}
                    className="truncate text-left font-semibold text-primary underline-offset-2 hover:underline"
                    title="Click to auto-fill"
                  >
                    {creds.email}
                  </button>
                  <span className="text-muted-foreground">Password</span>
                  <button
                    type="button"
                    onClick={() => { setPassword(creds.password); clearErrors(); }}
                    className="text-left font-semibold text-primary underline-offset-2 hover:underline"
                    title="Click to auto-fill"
                  >
                    {creds.password}
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                  Click email or password above to auto-fill.
                </p>
              </div>
            </div>

            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                placeholder={creds.email}
                className={`block w-full rounded-lg border bg-background px-3.5 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2 ${
                  emailError
                    ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                    : "border-input focus:border-primary focus:ring-primary/20"
                }`}
              />
              {emailError && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  {emailError}
                </p>
              )}
            </div>

            {/* Password field */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground"
                >
                  Password
                </label>
                <a
                  href="#"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  placeholder="Enter your password"
                  className={`block w-full rounded-lg border bg-background py-2.5 pl-9 pr-10 text-sm shadow-sm transition focus:outline-none focus:ring-2 ${
                    passwordError
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                      : "border-input focus:border-primary focus:ring-primary/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  {passwordError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full"
              disabled={loading}
            >
              {loading
                ? "Signing in…"
                : leagueData
                ? "Sign in & continue to payment →"
                : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <a
              href={leagueId ? `/signup?leagueId=${leagueId}` : "/signup"}
              className="font-semibold text-primary hover:underline"
            >
              Create one
            </a>
          </p>
        </div>

        {/* Safety note */}
        {leagueData && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
            <Lock className="mt-px size-3.5 shrink-0 text-primary" />
            <p>
              Your selected league will be saved while you sign in. You can
              complete your registration right after.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
