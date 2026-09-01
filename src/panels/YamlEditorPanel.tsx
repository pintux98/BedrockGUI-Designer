import React, { useEffect, useState } from "react";
import { useDesignerStore } from "../core/store";
import { serializeFormDocument } from "../serialize/form";

interface YamlEditorPanelProps {
  onCollapseChange?: (collapsed: boolean) => void;
  defaultExpanded?: boolean;
}

export function YamlEditorPanel({ onCollapseChange, defaultExpanded }: YamlEditorPanelProps) {
  const { activeForm } = useDesignerStore();
  const contentId = React.useId();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("yaml_panel_collapsed") === "true";
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (defaultExpanded) {
      setCollapsed(false);
    }
  }, [defaultExpanded]);

  useEffect(() => {
    onCollapseChange?.(collapsed);
  }, [collapsed, onCollapseChange]);

  useEffect(() => {
    localStorage.setItem("yaml_panel_collapsed", String(collapsed));
  }, [collapsed]);

  const liveYaml = serializeFormDocument(activeForm());

  const copyToClipboard = () => {
    navigator.clipboard.writeText(liveYaml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`flex flex-col h-full border-t border-brand-border overflow-hidden transition-all duration-300 ${collapsed ? "bg-brand-surface" : "bg-brand-bg"}`}>
      <button
        type="button"
        className={`h-8 flex items-center px-4 bg-brand-surface border-b border-brand-border hover:bg-brand-surface2 transition-colors justify-between shrink-0 ${defaultExpanded ? "cursor-default" : "cursor-pointer"}`}
        onClick={() => !defaultExpanded && setCollapsed(!collapsed)}
        disabled={Boolean(defaultExpanded)}
        aria-expanded={!collapsed}
        aria-controls={contentId}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-brand-text">YAML Preview</span>
          {collapsed && <span className="text-[10px] text-brand-muted px-2 py-0.5 rounded bg-brand-bg border border-brand-border">Collapsed</span>}
        </div>
        {!defaultExpanded && <span className="text-xs text-brand-muted transition-transform duration-300" style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>}
      </button>
      {!collapsed && (
        <div id={contentId} className="flex-1 flex flex-col min-h-0 p-2 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <textarea
            className="ui-textarea flex-1 text-xs font-mono resize-none mb-2 w-full h-full"
            value={liveYaml}
            readOnly
            spellCheck={false}
          />
          <div className="flex justify-end gap-2 shrink-0">
            <button 
              className="ui-btn ui-btn-primary text-xs px-3 py-1"
              onClick={copyToClipboard}
            >
              {copied ? "Copied!" : "Copy YAML"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
