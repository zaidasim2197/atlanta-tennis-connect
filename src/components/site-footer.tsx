import { Link } from "@tanstack/react-router";
import { TennisBall } from "@/components/tennis-ball";

export function SiteFooter() {
  return (
    <footer className="court-lines mt-24 bg-primary-deep text-white/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <TennisBall className="size-6" />
            <span className="font-display text-lg font-bold text-white">Baseline ATL</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed">
            Organized tennis leagues across metro Atlanta. Real schedules, real standings, real matches every week.
          </p>
        </div>
        <div>
          <h3 className="eyebrow text-white">Players</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/leagues" className="transition-colors hover:text-accent">Browse leagues</Link></li>
            <li><Link to="/how-it-works" className="transition-colors hover:text-accent">How it works</Link></li>
            <li><Link to="/dashboard" className="transition-colors hover:text-accent">My dashboard</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="eyebrow text-white">Organizers</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/organizer" className="transition-colors hover:text-accent">Organizer hub</Link></li>
            <li><Link to="/login" className="transition-colors hover:text-accent">Sign in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs sm:px-6">
          © {new Date().getFullYear()} Baseline ATL. Atlanta, Georgia.
        </p>
      </div>
    </footer>
  );
}
