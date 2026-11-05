import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import {
  CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  LEAD_PRIORITIES,
  LEAD_PRIORITY_LABELS,
  LEAD_SOURCES,
  PIPELINE_STAGE_LABELS,
  type ContactStatus,
  type LeadPriority,
  type LeadSource,
} from "../../../shared/constants/leads";
import { SERVICE_CATEGORIES, OTHER_SERVICE } from "../../../shared/constants/services";
import { PERMISSIONS } from "../../../shared/types/permissions";
import type { DuplicateLeadDto, LeadDto } from "../../../shared/types/leads";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api";
import { fromDateTimeInputValue } from "../../lib/format";
import { hasPermission } from "../../lib/permissions";
import { usersService } from "../../services/users.service";
import { leadsService, type LeadCreateInput, type LeadUpdateInput } from "../../services/leads.service";
import {
  Button,
  Input,
  Modal,
  Select,
  Textarea,
} from "../ui";
import { StageBadge } from "./badges";

interface FormState {
  name: string;
  phone: string;
  email: string;
  businessName: string;
  location: string;
  serviceInterest: string;
  source: LeadSource;
  estimatedValue: string;
  priority: LeadPriority;
  assignedTo: string;
  contactStatus: ContactStatus;
  description: string;
  nextFollowUpAt: string;
}

function emptyState(lead?: LeadDto): FormState {
  return {
    name: lead?.name ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    businessName: lead?.businessName ?? "",
    location: lead?.location ?? "",
    serviceInterest: lead?.serviceInterest ?? "",
    source: lead?.source ?? "Website",
    estimatedValue:
      lead?.estimatedValue === null || lead?.estimatedValue === undefined
        ? ""
        : String(lead.estimatedValue),
    priority: lead?.priority ?? "medium",
    assignedTo: lead?.assignedTo ?? "",
    contactStatus: lead?.contactStatus ?? "not_contacted",
    description: lead?.description ?? "",
    nextFollowUpAt: "",
  };
}

function extractDuplicates(details: unknown): DuplicateLeadDto[] {
  if (
    details &&
    typeof details === "object" &&
    "duplicates" in details &&
    Array.isArray((details as { duplicates?: unknown }).duplicates)
  ) {
    return (details as { duplicates: DuplicateLeadDto[] }).duplicates;
  }
  return [];
}

function extractFieldErrors(details: unknown): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!Array.isArray(details)) {
    return errors;
  }
  for (const item of details) {
    if (item && typeof item === "object" && "path" in item && "message" in item) {
      const path = String((item as { path: unknown }).path);
      errors[path] = String((item as { message: unknown }).message);
    }
  }
  return errors;
}

