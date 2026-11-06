import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Link2,
  Search,
  UserPlus,
  Trophy,
} from "lucide-react";
import {
  CUSTOMER_SERVICE_CATEGORIES,
  CUSTOMER_SERVICE_CATEGORY_LABELS,
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPES,
  type CustomerServiceCategory,
  type CustomerType,
} from "../../../shared/constants/customers";
import { PIPELINE_STAGE_LABELS } from "../../../shared/constants/leads";
import { PERMISSIONS } from "../../../shared/types/permissions";
import type { LeadDto } from "../../../shared/types/leads";
import type {
  ConvertLeadResultDto,
  CustomerListItemDto,
  DuplicateCustomerDto,
} from "../../../shared/types/customers";
import { useAuth } from "../../hooks/useAuth";
import { useDebounce } from "../../hooks/useDebounce";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api";
import { formatCurrencyInr } from "../../lib/format";
import { hasPermission } from "../../lib/permissions";
import { usersService } from "../../services/users.service";
import { customersService } from "../../services/customers.service";
import {
  Badge,
  Button,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from "../ui";

type Mode = "link" | "create";

interface CreateFormState {
  type: CustomerType;
  name: string;
  businessName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  website: string;
  notes: string;
  serviceName: string;
  serviceCategory: CustomerServiceCategory | "";
  totalCost: string;
  profit: string;
  serviceDeliveredOn: string;
  renewalOn: string;
  assignedTo: string;
}

function buildForm(lead: LeadDto): CreateFormState {
  return {
    type: lead.businessName ? "business" : "individual",
    name: lead.name,
    businessName: lead.businessName ?? "",
    phone: lead.phone,
    email: lead.email ?? "",
    city: lead.location ?? "",
    state: "",
    postalCode: "",
    country: "",
    website: "",
    notes: lead.serviceInterest
      ? `Converted from won lead ${lead.leadNumber} (${lead.serviceInterest}).`
      : `Converted from won lead ${lead.leadNumber}.`,
    serviceName: lead.serviceInterest ?? "",
    serviceCategory: "",
    totalCost: lead.estimatedValue !== null ? String(lead.estimatedValue) : "",
    profit: "",
    serviceDeliveredOn: "",
    renewalOn: "",
    assignedTo: lead.assignedTo ?? "",
  };
}

function parseAmount(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
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

function CustomerOption({
  customer,
  selected,
  onSelect,
}: {
  customer: CustomerListItemDto;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
        selected
          ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-300"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {customer.businessName ?? customer.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {customer.customerNumber} · {customer.phone}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {customer.email ?? "No email"}
            {customer.assignedToName ? ` · ${customer.assignedToName}` : ""}
          </p>
        </div>
        <Badge variant={customer.status === "active" ? "success" : "warning"}>
          {customer.status === "active" ? "Active" : "Inactive"}
        </Badge>
      </div>
    </button>
  );
}

export function ConvertLeadDialog({
  open,
  onClose,
  lead,
  onConverted,
}: {
  open: boolean;
  onClose: () => void;
  lead: LeadDto;
  onConverted?: (result: ConvertLeadResultDto) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("create");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [form, setForm] = useState<CreateFormState>(() => buildForm(lead));
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCustomerDto[]>([]);
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const debouncedSearch = useDebounce(customerSearch, 250);
  const canAssign = hasPermission(user, PERMISSIONS.CUSTOMERS_ASSIGN);

  useEffect(() => {
    if (!open) {
      return;
    }
    setMode("create");
    setSelectedCustomerId(null);
    setCustomerSearch("");
    setForm(buildForm(lead));
    setAllowDuplicate(false);
    setFormError(null);
    setDuplicates([]);
    setSuggestionApplied(false);
  }, [open, lead]);

  const duplicateQuery = useQuery({
    queryKey: ["customers", "duplicates", "lead", lead.id],
    queryFn: () =>
      customersService.checkDuplicates({
        phone: lead.phone,
        email: lead.email ?? undefined,
        businessName: lead.businessName ?? undefined,
      }),
    enabled: open,
    retry: false,
  });

  useEffect(() => {
    if (!open || suggestionApplied || !duplicateQuery.isSuccess) {
      return;
    }
    setDuplicates(duplicateQuery.data);
    if (duplicateQuery.data.some((duplicate) => duplicate.canView)) {
      setMode("link");
    }
    setSuggestionApplied(true);
  }, [open, suggestionApplied, duplicateQuery.isSuccess, duplicateQuery.data]);

  const customersQuery = useQuery({
    queryKey: ["customers", "convert-link", debouncedSearch],
    queryFn: () =>
      customersService.list({
        page: 1,
        pageSize: 10,
        search: debouncedSearch.trim() || undefined,
        sortBy: "created_at",
        sortDir: "desc",
      }),
    enabled: open && mode === "link",
  });

  const usersQuery = useQuery({
    queryKey: ["users", "customer-assignees"],
    queryFn: () =>
      usersService.list({ page: 1, pageSize: 100, status: "active" }),
    enabled: open && canAssign && mode === "create",
  });

  const selectedCustomer = useMemo(
    () =>
      (customersQuery.data?.items ?? []).find(
        (customer) => customer.id === selectedCustomerId,
      ) ?? null,
    [customersQuery.data, selectedCustomerId],
  );

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === "link") {
        if (!selectedCustomerId) {
          throw new Error("Choose an existing customer.");
        }
        return customersService.convertLead(lead.id, {
          mode: "link",
          customerId: selectedCustomerId,
        });
      }

      return customersService.convertLead(lead.id, {
        mode: "create",
        confirmCreate: true,
        allowDuplicate: allowDuplicate || undefined,
        customer: {
          type: form.type,
          name: form.name.trim() || undefined,
          businessName: form.businessName.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          postalCode: form.postalCode.trim() || undefined,
          country: form.country.trim() || undefined,
          website: form.website.trim() || undefined,
          notes: form.notes.trim() || undefined,
          serviceName: form.serviceName.trim() || undefined,
          serviceCategory: form.serviceCategory || undefined,
          totalCost: parseAmount(form.totalCost),
          profit: parseAmount(form.profit),
          serviceDeliveredOn: form.serviceDeliveredOn || undefined,
          renewalOn: form.renewalOn || undefined,
          assignedTo: canAssign ? form.assignedTo || undefined : undefined,
        },
      });
    },
    onSuccess: async (result) => {
      toast({
        title: result.alreadyLinked
          ? "Lead was already converted"
          : "Lead converted",
        description: `${result.customer.customerNumber} — ${
          result.customer.businessName ?? result.customer.name
        }`,
        variant: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onConverted?.(result);
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const found = extractDuplicates(error.details);
        if (found.length > 0) {
          setDuplicates(found);
          setAllowDuplicate(false);
          setFormError(
            "A matching customer was found. Review the existing record or confirm that a separate customer is required.",
          );
          return;
        }
        setFormError(error.message);
        return;
      }
      setFormError(
        error instanceof Error ? error.message : "Could not convert this lead.",
      );
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "link" && !selectedCustomerId) {
      setFormError("Choose an existing customer to link.");
      return;
    }
    if (mode === "create") {
      if (!form.name.trim()) {
        setFormError("Enter the customer or contact name.");
        return;
      }
      if (!form.phone.trim()) {
        setFormError("Enter a phone number.");
        return;
      }
      if (duplicates.length > 0 && !allowDuplicate) {
        setFormError(
          "Review the matching records, then confirm that you want to create a separate customer.",
        );
        return;
      }
    }
    setFormError(null);
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convert won lead to customer"
      description={`${lead.name} · ${lead.leadNumber} · ${PIPELINE_STAGE_LABELS[lead.pipelineStage]}`}
      size="lg"
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
            form="convert-lead-form"
            isLoading={mutation.isPending}
            leftIcon={
              mode === "link" ? (
                <Link2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              )
            }
          >
            {mode === "link" ? "Link and convert" : "Create customer"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Won lead
            {lead.estimatedValue !== null
              ? ` · ${formatCurrencyInr(lead.estimatedValue)}`
              : ""}
            {lead.serviceInterest ? ` · ${lead.serviceInterest}` : ""}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setMode("link");
              setFormError(null);
            }}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
              mode === "link"
                ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-300"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
              <Link2 className="h-4 w-4" aria-hidden="true" />
              Link existing customer
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Attach this won enquiry to a customer that already exists.
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("create");
              setFormError(null);
            }}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
              mode === "create"
                ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-300"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Create new customer
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Review the prefilled details before creating a new record.
            </span>
          </button>
        </div>

        {formError ? (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        ) : null}

        {duplicates.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Matching customer{duplicates.length === 1 ? "" : "s"} found
            </p>
            {duplicates.map((duplicate) => (
              <div
                key={duplicate.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  {duplicate.canView ? (
                    <Link
                      to={`/customers/${duplicate.id}`}
                      className="text-sm font-medium text-brand-700 hover:text-brand-800"
                    >
                      {duplicate.businessName ?? duplicate.name}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-slate-900">
                      {duplicate.name}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    {duplicate.customerNumber} · {duplicate.phone}
                    {duplicate.matchedOn.length > 0
                      ? ` · Matched on ${duplicate.matchedOn
                          .map((match) =>
                            match === "business_name"
                              ? "business name"
                              : match,
                          )
                          .join(", ")}`
                      : ""}
                  </p>
                  {!duplicate.canView ? (
                    <p className="mt-0.5 text-[11px] text-amber-700">
                      Only an owner or admin can open this restricted record.
                    </p>
                  ) : null}
                </div>
                {duplicate.canView ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setMode("link");
                      setSelectedCustomerId(duplicate.id);
                      setCustomerSearch(duplicate.customerNumber);
                    }}
                  >
                    Link this customer
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : duplicateQuery.isLoading ? (
          <Skeleton className="h-10 rounded-lg" />
        ) : null}

        <form id="convert-lead-form" onSubmit={handleSubmit}>
          {mode === "link" ? (
            <div className="space-y-3">
              <Input
                aria-label="Search customers"
                placeholder="Search existing customers by name, number, phone or email"
                value={customerSearch}
                onChange={(event) => {
                  setCustomerSearch(event.target.value);
                  setSelectedCustomerId(null);
                }}
                leadingIcon={<Search className="h-4 w-4" aria-hidden="true" />}
                autoFocus
              />
              {customersQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-20 rounded-lg" />
                  ))}
                </div>
              ) : (customersQuery.data?.items ?? []).length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                  No matching customers. Create a new customer instead.
                </p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {(customersQuery.data?.items ?? []).map((customer) => (
                    <CustomerOption
                      key={customer.id}
                      customer={customer}
                      selected={selectedCustomerId === customer.id}
                      onSelect={() => setSelectedCustomerId(customer.id)}
                    />
                  ))}
                </div>
              )}
              {selectedCustomer ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  Linking will attach this lead to{" "}
                  <span className="font-medium">
                    {selectedCustomer.businessName ?? selectedCustomer.name}
                  </span>{" "}
                  ({selectedCustomer.customerNumber}). No enquiry data is copied.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Customer type"
                  value={form.type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      type: event.target.value as CustomerType,
                    }))
                  }
                >
                  {CUSTOMER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CUSTOMER_TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
                <Input
                  label={
                    form.type === "business" ? "Contact person" : "Full name"
                  }
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
                <Input
                  label="Business name"
                  value={form.businessName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      businessName: event.target.value,
                    }))
                  }
                />
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
                <Input
                  label="City"
                  value={form.city}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      city: event.target.value,
                    }))
                  }
                />
                <Input
                  label="State"
                  value={form.state}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      state: event.target.value,
                    }))
                  }
                />
                <Input
                  label="Postal code"
                  value={form.postalCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      postalCode: event.target.value,
                    }))
                  }
                />
                <Input
                  label="Country"
                  value={form.country}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      country: event.target.value,
                    }))
                  }
                />
                <Input
                  label="Website"
                  value={form.website}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      website: event.target.value,
                    }))
                  }
                />
                <Input
                  label="Service name"
                  value={form.serviceName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      serviceName: event.target.value,
                    }))
                  }
                  placeholder="e.g. Website maintenance"
                />
                <Select
                  label="Service category"
                  value={form.serviceCategory}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      serviceCategory: event.target
                        .value as CustomerServiceCategory | "",
                    }))
                  }
                >
                  <option value="">Select category</option>
                  {CUSTOMER_SERVICE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {CUSTOMER_SERVICE_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Total cost (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.totalCost}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      totalCost: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                />
                <Input
                  label="Profit (₹)"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={form.profit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      profit: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                />
                <Input
                  label="Service delivered on"
                  type="date"
                  value={form.serviceDeliveredOn}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      serviceDeliveredOn: event.target.value,
                    }))
                  }
                />
                <Input
                  label="Renewal date"
                  type="date"
                  value={form.renewalOn}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      renewalOn: event.target.value,
                    }))
                  }
                  hint="Leave blank if this service does not renew."
                />
                {canAssign ? (
                  <Select
                    label="Assigned to"
                    value={form.assignedTo}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        assignedTo: event.target.value,
                      }))
                    }
                    containerClassName="sm:col-span-2"
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
              <Textarea
                label="Notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={3}
              />
              {duplicates.length > 0 ? (
                <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    checked={allowDuplicate}
                    onChange={(event) => setAllowDuplicate(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-700"
                  />
                  <span>
                    <span className="font-medium">
                      Create a separate customer anyway
                    </span>
                    <span className="block text-xs text-amber-700">
                      The existing record will not be merged. This requires an
                      explicit confirmation.
                    </span>
                  </span>
                </label>
              ) : (
                <p className="flex items-start gap-2 text-xs text-slate-500">
                  <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  No customer is created until you click “Create customer”. You
                  can edit every field first.
                </p>
              )}
            </div>
          )}
        </form>
      </div>
    </Modal>
  );
}
