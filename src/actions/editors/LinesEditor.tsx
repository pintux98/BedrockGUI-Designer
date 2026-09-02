import React from "react";
import { ACTIONS } from "../../plugin/actions";
import { ParsedAction } from "../../plugin/grammar";
import { BufferedInput } from "../../components/BufferedInput";
import { PlaceholderPicker } from "../../components/PlaceholderPicker";
import { OpenTargetPicker } from "../../components/OpenTargetPicker";

interface LinesEditorProps {
  action: Extract<ParsedAction, { kind: "lines" }>;
  onChange: (next: ParsedAction) => void;
}

/**
 * `OpenFormActionHandler.shouldTreatValuesAsMenuChain` only opens the values as a
 * chain of menus when every one of them is a syntactically valid *and registered*
 * menu name. Otherwise the first value is the menu and the rest are arguments
 * passed to it. So only line 1 of an `open` block is reliably a menu target — the
 * later lines are shown as plain text, labelled for what they may actually be.
 */
const OPEN_CHAIN_NOTE =
  "Only the first value is always a menu. The rest open as a chain only when every one of them is a registered menu; otherwise they are passed to the first menu as arguments.";

export function LinesEditor({ action, onChange }: LinesEditorProps) {
  const info = ACTIONS[action.id];
  const [placeholderTarget, setPlaceholderTarget] = React.useState<number | null>(null);
  const isOpen = action.id === "open";

  const updateLine = (i: number, value: string) => {
    const lines = [...action.lines];
    lines[i] = value;
    onChange({ kind: "lines", id: action.id, lines });
  };

  const addLine = () => onChange({ kind: "lines", id: action.id, lines: [...action.lines, ""] });

  const removeLine = (i: number) =>
    onChange({ kind: "lines", id: action.id, lines: action.lines.filter((_, idx) => idx !== i) });

  const lineLabel = (i: number) => (isOpen && i > 0 ? `Line ${i + 1} (chained menu or argument)` : `Line ${i + 1}`);

  return (
    <div className="space-y-1">
      {action.lines.map((line, i) =>
        isOpen && i === 0 ? (
          <div key={i} className="flex items-start gap-1">
            <div className="flex-1">
              <OpenTargetPicker value={line} onChange={(v) => updateLine(0, v)} />
            </div>
            <button
              type="button"
              className="ui-btn-ghost px-1.5 py-0.5 text-xs text-brand-danger hover:text-red-400 mt-4"
              aria-label={`Remove line ${i + 1}`}
              onClick={() => removeLine(i)}
            >
              ✕
            </button>
          </div>
        ) : (
          <div key={i} className="flex items-center gap-1">
            <BufferedInput
              aria-label={lineLabel(i)}
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
        )
      )}
      <button type="button" className="ui-btn-ghost px-2 py-1 text-xs" onClick={addLine}>
        + Add line
      </button>
      {isOpen && action.lines.length > 1 && (
        <p className="text-[10px] text-brand-muted">{OPEN_CHAIN_NOTE}</p>
      )}
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