export function LeadForm({
  open,
  onClose,
  lead,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  lead?: LeadDto;
  onSaved?: (lead: LeadDto) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => emptyState(lead));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateLeadDto[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const isEdit = Boolean(lead);
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
    setForm(emptyState(lead));
    setFieldErrors({});
    setFormError(null);
    setDuplicates([]);
  }, [open, lead]);

  const update = (patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const resetAndClose = () => {
    setDuplicates([]);
    setFormError(null);
    onClose();
  };

  const submit = async (allowDuplicate = false) => {
    setFormError(null);
    setFieldErrors({});
    const errors: Record<string, string> = {};

    if (!form.name.trim()) {
      errors.name = "Enter the lead's name.";
    }
    const digits = form.phone.replace(/\D/g, "");
    if (!form.phone.trim()) {
      errors.phone = "Enter a phone number.";
    } else if (digits.length < 7 || digits.length > 15) {
      errors.phone = "Enter a phone number with 7 to 15 digits.";
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (form.estimatedValue.trim()) {
      const value = Number(form.estimatedValue);
      if (!Number.isFinite(value) || value < 0) {
        errors.estimatedValue = "Enter a valid non-negative amount.";
      }
    }
    if (!isEdit && form.nextFollowUpAt) {
      const date = new Date(form.nextFollowUpAt);
      if (Number.isNaN(date.getTime())) {
        errors.nextFollowUpAt = "Choose a valid follow-up date and time.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const estimatedValue = form.estimatedValue.trim()
        ? Number(form.estimatedValue)
        : isEdit
          ? null
          : undefined;

      const trimmed = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        source: form.source,
        priority: form.priority,
        businessName: form.businessName.trim(),
        location: form.location.trim(),
        serviceInterest: form.serviceInterest,
        description: form.description.trim(),
        email: form.email.trim(),
      };

      let saved: LeadDto;
      if (isEdit && lead) {
        const input: LeadUpdateInput = {
          name: trimmed.name,
          phone: trimmed.phone,
          source: trimmed.source,
          priority: trimmed.priority,
          businessName: trimmed.businessName || null,
          location: trimmed.location || null,
          serviceInterest: trimmed.serviceInterest || null,
          description: trimmed.description || null,
          email: trimmed.email || null,
          estimatedValue: estimatedValue ?? null,
          contactStatus: form.contactStatus,
        };
        if (canAssign) {
          input.assignedTo = form.assignedTo || null;
        }
        saved = await leadsService.update(lead.id, input);
        toast({ title: "Lead updated", variant: "success" });
      } else {
        const input: LeadCreateInput = {
          name: trimmed.name,
          phone: trimmed.phone,
          source: trimmed.source,
          priority: trimmed.priority,
          businessName: trimmed.businessName || undefined,
          location: trimmed.location || undefined,
          serviceInterest: trimmed.serviceInterest || undefined,
          description: trimmed.description || undefined,
          email: trimmed.email || undefined,
          estimatedValue: estimatedValue ?? undefined,
          nextFollowUpAt: form.nextFollowUpAt
            ? fromDateTimeInputValue(form.nextFollowUpAt)
            : undefined,
          allowDuplicate,
        };
        if (canAssign && form.assignedTo) {
          input.assignedTo = form.assignedTo;
        }
        saved = await leadsService.create(input);
        toast({
          title: "Lead created",
          description: `${saved.name} was added to the pipeline.`,
          variant: "success",
        });
      }

      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "possible_duplicate") {
          setDuplicates(extractDuplicates(error.details));
          return;
        }
        const serverFieldErrors = extractFieldErrors(error.details);
        if (Object.keys(serverFieldErrors).length > 0) {
          setFieldErrors(serverFieldErrors);
          return;
        }
        setFormError(error.message);
        return;
      }
      setFormError("Unable to save the lead right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(false);
  };

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title={isEdit ? "Edit lead" : "Add lead"}
      description={
        isEdit
          ? "Update the lead's contact and qualification details."
          : "Capture a new enquiry and assign it to a team member."
      }
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={resetAndClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="lead-form"
            isLoading={isSaving}
            disabled={duplicates.length > 0}
          >
            {isEdit ? "Save changes" : "Create lead"}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {formError}
          </div>
        ) : null}

        {duplicates.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              A possible duplicate already exists
            </p>
            <p className="mt-1 text-amber-800">
              Review the existing lead before creating another. You can still
              create this lead if it is genuinely separate.
            </p>
            <ul className="mt-2 space-y-1.5">
              {duplicates.map((duplicate) => (
                <li key={duplicate.id} className="flex flex-wrap items-center gap-2">
                  {duplicate.canView ? (
                    <Link
                      to={`/leads/${duplicate.id}`}
                      target="_blank"
                      className="font-medium text-brand-800 underline"
                    >
                      {duplicate.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-slate-800">
                      {duplicate.name}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">
                    {duplicate.leadNumber} · {duplicate.phone}
                  </span>
                  <StageBadge stage={duplicate.pipelineStage} />
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDuplicates([])}
                disabled={isSaving}
              >
                Go back and edit
              </Button>
              <Button
                size="sm"
                isLoading={isSaving}
                onClick={() => {
                  void submit(true);
                }}
              >
                Create anyway
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            value={form.name}
            onChange={(event) => update({ name: event.target.value })}
            error={fieldErrors.name}
            required
          />
          <Input
            label="Phone number"
            value={form.phone}
            onChange={(event) => update({ phone: event.target.value })}
            placeholder="+91 98765 43210"
            error={fieldErrors.phone}
            required
          />
          <Input
            label="Email address"
            type="email"
            value={form.email}
            onChange={(event) => update({ email: event.target.value })}
            error={fieldErrors.email}
          />
          <Input
            label="Business name"
            value={form.businessName}
            onChange={(event) => update({ businessName: event.target.value })}
            error={fieldErrors.businessName}
          />
          <Input
            label="Location"
            value={form.location}
            onChange={(event) => update({ location: event.target.value })}
            error={fieldErrors.location}
          />
          <Select
            label="Lead source"
            value={form.source}
            onChange={(event) =>
              update({ source: event.target.value as LeadSource })
            }
            error={fieldErrors.source}
            required
          >
            {LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </Select>
          <Select
            label="Service interest"
            value={form.serviceInterest}
            onChange={(event) => update({ serviceInterest: event.target.value })}
            error={fieldErrors.serviceInterest}
          >
            <option value="">Not specified</option>
            {SERVICE_CATEGORIES.map((category) => (
              <optgroup key={category.key} label={category.label}>
                {category.services.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={OTHER_SERVICE}>{OTHER_SERVICE}</option>
          </Select>
          <Input
            label="Estimated value (INR)"
            type="number"
            min="0"
            step="0.01"
            value={form.estimatedValue}
            onChange={(event) => update({ estimatedValue: event.target.value })}
            error={fieldErrors.estimatedValue}
          />
          <Select
            label="Priority"
            value={form.priority}
            onChange={(event) =>
              update({ priority: event.target.value as LeadPriority })
            }
            error={fieldErrors.priority}
          >
            {LEAD_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {LEAD_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>

          {canAssign ? (
            <Select
              label="Assigned to"
              value={form.assignedTo}
              onChange={(event) => update({ assignedTo: event.target.value })}
              error={fieldErrors.assignedTo}
            >
              <option value="">Unassigned</option>
              {(usersQuery.data?.items ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
              {lead?.assignedTo &&
              !(usersQuery.data?.items ?? []).some(
                (member) => member.id === lead.assignedTo,
              ) ? (
                <option value={lead.assignedTo}>
                  {lead.assignedToName ?? "Current owner"}
                </option>
              ) : null}
            </Select>
          ) : null}

          {isEdit ? (
            <Select
              label="Contact status"
              value={form.contactStatus}
              onChange={(event) =>
                update({ contactStatus: event.target.value as ContactStatus })
              }
              error={fieldErrors.contactStatus}
              hint="Interactions update this automatically; override it only when needed."
            >
              {CONTACT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CONTACT_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              label="Initial follow-up"
              type="datetime-local"
              value={form.nextFollowUpAt}
              onChange={(event) =>
                update({ nextFollowUpAt: event.target.value })
              }
              error={fieldErrors.nextFollowUpAt}
              hint="Optional. Creates a pending follow-up."
            />
          )}
        </div>

        <Textarea
          label="Notes"
          value={form.description}
          onChange={(event) => update({ description: event.target.value })}
          error={fieldErrors.description}
          hint="Share context, requirements or next steps."
          rows={3}
        />

        {lead?.pipelineStage ? (
          <p className="text-xs text-slate-500">
            Current stage: {PIPELINE_STAGE_LABELS[lead.pipelineStage]}. Use the
            lead detail page to move it through the pipeline.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
