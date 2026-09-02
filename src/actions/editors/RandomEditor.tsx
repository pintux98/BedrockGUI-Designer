import React from "react";
import { ParsedAction } from "../../plugin/grammar";
import { BufferedInput } from "../../components/BufferedInput";
import { PlaceholderPicker } from "../../components/PlaceholderPicker";

interface RandomEditorProps {
  action: Extract<ParsedAction, { kind: "random" }>;
  onChange: (next: ParsedAction) => void;
}

export function RandomEditor({ action, onChange }: RandomEditorProps) {
  const [placeholderTarget, setPlaceholderTarget] = React.useState<number | null>(null);

  const updateEntry = (i: number, patch: Partial<{ text: string; weight?: number }>) =>
    onChange({ kind: "random", entries: action.entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });

  const addEntry = () => onChange({ kind: "random", entries: [...action.entries, { text: "" }] });

  const removeEntry = (i: number) =>
    onChange({ kind: "random", entries: action.entries.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-1">
      {action.entries.map((entry, i) => (
        <div key={i} className="flex items-center gap-1">
          <BufferedInput
            aria-label={`Entry ${i + 1} text`}
            className="ui-input text-xs flex-1"
            placeholder="e.g. inventory:give:diamond:1"
            value={entry.text}
            onCommit={(v) => updateEntry(i, { text: v })}
          />
          <BufferedInput
            type="number"
            step="any"
            aria-label={`Entry ${i + 1} weight`}
            className="ui-input text-xs w-16"
            placeholder="1.0"
            value={entry.weight ?? ""}
            onCommit={(v) => updateEntry(i, { weight: v.trim() === "" ? undefined : Number(v) })}
          />
          <button
            type="button"
            className="ui-btn-ghost px-1.5 py-0.5 text-xs"
            aria-label={`Insert placeholder into entry ${i + 1}`}
            onClick={() => setPlaceholderTarget(i)}
          >
            @
          </button>
          <button
            type="button"
            className="ui-btn-ghost px-1.5 py-0.5 text-xs text-brand-danger hover:text-red-400"
            aria-label={`Remove entry ${i + 1}`}
            onClick={() => removeEntry(i)}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="ui-btn-ghost px-2 py-1 text-xs" onClick={addEntry}>
        + Add entry
      </button>

      {placeholderTarget !== null && (
        <PlaceholderPicker
          onSelect={(placeholder) =>
            updateEntry(placeholderTarget, { text: action.entries[placeholderTarget].text + placeholder })
          }
          onClose={() => setPlaceholderTarget(null)}
        />
      )}
    </div>
  );
}
