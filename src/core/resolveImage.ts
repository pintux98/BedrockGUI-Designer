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
