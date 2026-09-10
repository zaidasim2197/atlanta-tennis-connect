import { cn } from "@/lib/utils";

export function TennisBall({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-6", className)}>
      <circle cx="16" cy="16" r="15" fill="var(--accent)" />
      <path
        d="M3 8c6 3 8 10 6 18M29 8c-6 3-8 10-6 18"
        fill="none"
        stroke="var(--primary-deep)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}

/** Tennis-themed loading indicator. */
export function BallLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10" role="status" aria-live="polite">
      <TennisBall className="animate-ball size-8" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
