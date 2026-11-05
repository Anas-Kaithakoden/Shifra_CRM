import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus, UserRound, Users } from "lucide-react";
import {
  CUSTOMER_QUICK_FILTER_LABELS,
  CUSTOMER_STATUSES,
  type CustomerQuickFilter,
  type CustomerSortField,
  type CustomerStatus,
} from "../../shared/constants/customers";
import { PERMISSIONS } from "../../shared/types/permissions";
import { useAuth } from "../hooks/useAuth";
import { useDebounce } from "../hooks/useDebounce";
import { hasPermission } from "../lib/permissions";
import { customersService } from "../services/customers.service";
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
  CustomerForm,
  CustomerTable,
  CustomerToolbar,
  type CustomerFilterValues,
} from "../components/customers";
import { cn } from "../lib/cn";

const TABS: CustomerQuickFilter[] = ["all", "active", "inactive", "archived"];

function isStatus(value: string | null): value is CustomerStatus {
  return Boolean(
    value && (CUSTOMER_STATUSES as readonly string[]).includes(value),
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-44" />
            <Skeleton className="h-3 w-60" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

const DEFAULT_FILTERS: CustomerFilterValues = {
  type: "",
  assignedTo: "",
  sortBy: "created_at",
  sortDir: "desc",
};

export function CustomersPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CustomerFilterValues>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const rawStatus = searchParams.get("status");
  const status = isStatus(rawStatus) ? rawStatus : undefined;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, status]);

  const canCreate = hasPermission(user, PERMISSIONS.CUSTOMERS_CREATE);
  const canAssign = hasPermission(user, PERMISSIONS.CUSTOMERS_ASSIGN);

  const usersQuery = useQuery({
    queryKey: ["users", "customer-assignees"],
    queryFn: () =>
      usersService.list({ page: 1, pageSize: 100, status: "active" }),
    enabled: canAssign,
  });

  const customersQuery = useQuery({
    queryKey: ["customers", "list", debouncedSearch, filters, status, page],
    queryFn: () =>
      customersService.list({
        page,
        pageSize: 20,
        search: debouncedSearch.trim() || undefined,
        status,
        type: filters.type || undefined,
        assignedTo: filters.assignedTo || undefined,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
      }),
    placeholderData: keepPreviousData,
  });

  const setStatus = (next: CustomerQuickFilter) => {
    const params = new URLSearchParams(searchParams);
    if (next === "all") {
      params.delete("status");
    } else {
      params.set("status", next);
    }
    setSearchParams(params, { replace: true });
  };

  const updateFilters = (patch: Partial<CustomerFilterValues>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  const clearFilters = () => {
    setSearch("");
    setFilters(DEFAULT_FILTERS);
  };

  const hasFilters = Boolean(
    search ||
      filters.type ||
      filters.assignedTo ||
      filters.sortBy !== "created_at" ||
      filters.sortDir !== "desc",
  );

  const handleSort = (field: CustomerSortField) => {
    setFilters((current) =>
      current.sortBy === field
        ? {
            ...current,
            sortDir: current.sortDir === "asc" ? "desc" : "asc",
          }
        : { ...current, sortBy: field, sortDir: "desc" },
    );
    setPage(1);
  };

  const items = customersQuery.data?.items ?? [];
  const pagination = customersQuery.data?.pagination;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description="A single record for every customer, with contacts, enquiries, won purchases and activity history."
        actions={
          canCreate ? (
            <Button
              onClick={() => setCreateOpen(true)}
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              New customer
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatus(tab)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              (tab === "all" && !status) || tab === status
                ? "bg-brand-50 text-brand-800"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            {CUSTOMER_QUICK_FILTER_LABELS[tab]}
          </button>
        ))}
      </div>

      <Card>
        <CustomerToolbar
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={updateFilters}
          users={usersQuery.data?.items ?? []}
          canAssign={canAssign}
          hasFilters={hasFilters}
          onClear={clearFilters}
        />

        {customersQuery.isLoading ? (
          <ListSkeleton />
        ) : customersQuery.isError ? (
          <ErrorState
            title="Unable to load customers"
            message="Please try again. Your access may have changed."
            onRetry={() => {
              void customersQuery.refetch();
            }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            title={
              hasFilters || status
                ? "No customers match these filters"
                : "No customers yet"
            }
            description={
              hasFilters || status
                ? "Try clearing filters or choosing a different customer status."
                : "Create the first customer record to start tracking enquiries, contacts and purchases."
            }
            action={
              hasFilters || status ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setStatus("all");
                    clearFilters();
                  }}
                >
                  Clear filters
                </Button>
              ) : canCreate ? (
                <Button
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  leftIcon={<UserRound className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Create customer
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <CustomerTable
              customers={items}
              sortBy={filters.sortBy}
              sortDir={filters.sortDir}
              onSort={handleSort}
            />
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

      <CustomerForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
