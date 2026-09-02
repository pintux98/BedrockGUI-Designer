export type ImageKind =
  | "material" | "potion" | "texturePath" | "head" | "implicitHead"
  | "url" | "assetFile" | "placeholder" | "headFallback" | "unknown"
  | "mojangTexture" | "base64Skin";

/**
 * Materials `IconResolver` refuses to map to a texture (its `AIR_MATERIALS` set,
 * IconResolver.java:187-189).
 *
 * They do **not** mean "no icon" on a Bedrock button. The only "no icon" guard lives
 * in `IconResolver.resolveImage` (IconResolver.java:373-375), whose sole caller is
 * `BedrockGUIApi.java:120` — buttons never go through it. A button's image goes
 * through `FormMenuUtil.mapImageSource` (FormMenuUtil.java:1428), which has no such
 * guard: `resolveIcon("BARRIER")` returns null (IconResolver.java:401-416 →
 * `resolve`, IconResolver.java:197-201, which nulls out on AIR_MATERIALS), the value
 * is not a local image file, and execution reaches
 *
 *   // FormMenuUtil.java:1472-1474
 *   if (trimmed.matches("^[A-Za-z0-9_.\\-]+$")) {
 *       return "https://mc-heads.net/head/" + trimmed + "/64";
 *   }
 *
 * so the game renders a player head named BARRIER. That is why these classify as
 * `headFallback` and not as a "none" kind: the designer must show what the client
 * shows. These six are exactly the bare material-shaped words that fall through,
 * because `IconResolver.resolve` is otherwise total.
 */
export const HEAD_FALLBACK_MATERIALS = [
  "AIR", "CAVE_AIR", "VOID_AIR", "STRUCTURE_VOID", "BARRIER", "LIGHT"
] as const;

export const ASSET_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"] as const;

const POTION_PREFIXES = ["POTION", "SPLASH_POTION", "LINGERING_POTION", "TIPPED_ARROW"];

/**
 * A raw Mojang skin texture URL. The plugin rewrites these to a mc-heads head
 * render rather than serving the full skin sheet — see FormMenuUtil.mapImageSource.
 */
const MOJANG_TEXTURE = /^https?:\/\/textures\.minecraft\.net\/texture\/(.+)$/i;

/**
 * A base64 skin blob as the Minecraft-Heads.com API returns it: a JSON document
 * carrying textures.SKIN.url, base64-encoded. The plugin accepts it on shape
 * alone — `^[A-Za-z0-9+/=]+$` and longer than 40 — and only then tries to decode
 * it (ValidationUtils.isValidImageSource vs FormMenuUtil.mapImageSource). This
 * classifier mirrors that split: shape here, decoding in the resolver.
 *
 * Checked BEFORE the material branch for the same reason the plugin checks it
 * early: an all-alphanumeric blob would otherwise read as a material name.
 */
const BASE64_SKIN = /^[A-Za-z0-9+/=]+$/;
const BASE64_MIN_LENGTH = 40;

/**
 * A pack-relative path under any root — `mypack/icons/gold`, not just `textures/`.
 *
 *   // ValidationUtils.java:103-106
 *   // Pack-relative paths under any other root, e.g. a custom resource pack folder
 *   if (trimmed.matches("^[A-Za-z0-9_.\\-]+(/[A-Za-z0-9_.\\-]+)+$")) { return true; }
 *
 * `mapImageSource` finds no icon, no local image file and no bare-word match, so it
 * falls to `return trimmed;` (FormMenuUtil.java:1476) and the path reaches the client
 * intact as `FormImage.Type.PATH`. Verbatim copy of the Java regex.
 */
const PACK_RELATIVE_PATH = /^[A-Za-z0-9_.\-]+(\/[A-Za-z0-9_.\-]+)+$/;

const HEAD_FALLBACK_SET = new Set<string>(HEAD_FALLBACK_MATERIALS);

