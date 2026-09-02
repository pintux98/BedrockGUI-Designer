import React from "react";
import { ActionBlock, ActionBlockData, ActionKind } from "./ActionBlock";
import { ActionPicker } from "./ActionPicker";
import { isActionId, parseActionBlock, serializeActionBlock } from "../plugin";

interface VisualActionEditorProps {
  value: string[];
  onChange: (v: string[]) => void;
}

export interface ParsedAction {
  type: ActionKind;
  lines: string[];
  subchannel?: string;
  args?: string[];
  raw?: string;
  trueLines?: string[];
  falseLines?: string[];
  condition?: string;
}

export function parseAction(raw: string): ParsedAction {
  const s = String(raw ?? "").trim();
  if (!s) return { type: "message", lines: [""] };

  const open = s.indexOf("{");
  const close = s.lastIndexOf("}");

  if (open !== -1 && close !== -1 && close > open) {
    const type = s.slice(0, open).trim().toLowerCase();
    const inner = s.slice(open + 1, close);

    if (type === "bungee") {
      const m = inner.match(/subchannel\s*:\s*"((?:\\.|[^"\\])*)"/i);
      const subchannel = (m?.[1] ?? "Connect").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      const args = extractListLines(inner);
      return { type: "bungee", lines: [], subchannel, args: args.length ? args : [""] };
    }

    if (type === "conditional") {
      const parsed = parseActionBlock(s);
      if (parsed.kind !== "conditional") return { type: "raw", lines: [], raw: s };
      return {
        type: "conditional",
        lines: [],
        condition: parsed.check,
        trueLines: parsed.whenTrue.length ? parsed.whenTrue.map(serializeActionBlock) : [""],
        falseLines: parsed.whenFalse.length ? parsed.whenFalse.map(serializeActionBlock) : [""]
      };
    }

    if (isActionId(type)) {
      const lines = extractListLines(inner);
      return { type, lines: lines.length ? lines : [""] };
    }
    return { type: "raw", lines: [], raw: s };
  }

  return { type: "raw", lines: [], raw: s };
}

function extractListLines(inner: string): string[] {
  return inner
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-") || l.startsWith('"'))
    .map((l) => {
      let v = l.replace(/^-+\s*/, "");
      v = v.replace(/^"+|"+$/g, "");
      v = v.replace(/\\"/g, '"');
      return v.trim();
    })
    .filter((l) => l.length > 0 || true);
}

export function serializeAction(action: ParsedAction): string | undefined {
  const escapeLine = (l: string) => l.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  if (action.type === "raw") return action.raw?.trim() ? action.raw.trim() : undefined;

  if (action.type === "bungee") {
    const subchannel = String(action.subchannel ?? "Connect");
    const args = (action.args ?? [""]).filter((l) => l.trim());
    const argsBody = (args.length ? args : [""])
      .map((l) => `  - "${escapeLine(l)}"`)
      .join("\n");
    return `bungee {\n  subchannel: "${escapeLine(subchannel)}"\n${argsBody}\n}`;
  }

  if (action.type === "conditional") {
    const whenTrue = (action.trueLines ?? [""]).filter((l) => l.trim()).map(parseActionBlock);
    const whenFalse = (action.falseLines ?? [""]).filter((l) => l.trim()).map(parseActionBlock);
    return serializeActionBlock({
      kind: "conditional",
      check: action.condition ?? "",
      whenTrue,
      whenFalse
    });
  }

  const lines = (action.lines ?? [""]).filter((l) => l.trim());
  const body = lines.map((l) => `  - "${escapeLine(l)}"`).join("\n");
  if (!lines.length) return `${action.type} {\n}`;
  return `${action.type} {\n${body}\n}`;
}

export function VisualActionEditor({ value, onChange }: VisualActionEditorProps) {
  const [actions, setActions] = React.useState<ParsedAction[]>(() =>
    value.length ? value.map(parseAction) : []
  );
  const [showPicker, setShowPicker] = React.useState(false);

  React.useEffect(() => {
    setActions(value.length ? value.map(parseAction) : []);
  }, [value.join("\n---\n")]);

  const updateActions = (next: ParsedAction[]) => {
    setActions(next);
    const serialized = next.map(serializeAction).filter(Boolean) as string[];
    onChange(serialized);
  };

  const addAction = (type: ActionKind) => {
    const newAction: ParsedAction = {
      type,
      lines: type === "raw" ? [] : [""],
      raw: type === "raw" ? "" : undefined,
      subchannel: type === "bungee" ? "Connect" : undefined,
      args: type === "bungee" ? [""] : undefined,
      condition: type === "conditional" ? "" : undefined,
      trueLines: type === "conditional" ? [""] : undefined,
      falseLines: type === "conditional" ? [""] : undefined
    };
    updateActions([...actions, newAction]);
    setShowPicker(false);
  };

  const updateAction = (index: number, updates: Partial<ActionBlockData>) => {
    const next = [...actions];
    next[index] = { ...next[index], ...updates };
    updateActions(next);
  };

  const moveAction = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= actions.length) return;
    const next = [...actions];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    updateActions(next);
  };

  const removeAction = (index: number) => {
    updateActions(actions.filter((_, i) => i !== index));
  };

  const duplicateAction = (index: number) => {
    const copy = { ...actions[index] };
    const next = [...actions];
    next.splice(index + 1, 0, copy);
    updateActions(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-brand-muted">Actions</div>
        <button
          className="ui-btn-primary px-3 py-1 text-xs"
          onClick={() => setShowPicker(true)}
        >
          + Add Action
        </button>
      </div>

      <div className="space-y-2">
        {actions.map((action, idx) => (
          <ActionBlock
            key={idx}
            type={action.type}
            lines={action.lines}
            subchannel={action.subchannel}
            args={action.args}
            raw={action.raw}
            trueLines={action.trueLines}
            falseLines={action.falseLines}
            condition={action.condition}
            onUpdate={(updates) => updateAction(idx, updates)}
            index={idx}
            total={actions.length}
            onMoveUp={() => moveAction(idx, -1)}
            onMoveDown={() => moveAction(idx, 1)}
            onRemove={() => removeAction(idx)}
            onDuplicate={() => duplicateAction(idx)}
          />
        ))}
        {actions.length === 0 && (
          <div className="text-xs text-brand-muted text-center py-4 border border-dashed border-brand-border rounded">
            No actions yet. Click "Add Action" to get started.
          </div>
        )}
      </div>

      {showPicker && (
        <ActionPicker
          onSelect={addAction}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
