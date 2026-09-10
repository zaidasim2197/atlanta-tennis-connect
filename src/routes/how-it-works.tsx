import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Target, CreditCard, Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Baseline ATL Works — Atlanta Tennis Leagues" },
      {
        name: "description",
        content: "Four steps from browsing Atlanta tennis leagues to playing your first match: browse, pick your level, sign up and pay, play the season.",
      },
      { property: "og:title", content: "How Baseline ATL Works" },
      { property: "og:description", content: "Browse leagues, pick your level, sign up and pay, play your season." },
    ],
  }),
  component: HowItWorks,
});

export const STEPS = [
  {
    icon: Search,
    title: "Browse leagues",
    body: "Filter every active and upcoming league in metro Atlanta by format, skill level and season until you find your fit.",
  },
  {
    icon: Target,
    title: "Pick your level",
    body: "Every flight is NTRP-rated, from 2.5 first-timers to 4.5+ competitive singles, so your matches stay close.",
  },
  {
    icon: CreditCard,
    title: "Sign up and pay",
    body: "One short registration, secure payment, instant confirmation. Your spot is locked the moment you're done.",
  },
  {
    icon: Trophy,
    title: "Play your season",
    body: "Weekly matches, live standings, and playoffs for the top of each flight. Track it all from your dashboard.",
  },
];

function HowItWorks() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <Reveal>
        <p className="eyebrow text-muted-foreground">How it works</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold sm:text-5xl">
          From browsing to your first match in four steps.
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
        <Button asChild size="lg">
          <Link to="/leagues">
            Browse leagues <ArrowRight />
          </Link>
        </Button>
      </Reveal>
    </div>
  );
}
