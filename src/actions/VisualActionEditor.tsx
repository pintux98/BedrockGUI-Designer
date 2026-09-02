import React from "react";
import { ActionBlock } from "./ActionBlock";
import { ActionPicker } from "./ActionPicker";
import { ActionKind, createDefaultAction } from "./actionInfo";
import { parseActionBlock, serializeActionBlock, ParsedAction } from "../plugin/grammar";

interface VisualActionEditorProps {
  value: string[];
  onChange: (v: string[]) => void;
}

export function VisualActionEditor({ value, onChange }: VisualActionEditorProps) {
  const [actions, setActions] = React.useState<ParsedAction[]>(() => value.map(parseActionBlock));
  const [showPicker, setShowPicker] = React.useState(false);

  React.useEffect(() => {
    setActions(value.map(parseActionBlock));
  }, [value.join("\n---\n")]);

  const updateActions = (next: ParsedAction[]) => {
    setActions(next);
    onChange(next.map(serializeActionBlock).filter((s) => s.trim().length > 0));
  };

  const addAction = (kind: ActionKind) => {
    updateActions([...actions, createDefaultAction(kind)]);
    setShowPicker(false);
  };

  const updateAction = (index: number, next: ParsedAction) => {
    const copy = [...actions];
    copy[index] = next;
    updateActions(copy);
  };

  const moveAction = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= actions.length) return;
    const copy = [...actions];
    [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
    updateActions(copy);
  };

  const removeAction = (index: number) => {
    updateActions(actions.filter((_, i) => i !== index));
  };

  const duplicateAction = (index: number) => {
    const copy = [...actions];
    copy.splice(index + 1, 0, actions[index]);
    updateActions(copy);
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
            action={action}
            onUpdate={(next) => updateAction(idx, next)}
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
