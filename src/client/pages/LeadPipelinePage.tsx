import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Columns3, Plus, Search } from "lucide-react";
import {
  PIPELINE_STAGE_LABELS,
  type PipelineStage,
} from "../../shared/constants/leads";
import { PERMISSIONS } from "../../shared/types/permissions";
import type {
  LeadListItemDto,
  PipelineColumnDto,
} from "../../shared/types/leads";
import { useAuth } from "../hooks/useAuth";
import { useDebounce } from "../hooks/useDebounce";
import { useToast } from "../hooks/useToast";
import { hasPermission } from "../lib/permissions";
import { leadsService } from "../services/leads.service";
import { usersService } from "../services/users.service";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from "../components/ui";
import { LeadForm, PipelineBoard } from "../components/leads";

function PipelineSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-[420px] w-[270px] shrink-0 rounded-xl" />
      ))}
    </div>
  );
}

export function LeadPipelinePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [assignedTo, setAssignedTo] = useState("");
  const [scope, setScope] = useState<"all" | "my">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [columns, setColumns] = useState<PipelineColumnDto[] | null>(null);
  const [pendingLost, setPendingLost] = useState<{
    leadId: string;
    leadName: string;
  } | null>(null);
  const [lostReason, setLostReason] = useState("");

  const canCreate = hasPermission(user, PERMISSIONS.LEADS_CREATE);
  const canViewUsers = hasPermission(user, PERMISSIONS.USERS_READ);

  const usersQuery = useQuery({
    queryKey: ["users", "lead-assignees"],
    queryFn: () => usersService.list({ page: 1, pageSize: 100, status: "active" }),
    enabled: canViewUsers,
  });

  const pipelineQuery = useQuery({
    queryKey: ["leads", "pipeline", { search: debouncedSearch, assignedTo, scope }],
    queryFn: () =>
      leadsService.pipeline({
        search: debouncedSearch || undefined,
        assignedTo: assignedTo || undefined,
        scope,
      }),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (pipelineQuery.data) {
      setColumns(pipelineQuery.data.columns);
    }
  }, [pipelineQuery.data]);

  const leadLookup = useMemo(() => {
    const map = new Map<string, LeadListItemDto>();
    for (const column of columns ?? []) {
      for (const lead of column.leads) {
        map.set(lead.id, lead);
      }
    }
    return map;
  }, [columns]);

  const stageMutation = useMutation({
    mutationFn: (input: {
      leadId: string;
      stage: PipelineStage;
      lostReason?: string;
    }) =>
      leadsService.changeStage(input.leadId, {
        stage: input.stage,
        lostReason: input.lostReason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      toast({
        title: "Could not move the lead",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
      void pipelineQuery.refetch();
    },
  });

  const moveLead = (leadId: string, stage: PipelineStage, lost?: string) => {
    if (!columns) {
      return;
    }
    const source = columns.find((column) =>
      column.leads.some((lead) => lead.id === leadId),
    );
    if (!source || source.stage === stage) {
      return;
    }

    const lead = source.leads.find((item) => item.id === leadId);
    if (!lead) {
      return;
    }

    const snapshot = columns;
    setColumns((current) => {
      if (!current) {
        return current;
      }
      return current.map((column) => {
        if (column.stage === source.stage) {
          return {
            ...column,
            count: Math.max(0, column.count - 1),
            leads: column.leads.filter((item) => item.id !== leadId),
          };
        }
        if (column.stage === stage) {
          return {
            ...column,
            count: column.count + 1,
            leads: [{ ...lead, pipelineStage: stage }, ...column.leads],
          };
        }
        return column;
      });
    });

    stageMutation.mutate(
      { leadId, stage, lostReason: lost },
      {
        onError: () => setColumns(snapshot),
      },
    );
  };

  const handleStageChange = (leadId: string, stage: PipelineStage) => {
    if (stage === "lost") {
      const lead = leadLookup.get(leadId);
      setLostReason("");
      setPendingLost({
        leadId,
        leadName: lead?.name ?? "this lead",
      });
      return;
    }
    moveLead(leadId, stage);
  };

  const total = columns?.reduce((sum, column) => sum + column.count, 0) ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pipeline"
        description="Drag leads between stages, or use the move menu on each card."
        actions={
          canCreate ? (
            <Button
              onClick={() => setCreateOpen(true)}
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              Add lead
            </Button>
          ) : null
        }
      />

      <Card className="p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="lg:max-w-sm lg:flex-1">
            <Input
              aria-label="Search pipeline"
              placeholder="Search leads in the pipeline"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              leadingIcon={<Search className="h-4 w-4" aria-hidden="true" />}
            />
          </div>
          {canViewUsers ? (
            <Select
              aria-label="Filter by owner"
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
              containerClassName="lg:w-48"
            >
              <option value="">All owners</option>
              {(usersQuery.data?.items ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </Select>
          ) : null}
          <Select
            aria-label="Pipeline scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as "all" | "my")}
            containerClassName="lg:w-40"
          >
            <option value="all">All leads</option>
            <option value="my">My leads</option>
          </Select>
          <span className="text-xs text-slate-500 lg:ml-auto">
            {total} open and closed leads
          </span>
        </div>
      </Card>

      {pipelineQuery.isLoading ? (
        <PipelineSkeleton />
      ) : pipelineQuery.isError ? (
        <ErrorState
          title="Unable to load the pipeline"
          message="Please check your connection and try again."
          onRetry={() => {
            void pipelineQuery.refetch();
          }}
        />
      ) : total === 0 ? (
        <Card>
          <EmptyState
            icon={<Columns3 className="h-5 w-5" aria-hidden="true" />}
            title="The pipeline is empty"
            description="Add a lead to start moving enquiries through your stages."
            action={
              canCreate ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  Add lead
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : columns ? (
        <PipelineBoard
          columns={columns}
          onStageChange={handleStageChange}
          onCreate={canCreate ? () => setCreateOpen(true) : undefined}
        />
      ) : null}

      <p className="text-xs text-slate-400">
        Drag the grip handle to move a lead. On touch devices, use the move menu
        below each card. Moving to Lost asks for a reason; moving a closed lead
        back into the pipeline reopens it.
      </p>

      {canCreate ? (
        <LeadForm open={createOpen} onClose={() => setCreateOpen(false)} />
      ) : null}

      <Modal
        open={Boolean(pendingLost)}
        onClose={() => setPendingLost(null)}
        title="Mark lead as lost"
        description="A lost reason is required so the team understands why the opportunity closed."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingLost(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!lostReason.trim()}
              isLoading={stageMutation.isPending}
              onClick={() => {
                if (!pendingLost) {
                  return;
                }
                moveLead(pendingLost.leadId, "lost", lostReason.trim());
                setPendingLost(null);
              }}
            >
              Mark as lost
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          {pendingLost?.leadName} will move to{" "}
          {PIPELINE_STAGE_LABELS.lost}.
        </p>
        <Textarea
          label="Lost reason"
          value={lostReason}
          onChange={(event) => setLostReason(event.target.value)}
          placeholder="e.g. Budget was not approved"
          rows={3}
          required
        />
      </Modal>
    </div>
  );
}
