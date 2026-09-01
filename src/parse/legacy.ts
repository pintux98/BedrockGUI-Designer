import * as yaml from "js-yaml";
import { FormDoc } from "../core/project";
import { parseFormDocument } from "./form";

export function parseLegacyInlineConfig(text: string): FormDoc[] {
  const doc = (yaml.load(text) ?? {}) as Record<string, any>;
  const forms = doc.forms ?? {};
  return Object.entries(forms)
    .filter(([, entry]) => isInlineForm(entry))
    .map(([id, entry]) => parseFormDocument(yaml.dump(entry), id));
}

function isInlineForm(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  if (typeof e.file === "string" && e.file.trim()) return false;
  if (e.bedrock && typeof e.bedrock === "object") return true;
  return Boolean(e.type || e.title || e.buttons || e.components);
}
