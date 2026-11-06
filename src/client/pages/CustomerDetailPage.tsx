import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Archive,
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock3,
  Globe2,
  IndianRupee,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  StickyNote,
  TrendingUp,
  Target,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import {
  CUSTOMER_SERVICE_CATEGORY_LABELS,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPE_LABELS,
  type ManualCustomerActivityType,
} from "../../shared/constants/customers";
import { PERMISSIONS } from "../../shared/types/permissions";
import type { CustomerContactDto } from "../../shared/types/customers";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { ApiError } from "../lib/api";
import {
  formatCrmDate,
  formatCrmDateTime,
  formatCurrencyInr,
  formatRelativeTime,
} from "../lib/format";
import { hasPermission } from "../lib/permissions";
import { customersService } from "../services/customers.service";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from "../components/ui";
import {
  ContactForm,
  CustomerActivityForm,
  CustomerContacts,
  CustomerForm,
  CustomerLeads,
  CustomerStatusBadge,
  CustomerTimeline,
  CustomerTypeBadge,
  LinkLeadDialog,
} from "../components/customers";
import { EntityTasksSection } from "../components/tasks";
import { cn } from "../lib/cn";

type DetailTab = "overview" | "contacts" | "leads" | "service" | "activity";

const TABS: Array<{ value: DetailTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "contacts", label: "Contacts" },
  { value: "leads", label: "Enquiries & Leads" },
  { value: "service", label: "Service History" },
  { value: "activity", label: "Activity Timeline" },
];

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <div className="break-words text-sm text-slate-700">{children}</div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <div className="space-y-5">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function CountTile({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "brand" | "emerald";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
      <p
        className={cn(
          "text-lg font-semibold",
          tone === "brand"
            ? "text-brand-700"
            : tone === "emerald"
              ? "text-emerald-700"
              : "text-slate-800",
        )}
      >
        {value}
      </p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
    </div>
  );
}

