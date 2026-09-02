import React, { useState } from "react";
import { Dialog } from "./Dialog";

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
