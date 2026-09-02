import React from "react";
import { ParsedAction } from "../../plugin/grammar";
import { BufferedInput } from "../../components/BufferedInput";

interface BungeeEditorProps {
  action: Extract<ParsedAction, { kind: "bungee" }>;
  onChange: (next: ParsedAction) => void;
}

export function BungeeEditor({ action, onChange }: BungeeEditorProps) {
  const subchannelId = React.useId();

  const updateArg = (i: number, value: string) => {
    const args = [...action.args];
    args[i] = value;
    onChange({ ...action, args });
  };

  const addArg = () => onChange({ ...action, args: [...action.args, ""] });

  const removeArg = (i: number) => onChange({ ...action, args: action.args.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-2">
      <div>
        <label htmlFor={subchannelId} className="block text-[10px] text-brand-muted mb-1">
          Subchannel
        </label>
        <BufferedInput
          id={subchannelId}
          className="ui-input text-xs"
          placeholder="e.g. Connect"
          value={action.subchannel}
          onCommit={(v) => onChange({ ...action, subchannel: v })}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-brand-muted">Args</span>
          <button type="button" className="ui-btn-ghost px-2 py-1 text-xs" onClick={addArg}>
            + Add arg
          </button>
        </div>
        <div className="space-y-1">
          {action.args.map((arg, i) => (
            <div key={i} className="flex items-center gap-1">
              <BufferedInput
                aria-label={`Arg ${i + 1}`}
                className="ui-input text-xs flex-1"
                placeholder="e.g. lobby"
                value={arg}
                onCommit={(v) => updateArg(i, v)}
              />
              <button
                type="button"
                className="ui-btn-ghost px-1.5 py-0.5 text-xs text-brand-danger hover:text-red-400"
                aria-label={`Remove arg ${i + 1}`}
                onClick={() => removeArg(i)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
