import React from "react";
import { ParsedAction } from "../../plugin/grammar";
import { ActionKind, createDefaultAction } from "../actionInfo";
import { ActionBlock } from "../ActionBlock";
import { ActionPicker } from "../ActionPicker";
import { BufferedInput } from "../../components/BufferedInput";
import { PlaceholderPicker } from "../../components/PlaceholderPicker";

interface ConditionalEditorProps {
  action: Extract<ParsedAction, { kind: "conditional" }>;
  onChange: (next: ParsedAction) => void;
}

export function ConditionalEditor({ action, onChange }: ConditionalEditorProps) {
  const checkId = React.useId();
  const [showPlaceholderPicker, setShowPlaceholderPicker] = React.useState(false);

  return (
    <div className="space-y-2">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={checkId} className="text-[10px] text-brand-muted">
            Check condition
          </label>
          <button
            type="button"
            className="ui-btn-ghost px-1.5 py-0.5 text-xs"
            aria-label="Insert placeholder"
            onClick={() => setShowPlaceholderPicker(true)}
          >
            @
          </button>
        </div>
        <BufferedInput
          id={checkId}
          className="ui-input text-xs"
          placeholder="e.g. permission:my.perm"
          value={action.check}
          onCommit={(v) => onChange({ ...action, check: v })}
        />
      </div>

      <Branch
        label="If true"
        dotClassName="bg-brand-success"
        actions={action.whenTrue}
        onChange={(whenTrue) => onChange({ ...action, whenTrue })}
      />
      <Branch
        label="If false"
        dotClassName="bg-brand-danger"
        actions={action.whenFalse}
        onChange={(whenFalse) => onChange({ ...action, whenFalse })}
      />

      {showPlaceholderPicker && (
        <PlaceholderPicker
          onSelect={(placeholder) => onChange({ ...action, check: action.check + placeholder })}
          onClose={() => setShowPlaceholderPicker(false)}
        />
      )}
    </div>
  );
}

interface BranchProps {
  label: string;
  dotClassName: string;
  actions: ParsedAction[];
  onChange: (next: ParsedAction[]) => void;
}

function Branch({ label, dotClassName, actions, onChange }: BranchProps) {
  const [showPicker, setShowPicker] = React.useState(false);

  const addAction = (kind: ActionKind) => {
    onChange([...actions, createDefaultAction(kind)]);
    setShowPicker(false);
  };

  const updateAt = (i: number, next: ParsedAction) => {
    const copy = [...actions];
    copy[i] = next;
    onChange(copy);
  };

  const moveAt = (i: number, direction: -1 | 1) => {
    const j = i + direction;
    if (j < 0 || j >= actions.length) return;
    const copy = [...actions];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };

  const removeAt = (i: number) => onChange(actions.filter((_, idx) => idx !== i));

  const duplicateAt = (i: number) => {
    const copy = [...actions];
    copy.splice(i + 1, 0, actions[i]);
    onChange(copy);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${dotClassName}`} />
          <span className="text-[10px] text-brand-muted">{label}</span>
        </div>
        <button type="button" className="ui-btn-ghost px-1.5 py-0.5 text-xs" onClick={() => setShowPicker(true)}>
          + Add
        </button>
      </div>
      <div className="space-y-1">
        {actions.map((a, i) => (
          <ActionBlock
            key={i}
            action={a}
            onUpdate={(next) => updateAt(i, next)}
            index={i}
            total={actions.length}
            onMoveUp={() => moveAt(i, -1)}
            onMoveDown={() => moveAt(i, 1)}
            onRemove={() => removeAt(i)}
            onDuplicate={() => duplicateAt(i)}
            defaultExpanded={false}
          />
        ))}
        {actions.length === 0 && (
          <div className="text-[10px] text-brand-muted text-center py-2 border border-dashed border-brand-border rounded">
            No actions.
          </div>
        )}
      </div>
      {showPicker && <ActionPicker onSelect={addAction} onClose={() => setShowPicker(false)} />}
    </div>
  );
}
