import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Phone,
  RotateCcw,
  Search,
  Target,
  XCircle,
} from "lucide-react";
import { PERMISSIONS } from "../../shared/types/permissions";
import type { LeadFollowUpDto } from "../../shared/types/leads";
import { useAuth } from "../hooks/useAuth";
import { useDebounce } from "../hooks/useDebounce";
import { useToast } from "../hooks/useToast";
import {
  defaultFollowUpDateTimeValue,
  formatCrmDateTime,
  formatRelativeTime,
  fromDateTimeInputValue,
  isPastDateTime,
  toDateTimeInputValue,
} from "../lib/format";
import { hasPermission } from "../lib/permissions";
import { followUpsService, type FollowUpScope } from "../services/follow-ups.service";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Skeleton,
  Textarea,
} from "../components/ui";
import { cn } from "../lib/cn";

const SCOPE_TABS: Array<{
  key: FollowUpScope;
  label: string;
  countKey: "today" | "upcoming" | "overdue" | "completed";
  icon: typeof CalendarClock;
  emptyTitle: string;
  emptyDescription: string;
}> = [
  {
    key: "today",
    label: "Today",
    countKey: "today",
    icon: CalendarCheck2,
    emptyTitle: "Nothing due today",
    emptyDescription: "Follow-ups scheduled for today will appear here.",
  },
  {
    key: "upcoming",
    label: "Upcoming",
    countKey: "upcoming",
    icon: CalendarDays,
    emptyTitle: "No upcoming follow-ups",
    emptyDescription: "Schedule a follow-up from a lead to see it here.",
  },
  {
    key: "overdue",
    label: "Overdue",
    countKey: "overdue",
    icon: Clock,
    emptyTitle: "Nothing overdue",
    emptyDescription: "Every pending follow-up is still on schedule.",
  },
  {
    key: "completed",
    label: "Completed",
    countKey: "completed",
    icon: CheckCircle2,
    emptyTitle: "No completed follow-ups",
    emptyDescription: "Completed follow-ups are kept here for your records.",
  },
];

function ListSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="space-y-2 px-4 py-4">
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

function statusBadge(followUp: LeadFollowUpDto) {
  if (followUp.status === "completed") {
    return <Badge variant="success">Completed</Badge>;
  }
  if (followUp.status === "cancelled") {
    return <Badge variant="neutral">Cancelled</Badge>;
  }
  return isPastDateTime(followUp.scheduledAt) ? (
    <Badge variant="danger">Overdue</Badge>
  ) : (
    <Badge variant="warning">Pending</Badge>
  );
}

