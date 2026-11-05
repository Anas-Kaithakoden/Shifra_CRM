import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import type {
  RecurrenceType,
  TaskPriority,
  TaskType,
} from "../../../shared/constants/tasks";
import {
  RECURRENCE_TYPES,
  RECURRENCE_TYPE_LABELS,
  REMINDER_MINUTES_OPTIONS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_TYPES,
  TASK_TYPE_LABELS,
} from "../../../shared/constants/tasks";
import { PERMISSIONS } from "../../../shared/types/permissions";
import type { TaskDto } from "../../../shared/types/tasks";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api";
import {
  defaultFollowUpDateTimeValue,
  fromDateTimeInputValue,
  toDateTimeInputValue,
} from "../../lib/format";
import { hasPermission } from "../../lib/permissions";
import { tasksService } from "../../services/tasks.service";
import { usersService } from "../../services/users.service";
import { Button, Input, Modal, Select, Textarea } from "../ui";

export function TaskForm({
  open,
  onClose,
  task,
  defaultLeadId,
  defaultCustomerId,
  defaultTaskType,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  task?: TaskDto | null;
  defaultLeadId?: string | null;
  defaultCustomerId?: string | null;
  defaultTaskType?: TaskType;
  onSaved?: (savedTask: TaskDto) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEdit = Boolean(task?.id);
  const canAssign = hasPermission(user, PERMISSIONS.TASKS_ASSIGN);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("internal");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number>(15);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("weekly");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndAt, setRecurrenceEndAt] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Users query for assignees
  const usersQuery = useQuery({
    queryKey: ["users", "active-assignees"],
    queryFn: () => usersService.list({ page: 1, pageSize: 100, status: "active" }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;

    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setTaskType(task.taskType);
      setPriority(task.priority);
      setAssignedTo(task.assignedTo ?? "");
      setDueAt(task.dueAt ? toDateTimeInputValue(task.dueAt) : "");
      setReminderEnabled(task.reminderEnabled);
      setReminderMinutesBefore(task.reminderMinutesBefore ?? 15);
      setRepeatEnabled(Boolean(task.recurrenceType));
      setRecurrenceType(task.recurrenceType ?? "weekly");
      setRecurrenceInterval(task.recurrenceInterval ?? 1);
      setRecurrenceEndAt(
        task.recurrenceEndAt ? toDateTimeInputValue(task.recurrenceEndAt) : "",
      );
    } else {
      setTitle("");
      setDescription("");
      setTaskType(defaultTaskType ?? "internal");
      setPriority("medium");
      setAssignedTo(user?.id ?? "");
      setDueAt(defaultFollowUpDateTimeValue());
      setReminderEnabled(false);
      setReminderMinutesBefore(15);
      setRepeatEnabled(false);
      setRecurrenceType("weekly");
      setRecurrenceInterval(1);
      setRecurrenceEndAt("");
    }

    setFormError(null);
    setFieldErrors({});
  }, [open, task, user?.id, defaultTaskType]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!title.trim()) {
      errors.title = "Enter a task title.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        taskType,
        priority,
        assignedTo: assignedTo ? assignedTo : user?.id,
        leadId: task?.leadId ?? defaultLeadId ?? null,
        customerId: task?.customerId ?? defaultCustomerId ?? null,
        dueAt: dueAt ? fromDateTimeInputValue(dueAt) : null,
        reminderEnabled,
        reminderMinutesBefore: reminderEnabled ? reminderMinutesBefore : null,
        recurrenceType: repeatEnabled ? recurrenceType : null,
        recurrenceInterval: repeatEnabled ? recurrenceInterval : null,
        recurrenceEndAt:
          repeatEnabled && recurrenceEndAt
            ? fromDateTimeInputValue(recurrenceEndAt)
            : null,
      };

      let result: TaskDto;
      if (isEdit && task) {
        result = await tasksService.update(task.id, payload as any);
        toast({ title: "Task updated", variant: "success" });
      } else {
        result = await tasksService.create(payload as any);
        toast({ title: "Task created", variant: "success" });
      }

      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });

      onSaved?.(result);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Unable to save task. Please verify all inputs.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit task" : "Create new task"}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" isLoading={isSaving}>
            {isEdit ? "Save changes" : "Create task"}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {formError}
          </div>
        ) : null}

        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={fieldErrors.title}
          required
          placeholder="e.g. Follow up on commercial proposal"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Task Type"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value as TaskType)}
          >
            {TASK_TYPES.map((type) => (
              <option key={type} value={type}>
                {TASK_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>

          <Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            {TASK_PRIORITIES.map((pr) => (
              <option key={pr} value={pr}>
                {TASK_PRIORITY_LABELS[pr]}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Due Date & Time"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />

          {canAssign ? (
            <Select
              label="Assignee"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value="">Unassigned</option>
              {(usersQuery.data?.items ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.role})
                </option>
              ))}
            </Select>
          ) : (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Assignee
              </label>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {user?.fullName} (Self)
              </p>
            </div>
          )}
        </div>

        <Textarea
          label="Description / Notes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Details or checklist items for this task..."
        />

        {/* Telegram Reminder */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm font-medium text-slate-800">
              Send Telegram reminder
            </span>
          </label>

          {reminderEnabled ? (
            <div className="pl-6">
              <Select
                label="Reminder timing"
                value={String(reminderMinutesBefore)}
                onChange={(e) =>
                  setReminderMinutesBefore(Number(e.target.value))
                }
              >
                {REMINDER_MINUTES_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>

        {/* Recurrence Settings */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={repeatEnabled}
              onChange={(e) => setRepeatEnabled(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm font-medium text-slate-800">
              Repeat this task automatically
            </span>
          </label>

          {repeatEnabled ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pl-6 pt-1">
              <Select
                label="Frequency"
                value={recurrenceType}
                onChange={(e) =>
                  setRecurrenceType(e.target.value as RecurrenceType)
                }
              >
                {RECURRENCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {RECURRENCE_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>

              <Input
                label="Interval"
                type="number"
                min={1}
                max={365}
                value={String(recurrenceInterval)}
                onChange={(e) =>
                  setRecurrenceInterval(Math.max(1, Number(e.target.value)))
                }
              />

              <Input
                label="End date (optional)"
                type="datetime-local"
                value={recurrenceEndAt}
                onChange={(e) => setRecurrenceEndAt(e.target.value)}
              />
            </div>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
