import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import {
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPES,
  type CustomerType,
} from "../../../shared/constants/customers";
import { PERMISSIONS } from "../../../shared/types/permissions";
import type {
  CustomerDto,
  CustomerDuplicateMatch,
  DuplicateCustomerDto,
} from "../../../shared/types/customers";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api";
import { hasPermission } from "../../lib/permissions";
import { usersService } from "../../services/users.service";
import {
  customersService,
  type CustomerCreateInput,
  type CustomerUpdateInput,
} from "../../services/customers.service";
import {
  Badge,
  Button,
  Input,
  Modal,
  Select,
  Textarea,
} from "../ui";

interface FormState {
  type: CustomerType;
  name: string;
  businessName: string;
  phone: string;
  email: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  notes: string;
  totalCost: string;
  profit: string;
  serviceDeliveredOn: string;
  renewalOn: string;
  status: "active" | "inactive";
  assignedTo: string;
}

function emptyState(customer?: CustomerDto): FormState {
  return {
    type: customer?.type ?? "individual",
    name: customer?.name ?? "",
    businessName: customer?.businessName ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    website: customer?.website ?? "",
    addressLine1: customer?.addressLine1 ?? "",
    addressLine2: customer?.addressLine2 ?? "",
    city: customer?.city ?? "",
    state: customer?.state ?? "",
    postalCode: customer?.postalCode ?? "",
    country: customer?.country ?? "",
    notes: customer?.notes ?? "",
    totalCost:
      customer?.totalCost !== null && customer?.totalCost !== undefined
        ? String(customer.totalCost)
        : "",
    profit:
      customer?.profit !== null && customer?.profit !== undefined
        ? String(customer.profit)
        : "",
    serviceDeliveredOn: customer?.serviceDeliveredOn ?? "",
    renewalOn: customer?.renewalOn ?? "",
    status:
      customer?.status === "inactive"
        ? "inactive"
        : customer?.status === "active"
          ? "active"
          : "active",
    assignedTo: customer?.assignedTo ?? "",
  };
}

