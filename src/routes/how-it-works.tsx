import { createFileRoute, Link } from "@tanstack/react-router";
import { UserPlus, Search, CreditCard, Trophy, ArrowRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Baseline ATL Works — Atlanta Tennis Leagues" },
      {
        name: "description",
        content: "Four steps to playing Atlanta tennis leagues: register your account, browse leagues, secure your spot, and play the season.",
      },
      { property: "og:title", content: "How Baseline ATL Works" },
      { property: "og:description", content: "Register your account, browse leagues, secure your spot, and play your season." },
    ],
  }),
  component: HowItWorks,
});

export const STEPS = [
  {
    icon: UserPlus,
    title: "Register your account",
    body: "Create your free player profile with your skill level and location to unlock full access to all metro Atlanta leagues, flights, and schedules.",
  },
  {
    icon: Search,
    title: "Browse leagues & find your fit",
    body: "Explore active and upcoming flights tailored to your NTRP rating (2.5 to 5.0), preferred format (singles, doubles, mixed), and local courts.",
  },
  {
    icon: CreditCard,
    title: "Register and secure your spot",
    body: "One fast registration with secure payment and instant confirmation. Your spot in the flight is guaranteed immediately.",
  },
  {
    icon: Trophy,
    title: "Play your season",
    body: "Weekly scheduled matches, live standings, playoffs for top flight finishers, and sub management all from your player dashboard.",
  },
];

function HowItWorks() {
  const { user, hydrated } = useStore();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <Reveal>
        <p className="eyebrow text-muted-foreground">How it works</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold sm:text-5xl">
          From registration to your first match in four steps.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Baseline ATL handles the scheduling, the standings and the payments so players and organizers can focus on
          the tennis.
        </p>
      </Reveal>

      <ol className="mt-12 grid gap-6 sm:grid-cols-2">
        {STEPS.map((step, i) => (
          <Reveal as="li" key={step.title} delay={i * 60}>
            <div className="hover-lift h-full rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card)]">
              <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                <step.icon className="size-5" />
              </div>
              <p className="eyebrow mt-5 text-muted-foreground">Step {i + 1}</p>
              <h2 className="mt-1 text-xl font-bold">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </ol>

      <Reveal delay={100} className="mt-14">
        {hydrated && user ? (
          <Button asChild size="lg" className="rounded-full px-8 py-6 font-bold">
            <Link to="/leagues">
              Browse leagues <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="rounded-full px-8 py-6 font-bold shadow-lg shadow-primary/20">
              <Link to="/signup" search={{ leagueId: undefined }}>
                <UserPlus className="mr-2 size-4" />
                Register your account
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-8 py-6 font-semibold">
              <Link to="/login" search={{ leagueId: undefined }}>
                <LogIn className="mr-2 size-4" />
                Sign in
              </Link>
            </Button>
          </div>
        )}
      </Reveal>
    </div>
  );
}
