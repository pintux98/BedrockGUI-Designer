import React from "react";
import { useDesignerStore } from "../core/store";
import { BedrockFormType } from "../core/types";
import { Icon, IconName } from "../components/Icon";

export const FORM_TYPE_INFO: Record<BedrockFormType, { label: string; description: string; icon: IconName }> = {
  SIMPLE: { label: "Menu", description: "A list of buttons", icon: "list" },
  MODAL: { label: "Yes / No", description: "A message with two buttons", icon: "dialog" },
  CUSTOM: { label: "Input form", description: "Fields the player fills in", icon: "sliders" }
};

export function FormTypePanel() {
  const { activeForm, setBedrock, setSelectedBedrockButtonId, setSelectedBedrockComponentId } = useDesignerStore();
  const bedrock = activeForm().bedrock;
  return (
    <div role="radiogroup" aria-label="Form type" className="grid grid-cols-3 gap-1.5">
      {(Object.keys(FORM_TYPE_INFO) as BedrockFormType[]).map((type) => {
        const info = FORM_TYPE_INFO[type];
        const checked = bedrock.type === type;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={checked}
            title={info.description}
            onClick={() => {
              if (checked) return;
              setSelectedBedrockButtonId(null);
              setSelectedBedrockComponentId(null);
              setBedrock(coerceBedrockType(bedrock, type), `Changed form type to ${info.label}`);
            }}
            className={`flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[12px] ${
              checked
                ? "border-brand-accent bg-brand-accent/15 text-brand-text"
                : "border-brand-border text-brand-muted hover:border-brand-borderStrong hover:text-brand-text"
            }`}
          >
            <Icon name={info.icon} size={16} />
            {info.label}
          </button>
        );
      })}
    </div>
  );
}

export function coerceBedrockType(prev: any, type: BedrockFormType) {
  const { buttons: _buttons, components: _components, ...shared } = prev;
  if (type === "SIMPLE") {
    return {
      ...shared,
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
      ...shared,
      type,
      title: prev.title ?? "Modal",
      content: prev.content ?? "",
      buttons
    };
  }
  return {
    ...shared,
    type,
    title: prev.title ?? "Custom",
    components: Array.isArray(prev.components) ? prev.components : []
  };
}