function buildWhatsAppHref(phone: string, name: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) {
    return null;
  }
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(
    `Hello ${name},`,
  )}`;
}

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<DetailTab>("overview");
  const [activityPage, setActivityPage] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [editingContact, setEditingContact] =
    useState<CustomerContactDto | null>(null);
  const [removeContactTarget, setRemoveContactTarget] =
    useState<CustomerContactDto | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityType, setActivityType] =
    useState<ManualCustomerActivityType>("note");
  const [activityTitle, setActivityTitle] = useState("");

  const customerQuery = useQuery({
    queryKey: ["customers", "detail", id],
    queryFn: () => customersService.get(id),
    enabled: Boolean(id),
  });

  const activitiesQuery = useQuery({
    queryKey: ["customers", "activities", id, activityPage],
    queryFn: () =>
      customersService.listActivities(id, { page: activityPage, pageSize: 20 }),
    enabled: Boolean(id),
    placeholderData: (previous) => previous,
  });

  const customer = customerQuery.data;
  const activities = activitiesQuery.data?.items ?? [];
  const customerName = customer?.businessName ?? customer?.name ?? "Customer";

  const canManage = Boolean(
    customer &&
      user &&
      (user.role === "owner" ||
        user.role === "admin" ||
        customer.assignedTo === user.id ||
        customer.createdBy === user.id),
  );
  const canUpdate =
    canManage && hasPermission(user, PERMISSIONS.CUSTOMERS_UPDATE);
  const canArchive =
    canManage && hasPermission(user, PERMISSIONS.CUSTOMERS_ARCHIVE);
  const canManageContacts =
    canManage && hasPermission(user, PERMISSIONS.CUSTOMERS_CONTACTS);
  const canAddNotes =
    canManage && hasPermission(user, PERMISSIONS.CUSTOMERS_NOTES);
  const canLinkLeads =
    canManage && hasPermission(user, PERMISSIONS.CUSTOMERS_LINK_LEADS);
  const isArchived = customer?.status === "archived";

  const invalidateCustomer = async () => {
    await queryClient.invalidateQueries({ queryKey: ["customers"] });
    await queryClient.invalidateQueries({ queryKey: ["leads"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const archiveMutation = useMutation({
    mutationFn: () => customersService.archive(id),
    onSuccess: async () => {
      toast({
        title: "Customer archived",
        description: "The full history is preserved and can be restored later.",
        variant: "success",
      });
      setArchiveOpen(false);
      await invalidateCustomer();
    },
    onError: (error) => {
      toast({
        title: "Could not archive customer",
        description:
          error instanceof ApiError ? error.message : "Please try again.",
        variant: "error",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => customersService.restore(id),
    onSuccess: async () => {
      toast({
        title: "Customer restored",
        description: "The customer is active again with its history intact.",
        variant: "success",
      });
      await invalidateCustomer();
    },
    onError: (error) => {
      toast({
        title: "Could not restore customer",
        description:
          error instanceof ApiError ? error.message : "Please try again.",
        variant: "error",
      });
    },
  });

  const removeContactMutation = useMutation({
    mutationFn: (contact: CustomerContactDto) =>
      customersService.removeContact(id, contact.id),
    onSuccess: async () => {
      toast({
        title: "Contact removed",
        description: "Past activity and interaction history is unchanged.",
        variant: "success",
      });
      setRemoveContactTarget(null);
      await invalidateCustomer();
    },
    onError: (error) => {
      toast({
        title: "Could not remove contact",
        description:
          error instanceof ApiError ? error.message : "Please try again.",
        variant: "error",
      });
    },
  });

  if (customerQuery.isLoading) {
    return <DetailSkeleton />;
  }

  if (customerQuery.isError || !customer) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/customers")}
          leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          className="-ml-2"
        >
          Back to customers
        </Button>
        <ErrorState
          title="Customer unavailable"
          message={
            customerQuery.error instanceof ApiError
              ? customerQuery.error.message
              : "This customer could not be loaded or you no longer have access."
          }
          onRetry={() => {
            void customerQuery.refetch();
          }}
        />
      </div>
    );
  }

  const whatsAppHref = buildWhatsAppHref(customer.phone, customer.name);
  const address = [
    customer.addressLine1,
    customer.addressLine2,
    customer.city,
    customer.state,
    customer.postalCode,
    customer.country,
  ]
    .filter(Boolean)
    .join(", ");

  const openContactForm = (contact?: CustomerContactDto) => {
    setEditingContact(contact ?? null);
    setContactFormOpen(true);
  };

  const openActivity = (
    type: ManualCustomerActivityType,
    title = "",
  ) => {
    setActivityType(type);
    setActivityTitle(title);
    setActivityOpen(true);
  };

  const activityTotal = activitiesQuery.data?.pagination.total ?? 0;
  const activityPagination = activitiesQuery.data?.pagination;
  const contacts = customer.contacts;
  const primaryContact = customer.primaryContact;

  return (
    <div className="space-y-5">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/customers")}
          leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          className="-ml-2"
        >
          Back to customers
        </Button>
      </div>

      <PageHeader
        title={customerName}
        description={`${customer.customerNumber} · ${CUSTOMER_TYPE_LABELS[customer.type]} · ${customer.name}`}
        actions={
          canUpdate && !isArchived ? (
            <Button
              variant="outline"
              onClick={() => setEditOpen(true)}
              leftIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}
            >
              Edit customer
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <CustomerStatusBadge status={customer.status} />
        <CustomerTypeBadge type={customer.type} />
        {customer.assignedToName ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            Owner {customer.assignedToName}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Unassigned</span>
        )}
        {customer.lastActivityAt ? (
          <span
            className="inline-flex items-center gap-1 text-xs text-slate-400"
            title={formatCrmDateTime(customer.lastActivityAt)}
          >
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            Last activity {formatRelativeTime(customer.lastActivityAt)}
          </span>
        ) : null}
      </div>

      {isArchived ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-amber-900">
              This customer is archived
            </p>
            <p className="text-xs text-amber-700">
              Archived records are read-only. All contacts, enquiries and
              activity history remain available.
            </p>
          </div>
          {canArchive ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => restoreMutation.mutate()}
              isLoading={restoreMutation.isPending}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Restore customer
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.map((item) => {
          const count =
            item.value === "contacts"
              ? contacts.length
              : item.value === "leads"
                ? customer.leads.length
                : item.value === "service"
                  ? customer.stats.wonLeadCount
                  : item.value === "activity"
                    ? activityTotal
                    : null;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === item.value
                  ? "bg-brand-50 text-brand-800"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {item.label}
              {count !== null ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    tab === item.value
                      ? "bg-brand-100 text-brand-700"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {tab === "overview" ? (
            <>
              <Card>
                <CardHeader
                  title="Customer details"
                  description="Account information and contact details."
                />
                <CardBody className="grid gap-5 sm:grid-cols-2">
                  <InfoRow
                    icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
                    label={customer.type === "business" ? "Business" : "Name"}
                  >
                    {customer.businessName ?? customer.name}
                    {customer.businessName ? (
                      <span className="block text-xs text-slate-500">
                        {customer.name}
                      </span>
                    ) : null}
                  </InfoRow>
                  <InfoRow
                    icon={<Phone className="h-4 w-4" aria-hidden="true" />}
                    label="Phone"
                  >
                    <a
                      href={`tel:${customer.phone}`}
                      className="hover:text-brand-700"
                    >
                      {customer.phone}
                    </a>
                  </InfoRow>
                  <InfoRow
                    icon={<Mail className="h-4 w-4" aria-hidden="true" />}
                    label="Email"
                  >
                    {customer.email ? (
                      <a
                        href={`mailto:${customer.email}`}
                        className="break-all hover:text-brand-700"
                      >
                        {customer.email}
                      </a>
                    ) : (
                      <span className="text-slate-400">Not provided</span>
                    )}
                  </InfoRow>
                  <InfoRow
                    icon={<Globe2 className="h-4 w-4" aria-hidden="true" />}
                    label="Website"
                  >
                    {customer.website ? (
                      <a
                        href={customer.website}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-brand-700 hover:text-brand-800"
                      >
                        {customer.website}
                      </a>
                    ) : (
                      <span className="text-slate-400">Not provided</span>
                    )}
                  </InfoRow>
                  <InfoRow
                    icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                    label="Address"
                  >
                    {address ? (
                      <span className="whitespace-pre-line">{address}</span>
                    ) : (
                      <span className="text-slate-400">Not provided</span>
                    )}
                  </InfoRow>
                  <InfoRow
                    icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
                    label="Assigned to"
                  >
                    {customer.assignedToName ?? "Unassigned"}
                  </InfoRow>
                  <InfoRow
                    icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
                    label="Created"
                  >
                    {formatCrmDate(customer.createdAt)}
                    {customer.createdByName ? (
                      <span className="block text-xs text-slate-500">
                        by {customer.createdByName}
                      </span>
                    ) : null}
                  </InfoRow>
                  <InfoRow
                    icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
                    label="Last updated"
                  >
                    {formatCrmDateTime(customer.updatedAt)}
                  </InfoRow>
                  {customer.notes ? (
                    <div className="sm:col-span-2">
                      <InfoRow
                        icon={<StickyNote className="h-4 w-4" aria-hidden="true" />}
                        label="Internal notes"
                      >
                        <span className="whitespace-pre-line">
                          {customer.notes}
                        </span>
                      </InfoRow>
                    </div>
                  ) : null}
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Service &amp; financials"
                  description="Delivery, cost and renewal details for this customer."
                />
                <CardBody className="grid gap-5 sm:grid-cols-2">
                  <InfoRow
                    icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
                    label="Service"
                  >
                    {customer.serviceName ? (
                      customer.serviceName
                    ) : (
                      <span className="text-slate-400">Not provided</span>
                    )}
                  </InfoRow>
                  <InfoRow
                    icon={<Target className="h-4 w-4" aria-hidden="true" />}
                    label="Service category"
                  >
                    {customer.serviceCategory ? (
                      CUSTOMER_SERVICE_CATEGORY_LABELS[
                        customer.serviceCategory
                      ]
                    ) : (
                      <span className="text-slate-400">Not provided</span>
                    )}
                  </InfoRow>
                  <InfoRow
                    icon={<IndianRupee className="h-4 w-4" aria-hidden="true" />}
                    label="Total cost"
                  >
                    {customer.totalCost !== null ? (
                      formatCurrencyInr(customer.totalCost)
                    ) : (
                      <span className="text-slate-400">Not provided</span>
                    )}
                  </InfoRow>
                  <InfoRow
                    icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
                    label="Profit"
                  >
                    {customer.profit !== null ? (
                      formatCurrencyInr(customer.profit)
                    ) : (
                      <span className="text-slate-400">Not provided</span>
                    )}
                  </InfoRow>
                  <InfoRow
                    icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
                    label="Service delivered on"
                  >
                    {customer.serviceDeliveredOn ? (
                      formatCrmDate(customer.serviceDeliveredOn)
                    ) : (
                      <span className="text-slate-400">Not provided</span>
                    )}
                  </InfoRow>
                  <InfoRow
                    icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                    label="Renewal date"
                  >
                    {customer.renewalOn ? (
                      <span>
                        {formatCrmDate(customer.renewalOn)}
                        {customer.renewalReminderSentAt ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-400">
                            Telegram reminder sent{" "}
                            {formatCrmDateTime(customer.renewalReminderSentAt)}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-slate-400">No renewal</span>
                    )}
                  </InfoRow>
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Recent activity"
                  description="The latest changes, notes and interactions."
                  action={
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setTab("activity")}
                    >
                      View full timeline
                    </Button>
                  }
                />
                <CardBody>
                  {activities.length > 0 ? (
                    <CustomerTimeline activities={activities.slice(0, 5)} />
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                      No activity recorded yet.
                    </p>
                  )}
                </CardBody>
              </Card>

              {hasPermission(user, PERMISSIONS.TASKS_READ) ? (
                <EntityTasksSection
                  customerId={id}
                  canCreate={canAddNotes && hasPermission(user, PERMISSIONS.TASKS_CREATE)}
                />
              ) : null}
            </>
          ) : null}

          {tab === "contacts" ? (
            <Card>
              <CardHeader
                title="Contacts"
                description="People the team can reach about this customer. Only one contact can be primary."
                action={
                  canManageContacts && !isArchived ? (
                    <Button
                      size="sm"
                      onClick={() => openContactForm()}
                      leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                    >
                      Add contact
                    </Button>
                  ) : undefined
                }
              />
              <CardBody>
                <CustomerContacts
                  contacts={contacts}
                  canManage={canManageContacts && !isArchived}
                  onAdd={() => openContactForm()}
                  onEdit={openContactForm}
                  onRemove={setRemoveContactTarget}
                />
              </CardBody>
            </Card>
          ) : null}

          {tab === "leads" ? (
            <Card>
              <CardHeader
                title="Enquiries & leads"
                description="Every lead linked to this customer, including won purchases."
                action={
                  canLinkLeads && !isArchived ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLinkOpen(true)}
                      leftIcon={<Link2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    >
                      Link lead
                    </Button>
                  ) : undefined
                }
              />
              <CardBody>
                <CustomerLeads
                  leads={customer.leads}
                  canLink={canLinkLeads && !isArchived}
                  onLink={() => setLinkOpen(true)}
                />
              </CardBody>
            </Card>
          ) : null}

          {tab === "service" ? (
            <Card>
              <CardHeader
                title="Service history"
                description="Won purchases only. Enquiries and active opportunities stay under Enquiries & Leads."
              />
              <CardBody className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs text-slate-600">
                  This history is based on won leads. Projects, invoices and
                  payments are not tracked in this module yet.
                </div>
                <CustomerLeads
                  leads={customer.leads}
                  canLink={false}
                  onLink={() => undefined}
                  view="won"
                />
              </CardBody>
            </Card>
          ) : null}

          {tab === "activity" ? (
            <Card>
              <CardHeader
                title="Activity timeline"
                description="A complete chronological record. Entries are never silently overwritten."
                action={
                  canAddNotes && !isArchived ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openActivity("note", "Note added")}
                      leftIcon={<StickyNote className="h-3.5 w-3.5" aria-hidden="true" />}
                    >
                      Add note
                    </Button>
                  ) : undefined
                }
              />
              <CardBody>
                {activitiesQuery.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-20 rounded-lg" />
                    ))}
                  </div>
                ) : activitiesQuery.isError ? (
                  <ErrorState
                    title="Unable to load activity"
                    message="Please try again."
                    onRetry={() => {
                      void activitiesQuery.refetch();
                    }}
                  />
                ) : (
                  <CustomerTimeline activities={activities} />
                )}
              </CardBody>
              {activityPagination && activityPagination.totalPages > 1 ? (
                <Pagination
                  page={activityPagination.page}
                  pageSize={activityPagination.pageSize}
                  total={activityPagination.total}
                  totalPages={activityPagination.totalPages}
                  onPageChange={setActivityPage}
                />
              ) : null}
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Quick actions"
              description="Reach or update this customer."
            />
            <CardBody className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <a href={`tel:${customer.phone}`} className="block">
                  <Button
                    variant="outline"
                    className="w-full justify-center"
                    leftIcon={<Phone className="h-4 w-4" aria-hidden="true" />}
                  >
                    Call
                  </Button>
                </a>
                {whatsAppHref ? (
                  <a
                    href={whatsAppHref}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <Button
                      variant="outline"
                      className="w-full justify-center"
                      leftIcon={
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      }
                    >
                      WhatsApp
                    </Button>
                  </a>
                ) : null}
                {customer.email ? (
                  <a
                    href={`mailto:${customer.email}`}
                    className="col-span-2 block"
                  >
                    <Button
                      variant="outline"
                      className="w-full justify-center"
                      leftIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
                    >
                      Email
                    </Button>
                  </a>
                ) : null}
              </div>

              {!isArchived ? (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  {canAddNotes ? (
                    <>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => openActivity("note", "Note added")}
                        leftIcon={
                          <StickyNote className="h-4 w-4" aria-hidden="true" />
                        }
                      >
                        Add note
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => openActivity("call", "")}
                        leftIcon={
                          <Activity className="h-4 w-4" aria-hidden="true" />
                        }
                      >
                        Log interaction
                      </Button>
                    </>
                  ) : null}
                  {canManageContacts ? (
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => openContactForm()}
                      leftIcon={
                        <UserRound className="h-4 w-4" aria-hidden="true" />
                      }
                    >
                      Add contact
                    </Button>
                  ) : null}
                  {canLinkLeads ? (
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => setLinkOpen(true)}
                      leftIcon={<Link2 className="h-4 w-4" aria-hidden="true" />}
                    >
                      Link lead
                    </Button>
                  ) : null}
                  {canUpdate ? (
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => setEditOpen(true)}
                      leftIcon={
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      }
                    >
                      Edit customer
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {canArchive && !isArchived ? (
                <div className="border-t border-slate-100 pt-3">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => setArchiveOpen(true)}
                    leftIcon={<Archive className="h-4 w-4" aria-hidden="true" />}
                  >
                    Archive customer
                  </Button>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="At a glance" />
            <CardBody className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <CountTile
                  label="Contacts"
                  value={customer.stats.contactCount}
                />
                <CountTile
                  label="Leads"
                  value={customer.stats.leadCount}
                  tone="brand"
                />
                <CountTile
                  label="Won"
                  value={customer.stats.wonLeadCount}
                  tone="emerald"
                />
              </div>
              <div className="space-y-1.5 text-xs text-slate-500">
                <p className="flex items-center justify-between gap-2">
                  <span>Status</span>
                  <span className="font-medium text-slate-700">
                    {CUSTOMER_STATUS_LABELS[customer.status]}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span>Customer since</span>
                  <span className="font-medium text-slate-700">
                    {formatCrmDate(customer.createdAt)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span>Last updated</span>
                  <span className="font-medium text-slate-700">
                    {formatCrmDate(customer.updatedAt)}
                  </span>
                </p>
              </div>
            </CardBody>
          </Card>

          {primaryContact ? (
            <Card>
              <CardHeader
                title="Primary contact"
                action={
                  canManageContacts && !isArchived ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openContactForm(primaryContact)}
                    >
                      Edit
                    </Button>
                  ) : undefined
                }
              />
              <CardBody className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {primaryContact.fullName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {primaryContact.jobTitle ?? "Primary contact"}
                    </p>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-slate-600">
                  {primaryContact.phone ? (
                    <a
                      href={`tel:${primaryContact.phone}`}
                      className="flex items-center gap-1.5 hover:text-brand-700"
                    >
                      <Phone className="h-3 w-3 text-slate-400" aria-hidden="true" />
                      {primaryContact.phone}
                    </a>
                  ) : null}
                  {primaryContact.email ? (
                    <a
                      href={`mailto:${primaryContact.email}`}
                      className="flex items-center gap-1.5 break-all hover:text-brand-700"
                    >
                      <Mail className="h-3 w-3 text-slate-400" aria-hidden="true" />
                      {primaryContact.email}
                    </a>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Primary contact" />
              <CardBody>
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center">
                  <Users
                    className="mx-auto mb-1.5 h-5 w-5 text-slate-300"
                    aria-hidden="true"
                  />
                  <p className="text-xs text-slate-500">
                    No primary contact has been set.
                  </p>
                  {canManageContacts && !isArchived ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => openContactForm()}
                      leftIcon={<Plus className="h-3 w-3" aria-hidden="true" />}
                    >
                      Add contact
                    </Button>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          )}

          {customer.leads.length > 0 ? (
            <Card>
              <CardHeader
                title="Linked enquiries"
                action={
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTab("leads")}
                  >
                    View all
                  </Button>
                }
              />
              <CardBody className="space-y-2">
                {customer.leads.slice(0, 3).map((lead) => (
                  <Link
                    key={lead.id}
                    to={`/leads/${lead.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-200 hover:bg-brand-50/30"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
                        {lead.pipelineStage === "won" ? (
                          <Trophy
                            className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                            aria-hidden="true"
                          />
                        ) : (
                          <Target
                            className="h-3.5 w-3.5 shrink-0 text-slate-400"
                            aria-hidden="true"
                          />
                        )}
                        {lead.serviceInterest ?? lead.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {lead.leadNumber}
                      </p>
                    </div>
                    <Badge
                      variant={lead.pipelineStage === "won" ? "success" : "neutral"}
                    >
                      {lead.pipelineStage === "won" ? "Won" : "Enquiry"}
                    </Badge>
                  </Link>
                ))}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      {canUpdate ? (
        <CustomerForm
          open={editOpen}
          onClose={() => setEditOpen(false)}
          customer={customer}
        />
      ) : null}

      {canManageContacts ? (
        <ContactForm
          open={contactFormOpen}
          onClose={() => {
            setContactFormOpen(false);
            setEditingContact(null);
          }}
          customerId={customer.id}
          contact={editingContact ?? undefined}
        />
      ) : null}

      <CustomerActivityForm
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        customerId={customer.id}
        defaultType={activityType}
        defaultTitle={activityTitle}
        onSaved={() => setActivityPage(1)}
      />

      <LinkLeadDialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        customerId={customer.id}
        customerName={customerName}
      />

      <ConfirmDialog
        open={archiveOpen}
        title="Archive this customer?"
        description={`${customerName} will be removed from active customer lists but its contacts, enquiries and full activity history will be preserved. You can restore it later.`}
        confirmLabel="Archive customer"
        isLoading={archiveMutation.isPending}
        onConfirm={() => archiveMutation.mutate()}
        onCancel={() => setArchiveOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(removeContactTarget)}
        title="Remove this contact?"
        description={`${removeContactTarget?.fullName ?? "This contact"} will be removed from the customer. Past activity and notes that reference this contact are preserved.`}
        confirmLabel="Remove contact"
        isLoading={removeContactMutation.isPending}
        onConfirm={() => {
          if (removeContactTarget) {
            removeContactMutation.mutate(removeContactTarget);
          }
        }}
        onCancel={() => setRemoveContactTarget(null)}
      />
    </div>
  );
}
