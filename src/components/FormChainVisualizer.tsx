import React from "react";
import { useDesignerStore } from "../core/store";

interface FormChainNode {
  id: string;
  label: string;
  type: "form" | "button" | "open-action";
  target?: string;
  children: FormChainNode[];
}

export function FormChainVisualizer() {
  const { activeForm } = useDesignerStore();
  const bedrock = activeForm().bedrock;

  if (!bedrock || (bedrock.type !== "SIMPLE" && bedrock.type !== "MODAL")) {
    return (
      <div className="text-xs text-brand-muted text-center py-4">
        Form chaining is available for Simple and Modal forms.
      </div>
    );
  }

  const buttons = bedrock.buttons || [];
  const chains: FormChainNode[] = [];

  for (const button of buttons) {
    const openActions = (button.onClick ?? [])
      .filter((a) => a.raw && a.raw.trim().startsWith("open"))
      .map((a) => {
        const match = a.raw?.match(/open\s*\{\s*\n?\s*-\s*["']?([a-zA-Z0-9_.-]+)/);
        return match ? match[1] : "unknown";
      });

    if (openActions.length > 0) {
      chains.push({
        id: button.id,
        label: button.text,
        type: "button",
        children: openActions.map((target) => ({
          id: `${button.id}->${target}`,
          label: target,
          type: "open-action",
          target,
          children: []
        }))
      });
    }
  }

  if (chains.length === 0) {
    return (
      <div className="text-xs text-brand-muted text-center py-4">
        No form chains detected. Add &quot;open: form_name&quot; actions to buttons to create chains.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {chains.map((chain) => (
        <div key={chain.id} className="flex items-center gap-2 flex-wrap">
          <div className="ui-chip bg-brand-surface2">
            <span className="text-xs">{chain.label}</span>
          </div>
          <span className="text-brand-muted text-xs">→</span>
          {chain.children.map((child) => (
            <React.Fragment key={child.id}>
              <div className="ui-chip bg-brand-accent/20 border-brand-accent/40">
                <span className="text-xs text-brand-accent">{child.label}</span>
              </div>
              {chain.children.indexOf(child) < chain.children.length - 1 && (
                <span className="text-brand-muted text-xs">,</span>
              )}
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
