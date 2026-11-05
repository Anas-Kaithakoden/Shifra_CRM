import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Mail,
  Phone,
} from "lucide-react";
import type { CustomerListItemDto } from "../../../shared/types/customers";
import type { CustomerSortField } from "../../../shared/constants/customers";
import { formatCrmDate, formatCrmDateTime } from "../../lib/format";
import { CustomerStatusBadge, CustomerTypeBadge } from "./badges";

function SortButton({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  field: CustomerSortField;
  sortBy: CustomerSortField;
  sortDir: "asc" | "desc";
  onSort: (field: CustomerSortField) => void;
}) {
  const active = sortBy === field;
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 font-medium transition-colors hover:text-slate-700"
    >
      {label}
      <Icon className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

export function CustomerTable({
  customers,
  sortBy,
  sortDir,
  onSort,
}: {
  customers: CustomerListItemDto[];
  sortBy: CustomerSortField;
  sortDir: "asc" | "desc";
  onSort: (field: CustomerSortField) => void;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <th scope="col" className="px-4 py-3">
                <SortButton
                  label="Customer"
                  field="customer_number"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                />
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Type
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Contact
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Owner
              </th>
              <th scope="col" className="px-4 py-3 text-center font-medium">
                Enquiries / Won
              </th>
              <th scope="col" className="px-4 py-3">
                <SortButton
                  label="Created"
                  field="created_at"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                />
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((customer) => {
              const contact = customer.primaryContact;
              return (
                <tr
                  key={customer.id}
                  className="group transition-colors hover:bg-slate-50/80"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/customers/${customer.id}`}
                      className="block max-w-[22rem]"
                    >
                      <span className="block truncate font-medium text-slate-900 group-hover:text-brand-700">
                        {customer.businessName ?? customer.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {customer.customerNumber}
                        {customer.businessName ? ` · ${customer.name}` : ""}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <CustomerTypeBadge type={customer.type} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5 text-xs text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-slate-400" aria-hidden="true" />
                        {contact?.phone ?? customer.phone}
                      </span>
                      {contact?.email ?? customer.email ? (
                        <span className="flex max-w-[14rem] items-center gap-1.5 truncate">
                          <Mail className="h-3 w-3 text-slate-400" aria-hidden="true" />
                          <span className="truncate">
                            {contact?.email ?? customer.email}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <CustomerStatusBadge status={customer.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {customer.assignedToName ?? "Unassigned"}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    <span className="font-medium text-slate-700">
                      {customer.enquiryCount}
                    </span>
                    <span className="text-slate-300"> / </span>
                    <span className="font-medium text-emerald-700">
                      {customer.wonCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-slate-600">
                      {formatCrmDate(customer.createdAt)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {customer.lastActivityAt
                        ? `Active ${formatCrmDateTime(customer.lastActivityAt)}`
                        : "No activity yet"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/customers/${customer.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Open ${customer.businessName ?? customer.name}`}
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {customers.map((customer) => (
          <Link
            key={customer.id}
            to={`/customers/${customer.id}`}
            className="block px-4 py-4 transition-colors hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">
                  {customer.businessName ?? customer.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {customer.customerNumber}
                </p>
              </div>
              <CustomerStatusBadge status={customer.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <CustomerTypeBadge type={customer.type} />
              <span>{customer.assignedToName ?? "Unassigned"}</span>
              <span>
                {customer.enquiryCount} enquiries · {customer.wonCount} won
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {customer.primaryContact?.phone ?? customer.phone}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
