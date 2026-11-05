import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  CUSTOMER_SORT_FIELDS,
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
  type CustomerSortField,
  type CustomerType,
} from "../../../shared/constants/customers";
import type { UserDto } from "../../../shared/types/api";
import { Button, Input, Select } from "../ui";

const SORT_LABELS: Record<CustomerSortField, string> = {
  created_at: "Newest first",
  updated_at: "Recently updated",
  name: "Name",
  customer_number: "Customer number",
};

export interface CustomerFilterValues {
  type: CustomerType | "";
  assignedTo: string;
  sortBy: CustomerSortField;
  sortDir: "asc" | "desc";
}

export function CustomerToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  users,
  canAssign,
  hasFilters,
  onClear,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  filters: CustomerFilterValues;
  onFiltersChange: (patch: Partial<CustomerFilterValues>) => void;
  users: UserDto[];
  canAssign: boolean;
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center">
      <Input
        aria-label="Search customers"
        placeholder="Search name, number, phone, email or city"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        leadingIcon={<Search className="h-4 w-4" aria-hidden="true" />}
        trailing={
          search ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : undefined
        }
        containerClassName="lg:max-w-sm"
      />

      <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
        <span className="hidden items-center gap-1 text-xs font-medium text-slate-400 sm:flex">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Filters
        </span>
        <Select
          aria-label="Filter by customer type"
          value={filters.type}
          onChange={(event) =>
            onFiltersChange({
              type: event.target.value as CustomerType | "",
            })
          }
          containerClassName="w-auto"
          className="h-9 min-w-32"
        >
          <option value="">All types</option>
          {CUSTOMER_TYPES.map((type) => (
            <option key={type} value={type}>
              {CUSTOMER_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>

        {canAssign ? (
          <Select
            aria-label="Filter by assigned employee"
            value={filters.assignedTo}
            onChange={(event) =>
              onFiltersChange({ assignedTo: event.target.value })
            }
            containerClassName="w-auto"
            className="h-9 min-w-36"
          >
            <option value="">All owners</option>
            {users.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </Select>
        ) : null}

        <Select
          aria-label="Sort customers"
          value={`${filters.sortBy}:${filters.sortDir}`}
          onChange={(event) => {
            const [sortBy, sortDir] = event.target.value.split(":");
            onFiltersChange({
              sortBy: sortBy as CustomerSortField,
              sortDir: sortDir as "asc" | "desc",
            });
          }}
          containerClassName="w-auto"
          className="h-9 min-w-40"
        >
          {CUSTOMER_SORT_FIELDS.map((field) => (
            <option key={field} value={`${field}:desc`}>
              {SORT_LABELS[field]} ↓
            </option>
          ))}
          {CUSTOMER_SORT_FIELDS.map((field) => (
            <option key={`${field}:asc`} value={`${field}:asc`}>
              {SORT_LABELS[field]} ↑
            </option>
          ))}
        </Select>

        {hasFilters ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            leftIcon={<X className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
