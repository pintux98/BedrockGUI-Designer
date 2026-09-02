import React from "react";
import { ActionBlock } from "./ActionBlock";
import { ActionPicker } from "./ActionPicker";
import { ActionKind, createDefaultAction } from "./actionInfo";
import { parseActionBlock, serializeActionBlock, ParsedAction } from "../plugin/grammar";

interface VisualActionEditorProps {
  value: string[];
  onChange: (v: string[]) => void;
}

const JOIN = "\n---\n";

/**
 * The blocks the model is allowed to hold.
 *
 * A block the user has only just added — a fresh Raw block waiting to be pasted
 * into, say — serializes to "" and must never reach the model, because it would
 * export as a blank action block. It still has to stay on screen, so the empty
 * ones are dropped here and only here: `actions` keeps them.
 */
function committable(actions: ParsedAction[]): string[] {
  return actions.map(serializeActionBlock).filter((s) => s.trim().length > 0);
}

export function VisualActionEditor({ value, onChange }: VisualActionEditorProps) {
  /**
   * Editing state and the committed value are two different things. `actions` is
   * what the user is working on and may hold blocks that are still empty; `value`
   * is what the model kept, which never does. `committedRef` remembers the last
   * list this editor handed upwards, so the sync effect can tell its own echo
   * (keep the in-progress blocks) from a real outside change such as an undo or a
   * YAML edit (re-derive from the file). Without it, committing an edit to one
   * action bounced back through `value` and silently deleted every empty sibling.
   */
  const [actions, setActions] = React.useState<ParsedAction[]>(() => value.map(parseActionBlock));
  const [showPicker, setShowPicker] = React.useState(false);
  const committedRef = React.useRef(value.join(JOIN));

  const incoming = value.join(JOIN);
  React.useEffect(() => {
    if (incoming === committedRef.current) return;
    committedRef.current = incoming;
    setActions(value.map(parseActionBlock));
  }, [incoming]);

  const updateActions = (next: ParsedAction[]) => {
    setActions(next);
    const blocks = committable(next);
    const joined = blocks.join(JOIN);
    // Adding an empty block changes nothing the model can see; don't churn history.
    if (joined === committedRef.current) return;
    committedRef.current = joined;
    onChange(blocks);
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
