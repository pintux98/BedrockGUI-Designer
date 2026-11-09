import React from "react";
import { ACTIONS } from "../../plugin/actions";
import { ParsedAction } from "../../plugin/grammar";
import { BufferedInput } from "../../components/BufferedInput";
import { PlaceholderPicker } from "../../components/PlaceholderPicker";
import { OpenTargetPicker } from "../../components/OpenTargetPicker";
import { Icon } from "../../components/Icon";
import { DEFAULT_LINES, LineFields, LineProblems, STRUCTURED_LINES } from "../LineFields";

interface LinesEditorProps {
  action: Extract<ParsedAction, { kind: "lines" }>;
  onChange: (next: ParsedAction) => void;
}

const OPEN_CHAIN_NOTE =
  "Only the first value is always a form. The rest open as a chain only when every one of them is a registered form; otherwise they are passed to the first form as arguments.";

export function LinesEditor({ action, onChange }: LinesEditorProps) {
  const info = ACTIONS[action.id];
  const [placeholderTarget, setPlaceholderTarget] = React.useState<number | null>(null);
  const [asText, setAsText] = React.useState<Record<number, boolean>>({});
  const isOpen = action.id === "open";
  const structured = STRUCTURED_LINES.includes(action.id);

  const updateLine = (i: number, value: string) => {
    const lines = [...action.lines];
    lines[i] = value;
    onChange({ kind: "lines", id: action.id, lines });
  };
  const addLine = () => onChange({ kind: "lines", id: action.id, lines: [...action.lines, DEFAULT_LINES[action.id] ?? ""] });
  const removeLine = (i: number) => onChange({ kind: "lines", id: action.id, lines: action.lines.filter((_, idx) => idx !== i) });

  const removeButton = (i: number) => (
    <button type="button" className="ui-icon-btn size-7 hover:!text-brand-danger" aria-label={`Remove line ${i + 1}`} title="Remove" onClick={() => removeLine(i)}>
      <Icon name="x" size={14} />
    </button>
  );

  return (
    <div className="space-y-2">
      {action.lines.map((line, i) => {
        if (isOpen && i === 0) {
          return (
            <div key={i} className="flex items-start gap-1">
              <div className="flex-1">
                <OpenTargetPicker value={line} onChange={(v) => updateLine(0, v)} />
                <LineProblems id={action.id} line={line} />
              </div>
              {action.lines.length > 1 && removeButton(i)}
            </div>
          );
        }
        if (structured && !asText[i]) {
          return (
            <div key={i} className="rounded-md border border-brand-border bg-brand-surface p-2.5">
              <LineFields id={action.id} value={line} onChange={(v) => updateLine(i, v)} />
              <LineProblems id={action.id} line={line} />
              <div className="mt-2 flex items-center justify-between">
                <button type="button" className="ui-btn-ghost min-h-6 px-1 text-[12px]" onClick={() => setAsText((s) => ({ ...s, [i]: true }))}>
                  Edit as text
                </button>
                {action.lines.length > 1 && removeButton(i)}
              </div>
            </div>
          );
        }
        return (
          <div key={i}>
            <div className="flex items-center gap-1">
              <BufferedInput
                aria-label={isOpen ? `Line ${i + 1} (chained form or argument)` : `Line ${i + 1}`}
                className="ui-input flex-1"
                placeholder={info.placeholder}
                value={line}
                onCommit={(v) => updateLine(i, v)}
              />
              {structured ? (
                <button type="button" className="ui-btn-ghost min-h-7 px-1.5 text-[12px]" onClick={() => setAsText((s) => ({ ...s, [i]: false }))}>
                  Fields
                </button>
              ) : (
                <button type="button" className="ui-icon-btn size-7" aria-label={`Insert placeholder into line ${i + 1}`} title="Insert placeholder" onClick={() => setPlaceholderTarget(i)}>
                  {"{}"}
                </button>
              )}
              {removeButton(i)}
            </div>
            <LineProblems id={action.id} line={line} />
          </div>
        );
      })}
      <button type="button" className="ui-btn-ghost min-h-7 px-1.5 text-[12.5px]" onClick={addLine}>
        <Icon name="plus" size={13} /> {isOpen ? "Add another form or argument" : "Add line"}
      </button>
      {isOpen && action.lines.length > 1 && <p className="ui-hint">{OPEN_CHAIN_NOTE}</p>}

      {placeholderTarget !== null && (
        <PlaceholderPicker
          onSelect={(placeholder) => updateLine(placeholderTarget, action.lines[placeholderTarget] + placeholder)}
          onClose={() => setPlaceholderTarget(null)}
        />
      )}
    </div>
  );
}