export function FollowUpsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [scope, setScope] = useState<FollowUpScope>("today");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [completeTarget, setCompleteTarget] = useState<LeadFollowUpDto | null>(
    null,
  );
  const [completeNote, setCompleteNote] = useState("");
  const [rescheduleTarget, setRescheduleTarget] =
    useState<LeadFollowUpDto | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState(
    defaultFollowUpDateTimeValue,
  );
  const [cancelTarget, setCancelTarget] = useState<LeadFollowUpDto | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const canUpdate = hasPermission(user, PERMISSIONS.FOLLOWUPS_UPDATE);

  const countsQuery = useQuery({
    queryKey: ["follow-ups", "counts"],
    queryFn: () => followUpsService.counts(),
  });

  useEffect(() => {
    setPage(1);
  }, [scope, debouncedSearch, pageSize]);

  const listQuery = useQuery({
    queryKey: ["follow-ups", "list", { scope, search: debouncedSearch, page, pageSize }],
    queryFn: () =>
      followUpsService.list({
        scope,
        page,
        pageSize,
        search: debouncedSearch || undefined,
      }),
  });

  useEffect(() => {
    const totalPages = listQuery.data?.pagination.totalPages ?? 0;
    if (listQuery.data && page > Math.max(1, totalPages)) {
      setPage(Math.max(1, totalPages));
    }
  }, [listQuery.data, page]);

  const items = listQuery.data?.items ?? [];
  const pagination = listQuery.data?.pagination;
  const activeTab = useMemo(
    () => SCOPE_TABS.find((tab) => tab.key === scope) ?? SCOPE_TABS[0],
    [scope],
  );

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const completeMutation = useMutation({
    mutationFn: () =>
      followUpsService.complete(
        completeTarget?.id ?? "",
        completeNote.trim() || undefined,
      ),
    onSuccess: () => {
      toast({ title: "Follow-up completed", variant: "success" });
      setCompleteTarget(null);
      setCompleteNote("");
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

  const rescheduleMutation = useMutation({
    mutationFn: () =>
      followUpsService.reschedule(
        rescheduleTarget?.id ?? "",
        fromDateTimeInputValue(rescheduleValue),
      ),
    onSuccess: () => {
      toast({ title: "Follow-up rescheduled", variant: "success" });
      setRescheduleTarget(null);
      invalidateAll();
    },
    onError: (error) => {
      toast({
        title: "Could not reschedule the follow-up",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      followUpsService.cancel(
        cancelTarget?.id ?? "",
        cancelReason.trim() || undefined,
      ),
    onSuccess: () => {
      toast({ title: "Follow-up cancelled", variant: "success" });
      setCancelTarget(null);
      setCancelReason("");
      invalidateAll();
    },
    onError: (error) => {
      toast({
        title: "Could not cancel the follow-up",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    },
  });

  const openReschedule = (followUp: LeadFollowUpDto) => {
    setRescheduleTarget(followUp);
    setRescheduleValue(
      toDateTimeInputValue(followUp.scheduledAt) ||
        defaultFollowUpDateTimeValue(),
    );
  };

  const handleRescheduleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const date = new Date(rescheduleValue);
    if (!rescheduleValue || Number.isNaN(date.getTime())) {
      toast({
        title: "Choose a valid date and time",
        variant: "error",
      });
      return;
    }
    rescheduleMutation.mutate();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Follow-ups"
        description="Stay on top of every scheduled conversation across your leads."
        actions={
          <select
            aria-label="Rows per page"
            value={String(pageSize)}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm"
          >
            <option value="10">10 / page</option>
            <option value="20">20 / page</option>
            <option value="50">50 / page</option>
          </select>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SCOPE_TABS.map((tab) => {
          const Icon = tab.icon;
          const count = countsQuery.data?.[tab.countKey] ?? 0;
          const isActive = scope === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setScope(tab.key)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition-colors",
                isActive
                  ? "border-brand-300 ring-2 ring-brand-100"
                  : "border-slate-200 hover:border-brand-200 hover:bg-brand-50/20",
              )}
              aria-pressed={isActive}
            >
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {tab.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {countsQuery.isLoading ? "—" : count}
                </p>
              </div>
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  tab.key === "overdue"
                    ? "bg-rose-50 text-rose-600"
                    : tab.key === "completed"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-brand-50 text-brand-700",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by lead, title or phone"
              aria-label="Search follow-ups"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>

        {listQuery.isLoading ? (
          <ListSkeleton />
        ) : listQuery.isError ? (
          <div className="p-4">
            <ErrorState
              title="Unable to load follow-ups"
              message="Please check your connection and try again."
              onRetry={() => {
                void listQuery.refetch();
              }}
            />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
            title={debouncedSearch ? "No matching follow-ups" : activeTab.emptyTitle}
            description={
              debouncedSearch
                ? "Try a different search term or switch tabs."
                : activeTab.emptyDescription
            }
            action={
              debouncedSearch ? (
                <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              ) : scope !== "today" ? (
                <Link to="/leads">
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Target className="h-4 w-4" aria-hidden="true" />}
                  >
                    Go to leads
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {items.map((followUp) => {
                const overdue =
                  followUp.status === "pending" &&
                  isPastDateTime(followUp.scheduledAt);
                return (
                  <li key={followUp.id} className="px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {followUp.title}
                          </p>
                          {statusBadge(followUp)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 font-medium",
                              overdue ? "text-rose-600" : "text-slate-600",
                            )}
                          >
                            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                            {formatCrmDateTime(followUp.scheduledAt)}
                            {followUp.status === "pending"
                              ? ` · ${formatRelativeTime(followUp.scheduledAt)}`
                              : ""}
                          </span>
                          {followUp.leadName ? (
                            <Link
                              to={`/leads/${followUp.leadId}`}
                              className="inline-flex items-center gap-1 font-medium text-brand-700 hover:text-brand-800"
                            >
                              {followUp.leadName}
                              {followUp.leadNumber ? ` · ${followUp.leadNumber}` : ""}
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </Link>
                          ) : null}
                          {followUp.leadPhone ? (
                            <a
                              href={`tel:${followUp.leadPhone}`}
                              className="inline-flex items-center gap-1 hover:text-slate-700"
                            >
                              <Phone className="h-3 w-3" aria-hidden="true" />
                              {followUp.leadPhone}
                            </a>
                          ) : null}
                          {followUp.assignedToName ? (
                            <span>Owner: {followUp.assignedToName}</span>
                          ) : null}
                        </div>
                        {followUp.notes ? (
                          <p className="max-w-2xl whitespace-pre-line text-xs text-slate-500">
                            {followUp.notes}
                          </p>
                        ) : null}
                        {followUp.status === "completed" &&
                        followUp.completedAt ? (
                          <p className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Completed {formatCrmDateTime(followUp.completedAt)}
                          </p>
                        ) : null}
                      </div>

                      {canUpdate && followUp.status === "pending" ? (
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            leftIcon={
                              <CheckCircle2
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            }
                            onClick={() => {
                              setCompleteTarget(followUp);
                              setCompleteNote("");
                            }}
                          >
                            Complete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={
                              <RotateCcw
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            }
                            onClick={() => openReschedule(followUp)}
                          >
                            Reschedule
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCancelTarget(followUp);
                              setCancelReason("");
                            }}
                            leftIcon={
                              <XCircle
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            }
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Link to={`/leads/${followUp.leadId}`} className="shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={
                              <ExternalLink
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            }
                          >
                            Open lead
                          </Button>
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {pagination ? (
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.total}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </Card>

      <p className="text-xs text-slate-400">
        {listQuery.isFetching && !listQuery.isLoading
          ? "Refreshing follow-ups…"
          : "Times are shown in Asia/Kolkata. Completing, rescheduling or cancelling a follow-up is recorded in the audit log."}
      </p>

      <Modal
        open={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
        title="Complete follow-up"
        description={completeTarget?.title}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCompleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => completeMutation.mutate()}
              isLoading={completeMutation.isPending}
            >
              Complete
            </Button>
          </>
        }
      >
        <Textarea
          label="Completion note (optional)"
          value={completeNote}
          onChange={(event) => setCompleteNote(event.target.value)}
          rows={3}
          placeholder="What was the outcome of this follow-up?"
        />
      </Modal>

      <Modal
        open={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        title="Reschedule follow-up"
        description={rescheduleTarget?.title}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRescheduleTarget(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="reschedule-follow-up-form"
              isLoading={rescheduleMutation.isPending}
            >
              Reschedule
            </Button>
          </>
        }
      >
        <form
          id="reschedule-follow-up-form"
          onSubmit={handleRescheduleSubmit}
          className="space-y-4"
        >
          <Input
            label="New date and time"
            type="datetime-local"
            value={rescheduleValue}
            onChange={(event) => setRescheduleValue(event.target.value)}
            required
          />
          <p className="text-xs text-slate-500">
            The previous schedule stays visible in the activity timeline.
          </p>
        </form>
      </Modal>

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancel follow-up"
        description={`Cancel "${cancelTarget?.title ?? "this follow-up"}"? It will move to cancelled and stop appearing in your due list.`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => cancelMutation.mutate()}
              isLoading={cancelMutation.isPending}
            >
              Cancel follow-up
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason (optional)"
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          rows={3}
          placeholder="Why is this follow-up no longer needed?"
        />
      </Modal>
    </div>
  );
}
