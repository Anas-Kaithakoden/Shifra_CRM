import { Link } from "react-router-dom";
import { Building2, CalendarClock, MapPin, Phone, UserRound } from "lucide-react";
import type { LeadListItemDto } from "../../../shared/types/leads";
import { formatCrmDate, formatCurrencyInr } from "../../lib/format";
import { cn } from "../../lib/cn";
import { Badge } from "../ui";
import { ContactStatusBadge, PriorityBadge, StageBadge } from "./badges";

export function LeadCard({
  lead,
  className,
  showStage = true,
}: {
  lead: LeadListItemDto;
  className?: string;
  showStage?: boolean;
}) {
  return (
    <Link
      to={`/leads/${lead.id}`}
      className={cn(
        "block rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50/20",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {lead.name}
          </p>
          {lead.businessName ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
              <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
              {lead.businessName}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          {lead.leadNumber}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {showStage ? <StageBadge stage={lead.pipelineStage} /> : null}
        {lead.customerId ? (
          <Badge variant="success">
            <Building2 className="h-2.5 w-2.5" aria-hidden="true" />
            Customer
          </Badge>
        ) : null}
        <ContactStatusBadge status={lead.contactStatus} />
        <PriorityBadge priority={lead.priority} />
      </div>

      <div className="mt-2.5 grid gap-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
          {lead.phone}
        </span>
        {lead.location ? (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            {lead.location}
          </span>
        ) : null}
        {lead.nextFollowUpAt ? (
          <span className="flex items-center gap-1.5">
            <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
            Follow-up {formatCrmDate(lead.nextFollowUpAt)}
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
        <span className="flex min-w-0 items-center gap-1.5">
          <UserRound className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {lead.assignedToName ?? "Unassigned"}
          </span>
        </span>
        <span className="shrink-0 font-medium text-slate-700">
          {formatCurrencyInr(lead.estimatedValue)}
        </span>
      </div>
    </Link>
  );
}
