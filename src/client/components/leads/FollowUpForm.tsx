import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PERMISSIONS } from "../../../shared/types/permissions";
import type { LeadFollowUpDto } from "../../../shared/types/leads";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api";
import {
  defaultFollowUpDateTimeValue,
  fromDateTimeInputValue,
} from "../../lib/format";
import { hasPermission } from "../../lib/permissions";
import { usersService } from "../../services/users.service";
import { leadsService } from "../../services/leads.service";
import { Button, Input, Modal, Select, Textarea } from "../ui";

export function FollowUpForm({
  open,
  onClose,
  leadId,
  defaultAssignedTo,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  leadId: string;
  defaultAssignedTo?: string | null;
  onCreated?: (followUp: LeadFollowUpDto) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("Follow up with lead");
  const [notes, setNotes] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultFollowUpDateTimeValue);
  const [assignedTo, setAssignedTo] = useState(defaultAssignedTo ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const canAssign = hasPermission(user, PERMISSIONS.LEADS_ASSIGN);

  const usersQuery = useQuery({
    queryKey: ["users", "lead-assignees"],
    queryFn: () => usersService.list({ page: 1, pageSize: 100, status: "active" }),
    enabled: open && canAssign,
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle("Follow up with lead");
    setNotes("");
    setScheduledAt(defaultFollowUpDateTimeValue());
    setAssignedTo(defaultAssignedTo ?? "");
    setFieldErrors({});
    setFormError(null);
  }, [open, defaultAssignedTo]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!title.trim()) {
      errors.title = "Enter a follow-up title.";
    }
    const date = new Date(scheduledAt);
    if (!scheduledAt || Number.isNaN(date.getTime())) {
      errors.scheduledAt = "Choose a valid date and time.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const created = await leadsService.createFollowUp(leadId, {
        title: title.trim(),
        notes: notes.trim() || undefined,
        scheduledAt: fromDateTimeInputValue(scheduledAt),
        assignedTo: canAssign && assignedTo ? assignedTo : undefined,
      });
      toast({ title: "Follow-up scheduled", variant: "success" });
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onCreated?.(created);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        return;
      }
      setFormError("Unable to schedule the follow-up. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule follow-up"
      description="Set a reminder for the next step with this lead."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="follow-up-form"
            isLoading={isSaving}
          >
            Schedule follow-up
          </Button>
        </>
      }
    >
      <form
        id="follow-up-form"
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
          onChange={(event) => setTitle(event.target.value)}
          error={fieldErrors.title}
          required
        />
        <Input
          label="Date and time"
          type="datetime-local"
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
          error={fieldErrors.scheduledAt}
          required
        />
        {canAssign ? (
          <Select
            label="Assigned to"
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
          >
            <option value="">Use the lead owner</option>
            {(usersQuery.data?.items ?? []).map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
              </option>
            ))}
          </Select>
        ) : null}
        <Textarea
          label="Notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          hint="Optional context for whoever completes the follow-up."
        />
      </form>
    </Modal>
  );
}
