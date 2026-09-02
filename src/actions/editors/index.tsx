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

export function ActionEditor({ action, onChange }: ActionEditorProps) {
  switch (action.kind) {
    case "lines":
      return <LinesEditor action={action} onChange={onChange} />;
    case "conditional":
      return <ConditionalEditor action={action} onChange={onChange} />;
    case "random":
      return <RandomEditor action={action} onChange={onChange} />;
    case "bungee":
      return <BungeeEditor action={action} onChange={onChange} />;
    case "raw":
      return <RawEditor action={action} onChange={onChange} />;
  }
}
