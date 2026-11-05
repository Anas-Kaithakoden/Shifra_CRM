import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CustomerContactDto } from "../../../shared/types/customers";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api";
import {
  customersService,
  type CustomerContactInput,
  type CustomerContactUpdateInput,
} from "../../services/customers.service";
import { Button, Input, Modal, Textarea } from "../ui";

export function ContactForm({
  open,
  onClose,
  customerId,
  contact,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  contact?: CustomerContactDto;
  onSaved?: (contact: CustomerContactDto) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = Boolean(contact);

  useEffect(() => {
    if (!open) {
      return;
    }
    setFullName(contact?.fullName ?? "");
    setJobTitle(contact?.jobTitle ?? "");
    setPhone(contact?.phone ?? "");
    setEmail(contact?.email ?? "");
    setNotes(contact?.notes ?? "");
    setIsPrimary(contact?.isPrimary ?? false);
    setFormError(null);
  }, [open, contact]);

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit && contact) {
        const input: CustomerContactUpdateInput = {
          fullName: fullName.trim(),
          jobTitle: jobTitle.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          notes: notes.trim() || null,
          isPrimary,
        };
        return customersService.updateContact(customerId, contact.id, input);
      }
      const input: CustomerContactInput = {
        fullName: fullName.trim(),
        jobTitle: jobTitle.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        isPrimary,
      };
      return customersService.addContact(customerId, input);
    },
    onSuccess: async (saved) => {
      toast({
        title: isEdit ? "Contact updated" : "Contact added",
        variant: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Could not save the contact. Please try again.",
      );
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fullName.trim()) {
      setFormError("Enter the contact's name.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setFormError("Enter a phone number or email address for this contact.");
      return;
    }
    setFormError(null);
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit contact" : "Add contact"}
      description="Contacts are people the team can reach about this customer."
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
            form="contact-form"
            isLoading={mutation.isPending}
          >
            {isEdit ? "Save contact" : "Add contact"}
          </Button>
        </>
      }
    >
      <form id="contact-form" onSubmit={handleSubmit} className="space-y-4">
        {formError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formError}
          </p>
        ) : null}
        <Input
          label="Full name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
        <Input
          label="Job title"
          value={jobTitle}
          onChange={(event) => setJobTitle(event.target.value)}
          placeholder="e.g. Purchase manager"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            inputMode="tel"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <Textarea
          label="Notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Preferred times, responsibilities or other context."
        />
        <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(event) => setIsPrimary(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700"
          />
          <span>
            <span className="font-medium text-slate-800">Primary contact</span>
            <span className="block text-xs text-slate-500">
              Only one contact per customer can be primary.
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}
