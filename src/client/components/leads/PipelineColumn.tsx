import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical, Plus } from "lucide-react";
import {
  PIPELINE_STAGE_LABELS,
  type PipelineStage,
} from "../../../shared/constants/leads";
import type { LeadListItemDto } from "../../../shared/types/leads";
import { cn } from "../../lib/cn";
import { formatCurrencyInr } from "../../lib/format";
import { LeadCard } from "./LeadCard";

const STAGE_COLORS: Record<PipelineStage, string> = {
  new: "bg-sky-500",
  contacted: "bg-brand-500",
  qualified: "bg-indigo-500",
  proposal_sent: "bg-amber-500",
  negotiation: "bg-orange-500",
  won: "bg-emerald-500",
  lost: "bg-rose-500",
};

function DraggableLead({
  lead,
  stage,
  onMove,
}: {
  lead: LeadListItemDto;
  stage: PipelineStage;
  onMove?: (leadId: string, stage: PipelineStage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: lead.id,
      data: { lead, stage },
    });

  return (
    <div
      ref={setNodeRef}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      className={cn(
        "relative space-y-1.5",
        isDragging ? "z-20 opacity-40" : undefined,
      )}
    >
      <div className="relative">
        <LeadCard lead={lead} showStage={false} />
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute right-2 top-2 z-10 rounded-md bg-white/90 p-1 text-slate-400 shadow-sm ring-1 ring-slate-200 transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label={`Drag ${lead.name} to another stage`}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {onMove ? (
        <label className="block">
          <span className="sr-only">Move {lead.name} to another stage</span>
          <select
            value={stage}
            onChange={(event) =>
              onMove(lead.id, event.target.value as PipelineStage)
            }
            className="h-7 w-full rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-medium text-slate-600 focus:border-brand-500"
          >
            {(
              [
                "new",
                "contacted",
                "qualified",
                "proposal_sent",
                "negotiation",
                "won",
                "lost",
              ] as PipelineStage[]
            ).map((option) => (
              <option key={option} value={option}>
                Move to {PIPELINE_STAGE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

export function PipelineColumn({
  stage,
  count,
  leads,
  onMove,
  onCreate,
}: {
  stage: PipelineStage;
  count: number;
  leads: LeadListItemDto[];
  onMove?: (leadId: string, stage: PipelineStage) => void;
  onCreate?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const totalValue = leads.reduce(
    (sum, lead) => sum + (lead.estimatedValue ?? 0),
    0,
  );

  return (
    <section
      ref={setNodeRef}
      aria-label={`${PIPELINE_STAGE_LABELS[stage]} column`}
      className={cn(
        "flex w-[270px] shrink-0 flex-col rounded-xl border bg-slate-50/80 transition-colors",
        isOver
          ? "border-brand-400 bg-brand-50"
          : "border-slate-200",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", STAGE_COLORS[stage])}
            aria-hidden="true"
          />
          <h2 className="truncate text-xs font-semibold uppercase tracking-wide text-slate-600">
            {PIPELINE_STAGE_LABELS[stage]}
          </h2>
          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
            {count}
          </span>
        </div>
        <span className="shrink-0 text-[10px] font-medium text-slate-400">
          {formatCurrencyInr(totalValue)}
        </span>
      </header>

      <div className="scrollbar-thin flex max-h-[calc(100vh-19rem)] min-h-32 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {leads.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-xs text-slate-400">
            No leads in this stage.
          </p>
        ) : (
          leads.map((lead) => (
            <DraggableLead
              key={lead.id}
              lead={lead}
              stage={stage}
              onMove={onMove}
            />
          ))
        )}
      </div>

      {count > leads.length ? (
        <p className="border-t border-slate-200 px-3 py-2 text-[10px] text-slate-400">
          Showing {leads.length} of {count}
        </p>
      ) : null}

      {onCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center justify-center gap-1 border-t border-slate-200 py-2 text-[11px] font-medium text-slate-500 transition-colors hover:bg-white hover:text-brand-700"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Add lead
        </button>
      ) : null}
    </section>
  );
}
