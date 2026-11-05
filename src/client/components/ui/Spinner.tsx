import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

export function Spinner({
  size = "md",
  className,
  label = "Loading",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  const sizeClass =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-5 w-5";

  return (
    <span role="status" aria-live="polite" className={cn("inline-flex", className)}>
      <Loader2
        className={cn("animate-spin text-brand-600", sizeClass)}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function FullPageSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" label={label} />
        <p className="text-sm text-slate-500">{label}…</p>
      </div>
    </div>
  );
}
