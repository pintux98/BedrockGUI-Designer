import { classifyImage } from "../plugin/images";
import { AssetsConfig } from "./project";

export interface ResolvedImage {
  /** A URL the preview can put in an `<img src>`, when one exists. */
  src?: string;
  /** Human-readable text for the preview: an alt/tooltip when `src` is set, the fallback caption when it is not. */
  label: string;
}

const MC_HEADS = "https://mc-heads.net/avatar";

function headUrl(name: string): string {
  return `${MC_HEADS}/${encodeURIComponent(name.trim())}/64`;
}

/** The plugin renders a Mojang texture hash as a head, not as the raw skin sheet. */
function hashHeadUrl(hash: string): string {
  return `https://mc-heads.net/head/${encodeURIComponent(hash.trim())}/64`;
}

const SKIN_URL_IN_JSON = /"url"\s*:\s*"https?:\/\/textures\.minecraft\.net\/texture\/([^"]+)"/;

/**
 * Decode a Minecraft-Heads.com base64 skin blob to its texture hash.
 *
 * Mirrors FormMenuUtil.mapImageSource, which decodes the blob, pulls
 * textures.SKIN.url out of the JSON, and renders the hash as a head. Like the
 * plugin, a blob that will not decode or carries no skin url is not an error —
 * it simply does not resolve, and the caller falls back to a label.
 */
function skinHashFromBase64(blob: string): string | undefined {
  try {
    const json = atob(blob);
    return json.match(SKIN_URL_IN_JSON)?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Turn a button `image:` value into something the designer can actually draw.
 *
 * Materials, potions and texture paths deliberately resolve to no `src`: the designer
 * ships no Bedrock texture atlas, so the label is what the preview shows instead.
 */
export function resolveImageForPreview(value: string, assets: AssetsConfig): ResolvedImage {
  const raw = value.trim();
  if (!raw) return { label: "No image" };

  const { kind, detail } = classifyImage(raw);

  switch (kind) {
    case "url":
      return { src: raw, label: raw };

    case "head":
      return { src: headUrl(detail ?? ""), label: `Player head: ${detail ?? ""}` };

    case "implicitHead":
      return { src: headUrl(raw), label: `Player head: ${raw}` };

    case "mojangTexture":
      return { src: hashHeadUrl(detail ?? ""), label: `Player head from texture ${detail ?? ""}` };

    case "base64Skin": {
      const hash = skinHashFromBase64(raw);
      if (hash) return { src: hashHeadUrl(hash), label: "Player head from an encoded skin" };
      return { label: "Encoded skin — the plugin accepts this, but it carries no readable skin URL to preview" };
    }

    case "assetFile": {
      const host = assets.host.trim();
      if (assets.enabled && host) {
        return { src: `http://${host}:${assets.port}/${raw}`, label: raw };
      }
      return {
        label: `Local asset "${raw}" — enable the asset server and set its host in the plugin's config.yml to preview it`
      };
    }

    case "none":
      return { label: `${raw} draws no icon in game` };

    case "potion":
      return { label: `Potion: ${detail ?? raw}` };

    case "texturePath":
      return { label: `Texture path: ${raw}` };

    case "material":
      return { label: `Material: ${raw}` };

    default:
      return { label: `Unrecognised image value: ${raw}` };
  }
}
