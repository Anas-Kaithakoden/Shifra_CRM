import { useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Plus } from "lucide-react";
import { PERMISSIONS } from "../../shared/types/permissions";
import type { TaskDto } from "../../shared/types/tasks";
import { useAuth } from "../hooks/useAuth";
import { useDebounce } from "../hooks/useDebounce";
import { useToast } from "../hooks/useToast";
import { hasPermission } from "../lib/permissions";
import { tasksService } from "../services/tasks.service";
import { usersService } from "../services/users.service";
import { Button, Card, EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from "../components/ui";
import { TaskBoard, TaskDetail, TaskFilters, TaskForm, TaskTable, type TaskFilterValues } from "../components/tasks";

const DEFAULT_FILTERS: TaskFilterValues = { search: "", status: "", priority: "", taskType: "", assignedTo: "" };

function ListSkeleton() {
  return <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>;
}

export function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [viewMode, setViewMode] = useState<"table" | "board">("table");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDto | null>(null);
  const [selected, setSelected] = useState<TaskDto | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const canCreate = hasPermission(user, PERMISSIONS.TASKS_CREATE);
  const canViewUsers = hasPermission(user, PERMISSIONS.USERS_READ) || hasPermission(user, PERMISSIONS.TASKS_ASSIGN);

  const usersQuery = useQuery({
    queryKey: ["users", "task-assignees"],
    queryFn: () => usersService.list({ page: 1, pageSize: 100, status: "active" }),
    enabled: canViewUsers,
  });

  useEffect(() => { setPage(1); }, [debouncedSearch, filters.status, filters.priority, filters.taskType, filters.assignedTo]);

  const listQuery = useQuery({
    queryKey: ["tasks", "all", { page, pageSize, search: debouncedSearch, status: filters.status, priority: filters.priority, taskType: filters.taskType, assignedTo: filters.assignedTo }],
    queryFn: () => tasksService.list({ page, pageSize, search: debouncedSearch || undefined, status: filters.status || undefined, priority: filters.priority as any || undefined, taskType: filters.taskType as any || undefined, assignedTo: filters.assignedTo || undefined, scope: "all" }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: ["tasks"] }); void queryClient.invalidateQueries({ queryKey: ["dashboard"] }); };
  const action = (fn: (task: TaskDto) => Promise<TaskDto>, okMsg: string) => async (task: TaskDto) => {
    try { await fn(task); toast({ title: okMsg, variant: "success" }); invalidate(); }
    catch (e) { toast({ title: "Action failed", description: e instanceof Error ? e.message : "Please try again.", variant: "error" }); }
  };

  const onComplete = action((t) => tasksService.complete(t.id), "Task completed");
  const onReopen = action((t) => tasksService.reopen(t.id), "Task reopened");
  const onCancel = action((t) => tasksService.cancel(t.id), "Task cancelled");
  const onReschedule = action(async (t) => { const v = window.prompt("New due date/time (ISO, e.g. 2026-11-06T10:00:00Z):", t.dueAt ?? ""); if (!v) throw new Error("Cancelled"); return tasksService.reschedule(t.id, v); }, "Task rescheduled");

  return (
    <div className="space-y-5">
      <PageHeader title="Tasks" description="Manage team tasks, follow-ups, reminders, and recurring work." actions={canCreate ? <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>New task</Button> : undefined} />
      <TaskFilters values={{ ...filters, search }} onChange={(p) => { if (p.search !== undefined) setSearch(p.search); setFilters((c) => ({ ...c, ...p, search: c.search })); }} onReset={() => { setSearch(""); setFilters(DEFAULT_FILTERS); }} users={usersQuery.data?.items ?? []} viewMode={viewMode} onViewModeChange={setViewMode} />
      <Card>
        {listQuery.isLoading ? <ListSkeleton /> : listQuery.isError || !listQuery.data ? <ErrorState title="Unable to load tasks" message="Please check your connection and try again." onRetry={() => void listQuery.refetch()} /> : listQuery.data.items.length === 0 ? <EmptyState icon={<CheckSquare className="h-5 w-5" />} title="No tasks found" description="Create a task or adjust filters." /> : viewMode === "board" ? <div className="p-4"><TaskBoard tasks={listQuery.data.items} onSelectTask={(t) => { setSelected(t); setDetailOpen(true); }} onCompleteTask={(t) => void onComplete(t)} /></div> : <>
          <TaskTable tasks={listQuery.data.items} total={listQuery.data.pagination.total} page={page} pageSize={pageSize} onPageChange={setPage} onSelectTask={(t) => { setSelected(t); setDetailOpen(true); }} onCompleteTask={(t) => void onComplete(t)} onReopenTask={(t) => void onReopen(t)} onCancelTask={(t) => void onCancel(t)} onRescheduleTask={(t) => void onReschedule(t)} onEditTask={(t) => { setEditing(t); setFormOpen(true); }} />
          <Pagination page={page} pageSize={pageSize} total={listQuery.data.pagination.total} totalPages={listQuery.data.pagination.totalPages} onPageChange={setPage} />
        </>}
      </Card>
      <TaskForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} task={editing} onSaved={() => invalidate()} />
      <TaskDetail task={selected} open={detailOpen} onClose={() => setDetailOpen(false)} onEdit={(t) => { setEditing(t); setFormOpen(true); }} onComplete={(t) => void onComplete(t)} onReopen={(t) => void onReopen(t)} onCancel={(t) => void onCancel(t)} onReschedule={(t) => void onReschedule(t)} />
    </div>
  );
}
