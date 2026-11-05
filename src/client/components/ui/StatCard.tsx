import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";

export function StatCard({
  label,
  value,
  icon,
  hint,
  comingSoon = false,
  className,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  hint?: string;
  comingSoon?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm",
        comingSoon
          ? "border-dashed border-slate-300 bg-slate-50/60"
          : "border-slate-200",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            comingSoon
              ? "bg-slate-200/70 text-slate-500"
              : "bg-brand-50 text-brand-700",
          )}
        >
          {icon}
        </span>
        {comingSoon ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Soon
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
        {comingSoon ? "—" : value}
      </p>
      <p className="mt-0.5 text-sm font-medium text-slate-600">{label}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}
