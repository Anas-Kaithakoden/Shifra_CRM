import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Search, Target, Trophy } from "lucide-react";
import type { LeadListItemDto } from "../../../shared/types/leads";
import { useDebounce } from "../../hooks/useDebounce";
import { useToast } from "../../hooks/useToast";
import { ApiError } from "../../lib/api";
import { formatCrmDate, formatCurrencyInr } from "../../lib/format";
import { leadsService } from "../../services/leads.service";
import { customersService } from "../../services/customers.service";
import {
  Badge,
  Button,
  Input,
  Modal,
  Pagination,
  Skeleton,
} from "../ui";
import { StageBadge } from "../leads";

function LeadOption({
  lead,
  selected,
  onSelect,
}: {
  lead: LeadListItemDto;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
        selected
          ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-300"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {lead.businessName ?? lead.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {lead.leadNumber} · {lead.phone}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {lead.serviceInterest ?? "No service selected"}
            {lead.estimatedValue !== null
              ? ` · ${formatCurrencyInr(lead.estimatedValue)}`
              : ""}
            {` · ${formatCrmDate(lead.createdAt)}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StageBadge stage={lead.pipelineStage} />
          {lead.pipelineStage === "won" ? (
            <Badge variant="success">
              <Trophy className="h-2.5 w-2.5" aria-hidden="true" />
              Will convert
            </Badge>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export function LinkLeadDialog({
  open,
  onClose,
  customerId,
  customerName,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 250);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSearch("");
    setPage(1);
    setSelectedId(null);
  }, [open]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const leadsQuery = useQuery({
    queryKey: ["customers", "link-lead", debouncedSearch, page],
    queryFn: () =>
      leadsService.list({
        page,
        pageSize: 8,
        search: debouncedSearch.trim() || undefined,
        sortBy: "created_at",
        sortDir: "desc",
      }),
    enabled: open,
  });

  const available = (leadsQuery.data?.items ?? []).filter(
    (lead) => !lead.customerId,
  );
  const selected = available.find((lead) => lead.id === selectedId) ?? null;

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedId) {
        throw new Error("Choose a lead to link.");
      }
      return customersService.linkLead(customerId, selectedId);
    },
    onSuccess: async (result) => {
      toast({
        title: result.alreadyLinked ? "Lead already linked" : "Lead linked",
        description: `The lead is now part of ${customerName}'s history.`,
        variant: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Could not link the lead",
        description:
          error instanceof ApiError ? error.message : "Please try again.",
        variant: "error",
      });
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Link a lead"
      description={`Attach an existing enquiry to ${customerName}. No enquiry data is copied or changed.`}
      size="lg"
      footer={
        <>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            isLoading={mutation.isPending}
            disabled={!selectedId}
            leftIcon={<Link2 className="h-4 w-4" aria-hidden="true" />}
          >
            Link lead
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          aria-label="Search leads"
          placeholder="Search by name, phone or business"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          leadingIcon={<Search className="h-4 w-4" aria-hidden="true" />}
          autoFocus
        />

        {selected?.pipelineStage === "won" ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            This is a won lead. Linking it will mark the customer conversion date
            on the lead.
          </p>
        ) : null}

        {leadsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : leadsQuery.isError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
            Could not load leads.{" "}
            <button
              type="button"
              onClick={() => void leadsQuery.refetch()}
              className="font-medium underline"
            >
              Try again
            </button>
          </p>
        ) : available.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
            <Target className="mb-2 h-6 w-6 text-slate-300" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-800">
              No unlinked leads found
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {search
                ? "Try a different search."
                : "Every accessible lead is already linked to a customer."}
            </p>
          </div>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {available.map((lead) => (
              <LeadOption
                key={lead.id}
                lead={lead}
                selected={selectedId === lead.id}
                onSelect={() => setSelectedId(lead.id)}
              />
            ))}
          </div>
        )}

        {leadsQuery.data && leadsQuery.data.pagination.totalPages > 1 ? (
          <Pagination
            page={leadsQuery.data.pagination.page}
            pageSize={leadsQuery.data.pagination.pageSize}
            total={leadsQuery.data.pagination.total}
            totalPages={leadsQuery.data.pagination.totalPages}
            onPageChange={setPage}
            className="border-t-0 px-0"
          />
        ) : null}
      </div>
    </Modal>
  );
}
