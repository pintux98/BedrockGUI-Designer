import React from "react";
import { BufferedInput, BufferedTextArea } from "../components/BufferedInput";
import { ACTION_TYPE_INFO, ActionTypeId } from "./types";
import { PlaceholderPicker } from "../components/PlaceholderPicker";

interface ActionBlockProps {
  type: ActionTypeId;
  lines: string[];
  subchannel?: string;
  args?: string[];
  raw?: string;
  trueLines?: string[];
  falseLines?: string[];
  condition?: string;
  onUpdate: (updates: Partial<ActionBlockData>) => void;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

export interface ActionBlockData {
  type: ActionTypeId;
  lines?: string[];
  subchannel?: string;
  args?: string[];
  raw?: string;
  trueLines?: string[];
  falseLines?: string[];
  condition?: string;
}

export function ActionBlock({
  type,
  lines = [""],
  subchannel = "Connect",
  args = [""],
  raw = "",
  trueLines = [""],
  falseLines = [""],
  condition = "",
  onUpdate,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  onDuplicate
}: ActionBlockProps) {
  const [expanded, setExpanded] = React.useState(true);
  const [showPlaceholderPicker, setShowPlaceholderPicker] = React.useState(false);
  const [pickerTarget, setPickerTarget] = React.useState<"lines" | "args" | "trueLines" | "falseLines" | "condition" | null>(null);
  const info = ACTION_TYPE_INFO[type];
  const isBungee = type === "bungee";
  const isConditional = type === "conditional";
  const isRandom = type === "random";
  const isRaw = type === "raw";
  const hasNested = isConditional || isRandom;

  return (
    <div className={`bg-brand-surface2 border-l-4 ${info.color} border border-brand-border rounded overflow-hidden transition-all duration-150`}>
      <div className="flex items-center gap-2 px-2 py-1.5 bg-brand-surface/50 border-b border-brand-border">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-brand-muted hover:text-brand-text transition-colors w-4 text-left"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▼" : "▶"}
        </button>
        <span className="text-sm" title={info.description}>{info.icon}</span>
        <span className="text-xs font-medium text-brand-text flex-1">{info.label}</span>
        <span className="text-[10px] text-brand-muted font-mono">#{index + 1}</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onDuplicate}
            className="ui-btn-ghost px-1.5 py-0.5 text-xs"
            title="Duplicate"
            disabled={index >= total - 1 && type === "raw"}
          >
            ⧉
          </button>
          <button
            onClick={onMoveUp}
            className="ui-btn-ghost px-1.5 py-0.5 text-xs"
            title="Move up"
            disabled={index === 0}
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            className="ui-btn-ghost px-1.5 py-0.5 text-xs"
            title="Move down"
            disabled={index === total - 1}
          >
            ↓
          </button>
          <button
            onClick={onRemove}
            className="ui-btn-ghost px-1.5 py-0.5 text-xs text-brand-danger hover:text-red-400"
            title="Remove"
          >
            ✕
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-2 space-y-2">
          {isRaw ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-brand-muted">Raw action block</span>
                <button
                  className="ui-btn-ghost px-1.5 py-0.5 text-xs"
                  title="Insert placeholder"
                  onClick={() => { setPickerTarget("lines"); setShowPlaceholderPicker(true); }}
                >
                  @
                </button>
              </div>
              <BufferedTextArea
                className="ui-textarea h-24 text-xs font-mono"
                placeholder={info.placeholder}
                value={raw}
                onCommit={(v) => onUpdate({ raw: v })}
              />
            </div>
          ) : isBungee ? (
            <>
              <BufferedInput
                className="ui-input text-xs"
                placeholder="subchannel (e.g. Connect)"
                value={subchannel}
                onCommit={(v) => onUpdate({ subchannel: v })}
              />
              <div>
                <div className="text-[10px] text-brand-muted mb-1">Args (one per line)</div>
                <BufferedTextArea
                  className="ui-textarea h-16 text-xs"
                  placeholder="e.g. Lobby"
                  value={args.join("\n")}
                  onCommit={(v) => onUpdate({ args: v.split("\n") })}
                />
              </div>
            </>
          ) : hasNested ? (
            <>
              {isConditional && (
                <BufferedInput
                  className="ui-input text-xs"
                  placeholder="condition (e.g. hasPermission: my.permission)"
                  value={condition}
                  onCommit={(v) => onUpdate({ condition: v })}
                />
              )}
              <div className="space-y-2">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-brand-success" />
                    <span className="text-[10px] text-brand-muted">
                      {isConditional ? "If true" : "Group 1"}
                    </span>
                  </div>
                  <BufferedTextArea
                    className="ui-textarea h-16 text-xs"
                    placeholder="Actions (one per line)"
                    value={trueLines.join("\n")}
                    onCommit={(v) => onUpdate({ trueLines: v.split("\n") })}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-brand-danger" />
                    <span className="text-[10px] text-brand-muted">
                      {isConditional ? "If false" : "Group 2"}
                    </span>
                  </div>
                  <BufferedTextArea
                    className="ui-textarea h-16 text-xs"
                    placeholder="Actions (one per line)"
                    value={falseLines.join("\n")}
                    onCommit={(v) => onUpdate({ falseLines: v.split("\n") })}
                  />
                </div>
              </div>
            </>
            ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-brand-muted">Values (one per line)</span>
                <button
                  className="ui-btn-ghost px-1.5 py-0.5 text-xs"
                  title="Insert placeholder"
                  onClick={() => { setPickerTarget("lines"); setShowPlaceholderPicker(true); }}
                >
                  @
                </button>
              </div>
              <BufferedTextArea
                className="ui-textarea h-16 text-xs"
                placeholder={info.placeholder}
                value={lines.join("\n")}
                onCommit={(v) => onUpdate({ lines: v.split("\n") })}
              />
            </div>
            )}
        </div>
      )}

      {showPlaceholderPicker && (
        <PlaceholderPicker
          onSelect={(placeholder) => {
            if (pickerTarget === "lines") {
              const current = lines.join("\n");
              const newValue = current + (current.endsWith("\n") || current === "" ? "" : "\n") + placeholder;
              onUpdate({ lines: newValue.split("\n") });
            } else if (pickerTarget === "args") {
              const current = args.join("\n");
              const newValue = current + (current.endsWith("\n") || current === "" ? "" : "\n") + placeholder;
              onUpdate({ args: newValue.split("\n") });
            } else if (pickerTarget === "trueLines") {
              const current = trueLines.join("\n");
              const newValue = current + (current.endsWith("\n") || current === "" ? "" : "\n") + placeholder;
              onUpdate({ trueLines: newValue.split("\n") });
            } else if (pickerTarget === "falseLines") {
              const current = falseLines.join("\n");
              const newValue = current + (current.endsWith("\n") || current === "" ? "" : "\n") + placeholder;
              onUpdate({ falseLines: newValue.split("\n") });
            } else if (pickerTarget === "condition") {
              onUpdate({ condition: condition + placeholder });
            }
          }}
          onClose={() => setShowPlaceholderPicker(false)}
        />
      )}
    </div>
  );
}
