import {
  CalendarClock,
  Circle,
  MessageCircle,
  Phone,
  Sparkles,
  StickyNote,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { ACTIVITY_TYPE_LABELS, type ActivityType } from "../../../shared/constants/leads";
import type { LeadActivityDto } from "../../../shared/types/leads";
import { formatCrmDateTime } from "../../lib/format";
import { EmptyState } from "../ui";

const ACTIVITY_ICONS: Record<ActivityType, typeof Circle> = {
  lead_created: Sparkles,
  call: Phone,
  whatsapp: MessageCircle,
  email: MessageCircle,
  meeting: Users,
  note: StickyNote,
  stage_changed: Circle,
  assignment_changed: Users,
  contact_status_changed: Circle,
  follow_up_scheduled: CalendarClock,
  follow_up_rescheduled: CalendarClock,
  follow_up_completed: CalendarClock,
  follow_up_cancelled: XCircle,
  lead_won: Trophy,
  lead_lost: XCircle,
  lead_reopened: Circle,
};

export function ActivityTimeline({
  activities,
  emptyDescription = "Interactions, stage changes and follow-ups will appear here.",
}: {
  activities: LeadActivityDto[];
  emptyDescription?: string;
}) {
  if (activities.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description={emptyDescription}
        icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
      />
    );
  }

  return (
    <ol className="relative space-y-1">
      {activities.map((activity, index) => {
        const Icon = ACTIVITY_ICONS[activity.activityType] ?? Circle;
        return (
          <li key={activity.id} className="relative flex gap-3 pb-4">
            {index < activities.length - 1 ? (
              <span
                className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-slate-200"
                aria-hidden="true"
              />
            ) : null}
            <span className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-slate-800">
                  {activity.title}
                </p>
                <p className="text-[11px] text-slate-400">
                  {formatCrmDateTime(activity.createdAt)}
                </p>
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {ACTIVITY_TYPE_LABELS[activity.activityType]}
                {activity.userName ? ` · ${activity.userName}` : ""}
              </p>
              {activity.description ? (
                <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
                  {activity.description}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
