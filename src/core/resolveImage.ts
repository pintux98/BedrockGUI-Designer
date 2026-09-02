import { classifyImage } from "../plugin/images";
import { AssetsConfig } from "./project";

export interface ResolvedImage {
  /** A URL the preview can put in an `<img src>`, when one exists. */
  src?: string;
  /** Human-readable text for the preview: an alt/tooltip when `src` is set, the fallback caption when it is not. */
  label: string;
}

/**
 * The mc-heads render the plugin actually asks the client for:
 * `https://mc-heads.net/head/<owner>/64`. Every head-shaped value ends up at this
 * one URL shape — an explicit `head:` (IconResolver.resolveHead, IconResolver.java:456-458),
 * a Mojang texture hash and a decoded skin blob (FormMenuUtil.java:1436, 1447), and the
 * bare-word fallback (FormMenuUtil.java:1472-1474) — so the preview builds it the same
 * way and draws the same picture the game draws.
 */
function headUrl(owner: string): string {
  return `https://mc-heads.net/head/${encodeURIComponent(owner.trim())}/64`;
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

    case "head": {
      const owner = (detail ?? "").trim();
      // `head:` with nothing after it is not a head. IconResolver.resolveHead requires a
      // non-empty owner (HEAD_OWNER is `+`, IconResolver.java:441/456-458), resolveIcon
      // then returns null and mapImageSource falls all the way through to
      // `return trimmed;` (FormMenuUtil.java:1476) — the client is handed the literal
      // "head:" and draws nothing. Building a URL here would emit
      // ".../head//64" and preview an icon that never appears in game.
      if (!owner) return { label: `${raw} names no player, so the plugin renders no head` };
      return { src: headUrl(owner), label: `Player head: ${owner}` };
    }

    case "implicitHead":
      return { src: headUrl(raw), label: `Player head: ${raw}` };

    case "mojangTexture":
      return { src: headUrl(detail ?? ""), label: `Player head from texture ${detail ?? ""}` };

    case "base64Skin": {
      const hash = skinHashFromBase64(raw);
      if (hash) return { src: headUrl(hash), label: "Player head from an encoded skin" };
      return { label: "Encoded skin — the plugin accepts this, but it carries no readable skin URL to preview" };
    }

    case "assetFile": {
      // `?? ""` is belt-and-braces, not a live bug: every path into an AssetsConfig
      // coerces host to a string — the Zod schema in core/schemas.ts and
      // parseConfigDocument both do — so nothing reachable today passes undefined.
      // It costs nothing to make a `.trim()` on borrowed data unable to throw.
      const host = (assets.host ?? "").trim();
      if (assets.enabled && host) {
        return { src: `http://${host}:${assets.port}/${raw}`, label: raw };
      }
      return {
        label: `Local asset "${raw}" — enable the asset server and set its host in the plugin's config.yml to preview it`
      };
    }

    case "headFallback":
      // Emphatically NOT "no icon". The AIR_MATERIALS guard that means "draw nothing"
      // lives only in IconResolver.resolveImage (IconResolver.java:373-375), which a
      // button never reaches. FormMenuUtil.mapImageSource has no such guard, so
      // resolveIcon returns null and the bare word falls through to
      // FormMenuUtil.java:1472-1474 — the client is handed
      // https://mc-heads.net/head/BARRIER/64 and renders a player head named BARRIER.
      // The preview shows exactly that, because that is what the player sees.
      return {
        src: headUrl(detail ?? raw),
        label: `${raw} has no item icon — the game draws a player head named "${raw}" instead`
      };

    case "placeholder":
      // FormMenuUtil calls replacePlaceholders before mapImageSource ever sees the value
      // (FormMenuUtil.java:676-677, 697-698), so what this becomes depends on the player
      // looking at the form. The plugin accepts it outright (ValidationUtils.java:93-96)
      // and so must the preview: a neutral caption, never a complaint.
      return { label: `Resolved per player at runtime: ${raw}` };

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
