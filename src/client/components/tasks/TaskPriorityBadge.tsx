import type { TaskPriority } from "../../../shared/constants/tasks";
import { TASK_PRIORITY_LABELS } from "../../../shared/constants/tasks";
import { Badge } from "../ui";

export function TaskPriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  switch (priority) {
    case "urgent":
      return (
        <Badge variant="danger" className={className}>
          {TASK_PRIORITY_LABELS[priority]}
        </Badge>
      );
    case "high":
      return (
        <Badge variant="warning" className={className}>
          {TASK_PRIORITY_LABELS[priority]}
        </Badge>
      );
    case "medium":
      return (
        <Badge variant="info" className={className}>
          {TASK_PRIORITY_LABELS[priority]}
        </Badge>
      );
    case "low":
    default:
      return (
        <Badge variant="neutral" className={className}>
          {TASK_PRIORITY_LABELS[priority]}
        </Badge>
      );
  }
}
