import {
  Briefcase,
  CalendarClock,
  CheckSquare,
  Mail,
  Phone,
  Users,
} from "lucide-react";
import type { TaskType } from "../../../shared/constants/tasks";
import { TASK_TYPE_LABELS } from "../../../shared/constants/tasks";
import { cn } from "../../lib/cn";

const TYPE_ICONS: Record<TaskType, typeof Briefcase> = {
  follow_up: CalendarClock,
  call: Phone,
  meeting: Users,
  email: Mail,
  review: CheckSquare,
  internal: Briefcase,
};

const TYPE_COLORS: Record<TaskType, string> = {
  follow_up: "bg-purple-50 text-purple-700 border-purple-200",
  call: "bg-sky-50 text-sky-700 border-sky-200",
  meeting: "bg-indigo-50 text-indigo-700 border-indigo-200",
  email: "bg-cyan-50 text-cyan-700 border-cyan-200",
  review: "bg-emerald-50 text-emerald-700 border-emerald-200",
  internal: "bg-slate-50 text-slate-700 border-slate-200",
};

export function TaskTypeBadge({
  type,
  className,
}: {
  type: TaskType;
  className?: string;
}) {
  const Icon = TYPE_ICONS[type] ?? Briefcase;
  const color = TYPE_COLORS[type] ?? TYPE_COLORS.internal;
  const label = TASK_TYPE_LABELS[type] ?? type;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        color,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
