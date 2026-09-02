import React from "react";
import { ParsedAction } from "../../plugin/grammar";
import { LinesEditor } from "./LinesEditor";
import { ConditionalEditor } from "./ConditionalEditor";
import { RandomEditor } from "./RandomEditor";
import { BungeeEditor } from "./BungeeEditor";
import { RawEditor } from "./RawEditor";

export interface ActionEditorProps {
  action: ParsedAction;
  onChange: (next: ParsedAction) => void;
}

export function ActionEditor({ action, onChange }: ActionEditorProps): React.ReactElement {
  switch (action.kind) {
    case "lines":
      return React.createElement(LinesEditor, { action, onChange });
    case "conditional":
      return React.createElement(ConditionalEditor, { action, onChange });
    case "random":
      return React.createElement(RandomEditor, { action, onChange });
    case "bungee":
      return React.createElement(BungeeEditor, { action, onChange });
    case "raw":
      return React.createElement(RawEditor, { action, onChange });
  }
}
