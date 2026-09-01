import yaml from "js-yaml";
import { FormDoc } from "../core/project";
import { parseFormDocument } from "./form";

export function parseLegacyInlineConfig(text: string): FormDoc[] {
  const doc = (yaml.load(text) ?? {}) as Record<string, any>;
  const forms = doc.forms ?? {};
  return Object.entries(forms)
    .filter(([, entry]) => entry && typeof entry === "object" && (entry as any).bedrock)
    .map(([id, entry]) => parseFormDocument(yaml.dump(entry), id));
}
