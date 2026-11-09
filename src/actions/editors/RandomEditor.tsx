import React from "react";
import { ParsedAction } from "../../plugin/grammar";
import type { ActionId } from "../../plugin/actions";
import { validateRandomEntry } from "../../plugin/lines";
import { BufferedInput } from "../../components/BufferedInput";
import { Icon } from "../../components/Icon";
import { useLineContext } from "../../data/useMinecraftData";
import { DEFAULT_LINES, LineFields, STRUCTURED_LINES } from "../LineFields";
import { ACTION_TITLES } from "../actionWizard";

interface RandomEditorProps {
  action: Extract<ParsedAction, { kind: "random" }>;
  onChange: (next: ParsedAction) => void;
}

const ENTRY_TYPES: ActionId[] = ["message", "title", "actionbar", "sound", "inventory", "economy", "command", "server", "broadcast", "open"];

function splitEntry(text: string): { type: ActionId | null; value: string } {
  const colon = text.indexOf(":");
  const type = colon === -1 ? "" : text.slice(0, colon).trim().toLowerCase();
  return ENTRY_TYPES.includes(type as ActionId) ? { type: type as ActionId, value: text.slice(colon + 1) } : { type: null, value: text };
}

export function RandomEditor({ action, onChange }: RandomEditorProps) {
  const ctx = useLineContext();
  const [asText, setAsText] = React.useState<Record<number, boolean>>({});
  const total = action.entries.reduce((sum, e) => sum + (e.weight && e.weight > 0 ? e.weight : 1), 0);

  const updateEntry = (i: number, patch: Partial<{ text: string; weight?: number }>) =>
    onChange({ kind: "random", entries: action.entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });
  const addEntry = () => onChange({ kind: "random", entries: [...action.entries, { text: "message:" }] });
  const removeEntry = (i: number) => onChange({ kind: "random", entries: action.entries.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-2">
      <p className="ui-hint mt-0">One entry is picked each time. Bigger weights are picked more often.</p>
      {action.entries.map((entry, i) => {
        const { type, value } = splitEntry(entry.text);
        const chance = Math.round(((entry.weight && entry.weight > 0 ? entry.weight : 1) / total) * 100);
        const problems = validateRandomEntry(entry.text, entry.weight, ctx);
        const raw = asText[i] || type === null;
        return (
          <div key={i} className="space-y-2 rounded-md border border-brand-border bg-brand-surface p-2.5">
            <div className="flex items-end gap-2">
              <label className="block min-w-0 flex-1">
                <span className="ui-label">Entry {i + 1}</span>
                <select
                  className="ui-input"
                  aria-label={`Entry ${i + 1} action`}
                  value={raw ? "" : type ?? ""}
                  onChange={(e) => {
                    const t = e.target.value as ActionId;
                    if (!t) return setAsText((s) => ({ ...s, [i]: true }));
                    setAsText((s) => ({ ...s, [i]: false }));
                    updateEntry(i, { text: `${t}:${t === type ? value : DEFAULT_LINES[t] ?? ""}` });
                  }}
                >
                  {ENTRY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ACTION_TITLES[t].title}
                    </option>
                  ))}
                  <option value="">Written by hand</option>
                </select>
              </label>
              <label className="block w-20">
                <span className="ui-label">Weight</span>
                <BufferedInput
                  type="number"
                  step="any"
                  min={0}
                  aria-label={`Entry ${i + 1} weight`}
                  className="ui-input"
                  placeholder="1"
                  value={entry.weight ?? ""}
                  onCommit={(v) => updateEntry(i, { weight: v.trim() === "" ? undefined : Number(v) })}
                />
              </label>
              <span className="w-11 pb-2 text-right font-mono-ui text-[12px] text-brand-muted" title="Chance of being picked">
                {chance}%
              </span>
              <button type="button" className="ui-icon-btn mb-0.5 size-8 hover:!text-brand-danger" aria-label={`Remove entry ${i + 1}`} title="Remove" onClick={() => removeEntry(i)}>
                <Icon name="x" size={14} />
              </button>
            </div>
            {raw ? (
              <BufferedInput
                aria-label={`Entry ${i + 1} text`}
                className="ui-input font-mono-ui text-[12.5px]"
                placeholder="type:value, like inventory:give:diamond:1"
                value={entry.text}
                onCommit={(v) => updateEntry(i, { text: v })}
              />
            ) : STRUCTURED_LINES.includes(type!) ? (
              <LineFields id={type!} value={value} onChange={(v) => updateEntry(i, { text: `${type}:${v}` })} />
            ) : (
              <BufferedInput
                aria-label={`Entry ${i + 1} text`}
                className="ui-input"
                placeholder={type === "open" ? "form_name" : type === "command" || type === "server" ? "command without /" : "Text"}
                value={value}
                onCommit={(v) => updateEntry(i, { text: `${type}:${v}` })}
              />
            )}
            {problems.length > 0 && (
              <ul className="space-y-0.5">
                {problems.map((p) => (
                  <li key={p.message} className={`flex items-start gap-1.5 text-[12px] ${p.level === "error" ? "text-brand-danger" : "text-brand-warning"}`}>
                    <Icon name="alert" size={13} className="mt-0.5" />
                    {p.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      <button type="button" className="ui-btn-ghost min-h-7 px-1.5 text-[12.5px]" onClick={addEntry}>
        <Icon name="plus" size={13} /> Add entry
      </button>
    </div>
  );
}
