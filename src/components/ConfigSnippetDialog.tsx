import React, { useState } from "react";
import { Dialog } from "./Dialog";
import { addonRequirements } from "../serialize/configSnippet";
import { useDesignerStore } from "../core/store";

export function ConfigSnippetDialog({
  open,
  onClose,
  snippet
}: {
  open: boolean;
  onClose: () => void;
  snippet: string;
}) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const [copied, setCopied] = useState(false);
  /**
   * Read from the store rather than taken as a prop: the caller hands over the
   * pasteable snippet, and which addon jars the server also needs is separate
   * information that never belongs in `config.yml`.
   */
  const forms = useDesignerStore((s) => s.project.forms);
  const requirements = React.useMemo(() => addonRequirements(forms), [forms]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={descriptionId}
      overlayClassName="bg-black/80 backdrop-blur-sm p-6"
      className="ui-panel w-[560px] max-w-[calc(100vw-2rem)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div id={titleId} className="ui-panel-title mb-2">
          Register your exported forms
        </div>
        <button type="button" className="ui-btn ui-btn-ghost px-2 py-1" onClick={onClose} aria-label="Close dialog">
          ✕
        </button>
      </div>
      <div id={descriptionId} className="text-sm text-brand-muted mb-3">
        These forms were exported as files only. Paste the lines below into your server's{" "}
        <code>plugins/BedrockGUI/config.yml</code>, under its existing <code>forms:</code> key.
        Forms are registered by id, not by filename, so keep the ids below even if you rename the
        files on your server.
      </div>
      <label htmlFor="config-snippet-textarea" className="sr-only">
        Config registry snippet
      </label>
      <textarea
        id="config-snippet-textarea"
        className="ui-textarea w-full text-xs font-mono"
        rows={Math.min(14, snippet.split("\n").length + 1)}
        value={snippet}
        readOnly
        spellCheck={false}
      />
      {requirements.length > 0 && (
        <div className="mt-4 border border-brand-border rounded p-3" data-addon-requirements>
          <div className="text-sm font-medium text-brand-text mb-1">
            {requirements.length === 1 ? "This project also needs an addon" : "This project also needs addons"}
          </div>
          <div className="text-xs text-brand-muted mb-2">
            These action types are registered by an addon, not by BedrockGUI itself. Drop the jar
            into <code>plugins/</code> alongside BedrockGUI, or the action fails at runtime with
            "Unknown action type". Nothing here goes into <code>config.yml</code> — an addon
            registers action handlers, never forms.
          </div>
          <ul className="space-y-1">
            {requirements.map(({ addon, actionIds }) => (
              <li key={addon.id} className="text-xs" data-addon-required={addon.id}>
                <span className="text-brand-text font-medium">{addon.name}</span>
                <span className="text-brand-muted"> — </span>
                <code className="font-mono text-brand-accent">{addon.jar}</code>
                <div className="text-[11px] text-brand-muted font-mono">{actionIds.join(", ")}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="ui-btn ui-btn-secondary" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className="ui-btn ui-btn-primary"
          onClick={copyToClipboard}
          aria-label="Copy config snippet to clipboard"
        >
          {copied ? "Copied!" : "Copy snippet"}
        </button>
      </div>
    </Dialog>
  );
}
