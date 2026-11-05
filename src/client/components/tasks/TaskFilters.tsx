import { LayoutGrid, RotateCcw, Search, Table as TableIcon } from "lucide-react";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_TYPES,
  TASK_TYPE_LABELS,
} from "../../../shared/constants/tasks";
import type { UserDto } from "../../../shared/types/api";

export interface TaskFilterValues {
  search: string;
  status: string;
  priority: string;
  taskType: string;
  assignedTo: string;
}

export function TaskFilters({
  values,
  onChange,
  onReset,
  users = [],
  viewMode,
  onViewModeChange,
}: {
  values: TaskFilterValues;
  onChange: (patch: Partial<TaskFilterValues>) => void;
  onReset: () => void;
  users?: UserDto[];
  viewMode?: "table" | "board";
  onViewModeChange?: (mode: "table" | "board") => void;
}) {
  const hasActiveFilters = Boolean(
    values.search ||
      values.status ||
      values.priority ||
      values.taskType ||
      values.assignedTo,
  );

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search tasks by title, number, or notes..."
            value={values.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {onViewModeChange && viewMode ? (
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => onViewModeChange("table")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Table view"
            >
              <TableIcon className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("board")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "board"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Kanban Board view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        <select
          value={values.status}
          onChange={(e) => onChange({ status: e.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="overdue">Overdue</option>
          {TASK_STATUSES.map((st) => (
            <option key={st} value={st}>
              {TASK_STATUS_LABELS[st]}
            </option>
          ))}
        </select>

        <select
          value={values.priority}
          onChange={(e) => onChange({ priority: e.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
        >
          <option value="">All Priorities</option>
          {TASK_PRIORITIES.map((pr) => (
            <option key={pr} value={pr}>
              {TASK_PRIORITY_LABELS[pr]}
            </option>
          ))}
        </select>

        <select
          value={values.taskType}
          onChange={(e) => onChange({ taskType: e.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
        >
          <option value="">All Types</option>
          {TASK_TYPES.map((tt) => (
            <option key={tt} value={tt}>
              {TASK_TYPE_LABELS[tt]}
            </option>
          ))}
        </select>

        <select
          value={values.assignedTo}
          onChange={(e) => onChange({ assignedTo: e.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
        >
          <option value="">All Assignees</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 col-span-2 sm:col-span-1"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}
