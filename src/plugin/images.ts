import { MATERIALS } from "../data/materials";

export type ImageKind =
  | "material" | "potion" | "texturePath" | "head" | "url" | "assetFile" | "none" | "unknown";

export const NO_ICON_MATERIALS = [
  "AIR", "CAVE_AIR", "VOID_AIR", "STRUCTURE_VOID", "BARRIER", "LIGHT"
] as const;

export const ASSET_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"] as const;

const POTION_PREFIXES = ["POTION", "SPLASH_POTION", "LINGERING_POTION", "TIPPED_ARROW"];
const MATERIAL_SET = new Set(MATERIALS.map((m) => m.id.toUpperCase()));
const NO_ICON_SET = new Set<string>(NO_ICON_MATERIALS);

export function classifyImage(value: string): { kind: ImageKind; detail?: string } {
  const raw = value.trim();
  if (!raw) return { kind: "unknown" };

  if (/^https?:\/\//i.test(raw)) return { kind: "url" };
  if (raw.startsWith("textures/")) return { kind: "texturePath" };
  if (raw.toLowerCase().startsWith("head:")) return { kind: "head", detail: raw.slice(5) };

  const upper = raw.toUpperCase();
  if (NO_ICON_SET.has(upper)) return { kind: "none" };

  const colon = upper.indexOf(":");
  if (colon > 0 && POTION_PREFIXES.includes(upper.slice(0, colon))) {
    return { kind: "potion", detail: normalisePotionEffect(upper.slice(colon + 1)) };
  }

  if (MATERIAL_SET.has(upper) || upper.endsWith("_SPAWN_EGG") || upper.startsWith("MUSIC_DISC_")) {
    return { kind: "material" };
  }

  const ext = raw.split(".").pop()?.toLowerCase();
  if (ext && (ASSET_EXTENSIONS as readonly string[]).includes(ext)) return { kind: "assetFile" };

  return { kind: "unknown" };
}

function normalisePotionEffect(effect: string): string {
  return effect.replace(/^LONG_/, "").replace(/^STRONG_/, "");
}
