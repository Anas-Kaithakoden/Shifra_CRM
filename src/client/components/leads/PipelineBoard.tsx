import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type {
  LeadListItemDto,
  PipelineColumnDto,
} from "../../../shared/types/leads";
import type { PipelineStage } from "../../../shared/constants/leads";
import { PipelineColumn } from "./PipelineColumn";
import { LeadCard } from "./LeadCard";

export function PipelineBoard({
  columns,
  onStageChange,
  onCreate,
}: {
  columns: PipelineColumnDto[];
  onStageChange: (leadId: string, stage: PipelineStage) => void;
  onCreate?: () => void;
}) {
  const [activeLead, setActiveLead] = useState<LeadListItemDto | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const stageByLeadId = new Map<string, PipelineStage>();
  const leadById = new Map<string, LeadListItemDto>();
  const stageIds = new Set<string>(columns.map((column) => column.stage));
  for (const column of columns) {
    for (const lead of column.leads) {
      stageByLeadId.set(lead.id, column.stage);
      leadById.set(lead.id, lead);
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveLead(leadById.get(String(event.active.id)) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null);
    if (!event.over) {
      return;
    }

    const leadId = String(event.active.id);
    const overId = String(event.over.id);
    const sourceStage = stageByLeadId.get(leadId);
    const targetStage = stageIds.has(overId)
      ? (overId as PipelineStage)
      : stageByLeadId.get(overId);

    if (!targetStage || !sourceStage || targetStage === sourceStage) {
      return;
    }

    onStageChange(leadId, targetStage);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveLead(null)}
    >
      <div className="scrollbar-thin -mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
        {columns.map((column) => (
          <PipelineColumn
            key={column.stage}
            stage={column.stage}
            count={column.count}
            leads={column.leads}
            onMove={onStageChange}
            onCreate={onCreate}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeLead ? (
          <div className="w-[250px] rotate-1 opacity-95">
            <LeadCard lead={activeLead} showStage={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
