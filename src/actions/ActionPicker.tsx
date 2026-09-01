import React from "react";
import { ACTIONS, actionsForPlatform } from "../plugin";
import { useDesignerStore } from "../core/store";
import { ActionKind, RAW_ACTION_INFO } from "./ActionBlock";

interface ActionPickerProps {
  onSelect: (type: ActionKind) => void;
  onClose: () => void;
}

function infoFor(id: ActionKind) {
  return id === "raw" ? RAW_ACTION_INFO : ACTIONS[id];
}

export function ActionPicker({ onSelect, onClose }: ActionPickerProps) {
  const [search, setSearch] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const platform = useDesignerStore((s) => s.project.platformTarget);
  const order: ActionKind[] = [...actionsForPlatform(platform).map((a) => a.id), "raw"];

  const filtered = order.filter((id) => {
    const info = infoFor(id);
    const q = search.toLowerCase();
    return (
      info.label.toLowerCase().includes(q) ||
      id.toLowerCase().includes(q) ||
      info.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40" onClick={onClose}>
      <div
        ref={ref}
        className="ui-panel w-full max-w-md p-0 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-brand-border bg-brand-surface">
          <div className="text-xs font-medium text-brand-text mb-2">Add Action</div>
          <input
            className="ui-input text-xs"
            placeholder="Search actions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto custom-scrollbar p-1">
          {filtered.map((id) => {
            const info = infoFor(id);
            return (
              <button
                key={id}
                className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-brand-surface-raised rounded transition-colors"
                onClick={() => onSelect(id)}
              >
                <span className="text-lg mt-0.5">{info.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-brand-text">{info.label}</div>
                  <div className="text-[10px] text-brand-muted">{info.description}</div>
                  <pre className="text-[9px] text-brand-accent/70 font-mono mt-1 whitespace-pre-wrap">{info.formatExample}</pre>
                </div>
                <span className="text-[10px] text-brand-muted font-mono mt-0.5">{id}</span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-xs text-brand-muted text-center">No actions match "{search}"</div>
          )}
        </div>
      </div>
    </div>
  );
}
