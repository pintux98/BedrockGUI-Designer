import React from "react";
import { useDesignerStore } from "../core/store";
import { BedrockPreview } from "./previews/BedrockPreview";

export function Canvas() {
  const { activeForm, setSelectedBedrockButtonId, setSelectedBedrockComponentId } = useDesignerStore();
  const doc = activeForm();
  const form = doc.bedrock;
  const [conditionsMet, setConditionsMet] = React.useState(true);
  const hasConditions =
    form.type !== "CUSTOM" &&
    form.buttons.some((b) => b.showCondition || b.alternativeText || b.alternativeImage || b.conditions?.length);

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-brand-border bg-brand-surface px-3 py-1.5">
        <span className="truncate text-[12.5px] text-brand-muted">
          Preview of <span className="font-mono-ui text-brand-text">{doc.fileName}</span>
        </span>
        {hasConditions && (
          <div role="radiogroup" aria-label="Preview conditions" className="flex rounded-md border border-brand-border p-0.5 text-[12px]">
            {[
              { value: true, label: "Conditions met" },
              { value: false, label: "Not met" }
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={conditionsMet === o.value}
                onClick={() => setConditionsMet(o.value)}
                className={`rounded px-2 py-0.5 ${conditionsMet === o.value ? "bg-brand-surface-raised text-brand-text" : "text-brand-muted hover:text-brand-text"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="bedrock-stage flex-1 overflow-auto px-4 py-10"
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          setSelectedBedrockButtonId(null);
          setSelectedBedrockComponentId(null);
        }}
      >
        <BedrockPreview form={form} conditionsMet={conditionsMet} />
      </div>
    </div>
  );
}
