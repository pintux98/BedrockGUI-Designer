import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
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
import { IconTile } from "../components/IconTile";
import { arrayMove } from "@dnd-kit/sortable";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export function DndHost({ children }: { children: React.ReactNode }) {
  const { activeForm, setBedrock } = useDesignerStore();
  const bedrock = activeForm().bedrock;
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeLabel, setActiveLabel] = React.useState<string | null>(null);
  const [activeMaterial, setActiveMaterial] = React.useState<string | null>(null);
  const [activeIconUrl, setActiveIconUrl] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const overlay = useMemo(() => {
    if (activeMaterial) {
      return <IconTile id={activeMaterial} name={activeLabel ?? activeMaterial} iconUrl={activeIconUrl ?? undefined} />;
    }
    if (activeLabel) {
      return (
        <div className="px-2 py-1 bg-gray-700 rounded text-xs border border-gray-500">
          {activeLabel}
        </div>
      );
    }
    return null;
  }, [activeIconUrl, activeLabel, activeMaterial]);

  const onDragEnd = (event: DragEndEvent) => {
    const over = event.over?.id?.toString();
    const active = event.active.id?.toString();
    const data = event.active.data.current as any;
    setActiveId(null);
    setActiveLabel(null);
    setActiveMaterial(null);
    setActiveIconUrl(null);
    if (!over) return;
    if (!active) return;

    if (bedrock) {
      if (active.startsWith("bedrock-button-") && over.startsWith("bedrock-button-") && bedrock.type === "SIMPLE") {
        const activeKey = active.replace("bedrock-button-", "");
        const overKey = over.replace("bedrock-button-", "");
        const from = (bedrock.buttons ?? []).findIndex((b: any) => b.id === activeKey);
        const to = (bedrock.buttons ?? []).findIndex((b: any) => b.id === overKey);
        if (from !== -1 && to !== -1 && from !== to) {
          const buttons = arrayMove(bedrock.buttons ?? [], from, to);
          setBedrock({ ...(bedrock as any), buttons } as BedrockForm);
        }
        return;
      }
      if (active.startsWith("bedrock-component-") && over.startsWith("bedrock-component-") && bedrock.type === "CUSTOM") {
        const activeKey = active.replace("bedrock-component-", "");
        const overKey = over.replace("bedrock-component-", "");
        const from = (bedrock.components ?? []).findIndex((c: any) => c.id === activeKey);
        const to = (bedrock.components ?? []).findIndex((c: any) => c.id === overKey);
        if (from !== -1 && to !== -1 && from !== to) {
          const components = arrayMove(bedrock.components ?? [], from, to);
          setBedrock({ ...(bedrock as any), components } as BedrockForm);
        }
        return;
      }
    }

    if (bedrock) {
      const t = data?.type as string | undefined;
      if (!t) return;
      const next = computeDropResult(bedrock, over, t);
      if (next) setBedrock(next);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => {
        setActiveId(e.active.id.toString());
        const d = e.active.data.current as any;
        setActiveLabel(d?.label ?? null);
        setActiveMaterial(d?.material ?? null);
        setActiveIconUrl(d?.iconUrl ?? null);
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setActiveLabel(null);
        setActiveMaterial(null);
        setActiveIconUrl(null);
      }}
    >
      {children}
      {createPortal(
        <DragOverlay dropAnimation={null} zIndex={9999}>
          {activeId && (
            <div className="pointer-events-none">
              {overlay}
            </div>
          )}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}

function defaultBedrockComponentProps(type: string) {
  if (type === "input") return { text: "Input", placeholder: "Type here...", default: "" };
  if (type === "dropdown") return { text: "Dropdown", options: ["Option 1", "Option 2"], default: 0 };
  if (type === "toggle") return { text: "Toggle", default: false };
  if (type === "slider") return { text: "Slider", min: 0, max: 10, step: 1, default: 5 };
  return {};
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
    const props = defaultBedrockComponentProps(dropType);
    return { ...bedrock, components: [...bedrock.components, { id, type: dropType, props }] };
  }
  return null;
}

