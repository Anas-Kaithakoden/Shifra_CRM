import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  Repeat,
  RotateCcw,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { TaskDto } from "../../../shared/types/tasks";
import { formatCrmDateTime } from "../../lib/format";
import { tasksService } from "../../services/tasks.service";
import { Avatar, Button, Modal, Skeleton } from "../ui";
import { TaskPriorityBadge } from "./TaskPriorityBadge";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskTypeBadge } from "./TaskTypeBadge";

export function TaskDetail({
  task,
  open,
  onClose,
  onEdit,
  onComplete,
  onReopen,
  onCancel,
  onReschedule,
}: {
  task: TaskDto | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (task: TaskDto) => void;
  onComplete?: (task: TaskDto) => void;
  onReopen?: (task: TaskDto) => void;
  onCancel?: (task: TaskDto) => void;
  onReschedule?: (task: TaskDto) => void;
}) {
  if (!task || !open) return null;

  const activitiesQuery = useQuery({
    queryKey: ["task-activities", task.id],
    queryFn: () => tasksService.getActivities(task.id),
    enabled: open && Boolean(task.id),
  });

  const isCompleted = task.status === "completed";
  const isCancelled = task.status === "cancelled";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${task.taskNumber} · ${task.title}`}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>

          <div className="flex items-center gap-2">
            {onEdit && !isCancelled ? (
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onEdit(task);
                }}
              >
                Edit
              </Button>
            ) : null}

            {onReschedule && !isCompleted && !isCancelled ? (
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onReschedule(task);
                }}
              >
                <Clock className="h-4 w-4" />
                Reschedule
              </Button>
            ) : null}

            {onCancel && !isCancelled && !isCompleted ? (
              <Button
                variant="danger"
                onClick={() => {
                  onClose();
                  onCancel(task);
                }}
              >
                Cancel Task
              </Button>
            ) : null}

            {onReopen && isCompleted ? (
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  onReopen(task);
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Reopen Task
              </Button>
            ) : null}

            {onComplete && !isCompleted && !isCancelled ? (
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  onComplete(task);
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark Completed
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Badges bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <TaskStatusBadge status={task.status} isOverdue={task.isOverdue} />
          <TaskPriorityBadge priority={task.priority} />
          <TaskTypeBadge type={task.taskType} />

          {task.reminderEnabled ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              <Bell className="h-3.5 w-3.5" />
              Telegram Reminder ({task.reminderMinutesBefore ?? 0}m before)
            </span>
          ) : null}

          {task.recurrenceType ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              <Repeat className="h-3.5 w-3.5" />
              Repeats {task.recurrenceType}
            </span>
          ) : null}
        </div>

        {/* Description */}
        {task.description ? (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Description
            </h4>
            <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-lg bg-slate-50 p-3">
              {task.description}
            </p>
          </div>
        ) : null}

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Due Date & Time
            </p>
            <p
              className={`mt-1 text-sm font-semibold ${
                task.isOverdue && !isCompleted && !isCancelled
                  ? "text-rose-600"
                  : "text-slate-800"
              }`}
            >
              {task.dueAt ? formatCrmDateTime(task.dueAt) : "Not set"}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Assigned To
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              {task.assignedUser ? (
                <>
                  <Avatar name={task.assignedUser.fullName} size="sm" />
                  <span className="text-sm font-medium text-slate-800">
                    {task.assignedUser.fullName}
                  </span>
                </>
              ) : (
                <span className="text-sm text-slate-400">Unassigned</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Created By
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {task.createdByUser?.fullName ?? "System"}
            </p>
          </div>

          {task.lead ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Linked Lead
              </p>
              <Link
                to={`/leads/${task.lead.id}`}
                className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-800"
              >
                {task.lead.name}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          ) : null}

          {task.customer ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Linked Customer
              </p>
              <Link
                to={`/customers/${task.customer.id}`}
                className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-800"
              >
                {task.customer.name}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          ) : null}

          {task.reminderStatus && task.reminderEnabled ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Reminder Status
              </p>
              <p className="mt-1 text-sm capitalize text-slate-700">
                {task.reminderStatus}
                {task.reminderSentAt
                  ? ` (sent ${formatCrmDateTime(task.reminderSentAt)})`
                  : ""}
              </p>
            </div>
          ) : null}
        </div>

        {/* History / Activities */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-slate-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              History & Rescheduling Timeline
            </h4>
          </div>

          {activitiesQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : (activitiesQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 italic">No activity records yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
              {(activitiesQuery.data ?? []).map((act) => (
                <div key={act.id} className="p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-semibold text-slate-800">
                      {act.title}
                    </span>
                    <span>{formatCrmDateTime(act.createdAt)}</span>
                  </div>
                  {act.description ? (
                    <p className="text-slate-600">{act.description}</p>
                  ) : null}
                  {act.user ? (
                    <p className="text-[11px] text-slate-400">
                      Actor: {act.user.fullName}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
