import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus } from "lucide-react";
import { PERMISSIONS } from "../../shared/types/permissions";
import type { TaskDto } from "../../shared/types/tasks";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { hasPermission } from "../lib/permissions";
import { tasksService } from "../services/tasks.service";
import { Button, Card, EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from "../components/ui";
import { TaskDetail, TaskForm, TaskTable } from "../components/tasks";

export function MyTasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<TaskDto | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const canCreate = hasPermission(user, PERMISSIONS.TASKS_CREATE);

  const query = useQuery({ queryKey: ["tasks", "my", page], queryFn: () => tasksService.list({ scope: "my", page, pageSize: 20 }) });
  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: ["tasks"] }); void queryClient.invalidateQueries({ queryKey: ["dashboard"] }); };
  const run = (fn: (t: TaskDto) => Promise<unknown>, msg: string) => async (t: TaskDto) => { try { await fn(t); toast({ title: msg, variant: "success" }); invalidate(); } catch (e) { toast({ title: "Action failed", description: e instanceof Error ? e.message : undefined, variant: "error" }); } };

  return (
    <div className="space-y-5">
      <PageHeader title="My Tasks" description="Tasks assigned to you or created by you." actions={canCreate ? <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>New task</Button> : undefined} />
      <Card>
        {query.isLoading ? <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div> : query.isError || !query.data ? <ErrorState title="Unable to load tasks" message="Please try again." onRetry={() => void query.refetch()} /> : query.data.items.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="No tasks" description="You have no tasks in your scope." /> : <>
          <TaskTable tasks={query.data.items} total={query.data.pagination.total} page={page} pageSize={20} onPageChange={setPage} onSelectTask={(t) => { setSelected(t); setDetailOpen(true); }} onCompleteTask={run((t) => tasksService.complete(t.id), "Task completed")} onReopenTask={run((t) => tasksService.reopen(t.id), "Task reopened")} onCancelTask={run((t) => tasksService.cancel(t.id), "Task cancelled")} onRescheduleTask={run(async (t) => { const v = window.prompt("New due date/time (ISO):", t.dueAt ?? ""); if (!v) throw new Error("Cancelled"); return tasksService.reschedule(t.id, v); }, "Task rescheduled")} />
          <Pagination page={page} pageSize={20} total={query.data.pagination.total} totalPages={query.data.pagination.totalPages} onPageChange={setPage} />
        </>}
      </Card>
      <TaskForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={invalidate} />
      <TaskDetail task={selected} open={detailOpen} onClose={() => setDetailOpen(false)} onComplete={run((t) => tasksService.complete(t.id), "Task completed")} onReopen={run((t) => tasksService.reopen(t.id), "Task reopened")} onCancel={run((t) => tasksService.cancel(t.id), "Task cancelled")} onReschedule={run(async (t) => { const v = window.prompt("New due date/time (ISO):", t.dueAt ?? ""); if (!v) throw new Error("Cancelled"); return tasksService.reschedule(t.id, v); }, "Task rescheduled")} />
    </div>
  );
}
