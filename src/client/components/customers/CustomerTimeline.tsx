import { Link } from "react-router-dom";
import {
  Building2,
  CalendarCheck2,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import {
  CUSTOMER_ACTIVITY_TYPE_LABELS,
  type CustomerActivityType,
} from "../../../shared/constants/customers";
import type { CustomerActivityDto } from "../../../shared/types/customers";
import { formatCrmDateTime, formatRelativeTime } from "../../lib/format";
import { Badge, EmptyState } from "../ui";

const ACTIVITY_ICONS: Record<
  CustomerActivityType,
  typeof Phone
> = {
  customer_created: Building2,
  customer_updated: RefreshCw,
  status_changed: UserCheck,
  assignment_changed: Users,
  contact_added: UserCheck,
  contact_updated: RefreshCw,
  contact_removed: UserX,
  primary_contact_changed: UserCheck,
  note_added: FileText,
  interaction_logged: MessageCircle,
  call: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  meeting: Users,
  lead_linked: Building2,
  lead_converted: CalendarCheck2,
  customer_archived: UserX,
  customer_restored: UserCheck,
};

const ACTIVITY_TONES: Partial<Record<CustomerActivityType, string>> = {
  lead_converted: "bg-emerald-50 text-emerald-600",
  customer_created: "bg-brand-50 text-brand-600",
  customer_archived: "bg-rose-50 text-rose-500",
  customer_restored: "bg-emerald-50 text-emerald-600",
  note_added: "bg-amber-50 text-amber-600",
  call: "bg-sky-50 text-sky-600",
  whatsapp: "bg-emerald-50 text-emerald-600",
  email: "bg-indigo-50 text-indigo-600",
  meeting: "bg-violet-50 text-violet-600",
};

export function CustomerTimeline({
  activities,
}: {
  activities: CustomerActivityDto[];
}) {
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-5 w-5" aria-hidden="true" />}
        title="No activity yet"
        description="Notes, interactions, contact changes and lead links will appear here."
      />
    );
  }

  return (
    <ol className="relative space-y-4 pl-7">
      <span
        className="absolute bottom-2 left-[13px] top-2 w-px bg-slate-200"
        aria-hidden="true"
      />
      {activities.map((activity) => {
        const Icon = ACTIVITY_ICONS[activity.activityType] ?? FileText;
        const tone =
          ACTIVITY_TONES[activity.activityType] ??
          "bg-slate-100 text-slate-500";
        return (
          <li key={activity.id} className="relative">
            <span
              className={`absolute -left-7 top-0 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white ${tone}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {activity.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {CUSTOMER_ACTIVITY_TYPE_LABELS[activity.activityType]}
                    {activity.userName ? ` · ${activity.userName}` : ""}
                  </p>
                </div>
                <span
                  className="shrink-0 text-[11px] text-slate-400"
                  title={formatCrmDateTime(activity.createdAt)}
                >
                  {formatRelativeTime(activity.createdAt)}
                </span>
              </div>
              {activity.description ? (
                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600">
                  {activity.description}
                </p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-slate-400">
                  {formatCrmDateTime(activity.createdAt)}
                </span>
                {activity.leadId ? (
                  <Link
                    to={`/leads/${activity.leadId}`}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:text-brand-800"
                  >
                    <Badge variant="brand">View lead</Badge>
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
