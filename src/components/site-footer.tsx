import { Link } from "@tanstack/react-router";
import { TennisBall } from "@/components/tennis-ball";

export function SiteFooter() {
  return (
    <footer className="court-lines mt-24 bg-primary-deep text-white/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        {/* Brand */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-2">
            <TennisBall className="size-6" />
            <span className="font-display text-lg font-bold text-white">
              Baseline ATL
            </span>
          </div>

          <p className="mt-3 max-w-sm text-sm leading-relaxed">
            Organized tennis leagues across metro Atlanta. Real schedules,
            real standings, real matches every week.
          </p>
        </div>

        {/* Mobile navigation wrapper */}
        <div className="grid grid-cols-2 gap-6 md:contents">
          {/* Players */}
          <div>
            <h3 className="eyebrow text-white">Players</h3>

            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  to="/leagues"
                  className="transition-colors hover:text-accent"
                >
                  Browse leagues
                </Link>
              </li>
              <li>
                <Link
                  to="/how-it-works"
                  className="transition-colors hover:text-accent"
                >
                  How it works
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className="transition-colors hover:text-accent"
                >
                  My dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Organizers */}
          <div>
            <h3 className="eyebrow text-white">Organizers</h3>

            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link
                  to="/organizer"
                  className="transition-colors hover:text-accent"
                >
                  Organizer hub
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="transition-colors hover:text-accent"
                >
                  Sign in
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Demo disclaimer */}
          <p className="overflow-hidden whitespace-nowrap border-b border-white/10 py-3 text-center text-[10px] leading-relaxed text-white">
            Demo Notice: All content and data shown are for demonstration
            purposes only.
          </p>

          {/* Copyright + Powered by */}
          <div className="flex flex-col items-center gap-3 pt-6 pb-4 sm:flex-row sm:justify-between sm:gap-0">
            <p className="text-xs text-white">
              © {new Date().getFullYear()} Baseline ATL. Atlanta, Georgia.
            </p>

            {/* Vision71 branding */}
            <div className="flex items-center">
              {/* Mobile: beside logo */}
              <span className="mr-2 text-[10px] leading-none text-white sm:hidden">
                Powered by
              </span>

              {/* Desktop: directly above logo */}
              <div className="relative sm:pt-4">
                <span className="absolute left-0 top-0 hidden text-[9px] leading-none text-white sm:block">
                  Powered by
                </span>

                <a
                  href="https://vision71tech.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Vision71 Technologies"
                >
                  <img
                    src="/v71_white (1).png"
                    alt="Vision71 Technologies"
                    className="h-12 w-auto"
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}