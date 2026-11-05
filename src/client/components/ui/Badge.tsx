import type { ReactNode } from "react";
import { ROLE_LABELS, type Role } from "../../../shared/types/roles";
import { cn } from "../../lib/cn";

type BadgeVariant =
  | "neutral"
  | "brand"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "soon";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  brand: "border-brand-200 bg-brand-50 text-brand-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  soon: "border-slate-200 bg-white text-slate-500",
};

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

const ROLE_VARIANTS: Record<Role, BadgeVariant> = {
  owner: "brand",
  admin: "info",
  employee: "neutral",
};

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={ROLE_VARIANTS[role]}>{ROLE_LABELS[role]}</Badge>;
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "success" : "danger"}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-rose-500",
        )}
        aria-hidden="true"
      />
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}
