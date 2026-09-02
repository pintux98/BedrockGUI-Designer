import React from "react";
import { ACTIONS } from "../../plugin/actions";
import { ParsedAction } from "../../plugin/grammar";
import { BufferedInput } from "../../components/BufferedInput";
import { PlaceholderPicker } from "../../components/PlaceholderPicker";

interface LinesEditorProps {
  action: Extract<ParsedAction, { kind: "lines" }>;
  onChange: (next: ParsedAction) => void;
}

export function LinesEditor({ action, onChange }: LinesEditorProps) {
  const info = ACTIONS[action.id];
  const [placeholderTarget, setPlaceholderTarget] = React.useState<number | null>(null);

  const updateLine = (i: number, value: string) => {
    const lines = [...action.lines];
    lines[i] = value;
    onChange({ kind: "lines", id: action.id, lines });
  };

  const addLine = () => onChange({ kind: "lines", id: action.id, lines: [...action.lines, ""] });

  const removeLine = (i: number) =>
    onChange({ kind: "lines", id: action.id, lines: action.lines.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-1">
      {action.lines.map((line, i) => (
        <div key={i} className="flex items-center gap-1">
          <BufferedInput
            aria-label={`Line ${i + 1}`}
            className="ui-input text-xs flex-1"
            placeholder={info.placeholder}
            value={line}
            onCommit={(v) => updateLine(i, v)}
          />
          <button
            type="button"
            className="ui-btn-ghost px-1.5 py-0.5 text-xs"
            aria-label={`Insert placeholder into line ${i + 1}`}
            onClick={() => setPlaceholderTarget(i)}
          >
            @
          </button>
          <button
            type="button"
            className="ui-btn-ghost px-1.5 py-0.5 text-xs text-brand-danger hover:text-red-400"
            aria-label={`Remove line ${i + 1}`}
            onClick={() => removeLine(i)}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="ui-btn-ghost px-2 py-1 text-xs" onClick={addLine}>
        + Add line
      </button>
      <pre className="text-[9px] text-brand-accent/70 font-mono whitespace-pre-wrap">{info.formatExample}</pre>

      {placeholderTarget !== null && (
        <PlaceholderPicker
          onSelect={(placeholder) => updateLine(placeholderTarget, action.lines[placeholderTarget] + placeholder)}
          onClose={() => setPlaceholderTarget(null)}
        />
      )}
    </div>
  );
}
