import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Target,
  Trophy,
  UserPlus,
  UserRound,
} from "lucide-react";
import {
  ACTIVITY_TYPE_LABELS,
  MANUAL_ACTIVITY_TYPES,
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type ManualActivityType,
  type PipelineStage,
} from "../../shared/constants/leads";
import { PERMISSIONS } from "../../shared/types/permissions";
import type { LeadFollowUpDto } from "../../shared/types/leads";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { ApiError } from "../lib/api";
import {
  formatCrmDateTime,
  formatCurrencyInr,
  isPastDateTime,
} from "../lib/format";
import { hasPermission } from "../lib/permissions";
import { leadsService } from "../services/leads.service";
import { followUpsService } from "../services/follow-ups.service";
import { customersService } from "../services/customers.service";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from "../components/ui";
import {
  ActivityTimeline,
  ContactStatusBadge,
  FollowUpForm,
  LeadForm,
  PriorityBadge,
  StageBadge,
} from "../components/leads";
import { EntityTasksSection } from "../components/tasks";
import { ConvertLeadDialog } from "../components/customers";

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
        <div className="text-sm text-slate-700">{children}</div>
      </div>
    </div>
  );
}

export function LeadDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [activityType, setActivityType] =
    useState<ManualActivityType>("call");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [contacted, setContacted] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [newStage, setNewStage] = useState<PipelineStage>("new");
  const [lostReason, setLostReason] = useState("");
  const [stageReason, setStageReason] = useState("");
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<LeadFollowUpDto | null>(
    null,
  );
  const [convertOpen, setConvertOpen] = useState(false);

  const leadQuery = useQuery({
    queryKey: ["leads", "detail", id],
    queryFn: () => leadsService.get(id),
    enabled: Boolean(id),
  });

  const linkedCustomerId = leadQuery.data?.customerId ?? null;
  const linkedCustomerQuery = useQuery({
    queryKey: ["customers", "detail", linkedCustomerId],
    queryFn: () => customersService.get(linkedCustomerId ?? ""),
    enabled: Boolean(linkedCustomerId) &&
      hasPermission(user, PERMISSIONS.CUSTOMERS_READ),
  });

  const activitiesQuery = useQuery({
    queryKey: ["leads", "activities", id],
    queryFn: () => leadsService.listActivities(id, { pageSize: 100 }),
    enabled: Boolean(id),
  });

  const followUpsQuery = useQuery({
    queryKey: ["follow-ups", "lead", id],
    queryFn: () => followUpsService.list({ leadId: id, pageSize: 100 }),
    enabled: Boolean(id),
  });

  const lead = leadQuery.data;
  const activities = activitiesQuery.data?.items ?? [];
  const followUps = followUpsQuery.data?.items ?? [];
  const pendingFollowUps = followUps.filter(
    (followUp) => followUp.status === "pending",
  );

  const canManage = Boolean(
    lead &&
      user &&
      (user.role === "owner" ||
        user.role === "admin" ||
        lead.assignedTo === user.id),
  );
  const canEdit = canManage && hasPermission(user, PERMISSIONS.LEADS_UPDATE);
  const canStage = canManage && hasPermission(user, PERMISSIONS.LEADS_STAGE);
  const canSchedule =
    canManage && hasPermission(user, PERMISSIONS.FOLLOWUPS_CREATE);
  const canConvert =
    canManage &&
    hasPermission(user, PERMISSIONS.CUSTOMERS_LINK_LEADS) &&
    lead?.pipelineStage === "won" &&
    !lead.customerId;

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const noteMutation = useMutation({
    mutationFn: () =>
      leadsService.addActivity(id, {
        activityType: "note",
        title: "Note added",
        description: note.trim(),
      }),
    onSuccess: () => {
      toast({ title: "Note added", variant: "success" });
      setNote("");
      setNoteOpen(false);
      invalidateAll();
    },
    onError: (error) => {
      toast({
        title: "Could not add the note",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    },
  });

  const interactionMutation = useMutation({
    mutationFn: () =>
      leadsService.addActivity(id, {
        activityType,
        title:
          activityTitle.trim() ||
          `${ACTIVITY_TYPE_LABELS[activityType]} with lead`,
        description: activityNotes.trim() || undefined,
        contacted: contacted || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Interaction logged", variant: "success" });
      setActivityTitle("");
      setActivityNotes("");
      setContacted(false);
      setInteractionOpen(false);
      invalidateAll();
    },
    onError: (error) => {
      toast({
        title: "Could not log the interaction",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    },
  });

  const stageMutation = useMutation({
    mutationFn: () =>
      leadsService.changeStage(id, {
        stage: newStage,
        lostReason: lostReason.trim() || undefined,
        reason: stageReason.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Lead stage updated", variant: "success" });
      setStageOpen(false);
      setLostReason("");
      setStageReason("");
      invalidateAll();
    },
    onError: (error) => {
      toast({
        title: "Could not change the stage",
        description:
          error instanceof ApiError ? error.message : "Please try again.",
        variant: "error",
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (followUpId: string) =>
      followUpsService.complete(followUpId, "Completed from the lead page."),
    onSuccess: () => {
      toast({ title: "Follow-up completed", variant: "success" });
      setCompleteTarget(null);
      invalidateAll();
    },
    onError: (error) => {
      toast({
        title: "Could not complete the follow-up",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    },
  });

  if (leadQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (leadQuery.isError || !lead) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/leads")}
          leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
        >
          Back to leads
        </Button>
        <ErrorState
          title="Unable to load this lead"
          message={
            leadQuery.error instanceof ApiError
              ? leadQuery.error.message
              : "The lead may have been archived or you may not have access."
          }
          onRetry={() => {
            void leadQuery.refetch();
          }}
        />
      </div>
    );
  }

  const phoneDigits = lead.phone.replace(/\D/g, "");
  const whatsAppText = encodeURIComponent(
    `Hello ${lead.name}, this is Shifra Nuha Technologies following up on your enquiry${
      lead.serviceInterest ? ` about ${lead.serviceInterest}` : ""
    }.`,
  );
  const whatsAppHref = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${whatsAppText}`
    : undefined;

  const openStageModal = () => {
    setNewStage(lead.pipelineStage);
    setLostReason(lead.lostReason ?? "");
    setStageReason("");
    setStageOpen(true);
  };

  const handleInteractionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activityTitle.trim() && !activityNotes.trim()) {
      toast({
        title: "Add a title or note",
        description: "Describe the interaction before saving.",
        variant: "error",
      });
      return;
    }
    interactionMutation.mutate();
  };

  return (
    <div className="space-y-5">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/leads")}
          leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          className="-ml-2"
        >
          Back to leads
        </Button>
      </div>

      <PageHeader
        title={lead.name}
        description={`${lead.leadNumber}${lead.businessName ? ` · ${lead.businessName}` : ""}`}
        actions={
          <>
            <a href={`tel:${lead.phone}`}>
              <Button
                variant="outline"
                leftIcon={<Phone className="h-4 w-4" aria-hidden="true" />}
              >
                Call
              </Button>
            </a>
            {whatsAppHref ? (
              <a href={whatsAppHref} target="_blank" rel="noreferrer">
                <Button
                  variant="outline"
                  leftIcon={
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  }
                >
                  WhatsApp
                </Button>
              </a>
            ) : null}
            {canConvert ? (
              <Button
                onClick={() => setConvertOpen(true)}
                leftIcon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
              >
                Convert to customer
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                variant="outline"
                onClick={() => setEditOpen(true)}
                leftIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}
              >
                Edit
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <StageBadge stage={lead.pipelineStage} />
        <ContactStatusBadge status={lead.contactStatus} />
        <PriorityBadge priority={lead.priority} />
        {lead.nextFollowUpAt ? (
          <Badge
            variant={isPastDateTime(lead.nextFollowUpAt) ? "danger" : "warning"}
          >
            <CalendarClock className="h-3 w-3" aria-hidden="true" />
            Follow-up {formatCrmDateTime(lead.nextFollowUpAt)}
          </Badge>
        ) : null}
        {lead.convertedToCustomerAt ? (
          <Badge variant="success">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            Converted {formatCrmDateTime(lead.convertedToCustomerAt)}
          </Badge>
        ) : null}
      </div>

      {lead.customerId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-emerald-900">
                This lead is linked to a customer
              </p>
              <p className="text-xs text-emerald-700">
                {linkedCustomerQuery.data
                  ? `${linkedCustomerQuery.data.customerNumber} · ${
                      linkedCustomerQuery.data.businessName ??
                      linkedCustomerQuery.data.name
                    }`
                  : lead.convertedToCustomerAt
                    ? `Converted ${formatCrmDateTime(lead.convertedToCustomerAt)}`
                    : "The customer record holds the ongoing relationship history."}
              </p>
            </div>
          </div>
          {hasPermission(user, PERMISSIONS.CUSTOMERS_READ) ? (
            <Link to={`/customers/${lead.customerId}`}>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Building2 className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                View customer
              </Button>
            </Link>
          ) : null}
        </div>
      ) : lead.pipelineStage === "won" && canManage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-brand-900">
              Won lead not yet converted
            </p>
            <p className="text-xs text-brand-700">
              Link it to an existing customer or review prefilled details before
              creating a new customer record.
            </p>
          </div>
          {canConvert ? (
            <Button
              size="sm"
              onClick={() => setConvertOpen(true)}
              leftIcon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Convert to customer
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader
              title="Contact and enquiry"
              description="Everything captured for this lead."
            />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone">
                {lead.phone}
              </InfoRow>
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email">
                {lead.email ?? "—"}
              </InfoRow>
              <InfoRow
                icon={<Building2 className="h-4 w-4" />}
                label="Business"
              >
                {lead.businessName ?? "—"}
              </InfoRow>
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location">
                {lead.location ?? "—"}
              </InfoRow>
              <InfoRow icon={<Target className="h-4 w-4" />} label="Service">
                {lead.serviceInterest ?? "—"}
                {lead.serviceCategory ? (
                  <span className="block text-xs text-slate-400">
                    {lead.serviceCategory}
                  </span>
                ) : null}
              </InfoRow>
              <InfoRow
                icon={<Trophy className="h-4 w-4" />}
                label="Estimated value"
              >
                {formatCurrencyInr(lead.estimatedValue)}
              </InfoRow>
              <InfoRow icon={<UserRound className="h-4 w-4" />} label="Owner">
                {lead.assignedToName ?? "Unassigned"}
              </InfoRow>
              <InfoRow
                icon={<CalendarClock className="h-4 w-4" />}
                label="Created"
              >
                {formatCrmDateTime(lead.createdAt)}
                {lead.createdByName ? (
                  <span className="block text-xs text-slate-400">
                    by {lead.createdByName}
                  </span>
                ) : null}
              </InfoRow>
              <InfoRow
                icon={<CalendarClock className="h-4 w-4" />}
                label="Last contacted"
              >
                {formatCrmDateTime(lead.lastContactedAt)}
              </InfoRow>
              <InfoRow
                icon={<CalendarClock className="h-4 w-4" />}
                label="Source"
              >
                {lead.source}
              </InfoRow>
              {lead.description ? (
                <div className="sm:col-span-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Notes
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                    {lead.description}
                  </p>
                </div>
              ) : null}
              {lead.lostReason ? (
                <div className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-rose-500">
                    Lost reason
                  </p>
                  <p className="mt-0.5 text-sm text-rose-700">
                    {lead.lostReason}
                  </p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {hasPermission(user, PERMISSIONS.TASKS_READ) ? (
            <EntityTasksSection leadId={id} canCreate={hasPermission(user, PERMISSIONS.TASKS_CREATE)} />
          ) : null}

          <Card>
            <CardHeader
              title="Activity timeline"
              description="Calls, notes, stage moves and follow-ups."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void activitiesQuery.refetch();
                  }}
                >
                  Refresh
                </Button>
              }
            />
            <CardBody>
              {activitiesQuery.isError ? (
                <ErrorState
                  title="Unable to load activity"
                  message="Please try again."
                  onRetry={() => {
                    void activitiesQuery.refetch();
                  }}
                />
              ) : (
                <ActivityTimeline activities={activities} />
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Quick actions"
              description="Keep the lead moving."
            />
            <CardBody className="grid grid-cols-2 gap-2">
              {canEdit ? (
                <Button
                  variant="outline"
                  onClick={() => setNoteOpen(true)}
                  leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                >
                  Add note
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  variant="outline"
                  onClick={() => setInteractionOpen(true)}
                  leftIcon={
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  }
                >
                  Log interaction
                </Button>
              ) : null}
              {canSchedule ? (
                <Button
                  variant="outline"
                  onClick={() => setFollowUpOpen(true)}
                  leftIcon={
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  }
                >
                  Schedule follow-up
                </Button>
              ) : null}
              {canStage ? (
                <Button
                  variant="outline"
                  onClick={openStageModal}
                  leftIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
                >
                  Change stage
                </Button>
              ) : null}
              {canConvert ? (
                <Button
                  variant="outline"
                  onClick={() => setConvertOpen(true)}
                  leftIcon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
                >
                  Convert to customer
                </Button>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Follow-ups"
              description="Pending reminders for this lead."
              action={
                <Link
                  to="/follow-ups"
                  className="text-xs font-medium text-brand-700 hover:text-brand-800"
                >
                  View all
                </Link>
              }
            />
            <CardBody className="space-y-2">
              {followUpsQuery.isLoading ? (
                <Skeleton className="h-16 rounded-lg" />
              ) : pendingFollowUps.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                  No pending follow-ups.
                </p>
              ) : (
                pendingFollowUps.map((followUp) => (
                  <div
                    key={followUp.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">
                        {followUp.title}
                      </p>
                      {isPastDateTime(followUp.scheduledAt) ? (
                        <Badge variant="danger">Overdue</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatCrmDateTime(followUp.scheduledAt)}
                      {followUp.assignedToName
                        ? ` · ${followUp.assignedToName}`
                        : ""}
                    </p>
                    {followUp.notes ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {followUp.notes}
                      </p>
                    ) : null}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      leftIcon={
                        <CheckCircle2
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      }
                      onClick={() => setCompleteTarget(followUp)}
                    >
                      Complete
                    </Button>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <LeadForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        lead={lead}
      />

      <ConvertLeadDialog
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        lead={lead}
        onConverted={(result) => navigate(`/customers/${result.customer.id}`)}
      />

      <FollowUpForm
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        leadId={lead.id}
        defaultAssignedTo={lead.assignedTo}
      />

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Add note"
        description="Notes appear on the activity timeline."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => noteMutation.mutate()}
              isLoading={noteMutation.isPending}
              disabled={!note.trim()}
            >
              Add note
            </Button>
          </>
        }
      >
        <Textarea
          label="Note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          placeholder="Share context, a decision or next steps."
          required
        />
      </Modal>

      <Modal
        open={interactionOpen}
        onClose={() => setInteractionOpen(false)}
        title="Log interaction"
        description="Contact status updates automatically based on the interaction."
        footer={
          <>
            <Button variant="outline" onClick={() => setInteractionOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="log-interaction-form"
              isLoading={interactionMutation.isPending}
            >
              Log interaction
            </Button>
          </>
        }
      >
        <form
          id="log-interaction-form"
          onSubmit={handleInteractionSubmit}
          className="space-y-4"
        >
          <Select
            label="Interaction type"
            value={activityType}
            onChange={(event) =>
              setActivityType(event.target.value as ManualActivityType)
            }
          >
            {MANUAL_ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {ACTIVITY_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
          <Input
            label="Title"
            value={activityTitle}
            onChange={(event) => setActivityTitle(event.target.value)}
            placeholder="e.g. Discussed pricing"
          />
          <Textarea
            label="Details"
            value={activityNotes}
            onChange={(event) => setActivityNotes(event.target.value)}
            rows={3}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={contacted}
              onChange={(event) => setContacted(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-700"
            />
            I spoke with the lead
          </label>
        </form>
      </Modal>

      <Modal
        open={stageOpen}
        onClose={() => setStageOpen(false)}
        title="Change stage"
        description="Moving a closed lead back into the pipeline reopens it."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setStageOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => stageMutation.mutate()}
              isLoading={stageMutation.isPending}
              disabled={newStage === lead.pipelineStage}
            >
              Save stage
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="New stage"
            value={newStage}
            onChange={(event) =>
              setNewStage(event.target.value as PipelineStage)
            }
          >
            {PIPELINE_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {PIPELINE_STAGE_LABELS[stage]}
              </option>
            ))}
          </Select>
          {newStage === "lost" ? (
            <Textarea
              label="Lost reason"
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
              rows={3}
              required
            />
          ) : null}
          <Textarea
            label="Reason / note (optional)"
            value={stageReason}
            onChange={(event) => setStageReason(event.target.value)}
            rows={2}
          />
          {newStage === lead.pipelineStage ? (
            <p className="text-xs text-slate-500">
              Choose a different stage to continue.
            </p>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(completeTarget)}
        title="Complete follow-up"
        description={`Mark "${completeTarget?.title ?? "this follow-up"}" as completed?`}
        confirmLabel="Complete"
        variant="primary"
        isLoading={completeMutation.isPending}
        onConfirm={() => {
          if (completeTarget) {
            completeMutation.mutate(completeTarget.id);
          }
        }}
        onCancel={() => setCompleteTarget(null)}
      />
    </div>
  );
}
