import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Plus } from "lucide-react";
import { PERMISSIONS } from "../../shared/types/permissions";
import type { TaskDto } from "../../shared/types/tasks";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { hasPermission } from "../lib/permissions";
import { tasksService } from "../services/tasks.service";
import { Button, Card, EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from "../components/ui";
import { FollowUpForm, TaskDetail, TaskTable } from "../components/tasks";

export function TaskFollowUpsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<TaskDto | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const canCreate = hasPermission(user, PERMISSIONS.TASKS_CREATE);

  const query = useQuery({
    queryKey: ["tasks", "follow-ups", page],
    queryFn: () => tasksService.list({ scope: "follow_up", page, pageSize: 20, sortBy: "due_at", sortDir: "asc" }),
  });
  const invalidate = () => void query.refetch();
  const run = (fn: (t: TaskDto) => Promise<unknown>, msg: string) => async (t: TaskDto) => {
    try { await fn(t); toast({ title: msg, variant: "success" }); invalidate(); }
    catch (e) { toast({ title: "Action failed", description: e instanceof Error ? e.message : undefined, variant: "error" }); }
  };
  const errorMessage = query.error instanceof Error ? query.error.message : "Please try again.";

  return (
    <div className="space-y-5">
      <PageHeader title="Task Follow-ups" description="Scheduled follow-up tasks linked to leads and customers." actions={canCreate ? <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>Schedule follow-up</Button> : undefined} />
      <Card>
        {query.isLoading ? <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div> : query.isError || !query.data ? <ErrorState title="Unable to load follow-ups" message={errorMessage} onRetry={() => void query.refetch()} /> : query.data.items.length === 0 ? <EmptyState icon={<CalendarClock className="h-5 w-5" />} title="No follow-up tasks" description="Schedule a follow-up task to track the next interaction." /> : <>
          <TaskTable tasks={query.data.items} total={query.data.pagination.total} page={page} pageSize={20} onPageChange={setPage} onSelectTask={(t) => { setSelected(t); setDetailOpen(true); }} onCompleteTask={run((t) => tasksService.complete(t.id), "Follow-up completed")} onReopenTask={run((t) => tasksService.reopen(t.id), "Follow-up reopened")} onCancelTask={run((t) => tasksService.cancel(t.id), "Follow-up cancelled")} onRescheduleTask={run(async (t) => { const v = window.prompt("New due date/time (ISO):", t.dueAt ?? ""); if (!v) throw new Error("Cancelled"); return tasksService.reschedule(t.id, v); }, "Follow-up rescheduled")} />
          <Pagination page={page} pageSize={20} total={query.data.pagination.total} totalPages={query.data.pagination.totalPages} onPageChange={setPage} />
        </>}
      </Card>
      <FollowUpForm open={formOpen} onClose={() => setFormOpen(false)} onScheduled={invalidate} />
      <TaskDetail task={selected} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </div>
  );
}
