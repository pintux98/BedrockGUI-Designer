import React from "react";
import { useDesignerStore } from "../core/store";

export function FormTypePanel() {
  const { bedrock, setBedrock } = useDesignerStore();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-brand-text uppercase tracking-wider">Form Type</span>
        <span className="text-[10px] text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded font-medium">Bedrock</span>
      </div>
      {bedrock && (
        <select
          className="ui-input w-full text-sm"
          value={bedrock.type}
          onChange={(e) =>
            setBedrock(coerceBedrockType(bedrock, e.target.value as any))
          }
        >
          <option value="SIMPLE">Simple Form - Button list</option>
          <option value="MODAL">Modal Form - Yes/No dialog</option>
          <option value="CUSTOM">Custom Form - Input components</option>
        </select>
      )}
    </div>
  );
}

function coerceBedrockType(prev: any, type: "SIMPLE" | "MODAL" | "CUSTOM") {
  if (type === "SIMPLE") {
    return {
      type,
      title: prev.title ?? "Form",
      content: prev.content ?? "",
      buttons:
        Array.isArray(prev.buttons) && prev.buttons.length
          ? prev.buttons.map((b: any, i: number) => ({ id: b.id ?? `button_${i + 1}`, ...b }))
          : [{ id: "button_1", text: "Button 1" }]
    };
  }
  if (type === "MODAL") {
    const buttonsRaw =
      Array.isArray(prev.buttons) && prev.buttons.length >= 2
        ? prev.buttons.slice(0, 2)
        : [{ id: "yes", text: "Yes" }, { id: "no", text: "No" }];
    const buttons = buttonsRaw.map((b: any, i: number) => ({ id: b.id ?? (i === 0 ? "yes" : "no"), ...b }));
    return {
      type,
      title: prev.title ?? "Modal",
      content: prev.content ?? "",
      buttons
    };
  }
  return {
    type,
    title: prev.title ?? "Custom",
    components: Array.isArray(prev.components) ? prev.components : []
  };
}
