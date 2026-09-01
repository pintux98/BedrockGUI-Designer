import * as yaml from "js-yaml";
import { AssetsConfig } from "../core/project";

export interface ParsedConfig {
  configVersion: number;
  assets: AssetsConfig;
  registry: Array<{ id: string; file: string }>;
}

export function parseConfigDocument(text: string): ParsedConfig {
  const doc = (yaml.load(text) ?? {}) as Record<string, any>;
  const assets = doc.assets ?? {};
  const forms = doc.forms ?? {};
  return {
    configVersion: Number(doc["config-version"] ?? 1),
    assets: {
      enabled: Boolean(assets.enabled),
      port: Number(assets.port ?? 0),
      host: String(assets.host ?? "")
    },
    registry: Object.entries(forms)
      .filter(([, entry]) => entry && typeof entry === "object" && typeof (entry as any).file === "string")
      .map(([id, entry]) => ({ id, file: (entry as any).file }))
  };
}
