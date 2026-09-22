import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Trophy,
  Users,
  Calendar,
  Lock,
  LogIn,
  UserPlus,
  ShieldCheck,
  MapPin,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { LeagueCard } from "@/components/league-card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DemoBanner } from "@/components/demo-banner";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { leagues, seasons, spotsLeft, user, hydrated } = useStore();
  const featuredLeagues = leagues.slice(0, 3);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="group relative overflow-hidden bg-black px-4 py-40 sm:py-56 text-primary-foreground sm:px-6 lg:px-8">
        <div className="absolute inset-0">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="h-full w-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-1000 ease-out"
            poster="https://images.unsplash.com/photo-1499510318569-1a3d67dc3976?q=80&w=464&auto=format&fit=crop"
          >
            <source src="https://res.cloudinary.com/dereplqra/video/upload/v1789104060/281992_large_1_xy63dw.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        </div>
        <div className="relative mx-auto max-w-6xl text-center z-10">
          <h1 className="font-display animate-rise text-5xl font-bold tracking-tight text-white sm:text-7xl drop-shadow-lg">
            Real tennis. Real local.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/90 sm:text-xl font-medium drop-shadow-md">
            Join organized tennis leagues across metro Atlanta. Create your profile, browse member flights, sign up and play. We handle the schedules, you handle the rallies.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="rounded-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl border-2 border-primary/20">
              <Link to="/leagues">
                Find a league
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white border-white/30 backdrop-blur-sm shadow-xl">
              <Link to="/how-it-works">How it works</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats/Info Section */}
      <section className="border-b border-border bg-card px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-3">
          <div className="flex flex-col items-center text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Trophy className="size-6" />
            </div>
            <h3 className="mt-4 font-bold text-foreground">Competitive Play</h3>
            <p className="mt-2 text-sm text-muted-foreground">Find opponents at your exact skill level, from casual 2.5 to competitive 5.0.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Users className="size-6" />
            </div>
            <h3 className="mt-4 font-bold text-foreground">All Formats</h3>
            <p className="mt-2 text-sm text-muted-foreground">Singles, doubles, and mixed. Junior and senior divisions across metro Atlanta.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Calendar className="size-6" />
            </div>
            <h3 className="mt-4 font-bold text-foreground">Organized Seasons</h3>
            <p className="mt-2 text-sm text-muted-foreground">Spring, Summer, Fall, and Winter leagues with scheduled matches and playoffs.</p>
          </div>
        </div>
      </section>

      {/* Featured Leagues / Member Access Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-background">
        <div className="mx-auto max-w-6xl">
          {hydrated && user ? (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Featured Leagues</h2>
                  <p className="mt-2 text-muted-foreground">Upcoming flights with spots still available.</p>
                </div>
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/leagues">View all leagues</Link>
                </Button>
              </div>

              <DemoBanner
                message="Featured leagues shown here are sample data for demonstration purposes only."
                className="mt-6"
              />

              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featuredLeagues.map((league) => (
                  <LeagueCard
                    key={league.id}
                    league={league}
                    season={seasons.find((s) => s.id === league.seasonId)}
                    spotsLeft={spotsLeft(league.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-card p-8 sm:p-12 shadow-xl text-center relative overflow-hidden">
              <div className="absolute -top-24 -right-24 size-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 size-64 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl mx-auto space-y-6">
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
                  <Lock className="size-8" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground font-display">
                    Sign in or register to browse leagues
                  </h2>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    To view active flights, match schedules, court locations, and register for upcoming seasons in metro Atlanta, please create an account or sign in with your existing profile.
                  </p>
                </div>

                {/* Call-to-action buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <Link to="/signup" search={{ leagueId: undefined }} className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto rounded-full px-8 py-6 text-sm font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <UserPlus className="mr-2 size-4" /> Create an Account
                    </Button>
                  </Link>
                  <Link to="/login" search={{ leagueId: undefined }} className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto rounded-full px-8 py-6 text-sm font-semibold border-border hover:bg-muted/80 cursor-pointer"
                    >
                      <LogIn className="mr-2 size-4" /> Sign In to See Leagues
                    </Button>
                  </Link>
                </div>

                <p className="text-xs text-muted-foreground pt-1">
                  Already registered? <Link to="/login" search={{ leagueId: undefined }} className="text-primary font-semibold hover:underline">Sign in with your email</Link> to immediately view all leagues.
                </p>
              </div>

              {/* Feature preview cards */}
              <div className="mt-12 pt-10 border-t border-border/60 grid gap-4 sm:grid-cols-3 text-left">
                <div className="rounded-2xl border border-border/70 bg-background/50 p-5 space-y-2">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="size-5" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground">NTRP-Aligned Flights</h3>
                  <p className="text-xs text-muted-foreground">
                    Singles, doubles, and mixed flights balanced strictly by rating (2.5 to 5.0) for fair, competitive matches.
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/50 p-5 space-y-2">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MapPin className="size-5" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground">Metro Atlanta Venues</h3>
                  <p className="text-xs text-muted-foreground">
                    Convenient home and away match locations across Midtown, Buckhead, Decatur, Sandy Springs, and more.
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/50 p-5 space-y-2">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Trophy className="size-5" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground">Verified Standings</h3>
                  <p className="text-xs text-muted-foreground">
                    Official score reporting, committee review, live standings, and end-of-season championship tournaments.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 border-t border-border">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Frequently Asked Questions</h2>
            <p className="mt-4 text-lg text-muted-foreground">Everything you need to know about playing with Baseline ATL.</p>
          </div>
          
          <div className="mx-auto max-w-3xl rounded-2xl bg-card p-6 shadow-sm border border-border sm:p-10">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-base font-semibold hover:text-primary">How do I know my skill level?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  We use the standard NTRP rating system (2.5 to 5.0). If you're a beginner, 2.5 is a great start. Intermediate players typically fall into 3.0 or 3.5, while advanced players compete at 4.0 and 4.5 or 5.0. You can easily select your level when creating your profile.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="text-base font-semibold hover:text-primary">Where are the matches played?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  Matches are hosted at top-tier tennis facilities across metro Atlanta. Specific venues vary by league and season. When you view a league's details, you'll see exactly which venue will host your matches.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger className="text-base font-semibold hover:text-primary">What happens if I miss a match?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  We understand life happens! We offer an easy sub-request system. If you can't make a scheduled match, you can request a substitute player from our sub pool. Repeated no-shows may affect your eligibility for future seasons.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger className="text-base font-semibold hover:text-primary">Do I need a partner for doubles?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  Nope! You can sign up as an individual and we will pair you with a partner of a similar skill level. If you already have a partner in mind, both of you can register and specify each other during the registration process.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5" className="border-b-0">
                <AccordionTrigger className="text-base font-semibold hover:text-primary">When does the next season start?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
                  We run four major seasons year-round: Spring, Summer, Fall, and Winter. Registration typically opens 4 weeks before the season begins. Check the "Browse leagues" page to see what's currently enrolling!
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-secondary px-6 py-16 text-center shadow-lg sm:px-12">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ready to hit the courts?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Create your player profile, find a league that fits your schedule, and get ready for your first match.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/signup" search={{ leagueId: undefined }}>Create account</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
