import React from "react";
import { classifyImage, ASSET_EXTENSIONS, NO_ICON_MATERIALS, type ImageKind } from "../plugin/images";

/** Human labels for every kind the contract can return. */
const KIND_LABELS: Record<ImageKind, string> = {
  material: "Material",
  potion: "Potion",
  texturePath: "Texture path",
  head: "Player head",
  implicitHead: "Bare player name",
  url: "Image URL",
  assetFile: "Asset file",
  none: "No icon",
  unknown: "Unrecognised image source"
};

const EXTENSION_LIST = ASSET_EXTENSIONS.map((e) => `.${e}`).join(", ");
const NO_ICON_LIST = NO_ICON_MATERIALS.join(", ");

/** The source kinds an author can pick. `unknown` is a diagnosis, never a choice. */
const SOURCE_GROUPS: { title: string; kinds: { kind: Exclude<ImageKind, "unknown">; template: string; hint: string }[] }[] = [
  {
    title: "In-game item",
    kinds: [
      { kind: "material", template: "DIAMOND_SWORD", hint: "Any Bukkit material name" },
      { kind: "potion", template: "POTION:SPEED", hint: "POTION, SPLASH_POTION, LINGERING_POTION or TIPPED_ARROW plus an effect" },
      { kind: "none", template: "BARRIER", hint: `Draws no icon at all: ${NO_ICON_LIST}` }
    ]
  },
  {
    title: "Player skin",
    kinds: [
      { kind: "head", template: "head:Notch", hint: "The skin of a named player" },
      { kind: "implicitHead", template: "player.name", hint: "A bare name carrying a dot or dash is read as a head too" }
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

  const commit = (next: string) => {
    setDraft(next);
    if (next !== value) onChange(next);
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
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
          className="ui-btn-ghost px-2 py-1 text-xs shrink-0"
          aria-expanded={showSources}
          title="Image sources"
          onClick={() => setShowSources((s) => !s)}
        >
          🖼
        </button>
      </div>

      {result && result.kind === "unknown" && (
        <div role="alert" className="text-[10px] text-brand-danger leading-snug">
          {KIND_LABELS.unknown} — the plugin will not resolve this to an icon. Pick one of the sources listed under 🖼.
        </div>
      )}

      {result && result.kind !== "unknown" && (
        <div className="text-[10px] text-brand-muted flex items-center gap-1 flex-wrap">
          <span>{KIND_LABELS[result.kind]}</span>
          {result.detail && (
            <code className="font-mono bg-brand-surface2 px-1 rounded text-brand-accent">{result.detail}</code>
          )}
          {result.kind === "none" && <span>— this material draws nothing</span>}
        </div>
      )}

      {showSources && (
        <div className="border border-brand-border rounded bg-brand-surface p-2 space-y-2">
          {SOURCE_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-[9px] uppercase tracking-wide text-brand-muted mb-1">{group.title}</div>
              <div className="space-y-1">
                {group.kinds.map((src) => (
                  <button
                    key={src.kind}
                    type="button"
                    data-image-kind={src.kind}
                    className="w-full text-left px-2 py-1 rounded hover:bg-brand-surface-raised transition-colors"
                    onClick={() => {
                      commit(src.template);
                      setShowSources(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] font-mono text-brand-accent">{src.template}</code>
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
