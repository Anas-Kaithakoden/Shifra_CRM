import { Link } from "react-router-dom";
import { Building2, ChevronRight } from "lucide-react";
import type { LeadListItemDto } from "../../../shared/types/leads";
import { formatCrmDate, formatCurrencyInr } from "../../lib/format";
import { Badge } from "../ui";
import { LeadCard } from "./LeadCard";
import { ContactStatusBadge, PriorityBadge, StageBadge } from "./badges";

export function LeadTable({ leads }: { leads: LeadListItemDto[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <th scope="col" className="px-4 py-3 font-medium">
                Lead
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stage
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Contact
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Priority
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Next follow-up
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Owner
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Value
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="group transition-colors hover:bg-slate-50/80"
              >
                <td className="px-4 py-3">
                  <Link to={`/leads/${lead.id}`} className="block">
                    <p className="truncate font-medium text-slate-800 group-hover:text-brand-800">
                      {lead.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {lead.leadNumber}
                      {lead.businessName ? ` · ${lead.businessName}` : ""}
                    </p>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <StageBadge stage={lead.pipelineStage} />
                    {lead.customerId ? (
                      <Badge variant="success">
                        <Building2 className="h-2.5 w-2.5" aria-hidden="true" />
                        Customer
                      </Badge>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <ContactStatusBadge status={lead.contactStatus} />
                    <p className="text-xs text-slate-500">{lead.phone}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={lead.priority} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {formatCrmDate(lead.nextFollowUpAt)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {lead.assignedToName ?? "Unassigned"}
                </td>
                <td className="px-4 py-3 text-right text-xs font-medium text-slate-700">
                  {formatCurrencyInr(lead.estimatedValue)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/leads/${lead.id}`}
                    className="inline-flex rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    aria-label={`Open ${lead.name}`}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 md:hidden">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </>
  );
}
