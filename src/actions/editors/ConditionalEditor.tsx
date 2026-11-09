import React from "react";
import { ParsedAction } from "../../plugin/grammar";
import { ActionBlock } from "../ActionBlock";
import { AddActionFlow } from "../ActionSetup";
import { ConditionField } from "../../components/ConditionWizard";
import { Icon } from "../../components/Icon";

interface ConditionalEditorProps {
  action: Extract<ParsedAction, { kind: "conditional" }>;
  onChange: (next: ParsedAction) => void;
}

export function ConditionalEditor({ action, onChange }: ConditionalEditorProps) {
  return (
    <div className="space-y-3">
      <ConditionField label="Only if" context="symbol" value={action.check} onChange={(check) => onChange({ ...action, check })} />
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
          <span className="text-[11.5px] text-brand-muted">{label}</span>
        </div>
        <button type="button" className="ui-btn-ghost min-h-7 px-1.5 text-[12.5px]" onClick={() => setShowPicker(true)}>
          <Icon name="plus" size={13} /> Add
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
          <div className="text-[11.5px] text-brand-muted text-center py-2 border border-dashed border-brand-border rounded">
            No actions.
          </div>
        )}
      </div>
      {showPicker && <AddActionFlow onClose={() => setShowPicker(false)} onAdd={(a) => onChange([...actions, a])} />}
    </div>
  );
}
