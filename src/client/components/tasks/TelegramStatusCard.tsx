import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Send,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "../../hooks/useToast";
import { formatCrmDateTime } from "../../lib/format";
import { notificationsService } from "../../services/notifications.service";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton } from "../ui";

export function TelegramStatusCard({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [testResult, setTestResult] = useState<string | null>(null);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["telegram-status"],
    queryFn: () => notificationsService.getTelegramStatus(),
  });

  const testMutation = useMutation({
    mutationFn: () => notificationsService.sendTestNotification(),
    onSuccess: (res) => {
      setTestResult(res.message);
      toast({ title: "Test notification sent!", variant: "success" });
      void refetch();
    },
    onError: (err: any) => {
      setTestResult(err.message ?? "Failed to send test message");
      toast({
        title: "Test notification failed",
        description: err.message,
        variant: "error",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardBody>
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </CardBody>
      </Card>
    );
  }

  const isConfigured = status?.configured && status?.status === "configured";
  const hasError = status?.status === "error";

  return (
    <Card>
      <CardHeader
        title="Telegram reminders"
        description="Integration status and delivery health."
        action={
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Refresh status"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        }
      />

      <CardBody className="space-y-4">
        <div
          className={
            compact
              ? "flex flex-col gap-3"
              : "flex flex-wrap items-center justify-between gap-3"
          }
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {isConfigured ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Operational
              </Badge>
            ) : hasError ? (
              <Badge variant="danger" className="gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Error
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                Not Configured
              </Badge>
            )}
            {status?.botUsername ? (
              <span className="truncate text-xs font-mono font-medium text-slate-600">
                {status.botUsername}
              </span>
            ) : null}
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={!status?.configured || testMutation.isPending}
            isLoading={testMutation.isPending}
            onClick={() => testMutation.mutate()}
            className={compact ? "w-full gap-1.5" : "gap-1.5"}
          >
            <Send className="h-3.5 w-3.5" />
            Send test message
          </Button>
        </div>

        {status?.error ? (
          <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
            {status.error}
          </p>
        ) : null}

        {testResult ? (
          <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
            {testResult}
          </p>
        ) : null}

        {!compact ? (
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-3">
            <div>
              <p className="text-slate-400">Target Chat</p>
              <p className="font-mono font-medium text-slate-700 mt-0.5">
                {status?.chatIdMasked ?? "None"}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Last Successful Reminder</p>
              <p className="font-medium text-slate-700 mt-0.5">
                {status?.lastSuccessAt
                  ? formatCrmDateTime(status.lastSuccessAt)
                  : "None yet"}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Failed Delivery Count</p>
              <p className="font-medium text-slate-700 mt-0.5">
                {status?.failedCount ?? 0}
              </p>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
