import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { useDesignerStore } from "../core/store";

const items = [
  { id: "btn", label: "Button", data: { type: "button", label: "Button" } },
  { id: "input", label: "Input", data: { type: "input" } },
  { id: "dropdown", label: "Dropdown", data: { type: "dropdown" } },
  { id: "toggle", label: "Toggle", data: { type: "toggle" } },
  { id: "slider", label: "Slider", data: { type: "slider" } }
];

export function Palette() {
  const { activeForm } = useDesignerStore();
  const bedrock = activeForm().bedrock;
  // A Modal is a fixed two-button dialog: nothing in the palette can be dropped
  // onto it, so the palette is hidden rather than shown greyed out. The note
  // takes its place so the panel does not just silently go blank.
  if (bedrock?.type === "MODAL") {
    return (
      <div className="text-[11px] text-brand-muted px-1 py-2 leading-relaxed">
        A Modal form is a fixed two-button dialog — there is nothing to drag onto it. Edit its two buttons
        under Properties.
      </div>
    );
  }
  const visibleItems =
    bedrock?.type === "SIMPLE"
      ? items.filter((i) => i.id === "btn")
      : items.filter((i) => i.id !== "btn");
  return (
    <div className="ui-panel h-full">
      <div className="ui-panel-title">Palette</div>
      <div className="grid grid-cols-2 gap-2">
        {visibleItems.map((i) => (
          <Draggable key={i.id} id={i.id} label={i.label} data={i.data} />
        ))}
      </div>
    </div>
  );
}

function Draggable({
  id,
  label,
  data
}: {
  id: string;
  label: string;
  data: Record<string, unknown>;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id,
    data: { ...data, label }
  });
  return (
    <button
      ref={setNodeRef as any}
      {...attributes}
      {...listeners}
      type="button"
      aria-label={label}
      className="ui-btn-secondary w-full cursor-move"
      style={{ touchAction: "none" }}
    >
      {label}
    </button>
  );
}
