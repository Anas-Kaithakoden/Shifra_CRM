import {
  CheckCircle2,
  Clock,
  ExternalLink,
  MoreVertical,
  Repeat,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { TaskDto } from "../../../shared/types/tasks";
import { formatCrmDateTime } from "../../lib/format";
import { Avatar, EmptyState, Pagination } from "../ui";
import { TaskPriorityBadge } from "./TaskPriorityBadge";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskTypeBadge } from "./TaskTypeBadge";

export function TaskTable({
  tasks = [],
  total = 0,
  page = 1,
  pageSize = 20,
  onPageChange,
  onSelectTask,
  onCompleteTask,
  onReopenTask,
  onCancelTask,
  onRescheduleTask,
  onEditTask,
}: {
  tasks: TaskDto[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onSelectTask: (task: TaskDto) => void;
  onCompleteTask?: (task: TaskDto) => void;
  onReopenTask?: (task: TaskDto) => void;
  onCancelTask?: (task: TaskDto) => void;
  onRescheduleTask?: (task: TaskDto) => void;
  onEditTask?: (task: TaskDto) => void;
}) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No tasks found"
        description="There are no tasks matching your current view or filters."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="w-10 px-4 py-3 text-center">
                  <span className="sr-only">Status</span>
                </th>
                <th scope="col" className="px-4 py-3">
                  Task
                </th>
                <th scope="col" className="px-4 py-3">
                  Type & Priority
                </th>
                <th scope="col" className="px-4 py-3">
                  Linked Record
                </th>
                <th scope="col" className="px-4 py-3">
                  Assignee
                </th>
                <th scope="col" className="px-4 py-3">
                  Due Date
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="w-14 px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((task) => {
                const isCompleted = task.status === "completed";
                const isCancelled = task.status === "cancelled";
                const menuOpen = activeMenuId === task.id;

                return (
                  <tr
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td
                      className="px-4 py-3.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {onCompleteTask && !isCancelled ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (isCompleted && onReopenTask) {
                              onReopenTask(task);
                            } else if (!isCompleted && onCompleteTask) {
                              onCompleteTask(task);
                            }
                          }}
                          title={
                            isCompleted
                              ? "Completed (click to reopen)"
                              : "Click to complete"
                          }
                          className={`rounded p-1 transition-colors ${
                            isCompleted
                              ? "text-emerald-600 hover:text-slate-400"
                              : "text-slate-300 hover:text-emerald-600"
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>

                    <td className="px-4 py-3.5 max-w-xs sm:max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          {task.taskNumber}
                        </span>
                        <span
                          className={`font-medium truncate ${
                            isCompleted
                              ? "line-through text-slate-400"
                              : "text-slate-900"
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.recurrenceType ? (
                          <span title={`Repeats ${task.recurrenceType}`} aria-label={`Repeats ${task.recurrenceType}`}>
                            <Repeat className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                          </span>
                        ) : null}
                      </div>
                      {task.description ? (
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                          {task.description}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <TaskTypeBadge type={task.taskType} />
                        <TaskPriorityBadge priority={task.priority} />
                      </div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {task.lead ? (
                        <Link
                          to={`/leads/${task.lead.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md"
                        >
                          Lead: {task.lead.name}
                        </Link>
                      ) : task.customer ? (
                        <Link
                          to={`/customers/${task.customer.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md"
                        >
                          Customer: {task.customer.name}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {task.assignedUser ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={task.assignedUser.fullName} size="sm" />
                          <span className="text-xs text-slate-700">
                            {task.assignedUser.fullName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Unassigned</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {task.dueAt ? (
                        <span
                          className={`text-xs font-medium ${
                            task.isOverdue && !isCompleted && !isCancelled
                              ? "text-rose-600 font-semibold"
                              : "text-slate-700"
                          }`}
                        >
                          {formatCrmDateTime(task.dueAt)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <TaskStatusBadge
                        status={task.status}
                        isOverdue={task.isOverdue}
                      />
                    </td>

                    <td
                      className="px-4 py-3.5 text-right whitespace-nowrap relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuId(menuOpen ? null : task.id)
                        }
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {menuOpen ? (
                        <div className="absolute right-4 top-10 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onSelectTask(task);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-50"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View details
                          </button>

                          {onEditTask && !isCancelled ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onEditTask(task);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-50"
                            >
                              Edit task
                            </button>
                          ) : null}

                          {onRescheduleTask && !isCompleted && !isCancelled ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onRescheduleTask(task);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-50"
                            >
                              <Clock className="h-3.5 w-3.5" />
                              Reschedule
                            </button>
                          ) : null}

                          {onCompleteTask && !isCompleted && !isCancelled ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onCompleteTask(task);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-emerald-700 hover:bg-emerald-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Mark completed
                            </button>
                          ) : null}

                          {onReopenTask && isCompleted ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onReopenTask(task);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-blue-700 hover:bg-blue-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Reopen task
                            </button>
                          ) : null}

                          {onCancelTask && !isCancelled && !isCompleted ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onCancelTask(task);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-rose-700 hover:bg-rose-50"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Cancel task
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {total > pageSize ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={Math.max(1, Math.ceil(total / pageSize))}
          onPageChange={onPageChange}
        />
      ) : null}
    </div>
  );
}
