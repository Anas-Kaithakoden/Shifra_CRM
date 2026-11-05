import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MANUAL_CUSTOMER_ACTIVITY_TYPE_LABELS,
  MANUAL_CUSTOMER_ACTIVITY_TYPES,
  type ManualCustomerActivityType,
} from "../../../shared/constants/customers";
import type { CustomerActivityDto } from "../../../shared/types/customers";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api";
import { fromDateTimeInputValue } from "../../lib/format";
import { customersService } from "../../services/customers.service";
import { Button, Input, Modal, Select, Textarea } from "../ui";

export function CustomerActivityForm({
  open,
  onClose,
  customerId,
  defaultType = "note",
  defaultTitle = "",
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  defaultType?: ManualCustomerActivityType;
  defaultTitle?: string;
  onSaved?: (activity: CustomerActivityDto) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activityType, setActivityType] =
    useState<ManualCustomerActivityType>(defaultType);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setActivityType(defaultType);
    setTitle(defaultTitle);
    setDescription("");
    setOccurredAt("");
    setFormError(null);
  }, [open, defaultType, defaultTitle]);

  const mutation = useMutation({
    mutationFn: () =>
      customersService.addActivity(customerId, {
        activityType,
        title:
          title.trim() ||
          `${MANUAL_CUSTOMER_ACTIVITY_TYPE_LABELS[activityType]} with customer`,
        description: description.trim() || undefined,
        occurredAt: occurredAt ? fromDateTimeInputValue(occurredAt) : undefined,
      }),
    onSuccess: async (activity) => {
      toast({
        title:
          activityType === "note" ? "Note added" : "Interaction logged",
        variant: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onSaved?.(activity);
      onClose();
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Could not save this activity. Please try again.",
      );
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() && !description.trim()) {
      setFormError("Add a title or description.");
      return;
    }
    setFormError(null);
    mutation.mutate();
  };

  const isNote = activityType === "note";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNote ? "Add note" : "Log interaction"}
      description={
        isNote
          ? "Notes appear on the customer activity timeline."
          : "Record a call, message or meeting on the customer timeline."
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="customer-activity-form"
            isLoading={mutation.isPending}
          >
            {isNote ? "Add note" : "Log interaction"}
          </Button>
        </>
      }
    >
      <form
        id="customer-activity-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {formError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formError}
          </p>
        ) : null}
        <Select
          label="Activity type"
          value={activityType}
          onChange={(event) =>
            setActivityType(event.target.value as ManualCustomerActivityType)
          }
        >
          {MANUAL_CUSTOMER_ACTIVITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {MANUAL_CUSTOMER_ACTIVITY_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
        <Input
          label={isNote ? "Title (optional)" : "Summary"}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={
            isNote ? "Note added" : `e.g. Discussed the proposal`
          }
        />
        <Textarea
          label={isNote ? "Note" : "Details"}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          placeholder={
            isNote
              ? "Share context, a decision or next steps."
              : "What was discussed and what happens next?"
          }
        />
        <Input
          label="When it happened"
          type="datetime-local"
          value={occurredAt}
          onChange={(event) => setOccurredAt(event.target.value)}
          hint="Leave blank to use the current time. Future times are not allowed."
        />
      </form>
    </Modal>
  );
}
