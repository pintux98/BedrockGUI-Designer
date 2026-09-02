import React from "react";
import { classifyImage, ASSET_EXTENSIONS, HEAD_FALLBACK_MATERIALS, type ImageKind } from "../plugin/images";

/** Human labels for every kind the contract can return. */
const KIND_LABELS: Record<ImageKind, string> = {
  material: "Material",
  potion: "Potion",
  texturePath: "Texture path",
  head: "Player head",
  implicitHead: "Bare player name",
  url: "Image URL",
  assetFile: "Asset file",
  placeholder: "Runtime placeholder",
  headFallback: "Renders as a player head",
  mojangTexture: "Player head from a Mojang texture",
  base64Skin: "Player head from an encoded skin",
  unknown: "Unrecognised image source"
};

const EXTENSION_LIST = ASSET_EXTENSIONS.map((e) => `.${e}`).join(", ");
const HEAD_FALLBACK_LIST = HEAD_FALLBACK_MATERIALS.join(", ");

/**
 * The source kinds an author can pick.
 *
 * `unknown` is a diagnosis, never a choice. So are `placeholder` — which is any other
 * source with a `%token%` in it rather than a syntax of its own — and `headFallback`:
 * the six materials that classify that way render a *player head named BARRIER* in game
 * (see plugin/images.ts), so offering them here would be advertising a behaviour nobody
 * wants. They are reported below the field instead, as the warning they are.
 */
const SOURCE_GROUPS: {
  title: string;
  kinds: { kind: Exclude<ImageKind, "unknown" | "placeholder" | "headFallback">; template: string; hint: string }[];
}[] = [
  {
    title: "In-game item",
    kinds: [
      { kind: "material", template: "DIAMOND_SWORD", hint: "Any Bukkit material name" },
      { kind: "potion", template: "POTION:SPEED", hint: "POTION, SPLASH_POTION, LINGERING_POTION or TIPPED_ARROW plus an effect" }
    ]
  },
  {
    title: "Player skin",
    kinds: [
      { kind: "head", template: "head:Notch", hint: "The skin of a named player" },
      { kind: "implicitHead", template: "player.name", hint: "A bare name carrying a dot or dash is read as a head too" },
      {
        kind: "mojangTexture",
        template: "https://textures.minecraft.net/texture/<hash>",
        hint: "A Mojang texture URL — the plugin renders it as a head, not as the raw skin sheet"
      },
      {
        kind: "base64Skin",
        template: "<base64 skin blob>",
        hint: "The encoded value the Minecraft-Heads.com API returns"
      }
    ]
  },
  {
    title: "File or URL",
    kinds: [
      { kind: "texturePath", template: "textures/items/diamond_sword", hint: "A resource-pack texture path" },
      { kind: "url", template: "https://example.com/icon.png", hint: "An http(s) address" },
      { kind: "assetFile", template: "my-icon.png", hint: `A file in the assets folder — ${EXTENSION_LIST}` }
    ]
  }
];

interface ImagePickerProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

export function ImagePicker({
  value,
  onChange,
  placeholder = "DIAMOND_SWORD, head:Notch, textures/…, https://…",
  ariaLabel = "Image"
}: ImagePickerProps) {
  const [draft, setDraft] = React.useState(value);
  const [showSources, setShowSources] = React.useState(false);

  React.useEffect(() => setDraft(value), [value]);

  const trimmed = draft.trim();
  // An empty field means "no image", not an unclassifiable one — stay silent.
  const result = trimmed ? classifyImage(trimmed) : null;

  // Half-typed text is not a mistake. `https://example.com/i.png` is unclassifiable at
  // `https:` and at `https:/`, and both diagnoses live in a `role="alert"` — a screen
  // reader would announce an error mid-word while the author types a perfectly good URL.
  // So the two alerts fire only once the draft matches the committed value, i.e. after
  // blur, Enter, or a pick from the source list.
  const settled = trimmed === value.trim();

  const commit = (next: string) => {
    setDraft(next);
    if (next !== value) onChange(next);
  };

  return (
    <div className="space-y-1">
      {/* items-center, not the default stretch: the 44px tap target below must not drag
          the text input up to 44px tall with it. */}
      <div className="flex items-center gap-1">
        <input
          className="ui-input text-xs flex-1"
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(draft);
          }}
        />
        <button
          type="button"
          className="ui-btn-ghost min-h-11 min-w-11 px-2 py-1 text-xs shrink-0"
          aria-expanded={showSources}
          // A real name: the emoji is the button's whole text content, so `title` is
          // ignored for the accessible name and it would announce as "framed picture".
          aria-label="Image sources"
          title="Image sources"
          onClick={() => setShowSources((s) => !s)}
        >
          <span aria-hidden="true">🖼</span>
        </button>
      </div>

      {settled && result?.kind === "unknown" && (
        <div role="alert" className="text-[10px] text-brand-danger leading-snug">
          {KIND_LABELS.unknown} — the plugin will not resolve this to an icon. Pick one of the sources listed under Image
          sources.
        </div>
      )}

      {result && result.kind !== "unknown" && (
        <div className="text-[10px] text-brand-muted flex items-center gap-1 flex-wrap">
          <span>{KIND_LABELS[result.kind]}</span>
          {result.detail && (
            <code className="font-mono bg-brand-surface2 px-1 rounded text-brand-accent break-all">{result.detail}</code>
          )}
        </div>
      )}

      {settled && result?.kind === "headFallback" && (
        <div role="alert" className="text-[10px] text-brand-warning leading-snug">
          {trimmed} has no item icon, so the game draws a player head named “{trimmed}” instead — the same goes for{" "}
          {HEAD_FALLBACK_LIST}. Leave the image blank for a button with no icon.
        </div>
      )}

      {showSources && (
        <div className="border border-brand-border rounded bg-brand-surface p-2 space-y-2 overflow-hidden">
          {SOURCE_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-[9px] uppercase tracking-wide text-brand-muted mb-1">{group.title}</div>
              <div className="space-y-1">
                {group.kinds.map((src) => (
                  <button
                    key={src.kind}
                    type="button"
                    data-image-kind={src.kind}
                    className="w-full min-w-0 text-left px-2 py-1 rounded hover:bg-brand-surface-raised transition-colors"
                    onClick={() => {
                      commit(src.template);
                      setShowSources(false);
                    }}
                  >
                    {/* flex-wrap + break-all: the Mojang texture row is wider than the
                        properties column, and without these it was clipped on the right. */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-[10px] font-mono text-brand-accent break-all">{src.template}</code>
                      <span className="text-[10px] text-brand-text">{KIND_LABELS[src.kind]}</span>
                    </div>
                    <div className="text-[9px] text-brand-muted leading-snug">{src.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
