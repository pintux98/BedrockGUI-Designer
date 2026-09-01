import React from "react";
import { BufferedInput } from "../components/BufferedInput";
import { PlaceholderPicker } from "../components/PlaceholderPicker";

export interface ConditionRule {
  id: string;
  condition: string;
  property: "text" | "image" | "onClick";
  value: string;
}

interface ConditionBuilderProps {
  rules: ConditionRule[];
  onChange: (rules: ConditionRule[]) => void;
}

const CONDITION_TYPES = [
  { value: "permission", label: "Permission", placeholder: "my.permission" },
  { value: "not:permission", label: "No Permission", placeholder: "my.permission" },
  { value: "placeholder", label: "Placeholder", placeholder: "{vault_eco_balance} >= 100" },
  { value: "plugin", label: "Plugin Enabled", placeholder: "Vault" },
  { value: "bedrock_player", label: "Is Bedrock Player", placeholder: "" },
  { value: "java_player", label: "Is Java Player", placeholder: "" },
];

const PROPERTY_OPTIONS: { value: "text" | "image" | "onClick"; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
  { value: "onClick", label: "Actions" },
];

export function ConditionBuilder({ rules, onChange }: ConditionBuilderProps) {
  const [showPlaceholderPicker, setShowPlaceholderPicker] = React.useState(false);
  const [editingRuleIndex, setEditingRuleIndex] = React.useState<number | null>(null);

  const addRule = () => {
    onChange([...rules, { id: `cond_${Date.now()}`, condition: "", property: "text", value: "" }]);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, updates: Partial<ConditionRule>) => {
    const next = [...rules];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-brand-muted">Conditional Overrides</span>
        <button className="ui-btn-secondary px-2 py-1 text-xs" onClick={addRule}>
          + Add Rule
        </button>
      </div>

      {rules.map((rule, idx) => {
        const condType = rule.condition.split(":")[0] || "";
        const condValue = rule.condition.includes(":") ? rule.condition.slice(rule.condition.indexOf(":") + 1) : rule.condition;
        const matchedType = CONDITION_TYPES.find((t) => t.value === condType) || CONDITION_TYPES[0];

        return (
          <div key={rule.id} className="bg-brand-surface border border-brand-border p-2 rounded space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-brand-muted font-mono">Rule #{idx + 1}</span>
              <button className="ui-btn-ghost px-1.5 py-0.5 text-xs text-brand-danger" onClick={() => removeRule(idx)}>
                ✕
              </button>
            </div>

            <div className="grid grid-cols-12 gap-2">
              <select
                className="ui-input text-xs col-span-4"
                value={condType}
                onChange={(e) => {
                  const newType = e.target.value;
                  const info = CONDITION_TYPES.find((t) => t.value === newType);
                  const newCond = newType === "bedrock_player" || newType === "java_player" ? newType : `${newType}:${condValue || info?.placeholder || ""}`;
                  updateRule(idx, { condition: newCond });
                }}
              >
                {CONDITION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              {(condType !== "bedrock_player" && condType !== "java_player") && (
                <div className="col-span-8 flex gap-1">
                  <BufferedInput
                    className="ui-input text-xs flex-1"
                    placeholder={matchedType.placeholder}
                    value={condValue}
                    onCommit={(v) => {
                      const newCond = `${condType}:${v}`;
                      updateRule(idx, { condition: newCond });
                    }}
                  />
                  <button
                    className="ui-btn-ghost px-1.5 py-1 text-xs"
                    title="Insert placeholder"
                    onClick={() => { setEditingRuleIndex(idx); setShowPlaceholderPicker(true); }}
                  >
                    @
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-12 gap-2">
              <select
                className="ui-input text-xs col-span-3"
                value={rule.property}
                onChange={(e) => updateRule(idx, { property: e.target.value as ConditionRule["property"] })}
              >
                {PROPERTY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>

              {rule.property === "onClick" ? (
                <div className="col-span-9">
                  <div className="text-[10px] text-brand-muted mb-1">Actions (raw format)</div>
                  <textarea
                    className="ui-textarea h-14 text-xs font-mono"
                    placeholder={'message {\n  - "Conditional text"\n}'}
                    value={rule.value}
                    onChange={(e) => updateRule(idx, { value: e.target.value })}
                    onBlur={(e) => updateRule(idx, { value: e.target.value })}
                  />
                </div>
              ) : (
                <div className="col-span-9 flex gap-1">
                  <BufferedInput
                    className="ui-input text-xs flex-1"
                    placeholder={rule.property === "text" ? "Conditional text" : "Image URL/path"}
                    value={rule.value}
                    onCommit={(v) => updateRule(idx, { value: v })}
                  />
                  {rule.property === "text" && (
                    <button
                      className="ui-btn-ghost px-1.5 py-1 text-xs"
                      title="Insert placeholder"
                      onClick={() => { setEditingRuleIndex(idx); setShowPlaceholderPicker(true); }}
                    >
                      @
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {rules.length === 0 && (
        <div className="text-xs text-brand-muted text-center py-3 border border-dashed border-brand-border rounded">
          No conditional overrides. Add rules to change button properties based on conditions.
        </div>
      )}

      {showPlaceholderPicker && (
        <PlaceholderPicker
          onSelect={(placeholder) => {
            if (editingRuleIndex !== null) {
              const rule = rules[editingRuleIndex];
              const condType = rule.condition.split(":")[0] || "";
              const condValue = rule.condition.includes(":") ? rule.condition.slice(rule.condition.indexOf(":") + 1) : rule.condition;
              if (rule.property === "text") {
                updateRule(editingRuleIndex, { value: rule.value + placeholder });
              } else {
                const newCond = `${condType}:${condValue}${placeholder}`;
                updateRule(editingRuleIndex, { condition: newCond });
              }
            }
            setShowPlaceholderPicker(false);
          }}
          onClose={() => { setShowPlaceholderPicker(false); setEditingRuleIndex(null); }}
        />
      )}
    </div>
  );
}
