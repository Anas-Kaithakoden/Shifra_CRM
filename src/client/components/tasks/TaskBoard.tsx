import { CheckCircle2, Clock, PlayCircle } from "lucide-react";
import type { TaskDto } from "../../../shared/types/tasks";
import { TaskCard } from "./TaskCard";

export function TaskBoard({
  tasks = [],
  onSelectTask,
  onCompleteTask,
}: {
  tasks: TaskDto[];
  onSelectTask: (task: TaskDto) => void;
  onCompleteTask?: (task: TaskDto) => void;
}) {
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const completedTasks = tasks.filter(
    (t) => t.status === "completed" || t.status === "cancelled",
  );

  const columns = [
    {
      id: "pending",
      title: "Pending",
      icon: Clock,
      color: "border-amber-200 bg-amber-50/40 text-amber-800",
      tasks: pendingTasks,
    },
    {
      id: "in_progress",
      title: "In Progress",
      icon: PlayCircle,
      color: "border-sky-200 bg-sky-50/40 text-sky-800",
      tasks: inProgressTasks,
    },
    {
      id: "completed",
      title: "Completed & Archived",
      icon: CheckCircle2,
      color: "border-emerald-200 bg-emerald-50/40 text-emerald-800",
      tasks: completedTasks,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 items-start">
      {columns.map((column) => {
        const Icon = column.icon;
        return (
          <div
            key={column.id}
            className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-3 min-h-[300px]"
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 mb-3 px-1">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  {column.title}
                </h3>
              </div>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {column.tasks.length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh] pr-1">
              {column.tasks.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
                  No tasks
                </div>
              ) : (
                column.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onSelect={onSelectTask}
                    onComplete={onCompleteTask}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
