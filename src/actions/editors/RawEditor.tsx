import React from "react";
import { ParsedAction } from "../../plugin/grammar";
import { RAW_ACTION_INFO } from "../actionInfo";
import { BufferedTextArea } from "../../components/BufferedInput";
import { PlaceholderPicker } from "../../components/PlaceholderPicker";

interface RawEditorProps {
  action: Extract<ParsedAction, { kind: "raw" }>;
  onChange: (next: ParsedAction) => void;
}

export function RawEditor({ action, onChange }: RawEditorProps) {
  const [showPicker, setShowPicker] = React.useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-brand-muted">Raw action block</span>
        <button
          type="button"
          className="ui-btn-ghost px-1.5 py-0.5 text-xs"
          aria-label="Insert placeholder into raw action block"
          onClick={() => setShowPicker(true)}
        >
          @
        </button>
      </div>
      <BufferedTextArea
        aria-label="Raw action block"
        className="ui-textarea h-24 text-xs font-mono"
        placeholder={RAW_ACTION_INFO.placeholder}
        value={action.text}
        onCommit={(v) => onChange({ kind: "raw", text: v })}
      />

      {showPicker && (
        <PlaceholderPicker
          onSelect={(placeholder) => onChange({ kind: "raw", text: action.text + placeholder })}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
