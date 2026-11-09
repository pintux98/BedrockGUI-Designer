import React from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDesignerStore } from "../core/store";
import { BEDROCK_COMPONENT_TYPES, BedrockComponentType } from "../core/types";
import { COMPONENT_META } from "../core/componentMeta";
import { stripMinecraftCodes } from "../core/minecraftText";
import { computeDropResult } from "../app/DndHost";
import { Icon, IconName } from "../components/Icon";

export function Outline() {
  const {
    activeForm,
    setBedrock,
    selectedBedrockButtonId,
    selectedBedrockComponentId,
    setSelectedBedrockButtonId,
    setSelectedBedrockComponentId
  } = useDesignerStore();
  const form = activeForm().bedrock;
  const [menuOpen, setMenuOpen] = React.useState(false);
  const nothingSelected = !selectedBedrockButtonId && !selectedBedrockComponentId;

  const select = (kind: "button" | "component" | null, id: string | null) => {
    setSelectedBedrockButtonId(kind === "button" ? id : null);
    setSelectedBedrockComponentId(kind === "component" ? id : null);
  };

  const add = (type: string) => {
    const next = computeDropResult(form, form.type === "CUSTOM" ? "bedrock-components" : "bedrock-buttons", type);
    if (!next) return;
    const label = type === "button" ? "button" : COMPONENT_META[type as BedrockComponentType].label.toLowerCase();
    setBedrock(next, `Added ${label}`);
    if (next.type === "CUSTOM") select("component", next.components.at(-1)!.id);
    else select("button", next.buttons.at(-1)!.id);
    setMenuOpen(false);
  };

  const rows =
    form.type === "CUSTOM"
      ? form.components.map((c) => ({
          sortId: `bedrock-component-${c.id}`,
          id: c.id,
          kind: "component" as const,
          icon: COMPONENT_META[c.type]?.icon ?? "input",
          text: String(c.props?.text ?? COMPONENT_META[c.type]?.label ?? c.type),
          selected: selectedBedrockComponentId === c.id
        }))
      : form.buttons.map((b) => ({
          sortId: `bedrock-button-${b.id}`,
          id: b.id,
          kind: "button" as const,
          icon: "button" as IconName,
          text: b.text,
          selected: selectedBedrockButtonId === b.id
        }));

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 pb-1.5 pt-3">
        <h2 className="text-[12px] font-semibold text-brand-muted">On this form</h2>
      </div>
      <ul className="px-1.5" aria-label="Form elements">
        <li>
          <button
            type="button"
            onClick={() => select(null, null)}
            aria-current={nothingSelected}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left ${
              nothingSelected ? "bg-brand-accent/15 text-brand-text" : "text-brand-muted hover:bg-brand-surface-raised hover:text-brand-text"
            }`}
          >
            <Icon name="settings" size={14} />
            <span className="truncate">Form settings</span>
          </button>
        </li>
        <SortableContext items={rows.map((r) => r.sortId)} strategy={verticalListSortingStrategy}>
          {rows.map((row) => (
            <OutlineRow
              key={row.sortId}
              sortId={row.sortId}
              sortable={form.type !== "MODAL"}
              icon={row.icon}
              text={stripMinecraftCodes(row.text).split("\n")[0] || row.id}
              id={row.id}
              selected={row.selected}
              onSelect={() => select(row.kind, row.id)}
            />
          ))}
        </SortableContext>
      </ul>

      <div className="relative px-3 pb-3 pt-2">
        {form.type === "SIMPLE" && (
          <button type="button" className="ui-btn-secondary w-full" onClick={() => add("button")}>
            <Icon name="plus" size={14} /> Add button
          </button>
        )}
        {form.type === "MODAL" && (
          <p className="ui-hint">A yes / no dialog always has exactly two buttons.</p>
        )}
        {form.type === "CUSTOM" && (
          <>
            <button
              type="button"
              className="ui-btn-secondary w-full"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Icon name="plus" size={14} /> Add field
            </button>
            {menuOpen && (
              <AddFieldMenu onPick={add} onClose={() => setMenuOpen(false)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AddFieldMenu({ onPick, onClose }: { onPick: (type: string) => void; onClose: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div ref={ref} role="menu" className="ui-menu absolute inset-x-3 top-full z-30 -mt-1">
      {BEDROCK_COMPONENT_TYPES.map((type) => (
        <button key={type} type="button" role="menuitem" className="ui-menu-item" onClick={() => onPick(type)}>
          <Icon name={COMPONENT_META[type].icon} size={15} className="text-brand-muted" />
          <span className="flex-1">
            <span className="block">{COMPONENT_META[type].label}</span>
            <span className="block text-[11.5px] text-brand-muted">{COMPONENT_META[type].description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function OutlineRow({
  sortId,
  sortable,
  icon,
  text,
  id,
  selected,
  onSelect
}: {
  sortId: string;
  sortable: boolean;
  icon: IconName;
  text: string;
  id: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId, disabled: !sortable });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className={`group flex items-center rounded-md ${
        selected ? "bg-brand-accent/15 text-brand-text" : "text-brand-muted hover:bg-brand-surface-raised hover:text-brand-text"
      }`}
    >
      <button type="button" onClick={onSelect} aria-current={selected} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left">
        <Icon name={icon} size={14} />
        <span className="min-w-0 flex-1 truncate">{text}</span>
        <span className="font-mono-ui text-[11px] text-brand-muted/70">{id}</span>
      </button>
      {sortable && (
        <span
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${id}`}
          className="mr-1 cursor-grab rounded p-1 text-brand-muted opacity-0 outline-none group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
          style={{ touchAction: "none" }}
        >
          <Icon name="grip" size={14} />
        </span>
      )}
    </li>
  );
}
