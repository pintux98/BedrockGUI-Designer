import React from "react";
import { ParsedAction } from "../plugin/grammar";
import { infoForAction } from "./actionInfo";
import { ActionEditor } from "./editors";

interface ActionBlockProps {
  action: ParsedAction;
  onUpdate: (next: ParsedAction) => void;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  defaultExpanded?: boolean;
}

export function ActionBlock({
  action,
  onUpdate,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  onDuplicate,
  defaultExpanded = true
}: ActionBlockProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const info = infoForAction(action);

  return (
    <div className={`bg-brand-surface2 border-l-4 ${info.color} border border-brand-border rounded overflow-hidden transition-all duration-150`}>
      <div className="flex items-center gap-2 px-2 py-1.5 bg-brand-surface/50 border-b border-brand-border">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-brand-muted hover:text-brand-text transition-colors w-4 text-left"
          aria-label={expanded ? "Collapse action" : "Expand action"}
        >
          {expanded ? "▼" : "▶"}
        </button>
        <span className="text-sm" title={info.description}>{info.icon}</span>
        <span className="text-xs font-medium text-brand-text flex-1">{info.label}</span>
        <span className="text-[10px] text-brand-muted font-mono">#{index + 1}</span>
        <div className="flex items-center gap-0.5">
          <button onClick={onDuplicate} className="ui-btn-ghost px-1.5 py-0.5 text-xs" aria-label="Duplicate action">
            ⧉
          </button>
          <button
            onClick={onMoveUp}
            className="ui-btn-ghost px-1.5 py-0.5 text-xs"
            aria-label="Move action up"
            disabled={index === 0}
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            className="ui-btn-ghost px-1.5 py-0.5 text-xs"
            aria-label="Move action down"
            disabled={index === total - 1}
          >
            ↓
          </button>
          <button
            onClick={onRemove}
            className="ui-btn-ghost px-1.5 py-0.5 text-xs text-brand-danger hover:text-red-400"
            aria-label="Remove action"
          >
            ✕
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-2">
          <ActionEditor action={action} onChange={onUpdate} />
        </div>
      )}
    </div>
  );
}
