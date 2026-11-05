import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPE_LABELS,
  type CustomerStatus,
  type CustomerType,
} from "../../../shared/constants/customers";
import { Badge } from "../ui";

const STATUS_VARIANTS: Record<CustomerStatus, "success" | "warning" | "neutral"> =
  {
    active: "success",
    inactive: "warning",
    archived: "neutral",
  };

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      {status === "active" ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-500"
          aria-hidden="true"
        />
      ) : null}
      {CUSTOMER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function CustomerTypeBadge({ type }: { type: CustomerType }) {
  return (
    <Badge variant={type === "business" ? "info" : "neutral"}>
      {CUSTOMER_TYPE_LABELS[type]}
    </Badge>
  );
}

export function CustomerDisplayName({
  name,
  businessName,
}: {
  name: string;
  businessName: string | null;
}) {
  return (
    <span className="font-medium text-slate-900">
      {businessName ?? name}
    </span>
  );
}
