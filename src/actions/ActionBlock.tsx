import React from "react";
import { ParsedAction } from "../plugin/grammar";
import { infoForAction } from "./actionInfo";
import { ActionEditor } from "./editors";
import { Icon } from "../components/Icon";

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
    <div className="overflow-hidden rounded-md border border-brand-border bg-brand-surface2">
      <div className={`flex items-center gap-1 py-1 pl-1 pr-1 ${expanded ? "border-b border-brand-border" : ""}`}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-brand-surface-raised"
          aria-label={expanded ? "Collapse action" : "Expand action"}
          aria-expanded={expanded}
          title={info.description}
        >
          <Icon name={expanded ? "chevronDown" : "chevronRight"} size={14} className="text-brand-muted" />
          <span className="truncate text-[13px] font-medium">{info.label}</span>
        </button>
        <button type="button" onClick={onMoveUp} className="ui-icon-btn size-6" aria-label="Move action up" title="Move up" disabled={index === 0}>
          <Icon name="up" size={14} />
        </button>
        <button type="button" onClick={onMoveDown} className="ui-icon-btn size-6" aria-label="Move action down" title="Move down" disabled={index === total - 1}>
          <Icon name="down" size={14} />
        </button>
        <button type="button" onClick={onDuplicate} className="ui-icon-btn size-6" aria-label="Duplicate action" title="Duplicate">
          <Icon name="copy" size={13} />
        </button>
        <button type="button" onClick={onRemove} className="ui-icon-btn size-6 hover:!text-brand-danger" aria-label="Remove action" title="Remove">
          <Icon name="trash" size={13} />
        </button>
      </div>

      {expanded && (
        <div className="p-2.5">
          <ActionEditor action={action} onChange={onUpdate} />
        </div>
      )}
    </div>
  );
}
