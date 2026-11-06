import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import type {
  CustomerRenewalDto,
  RenewalFilter,
  RenewalReminderStatus,
  RenewalStatus,
} from "../../shared/types/customers";
import { customersService } from "../services/customers.service";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from "../components/ui";
import { formatCrmDate, formatCrmDateTime } from "../lib/format";
import { cn } from "../lib/cn";

const FILTERS: Array<{ value: RenewalFilter; label: string }> = [
  { value: "all", label: "All renewals" },
  { value: "overdue", label: "Overdue" },
  { value: "due_soon", label: "Due in 7 days" },
  { value: "next_30", label: "Next 30 days" },
  { value: "upcoming", label: "All upcoming" },
];

const RENEWAL_STATUS: Record<
  RenewalStatus,
  { label: string; variant: "danger" | "warning" | "info" }
> = {
  overdue: { label: "Overdue", variant: "danger" },
  due_soon: { label: "Due soon", variant: "warning" },
  upcoming: { label: "Upcoming", variant: "info" },
};

const REMINDER_STATUS: Record<
  RenewalReminderStatus,
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  sent: { label: "Sent", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  failed: { label: "Failed", variant: "danger" },
};

function RenewalRow({ renewal }: { renewal: CustomerRenewalDto }) {
  const reminder = REMINDER_STATUS[renewal.reminderStatus];
  const schedule = RENEWAL_STATUS[renewal.status];

  return (
    <tr className="transition-colors hover:bg-slate-50/80">
      <td className="px-4 py-3">
        <Link
          to={`/customers/${renewal.customerId}`}
          className="block max-w-[18rem]"
        >
          <span className="block truncate font-medium text-slate-900 hover:text-brand-700">
            {renewal.businessName ?? renewal.customerName}
          </span>
          <span className="mt-0.5 block text-xs text-slate-400">
            {renewal.customerNumber}
          </span>
        </Link>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-700">{renewal.serviceName}</p>
        {renewal.assignedToName ? (
          <p className="mt-0.5 text-xs text-slate-400">
            {renewal.assignedToName}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <p className="text-slate-700">{formatCrmDate(renewal.renewalOn)}</p>
        <Badge variant={schedule.variant} className="mt-1">
          {renewal.status === "overdue"
            ? `${Math.abs(renewal.daysUntilRenewal)} days overdue`
            : renewal.daysUntilRenewal === 0
              ? "Due today"
              : `${renewal.daysUntilRenewal} days`}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant={reminder.variant}>{reminder.label}</Badge>
        {renewal.reminderSentAt ? (
          <p className="mt-1 text-xs text-slate-400">
            {formatCrmDateTime(renewal.reminderSentAt)}
          </p>
        ) : renewal.reminderStatus === "failed" ? (
          <p className="mt-1 max-w-xs text-xs text-rose-600">
            {renewal.reminderError ?? "Delivery failed"}
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">
            Awaiting scheduled reminder
          </p>
        )}
      </td>
    </tr>
  );
}

export function CustomerRenewalsPage() {
  const [filter, setFilter] = useState<RenewalFilter>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const renewalsQuery = useQuery({
    queryKey: ["customers", "renewals", filter, page, pageSize],
    queryFn: () =>
      customersService.listRenewals({ filter, page, pageSize }),
  });

  const data = renewalsQuery.data;
  const items = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Renewal reminders"
        description="Reminder delivery status for every active customer service with a renewal date. Archived customers are excluded."
      />

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setFilter(option.value);
              setPage(1);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              filter === option.value
                ? "bg-brand-50 text-brand-800"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {data ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Renewals listed", value: data.counts.total },
            { label: "Overdue", value: data.counts.overdue },
            { label: "Due in 7 days", value: data.counts.dueSoon },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardBody className="py-3">
                <p className="text-xl font-semibold text-slate-900">
                  {stat.value}
                </p>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {stat.label}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        {renewalsQuery.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : renewalsQuery.isError || !data ? (
          <ErrorState
            title="Unable to load renewal reminders"
            message="Please check your connection and try again."
            onRetry={() => void renewalsQuery.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
            title="No renewals found"
            description="Services with a renewal date will appear here with their reminder delivery status."
            action={
              filter !== "all" ? (
                <Button variant="outline" onClick={() => setFilter("all")}>
                  Show all renewals
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Service
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Renewal
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Reminder status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((renewal) => (
                    <RenewalRow key={renewal.serviceId} renewal={renewal} />
                  ))}
                </tbody>
              </table>
            </div>
            {pagination && pagination.totalPages > 1 ? (
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.total}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
