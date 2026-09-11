import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const { login } = useStore();
  const navigate = useNavigate();
  
  const [role, setRole] = useState<"player" | "organizer">("player");
  const [email, setEmail] = useState("player@example.com");
  const [loading, setLoading] = useState(false);

  const handleRoleChange = (newRole: "player" | "organizer") => {
    setRole(newRole);
    if (newRole === "organizer") {
      setEmail("admin@baselineatl.com");
    } else {
      setEmail("player@example.com");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate network delay for realistic prototype feel
    setTimeout(() => {
      login(role, email);
      navigate({ to: role === "organizer" ? "/organizer" : "/dashboard" });
    }, 600);
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a demo role to experience the prototype.
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Modern Role Selector */}
            <div className="flex rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => handleRoleChange("player")}
                className={`flex-1 rounded-md py-2.5 text-sm font-semibold transition-all ${
                  role === "player"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Player
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange("organizer")}
                className={`flex-1 rounded-md py-2.5 text-sm font-semibold transition-all ${
                  role === "organizer"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Organizer
              </button>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                value="mockpassword"
                readOnly
                className="mt-1 block w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground shadow-sm focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">Any password works in this demo.</p>
            </div>
          </div>

          <div>
            <Button type="submit" className="w-full rounded-full text-md h-11" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </div>
          
          <div className="text-center text-sm text-muted-foreground mt-4">
            Don't have an account?{" "}
            <a href="/signup" className="font-semibold text-primary hover:underline">
              Create one
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
