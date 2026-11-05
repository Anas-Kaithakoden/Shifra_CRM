import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { REMINDER_MINUTES_OPTIONS } from "../../../shared/constants/tasks";
import { PERMISSIONS } from "../../../shared/types/permissions";
import type { TaskDto } from "../../../shared/types/tasks";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api";
import {
  defaultFollowUpDateTimeValue,
  fromDateTimeInputValue,
} from "../../lib/format";
import { hasPermission } from "../../lib/permissions";
import { tasksService } from "../../services/tasks.service";
import { usersService } from "../../services/users.service";
import { Button, Input, Modal, Select, Textarea } from "../ui";

export function FollowUpForm({
  open,
  onClose,
  leadId,
  customerId,
  defaultTitle = "Follow up with client",
  defaultAssignedTo,
  onScheduled,
}: {
  open: boolean;
  onClose: () => void;
  leadId?: string | null;
  customerId?: string | null;
  defaultTitle?: string;
  defaultAssignedTo?: string | null;
  onScheduled?: (task: TaskDto) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState(defaultFollowUpDateTimeValue);
  const [assignedTo, setAssignedTo] = useState(defaultAssignedTo ?? "");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(15);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canAssign = hasPermission(user, PERMISSIONS.TASKS_ASSIGN);

  const usersQuery = useQuery({
    queryKey: ["users", "follow-up-assignees"],
    queryFn: () => usersService.list({ page: 1, pageSize: 100, status: "active" }),
    enabled: open && canAssign,
  });

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setDescription("");
    setDueAt(defaultFollowUpDateTimeValue());
    setAssignedTo(defaultAssignedTo ?? user?.id ?? "");
    setReminderEnabled(true);
    setReminderMinutesBefore(15);
    setFieldErrors({});
    setFormError(null);
  }, [open, defaultTitle, defaultAssignedTo, user?.id]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!title.trim()) {
      errors.title = "Enter a follow-up title.";
    }
    if (!dueAt || Number.isNaN(new Date(dueAt).getTime())) {
      errors.dueAt = "Choose a valid date and time.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const created = await tasksService.create({
        title: title.trim(),
        description: description.trim() || undefined,
        taskType: "follow_up",
        priority: "high",
        dueAt: fromDateTimeInputValue(dueAt),
        assignedTo: canAssign && assignedTo ? assignedTo : user?.id,
        leadId: leadId ?? null,
        customerId: customerId ?? null,
        reminderEnabled,
        reminderMinutesBefore: reminderEnabled ? reminderMinutesBefore : null,
      });

      toast({ title: "Follow-up scheduled", variant: "success" });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      onScheduled?.(created);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError("Unable to schedule the follow-up. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule follow-up"
      description="Set a date, assignee, and reminder for the next interaction."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form="follow-up-task-form" isLoading={isSaving}>
            Schedule follow-up
          </Button>
        </>
      }
    >
      <form
        id="follow-up-task-form"
        onSubmit={handleSubmit}
        className="space-y-4"
        noValidate
      >
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
        />

        <Input
          label="Date and time"
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          error={fieldErrors.dueAt}
          required
        />

        {canAssign ? (
          <Select
            label="Assigned to"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            <option value="">Use current account</option>
            {(usersQuery.data?.items ?? []).map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName} ({member.role})
              </option>
            ))}
          </Select>
        ) : null}

        <Textarea
          label="Notes / Agenda"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Topics to discuss, client questions, or background notes..."
        />

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <span className="text-xs font-medium text-slate-800">
              Send Telegram reminder
            </span>
          </label>

          {reminderEnabled ? (
            <div className="pl-6">
              <Select
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
      </form>
    </Modal>
  );
}
