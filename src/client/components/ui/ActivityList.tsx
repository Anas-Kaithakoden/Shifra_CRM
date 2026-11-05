import type { ReactNode } from "react";
import {
  KeyRound,
  LogIn,
  LogOut,
  Pencil,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRound,
  UserX,
} from "lucide-react";
import type { AuditLogDto } from "../../../shared/types/api";
import {
  AUDIT_ACTIONS,
  auditActionLabel,
} from "../../../shared/constants/audit";
import { cn } from "../../lib/cn";
import { formatRelativeTime } from "../../lib/format";
import { EmptyState } from "./EmptyState";

interface ActionVisual {
  icon: ReactNode;
  tone: string;
}

function getActionVisual(action: string): ActionVisual {
  switch (action) {
    case AUDIT_ACTIONS.LOGIN_SUCCESS:
      return {
        icon: <LogIn className="h-4 w-4" aria-hidden="true" />,
        tone: "bg-emerald-50 text-emerald-600",
      };
    case AUDIT_ACTIONS.LOGIN_FAILED:
      return {
        icon: <ShieldAlert className="h-4 w-4" aria-hidden="true" />,
        tone: "bg-rose-50 text-rose-600",
      };
    case AUDIT_ACTIONS.LOGOUT:
      return {
        icon: <LogOut className="h-4 w-4" aria-hidden="true" />,
        tone: "bg-slate-100 text-slate-500",
      };
    case AUDIT_ACTIONS.PASSWORD_CHANGED:
      return {
        icon: <KeyRound className="h-4 w-4" aria-hidden="true" />,
        tone: "bg-amber-50 text-amber-600",
      };
    case AUDIT_ACTIONS.PROFILE_UPDATED:
      return {
        icon: <UserRound className="h-4 w-4" aria-hidden="true" />,
        tone: "bg-brand-50 text-brand-700",
      };
    case AUDIT_ACTIONS.USER_CREATED:
      return {
        icon: <UserPlus className="h-4 w-4" aria-hidden="true" />,
        tone: "bg-brand-50 text-brand-700",
      };
    case AUDIT_ACTIONS.USER_UPDATED:
      return {
        icon: <Pencil className="h-4 w-4" aria-hidden="true" />,
        tone: "bg-sky-50 text-sky-600",
      };
    case AUDIT_ACTIONS.USER_ROLE_CHANGED:
      return {
        icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
        tone: "bg-amber-50 text-amber-600",
      };
    case AUDIT_ACTIONS.USER_DEACTIVATED:
      return {
        icon: <UserX className="h-4 w-4" aria-hidden="true" />,
        tone: "bg-rose-50 text-rose-600",
      };
    case AUDIT_ACTIONS.USER_ACTIVATED:
      return {
        icon: <UserCheck className="h-4 w-4" aria-hidden="true" />,
        tone: "bg-emerald-50 text-emerald-600",
      };
    case AUDIT_ACTIONS.SETTINGS_UPDATED:
      return {
        icon: <Settings className="h-4 w-4" aria-hidden="true" />,
        tone: "bg-slate-100 text-slate-600",
      };
    default:
      return {
        icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
        tone: "bg-slate-100 text-slate-600",
      };
  }
}

function metadataTarget(log: AuditLogDto): string | null {
  const email = log.metadata?.email;
  return typeof email === "string" && email.length > 0 ? email : null;
}

export function ActivityList({
  logs,
  emptyTitle = "No activity yet",
  emptyDescription = "Activity will appear here as your team uses the CRM.",
}: {
  logs: AuditLogDto[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (logs.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
      />
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {logs.map((log) => {
        const visual = getActionVisual(log.action);
        const target = metadataTarget(log);

        return (
          <li key={log.id} className="flex items-start gap-3 px-5 py-3">
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                visual.tone,
              )}
            >
              {visual.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">
                {auditActionLabel(log.action)}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {log.actor ? log.actor.fullName : "System"}
                {target ? ` · ${target}` : ""}
              </p>
            </div>
            <time
              dateTime={log.createdAt}
              className="shrink-0 pt-0.5 text-xs text-slate-400"
              title={log.createdAt}
            >
              {formatRelativeTime(log.createdAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
