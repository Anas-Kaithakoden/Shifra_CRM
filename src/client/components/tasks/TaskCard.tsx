import { Bell, CheckCircle2, Clock, Repeat } from "lucide-react";
import { Link } from "react-router-dom";
import type { TaskDto } from "../../../shared/types/tasks";
import { formatCrmDateTime } from "../../lib/format";
import { Avatar } from "../ui";
import { TaskPriorityBadge } from "./TaskPriorityBadge";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskTypeBadge } from "./TaskTypeBadge";

export function TaskCard({
  task,
  onSelect,
  onComplete,
}: {
  task: TaskDto;
  onSelect?: (task: TaskDto) => void;
  onComplete?: (task: TaskDto) => void;
}) {
  const isCompleted = task.status === "completed";
  const isCancelled = task.status === "cancelled";

  return (
    <div
      onClick={() => onSelect?.(task)}
      className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-brand-300 hover:shadow-md cursor-pointer"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {task.taskNumber}
          </span>
          <div className="flex items-center gap-1.5">
            <TaskPriorityBadge priority={task.priority} />
            <TaskStatusBadge status={task.status} isOverdue={task.isOverdue} />
          </div>
        </div>

        <div className="flex items-start gap-2">
          {onComplete && !isCancelled ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onComplete(task);
              }}
              title={isCompleted ? "Completed" : "Mark as completed"}
              className={`mt-0.5 rounded transition-colors ${
                isCompleted
                  ? "text-emerald-600"
                  : "text-slate-300 hover:text-emerald-600"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          ) : null}

          <div className="min-w-0 flex-1">
            <h4
              className={`text-sm font-semibold text-slate-900 group-hover:text-brand-700 transition-colors line-clamp-2 ${
                isCompleted ? "line-through text-slate-400" : ""
              }`}
            >
              {task.title}
            </h4>

            {task.description ? (
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                {task.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <TaskTypeBadge type={task.taskType} />

          {task.lead ? (
            <Link
              to={`/leads/${task.lead.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              Lead: {task.lead.name}
            </Link>
          ) : null}

          {task.customer ? (
            <Link
              to={`/customers/${task.customer.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800 hover:bg-blue-100"
            >
              Customer: {task.customer.name}
            </Link>
          ) : null}

          {task.recurrenceType ? (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600"
              title={`Repeats ${task.recurrenceType}`}
            >
              <Repeat className="h-3 w-3" />
              {task.recurrenceType}
            </span>
          ) : null}

          {task.reminderEnabled ? (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700"
              title={`Telegram reminder active (${task.reminderMinutesBefore ?? 0}m before)`}
            >
              <Bell className="h-3 w-3" />
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
        <div className="flex items-center gap-1.5 min-w-0">
          {task.dueAt ? (
            <span
              className={`flex items-center gap-1 font-medium ${
                task.isOverdue && !isCompleted && !isCancelled
                  ? "text-rose-600"
                  : "text-slate-600"
              }`}
              title={`Due: ${formatCrmDateTime(task.dueAt)}`}
            >
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{formatCrmDateTime(task.dueAt)}</span>
            </span>
          ) : (
            <span className="text-slate-400">No due date</span>
          )}
        </div>

        {task.assignedUser ? (
          <div
            className="flex items-center gap-1 shrink-0 ml-2"
            title={`Assigned to ${task.assignedUser.fullName}`}
          >
            <Avatar name={task.assignedUser.fullName} size="sm" />
            <span className="truncate max-w-[80px] hidden sm:inline">
              {task.assignedUser.fullName.split(" ")[0]}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
