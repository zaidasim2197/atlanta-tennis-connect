import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TennisBall } from "@/components/tennis-ball";
import { useStore } from "@/lib/store";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/leagues", label: "Browse leagues" },
  { to: "/how-it-works", label: "How it works" },
] as const;

export function SiteHeader() {
  const { user, logout, dbConnected, fallbackActive } = useStore();
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();

  const dashboardTo = user?.role === "organizer" ? "/organizer" : "/dashboard";

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <TennisBall className="size-7" />
            <span className="font-display text-lg font-bold tracking-tight text-primary">
              Baseline<span className="text-muted-foreground font-medium"> ATL</span>
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{ className: "text-primary bg-secondary" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to={dashboardTo}>{user.role === "organizer" ? "Organizer hub" : "My dashboard"}</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  logout();
                  navigate({ to: "/" });
                }}
              >
                <LogOut /> Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login" search={{ leagueId: undefined }}>Sign in</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/signup" search={{ leagueId: undefined }}>Sign up</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/leagues">Find a league</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="inline-flex size-10 items-center justify-center rounded-full border border-border lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="animate-rise border-t border-border bg-background lg:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                activeOptions={{ exact: item.to === "/" }}
                activeProps={{ className: "text-primary bg-secondary" }}
                className="rounded-lg px-3 py-3 text-base font-medium"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              {user ? (
                <>
                  <Button asChild onClick={() => setOpen(false)}>
                    <Link to={dashboardTo}>{user.role === "organizer" ? "Organizer hub" : "My dashboard"}</Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      logout();
                      setOpen(false);
                      navigate({ to: "/" });
                    }}
                  >
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild onClick={() => setOpen(false)}>
                    <Link to="/leagues">Find a league</Link>
                  </Button>
                  <Button asChild variant="outline" onClick={() => setOpen(false)}>
                    <Link to="/signup" search={{ leagueId: undefined }}>Sign up</Link>
                  </Button>
                  <Button asChild variant="ghost" onClick={() => setOpen(false)}>
                    <Link to="/login" search={{ leagueId: undefined }}>Sign in</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