function extractDuplicates(details: unknown): DuplicateCustomerDto[] {
  if (
    details &&
    typeof details === "object" &&
    "duplicates" in details &&
    Array.isArray((details as { duplicates?: unknown }).duplicates)
  ) {
    return (details as { duplicates: DuplicateCustomerDto[] }).duplicates;
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

const MATCH_LABELS: Record<CustomerDuplicateMatch, string> = {
  phone: "Phone",
  email: "Email",
  business_name: "Business name",
};

export function CustomerForm({
  open,
  onClose,
  customer,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  customer?: CustomerDto;
  onSaved?: (customer: CustomerDto) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => emptyState(customer));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCustomerDto[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const isEdit = Boolean(customer);
  const canAssign = hasPermission(user, PERMISSIONS.CUSTOMERS_ASSIGN);

  const usersQuery = useQuery({
    queryKey: ["users", "customer-assignees"],
    queryFn: () =>
      usersService.list({ page: 1, pageSize: 100, status: "active" }),
    enabled: open && canAssign,
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    setForm(emptyState(customer));
    setFieldErrors({});
    setFormError(null);
    setDuplicates([]);
  }, [open, customer]);

  const update = (patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const parseAmount = (value: string): number | undefined => {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const buildCreateInput = (allowDuplicate: boolean): CustomerCreateInput => ({
    type: form.type,
    name: form.name.trim(),
    businessName: form.businessName.trim() || undefined,
    phone: form.phone.trim(),
    email: form.email.trim() || undefined,
    website: form.website.trim() || undefined,
    addressLine1: form.addressLine1.trim() || undefined,
    addressLine2: form.addressLine2.trim() || undefined,
    city: form.city.trim() || undefined,
    state: form.state.trim() || undefined,
    postalCode: form.postalCode.trim() || undefined,
    country: form.country.trim() || undefined,
    notes: form.notes.trim() || undefined,
    totalCost: parseAmount(form.totalCost),
    profit: parseAmount(form.profit),
    serviceDeliveredOn: form.serviceDeliveredOn || undefined,
    renewalOn: form.renewalOn || undefined,
    status: form.status,
    assignedTo: form.assignedTo || undefined,
    allowDuplicate: allowDuplicate || undefined,
  });

  const buildUpdateInput = (
    allowDuplicate: boolean,
  ): CustomerUpdateInput => ({
    type: form.type,
    name: form.name.trim(),
    businessName: form.businessName.trim() || null,
    phone: form.phone.trim(),
    email: form.email.trim() || null,
    website: form.website.trim() || null,
    addressLine1: form.addressLine1.trim() || null,
    addressLine2: form.addressLine2.trim() || null,
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    postalCode: form.postalCode.trim() || null,
    country: form.country.trim() || null,
    notes: form.notes.trim() || null,
    totalCost: parseAmount(form.totalCost) ?? null,
    profit: parseAmount(form.profit) ?? null,
    serviceDeliveredOn: form.serviceDeliveredOn || null,
    renewalOn: form.renewalOn || null,
    status: form.status,
    assignedTo: canAssign ? form.assignedTo || null : undefined,
    allowDuplicate: allowDuplicate || undefined,
  });

  const save = async (allowDuplicate: boolean) => {
    if (!form.name.trim()) {
      setFieldErrors({ name: "Enter the customer or contact name." });
      return;
    }
    if (!form.phone.trim()) {
      setFieldErrors({ phone: "Enter a phone number." });
      return;
    }

    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const saved =
        isEdit && customer
          ? await customersService.update(
              customer.id,
              buildUpdateInput(allowDuplicate),
            )
          : await customersService.create(buildCreateInput(allowDuplicate));
      toast({
        title: isEdit ? "Customer updated" : "Customer created",
        description: isEdit
          ? "The customer record has been saved."
          : `${saved.customerNumber} is ready to use.`,
        variant: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        const found = extractDuplicates(error.details);
        if (found.length > 0) {
          setDuplicates(found);
          setFormError(error.message);
          return;
        }
        setFieldErrors(extractFieldErrors(error.details));
        setFormError(error.message);
        return;
      }
      setFormError("Could not save the customer. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit customer" : "New customer"}
      description={
        isEdit
          ? "Update account and contact details. Changes are recorded in the activity timeline."
          : "Create a customer record. A primary contact is created from these details."
      }
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          {duplicates.length > 0 ? (
            <Button
              onClick={() => void save(true)}
              isLoading={isSaving}
              variant="danger"
            >
              {isEdit ? "Save anyway" : "Create anyway"}
            </Button>
          ) : (
            <Button
              type="submit"
              form="customer-form"
              isLoading={isSaving}
            >
              {isEdit ? "Save changes" : "Create customer"}
            </Button>
          )}
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} className="space-y-4">
        {formError ? (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        ) : null}

        {duplicates.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Possible existing customers
            </p>
            {duplicates.map((duplicate) => (
              <div
                key={duplicate.id}
                className="rounded-lg border border-amber-200 bg-white px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {duplicate.canView ? (
                    <Link
                      to={`/customers/${duplicate.id}`}
                      className="text-sm font-medium text-brand-700 hover:text-brand-800"
                    >
                      {duplicate.businessName ?? duplicate.name}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-slate-800">
                      {duplicate.businessName ?? duplicate.name}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">
                    {duplicate.customerNumber}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {duplicate.phone}
                  {duplicate.email ? ` · ${duplicate.email}` : ""}
                </p>
                {!duplicate.canView ? (
                  <p className="mt-0.5 text-[11px] text-amber-700">
                    Restricted to an owner or admin. You can still create a
                    separate customer after checking with them.
                  </p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {duplicate.matchedOn.map((match) => (
                    <Badge key={match} variant="warning">
                      {MATCH_LABELS[match]}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-amber-700">
              Review these records first. Creating a duplicate keeps both records
              separate and does not merge any data.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Customer type"
            value={form.type}
            onChange={(event) =>
              update({ type: event.target.value as CustomerType })
            }
          >
            {CUSTOMER_TYPES.map((type) => (
              <option key={type} value={type}>
                {CUSTOMER_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>

          <Select
            label="Status"
            value={form.status}
            onChange={(event) =>
              update({ status: event.target.value as "active" | "inactive" })
            }
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>

          <Input
            label={form.type === "business" ? "Contact person" : "Full name"}
            value={form.name}
            onChange={(event) => update({ name: event.target.value })}
            error={fieldErrors.name}
            required
          />
          <Input
            label="Business name"
            value={form.businessName}
            onChange={(event) => update({ businessName: event.target.value })}
            error={fieldErrors.businessName}
            placeholder={
              form.type === "business" ? "Legal or trading name" : "Optional"
            }
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(event) => update({ phone: event.target.value })}
            error={fieldErrors.phone}
            inputMode="tel"
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => update({ email: event.target.value })}
            error={fieldErrors.email}
          />
          <Input
            label="Website"
            value={form.website}
            onChange={(event) => update({ website: event.target.value })}
            error={fieldErrors.website}
            placeholder="https://"
          />
          {canAssign ? (
            <Select
              label="Assigned to"
              value={form.assignedTo}
              onChange={(event) => update({ assignedTo: event.target.value })}
              error={fieldErrors.assignedTo}
              disabled={usersQuery.isLoading}
            >
              <option value="">Unassigned</option>
              {(usersQuery.data?.items ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Service &amp; financials
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Total cost (₹)"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.totalCost}
              onChange={(event) => update({ totalCost: event.target.value })}
              error={fieldErrors.totalCost}
              placeholder="0.00"
            />
            <Input
              label="Profit (₹)"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.profit}
              onChange={(event) => update({ profit: event.target.value })}
              error={fieldErrors.profit}
              placeholder="0.00"
            />
            <Input
              label="Service delivered on"
              type="date"
              value={form.serviceDeliveredOn}
              onChange={(event) =>
                update({ serviceDeliveredOn: event.target.value })
              }
              error={fieldErrors.serviceDeliveredOn}
            />
            <Input
              label="Renewal date"
              type="date"
              value={form.renewalOn}
              onChange={(event) => update({ renewalOn: event.target.value })}
              error={fieldErrors.renewalOn}
              hint="Leave blank if this service does not renew."
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Address line 1"
            value={form.addressLine1}
            onChange={(event) => update({ addressLine1: event.target.value })}
            error={fieldErrors.addressLine1}
          />
          <Input
            label="Address line 2"
            value={form.addressLine2}
            onChange={(event) => update({ addressLine2: event.target.value })}
            error={fieldErrors.addressLine2}
          />
          <Input
            label="City"
            value={form.city}
            onChange={(event) => update({ city: event.target.value })}
            error={fieldErrors.city}
          />
          <Input
            label="State"
            value={form.state}
            onChange={(event) => update({ state: event.target.value })}
            error={fieldErrors.state}
          />
          <Input
            label="Postal code"
            value={form.postalCode}
            onChange={(event) => update({ postalCode: event.target.value })}
            error={fieldErrors.postalCode}
          />
          <Input
            label="Country"
            value={form.country}
            onChange={(event) => update({ country: event.target.value })}
            error={fieldErrors.country}
          />
        </div>

        <Textarea
          label="Internal notes"
          value={form.notes}
          onChange={(event) => update({ notes: event.target.value })}
          error={fieldErrors.notes}
          rows={3}
          placeholder="Context that helps the team serve this customer."
        />
      </form>
    </Modal>
  );
}
