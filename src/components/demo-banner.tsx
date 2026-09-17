import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DemoBannerProps {
  /** What the demo data represents */
  message?: string;
  className?: string;
  /**
   * "default" — for light page backgrounds
   * "ghost"   — for dark/image hero sections
   */
  variant?: "default" | "ghost";
}

/**
 * Professional inline disclaimer banner.
 * Marks sections containing simulated prototype data.
 */
export function DemoBanner({
  message = "All data shown is for demonstration purposes only.",
  className,
  variant = "default",
}: DemoBannerProps) {
  if (variant === "ghost") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm",
          className,
        )}
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Info className="size-3.5 text-white" />
        </span>
        <p className="text-xs leading-snug text-white/80">
          <span className="font-semibold text-white">Prototype data — </span>
          {message}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 overflow-hidden rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm",
        className,
      )}
    >
      {/* Left accent bar */}
      <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl bg-primary/40" />

      {/* Icon */}
      <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Info className="size-3.5 text-primary" />
      </span>

      {/* Text */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
          Prototype Environment
        </p>
        <p className="text-xs leading-snug text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
