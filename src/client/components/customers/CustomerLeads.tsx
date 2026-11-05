import { Link } from "react-router-dom";
import {
  CalendarCheck2,
  ChevronRight,
  Plus,
  Target,
  Trophy,
} from "lucide-react";
import type { CustomerLeadDto } from "../../../shared/types/customers";
import { formatCrmDate, formatCurrencyInr } from "../../lib/format";
import { Button, EmptyState } from "../ui";
import { StageBadge } from "../leads";

function LeadRow({ lead }: { lead: CustomerLeadDto }) {
  return (
    <Link
      to={`/leads/${lead.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-3 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-900">
            {lead.serviceInterest ?? lead.name}
          </p>
          <StageBadge stage={lead.pipelineStage} />
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {lead.leadNumber}
          {lead.estimatedValue !== null
            ? ` · ${formatCurrencyInr(lead.estimatedValue)}`
            : ""}
          {lead.assignedToName ? ` · ${lead.assignedToName}` : ""}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Enquiry {formatCrmDate(lead.createdAt)}
          {lead.convertedToCustomerAt
            ? ` · Customer since ${formatCrmDate(lead.convertedToCustomerAt)}`
            : ""}
        </p>
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-slate-300"
        aria-hidden="true"
      />
    </Link>
  );
}

export function CustomerLeads({
  leads,
  canLink,
  onLink,
  emptyDescription,
  view = "all",
}: {
  leads: CustomerLeadDto[];
  canLink: boolean;
  onLink: () => void;
  emptyDescription?: string;
  view?: "all" | "won";
}) {
  const won = leads.filter((lead) => lead.pipelineStage === "won");
  const enquiries = leads.filter((lead) => lead.pipelineStage !== "won");

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={<Target className="h-5 w-5" aria-hidden="true" />}
        title={view === "won" ? "No won purchases yet" : "No enquiries linked"}
        description={
          emptyDescription ??
          (view === "won"
            ? "When a linked lead is marked won, it will appear here as a purchase."
            : "Link a lead to keep this customer's enquiry and purchase history together.")
        }
        action={
          canLink ? (
            <Button
              size="sm"
              onClick={onLink}
              leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Link a lead
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {view === "all" ? (
        <section>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Target className="h-4 w-4 text-slate-400" aria-hidden="true" />
                Enquiries
              </h3>
              <p className="text-xs text-slate-500">
                Leads that have not become a won purchase.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-400">
              {enquiries.length}
            </span>
          </div>
          {enquiries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500">
              No open or lost enquiries.
            </p>
          ) : (
            <div className="space-y-2">
              {enquiries.map((lead) => (
                <LeadRow key={lead.id} lead={lead} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Trophy className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              Won purchases
            </h3>
            <p className="text-xs text-slate-500">
              Won leads linked to this customer. Projects and payments are not
              tracked here yet.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400">{won.length}</span>
        </div>
        {won.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500">
            No won purchases recorded.
          </p>
        ) : (
          <div className="space-y-2">
            {won.map((lead) => (
              <div key={lead.id}>
                <LeadRow lead={lead} />
                {lead.convertedToCustomerAt ? (
                  <p className="mt-1 flex items-center gap-1 pl-1 text-[11px] text-emerald-700">
                    <CalendarCheck2 className="h-3 w-3" aria-hidden="true" />
                    Converted {formatCrmDate(lead.convertedToCustomerAt)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {canLink && view === "all" ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onLink}
          leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          Link another lead
        </Button>
      ) : null}
    </div>
  );
}
