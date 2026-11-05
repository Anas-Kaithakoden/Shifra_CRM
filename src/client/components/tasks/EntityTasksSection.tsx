import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Plus } from "lucide-react";
import type { TaskDto } from "../../../shared/types/tasks";
import { useToast } from "../../hooks/useToast";
import { tasksService } from "../../services/tasks.service";
import { Button, Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton } from "../ui";
import { FollowUpForm, TaskDetail, TaskForm, TaskTable } from "./index";

export function EntityTasksSection({
  title = "Tasks & Follow-ups",
  leadId,
  customerId,
  canCreate = false,
}: {
  title?: string;
  leadId?: string | null;
  customerId?: string | null;
  canCreate?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [selected, setSelected] = useState<TaskDto | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const query = useQuery({
    queryKey: ["tasks", "entity", { leadId, customerId, page }],
    queryFn: () => tasksService.list({ leadId: leadId ?? undefined, customerId: customerId ?? undefined, page, pageSize: 10, sortBy: "due_at", sortDir: "asc" }),
    enabled: Boolean(leadId || customerId),
  });

  const invalidate = () => { void query.refetch(); void queryClient.invalidateQueries({ queryKey: ["tasks"] }); void queryClient.invalidateQueries({ queryKey: ["dashboard"] }); };
  const run = (fn: (t: TaskDto) => Promise<unknown>, msg: string) => async (t: TaskDto) => {
    try { await fn(t); toast({ title: msg, variant: "success" }); invalidate(); }
    catch (e) { toast({ title: "Action failed", description: e instanceof Error ? e.message : undefined, variant: "error" }); }
  };

  return (
    <>
      <Card>
        <CardHeader
          title={title}
          description="Tasks and follow-ups linked to this record."
          action={canCreate ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" leftIcon={<Clock className="h-3.5 w-3.5" />} onClick={() => setFollowUpOpen(true)}>Follow-up</Button>
              <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setTaskFormOpen(true)}>Task</Button>
            </div>
          ) : undefined}
        />
        <CardBody>
          {query.isLoading ? <Skeleton className="h-20 rounded-lg" /> : query.isError || !query.data ? <ErrorState title="Unable to load tasks" message="Please try again." onRetry={() => void query.refetch()} /> : query.data.items.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="No tasks yet" description="Create a task or schedule a follow-up for this record." /> : (
            <TaskTable
              tasks={query.data.items}
              total={query.data.pagination.total}
              page={page}
              pageSize={10}
              onPageChange={setPage}
              onSelectTask={(t) => { setSelected(t); setDetailOpen(true); }}
              onCompleteTask={run((t) => tasksService.complete(t.id), "Task completed")}
              onReopenTask={run((t) => tasksService.reopen(t.id), "Task reopened")}
              onCancelTask={run((t) => tasksService.cancel(t.id), "Task cancelled")}
              onRescheduleTask={run(async (t) => { const v = window.prompt("New due date/time (ISO):", t.dueAt ?? ""); if (!v) throw new Error("Cancelled"); return tasksService.reschedule(t.id, v); }, "Task rescheduled")}
            />
          )}
        </CardBody>
      </Card>
      <TaskForm open={taskFormOpen} onClose={() => setTaskFormOpen(false)} defaultLeadId={leadId} defaultCustomerId={customerId} onSaved={invalidate} />
      <FollowUpForm open={followUpOpen} onClose={() => setFollowUpOpen(false)} leadId={leadId} customerId={customerId} onScheduled={invalidate} />
      <TaskDetail task={selected} open={detailOpen} onClose={() => setDetailOpen(false)} onComplete={run((t) => tasksService.complete(t.id), "Task completed")} onReopen={run((t) => tasksService.reopen(t.id), "Task reopened")} onCancel={run((t) => tasksService.cancel(t.id), "Task cancelled")} onReschedule={run(async (t) => { const v = window.prompt("New due date/time (ISO):", t.dueAt ?? ""); if (!v) throw new Error("Cancelled"); return tasksService.reschedule(t.id, v); }, "Task rescheduled")} />
    </>
  );
}
