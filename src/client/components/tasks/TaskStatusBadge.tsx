import type { TaskStatus } from "../../../shared/constants/tasks";
import { TASK_STATUS_LABELS } from "../../../shared/constants/tasks";
import { Badge } from "../ui";

export function TaskStatusBadge({
  status,
  isOverdue = false,
  className,
}: {
  status: TaskStatus;
  isOverdue?: boolean;
  className?: string;
}) {
  if (isOverdue && status !== "completed" && status !== "cancelled") {
    return (
      <Badge variant="danger" className={className}>
        Overdue
      </Badge>
    );
  }

  switch (status) {
    case "completed":
      return (
        <Badge variant="success" className={className}>
          {TASK_STATUS_LABELS[status]}
        </Badge>
      );
    case "in_progress":
      return (
        <Badge variant="info" className={className}>
          {TASK_STATUS_LABELS[status]}
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="neutral" className={className}>
          {TASK_STATUS_LABELS[status]}
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge variant="warning" className={className}>
          {TASK_STATUS_LABELS[status]}
        </Badge>
      );
  }
}