export function classifyImage(value: string): { kind: ImageKind; detail?: string } {
  const raw = value.trim();
  if (!raw) return { kind: "unknown" };

  const mojang = raw.match(MOJANG_TEXTURE);
  if (mojang) return { kind: "mojangTexture", detail: mojang[1] };
  if (/^https?:\/\//i.test(raw)) return { kind: "url" };
  if (raw.startsWith("textures/")) return { kind: "texturePath" };
  if (raw.toLowerCase().startsWith("head:")) return { kind: "head", detail: raw.slice(5) };

  // Anything still holding a % is a placeholder the designer cannot resolve.
  //
  //   // ValidationUtils.java:93-96
  //   // Placeholders are resolved at runtime
  //   if (trimmed.contains("%")) { return true; }
  //
  // FormMenuUtil runs replacePlaceholders BEFORE mapImageSource
  // (FormMenuUtil.java:676-677 and 697-698), so the resolver never sees a raw token
  // and the designer cannot know what it becomes. It gets no src and a neutral
  // label — never a warning.
  //
  // Ordering: the plugin tests % first, but head:, textures/ and the URL forms are
  // tested above it here so `head:%player%` stays a head — that is the documented
  // spelling (IconResolver.java:445-447) and it resolves to a head once substituted.
  if (raw.includes("%")) return { kind: "placeholder" };

  if (raw.length > BASE64_MIN_LENGTH && BASE64_SKIN.test(raw)) return { kind: "base64Skin" };

  const upper = raw.toUpperCase();
  if (HEAD_FALLBACK_SET.has(upper)) return { kind: "headFallback", detail: raw };

  const colon = upper.indexOf(":");
  if (colon > 0 && POTION_PREFIXES.includes(upper.slice(0, colon))) {
    return { kind: "potion", detail: normalisePotionEffect(upper.slice(colon + 1)) };
  }

  if (upper.endsWith("_SPAWN_EGG") || upper.startsWith("MUSIC_DISC_")) {
    return { kind: "material" };
  }

  if (/^[A-Za-z0-9_]+$/.test(raw)) return { kind: "material" };

  const ext = raw.split(".").pop()?.toLowerCase();
  // Checked before PACK_RELATIVE_PATH: `assets/logo.png` matches both, and the
  // plugin resolves it as a local file — IconResolver.isLocalImageFile accepts a
  // slashed path with an image extension (IconResolver.java:433-435), and
  // mapImageSource hands it to the asset server (FormMenuUtil.java:1468-1470)
  // before ever reaching the pass-through at 1476.
  if (ext && (ASSET_EXTENSIONS as readonly string[]).includes(ext)) return { kind: "assetFile" };

  if (PACK_RELATIVE_PATH.test(raw)) return { kind: "texturePath" };

  if (/^[A-Za-z0-9_.-]+$/.test(raw) && (raw.includes(".") || raw.includes("-"))) {
    return { kind: "implicitHead" };
  }

  // Deliberate divergence from the plugin: a namespaced material such as
  // `minecraft:diamond_sword` passes ValidationUtils.isValidImageSource
  // (ValidationUtils.java:108-111, the "prefixed forms" regex) but is still broken
  // at render time. mapImageSource gets null from resolveIcon (MATERIAL_NAME rejects
  // the colon, IconResolver.java:414), is not a local image file, does not match the
  // bare-word head regex, and so falls to `return trimmed;` (FormMenuUtil.java:1476)
  // — the client is handed `minecraft:diamond_sword` as a PATH and draws nothing.
  // The plugin is silent about it; flagging it as unknown here is the more useful
  // answer, so this is kept as-is on purpose.
  return { kind: "unknown" };
}

function normalisePotionEffect(effect: string): string {
  const colon = effect.indexOf(":");
  const type = colon >= 0 ? effect.slice(colon + 1) : effect;
  return type.replace(/^LONG_/, "").replace(/^STRONG_/, "");
}
