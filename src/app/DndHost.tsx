import React from "react";
import { createPortal } from "react-dom";
import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { useDesignerStore } from "../core/store";
import { BedrockForm, isBedrockComponentType } from "../core/types";
import { nextSequentialId } from "../core/ids";
import { COMPONENT_META } from "../core/componentMeta";
import { arrayMove } from "@dnd-kit/sortable";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * A button row can be dragged from two surfaces now: the PropertiesPanel list
 * (`bedrock-button-<id>`) and the preview itself (`bedrock-preview-button-<id>`). The two
 * prefixes have to differ because dnd-kit keys every draggable by id inside a single
 * DndContext, and both surfaces are on screen at the same time. The literals are spelled
 * out here and again at each call site on purpose — that is what lets a test pin them.
 */
const BUTTON_SORTABLE_PREFIXES = ["bedrock-preview-button-", "bedrock-button-"];
const COMPONENT_SORTABLE_PREFIXES = ["bedrock-preview-component-", "bedrock-component-"];

function sortableTargetId(raw: string, prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    if (raw.startsWith(prefix)) return raw.slice(prefix.length);
  }
  return null;
}

/**
 * Resolves a sortable drag into the reordered form plus the history description to record.
 * Returns null when the drag is not a reorder (a palette drop, a no-op, an unknown id), so
 * the caller can fall through to the palette-drop path.
 */
export function computeReorderResult(
  bedrock: BedrockForm,
  activeId: string,
  overId: string
): { next: BedrockForm; description: string } | null {
  const fromButton = sortableTargetId(activeId, BUTTON_SORTABLE_PREFIXES);
  const toButton = sortableTargetId(overId, BUTTON_SORTABLE_PREFIXES);
  if (fromButton !== null && toButton !== null && bedrock.type === "SIMPLE") {
    const buttons = bedrock.buttons ?? [];
    const from = buttons.findIndex((b) => b.id === fromButton);
    const to = buttons.findIndex((b) => b.id === toButton);
    if (from === -1 || to === -1 || from === to) return null;
    return {
      next: { ...bedrock, buttons: arrayMove(buttons, from, to) },
      description: "Reordered buttons"
    };
  }

  const fromComponent = sortableTargetId(activeId, COMPONENT_SORTABLE_PREFIXES);
  const toComponent = sortableTargetId(overId, COMPONENT_SORTABLE_PREFIXES);
  if (fromComponent !== null && toComponent !== null && bedrock.type === "CUSTOM") {
    const components = bedrock.components ?? [];
    const from = components.findIndex((c) => c.id === fromComponent);
    const to = components.findIndex((c) => c.id === toComponent);
    if (from === -1 || to === -1 || from === to) return null;
    return {
      next: { ...bedrock, components: arrayMove(components, from, to) },
      description: "Reordered components"
    };
  }

  return null;
}

/**
 * closestCenter stays the algorithm — unsetting it broke drag entirely for a release. The
 * only change is the candidate set, and it is forced by the preview now holding its own
 * SortableContext *inside* the big `bedrock-buttons` / `bedrock-components` canvas
 * droppable. Unfiltered, the two kinds of drag steal each other's targets:
 *
 * - a row dragged in the preview keeps resolving to the canvas container, whose centre sits
 *   right in the middle of the row list, so the reorder silently does nothing;
 * - a palette tile can now resolve to a preview row instead of the container, and
 *   `computeDropResult` only ever accepts `bedrock-buttons` / `bedrock-components`, so the
 *   drop silently adds nothing.
 *
 * So: a sortable drag scores only droppables from its own SortableContext, and a palette
 * drag scores only the container droppables. Each is still ranked by plain closestCenter.
 */
function sortableContainerId(container: { data: { current?: any } }): string | undefined {
  return container.data.current?.sortable?.containerId;
}

export const sortableAwareClosestCenter: CollisionDetection = (args) => {
  const activeContainerId = (args.active.data.current as any)?.sortable?.containerId;
  const candidates =
    activeContainerId != null
      ? args.droppableContainers.filter((c) => sortableContainerId(c) === activeContainerId)
      : args.droppableContainers.filter((c) => sortableContainerId(c) === undefined);
  if (!candidates.length) return closestCenter(args);
  return closestCenter({ ...args, droppableContainers: candidates });
};

export function DndHost({ children }: { children: React.ReactNode }) {
  const { activeForm, setBedrock } = useDesignerStore();
  const bedrock = activeForm().bedrock;
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeLabel, setActiveLabel] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );


  const onDragEnd = (event: DragEndEvent) => {
    const over = event.over?.id?.toString();
    const active = event.active.id?.toString();
    const data = event.active.data.current as any;
    setActiveId(null);
    setActiveLabel(null);
    if (!over) return;
    if (!active) return;

    if (bedrock) {
      const reorder = computeReorderResult(bedrock, active, over);
      if (reorder) {
        setBedrock(reorder.next, reorder.description);
        return;
      }
    }

    if (bedrock) {
      // A sortable row carries only dnd-kit's own `sortable` data, never a `type`, so a
      // reorder that resolved to a no-op can never fall through into a palette insert.
      const t = data?.type as string | undefined;
      if (!t) return;
      const next = computeDropResult(bedrock, over, t);
      if (next) setBedrock(next);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={sortableAwareClosestCenter}
      onDragStart={(e) => {
        setActiveId(e.active.id.toString());
        const d = e.active.data.current as any;
        setActiveLabel(d?.label ?? null);
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setActiveLabel(null);
      }}
    >
      {children}
      {createPortal(
        <DragOverlay dropAnimation={null} zIndex={9999}>
          {activeId && activeLabel && (
            <div className="pointer-events-none rounded-md border border-brand-borderStrong bg-brand-surface-raised px-2.5 py-1 text-[13px] shadow-lg">
              {activeLabel}
            </div>
          )}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}

export function computeDropResult(
  bedrock: BedrockForm,
  overId: string,
  dropType: string
): BedrockForm | null {
  if (overId === "bedrock-buttons" && (bedrock.type === "SIMPLE" || bedrock.type === "MODAL") && dropType === "button") {
    const nextId = nextSequentialId("button", bedrock.buttons.map((b) => b.id));
    return { ...bedrock, buttons: [...bedrock.buttons, { id: nextId, text: `Button ${nextId.split("_")[1]}` }] };
  }
  if (overId === "bedrock-components" && bedrock.type === "CUSTOM") {
    if (!isBedrockComponentType(dropType)) return null;
    const id = nextSequentialId("component", bedrock.components.map((c) => c.id));
    const props = structuredClone(COMPONENT_META[dropType].defaults);
    return { ...bedrock, components: [...bedrock.components, { id, type: dropType, props }] };
  }
  return null;
}

