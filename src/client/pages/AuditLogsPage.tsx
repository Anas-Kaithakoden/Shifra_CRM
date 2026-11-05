import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import type { AuditLogDto } from "../../shared/types/api";
import { AUDIT_ACTION_LABELS, auditActionLabel } from "../../shared/constants/audit";
import { auditService } from "../services/audit.service";
import { formatDateTime } from "../lib/format";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
} from "../components/ui";

const ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS).sort((a, b) =>
  a[1].localeCompare(b[1]),
);

function metadataSummary(log: AuditLogDto): string {
  const metadata = log.metadata;
  if (!metadata) {
    return "—";
  }
  if (typeof metadata.from === "string" && typeof metadata.to === "string") {
    return `${metadata.from} → ${metadata.to}`;
  }
  if (Array.isArray(metadata.fields)) {
    return metadata.fields.map(String).join(", ");
  }
  if (typeof metadata.reason === "string") {
    return metadata.reason.replace(/_/g, " ");
  }
  if (typeof metadata.role === "string") {
    return `Role: ${metadata.role}`;
  }
  return "—";
}

function targetLabel(log: AuditLogDto): string {
  const email = log.metadata?.email;
  if (typeof email === "string" && email) {
    return email;
  }
  if (log.entityType === "settings") {
    return "Application settings";
  }
  return log.entityId ?? "—";
}

function AuditSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const pageSize = 20;

  useEffect(() => {
    setPage(1);
  }, [action]);

  const logsQuery = useQuery({
    queryKey: ["audit-logs", { page, action }],
    queryFn: () =>
      auditService.list({
        page,
        pageSize,
        action: action || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (logsQuery.data && page > Math.max(1, logsQuery.data.pagination.totalPages)) {
      setPage(Math.max(1, logsQuery.data.pagination.totalPages));
    }
  }, [logsQuery.data, page]);

  const items = logsQuery.data?.items ?? [];
  const pagination = logsQuery.data?.pagination;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit logs"
        description="A chronological record of sign-ins, account changes and system settings. Owner access only."
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">Activity history</p>
            <p className="text-xs text-slate-500">
              Times are shown in your local timezone.
            </p>
          </div>
          <Select
            aria-label="Filter by action"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            containerClassName="sm:w-64"
          >
            <option value="">All actions</option>
            {ACTION_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {logsQuery.isLoading ? (
          <AuditSkeleton />
        ) : logsQuery.isError ? (
          <div className="p-4">
            <ErrorState
              title="Unable to load audit logs"
              message="Please check your connection and try again."
              onRetry={() => {
                void logsQuery.refetch();
              }}
            />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-5 w-5" aria-hidden="true" />}
            title="No audit entries found"
            description={
              action
                ? "No events match the selected action. Try a different filter."
                : "Account and system activity will appear here."
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Time
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Action
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Actor
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Target
                    </th>
                    <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">
                      Details
                    </th>
                    <th scope="col" className="hidden px-4 py-3 font-medium xl:table-cell">
                      IP address
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral">{auditActionLabel(log.action)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-700">
                          {log.actor?.fullName ?? "System"}
                        </p>
                        {log.actor ? (
                          <p className="text-xs text-slate-400">{log.actor.email}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <span className="block max-w-56 truncate" title={targetLabel(log)}>
                          {targetLabel(log)}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-xs capitalize text-slate-500 lg:table-cell">
                        {metadataSummary(log)}
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-slate-400 xl:table-cell">
                        {log.ipAddress ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {items.map((log) => (
                <li key={log.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant="neutral">{auditActionLabel(log.action)}</Badge>
                    <time
                      dateTime={log.createdAt}
                      className="shrink-0 text-xs text-slate-400"
                    >
                      {formatDateTime(log.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-700">
                    {log.actor?.fullName ?? "System"}
                  </p>
                  <p className="text-xs text-slate-500">{targetLabel(log)}</p>
                  {metadataSummary(log) !== "—" ? (
                    <p className="mt-1 text-xs capitalize text-slate-400">
                      {metadataSummary(log)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>

            {pagination ? (
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

      <p className="text-xs text-slate-400">
        Audit entries are retained in the database and are not editable from the
        CRM.
      </p>
    </div>
  );
}
