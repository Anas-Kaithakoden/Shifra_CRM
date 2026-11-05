import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus, Target } from "lucide-react";
import {
  LEAD_QUICK_FILTERS,
  LEAD_QUICK_FILTER_LABELS,
  type LeadQuickFilter,
} from "../../shared/constants/leads";
import { PERMISSIONS } from "../../shared/types/permissions";
import { useAuth } from "../hooks/useAuth";
import { useDebounce } from "../hooks/useDebounce";
import { hasPermission } from "../lib/permissions";
import { leadsService } from "../services/leads.service";
import { usersService } from "../services/users.service";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from "../components/ui";
import {
  LeadFilters,
  LeadForm,
  LeadSearch,
  LeadTable,
  type LeadFilterValues,
} from "../components/leads";
import { cn } from "../lib/cn";

const DEFAULT_FILTERS: LeadFilterValues = {
  pipelineStage: "",
  contactStatus: "",
  source: "",
  serviceInterest: "",
  priority: "",
  assignedTo: "",
  sortBy: "created_at",
  sortDir: "desc",
};

function ListSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function LeadsPage({
  initialQuickFilter = "all",
}: {
  initialQuickFilter?: LeadQuickFilter;
}) {
  const { user } = useAuth();
  const [quickFilter, setQuickFilter] =
    useState<LeadQuickFilter>(initialQuickFilter);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filters, setFilters] = useState<LeadFilterValues>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);

  const canCreate = hasPermission(user, PERMISSIONS.LEADS_CREATE);
  const canViewUsers = hasPermission(user, PERMISSIONS.USERS_READ);

  const usersQuery = useQuery({
    queryKey: ["users", "lead-assignees"],
    queryFn: () => usersService.list({ page: 1, pageSize: 100, status: "active" }),
    enabled: canViewUsers,
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, quickFilter, filters, pageSize]);

  useEffect(() => {
    setQuickFilter(initialQuickFilter);
  }, [initialQuickFilter]);

  const listQuery = useQuery({
    queryKey: [
      "leads",
      "list",
      {
        page,
        pageSize,
        search: debouncedSearch,
        quickFilter,
        filters,
      },
    ],
    queryFn: () =>
      leadsService.list({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        quickFilter,
        pipelineStage: filters.pipelineStage || undefined,
        contactStatus: filters.contactStatus || undefined,
        source: filters.source || undefined,
        serviceInterest: filters.serviceInterest || undefined,
        priority: filters.priority || undefined,
        assignedTo: filters.assignedTo || undefined,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
      }),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const totalPages = listQuery.data?.pagination.totalPages ?? 0;
    if (listQuery.data && page > Math.max(1, totalPages)) {
      setPage(Math.max(1, totalPages));
    }
  }, [listQuery.data, page]);

  const items = listQuery.data?.items ?? [];
  const pagination = listQuery.data?.pagination;
  const hasSearchOrFilters = Boolean(
    debouncedSearch ||
      filters.pipelineStage ||
      filters.contactStatus ||
      filters.source ||
      filters.serviceInterest ||
      filters.priority ||
      filters.assignedTo ||
      quickFilter !== "all",
  );

  const clearAll = () => {
    setSearch("");
    setQuickFilter("all");
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads"
        description="Capture, qualify and follow up on every enquiry in one place."
        actions={
          <>
            <select
              aria-label="Rows per page"
              value={String(pageSize)}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm"
            >
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
            </select>
            {canCreate ? (
              <Button
                onClick={() => setCreateOpen(true)}
                leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              >
                Add lead
              </Button>
            ) : null}
          </>
        }
      />

      <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1">
        {LEAD_QUICK_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setQuickFilter(filter)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              quickFilter === filter
                ? "border-brand-700 bg-brand-700 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50",
            )}
          >
            {LEAD_QUICK_FILTER_LABELS[filter]}
          </button>
        ))}
      </div>

      <Card>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="max-w-xl">
            <LeadSearch value={search} onChange={setSearch} />
          </div>
          <LeadFilters
            values={filters}
            onChange={(patch) =>
              setFilters((current) => ({ ...current, ...patch }))
            }
            onClear={() => setFilters(DEFAULT_FILTERS)}
            users={canViewUsers ? usersQuery.data?.items : undefined}
          />
        </div>

        {listQuery.isLoading ? (
          <ListSkeleton />
        ) : listQuery.isError ? (
          <div className="p-4">
            <ErrorState
              title="Unable to load leads"
              message="Please check your connection and try again."
              onRetry={() => {
                void listQuery.refetch();
              }}
            />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Target className="h-5 w-5" aria-hidden="true" />}
            title={
              hasSearchOrFilters ? "No leads match your filters" : "No leads yet"
            }
            description={
              hasSearchOrFilters
                ? "Try a different search term or clear the filters."
                : "Add your first enquiry to start tracking the pipeline."
            }
            action={
              hasSearchOrFilters ? (
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear filters
                </Button>
              ) : canCreate ? (
                <Button
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                >
                  Add lead
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <LeadTable leads={items} />
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
        {listQuery.isFetching && !listQuery.isLoading
          ? "Refreshing leads…"
          : "Lead changes, stage moves and follow-ups are recorded in the audit log."}
      </p>

      {canCreate ? (
        <LeadForm open={createOpen} onClose={() => setCreateOpen(false)} />
      ) : null}
    </div>
  );
}
