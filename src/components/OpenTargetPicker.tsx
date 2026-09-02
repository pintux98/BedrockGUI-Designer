import React from "react";
import { ADDONS, ADDON_FORM_IDS, findAddonForFormId, type AddonDef } from "../plugin/addons";
import { useDesignerStore } from "../store";

/**
 * Picks the menu an `open` action targets.
 *
 * The value is always free text. A target may legitimately name a form the author
 * has not created yet, or one supplied by an addon that is not installed on the
 * machine the config is being written on, so nothing typed here is ever rejected
 * or normalised — the suggestions are a convenience, not a whitelist.
 *
 * The suggestion popup is always displayed rather than opening on focus: the list
 * is the discoverable half of the control, and there is nothing to reveal.
 */

interface SuggestionGroup {
  key: string;
  /** Accessible name of the group — the full addon name, or "This project". */
  name: string;
  /** Shorter visible heading; the accessible name stays the authoritative one. */
  heading: string;
  note?: string;
  ids: string[];
}

export interface OpenTargetPickerProps {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}

/** "Bedwars Addon" reads as "Bedwars" once it sits under an "Addons" heading. */
function shortName(addon: AddonDef): string {
  return addon.name.replace(/\s+Addon$/i, "");
}

export function OpenTargetPicker({ value, onChange, label = "Menu to open" }: OpenTargetPickerProps) {
  const uid = React.useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const forms = useDesignerStore((s) => s.project.forms);

  const trimmed = value.trim();
  const query = trimmed.toLowerCase();
  const matches = (id: string) => !query || id.toLowerCase().includes(query);

  const groups: SuggestionGroup[] = [];
  const projectIds = forms.map((f) => f.id).filter(matches);
  if (projectIds.length > 0) {
    groups.push({ key: "project", name: "This project", heading: "This project", ids: projectIds });
  }
  for (const addon of ADDONS) {
    const ids = addon.formIds.filter(matches);
    if (ids.length > 0) {
      groups.push({
        key: addon.id,
        name: addon.name,
        heading: shortName(addon),
        note: `needs ${addon.minPluginVersion}+`,
        ids
      });
    }
  }

  const suppliedBy = trimmed ? findAddonForFormId(trimmed) : undefined;
  const known = !trimmed || forms.some((f) => f.id === trimmed) || suppliedBy !== undefined;
  /**
   * `findAddonForFormId` also resolves the ids an addon only registers with an
   * argument appended, which `ADDON_FORM_IDS` (the plain form ids) does not hold —
   * so a hit here that is not a plain form id is a target that expects an argument.
   */
  const needsArgument = suppliedBy !== undefined && !ADDON_FORM_IDS.has(trimmed);

  const flatIds = groups.flatMap((g) => g.ids);
  const [active, setActive] = React.useState(-1);
  const activeId = active >= 0 && active < flatIds.length ? flatIds[active] : undefined;

  const commit = (next: string) => {
    setActive(-1);
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatIds.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % flatIds.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? flatIds.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeId) {
      e.preventDefault();
      commit(activeId);
    } else if (e.key === "Escape") {
      setActive(-1);
    }
  };

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="text-[10px] text-brand-muted block mb-0.5">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        // ARIA 1.2 combobox: the text input owns the role, the list below is its popup.
        role="combobox"
        aria-expanded={groups.length > 0}
        aria-controls={groups.length > 0 ? listId : undefined}
        aria-activedescendant={activeId ? `${uid}-opt-${activeId}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        className="ui-input text-xs w-full"
        placeholder="e.g. shop_menu"
        value={value}
        onChange={(e) => commit(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {groups.length > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label="Known menu targets"
          className="max-h-40 overflow-y-auto custom-scrollbar border border-brand-border rounded bg-brand-surface2"
        >
          {groups.map((group) => (
            <div key={group.key} role="group" aria-label={group.name}>
              <div className="flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase tracking-wide text-brand-muted bg-brand-surface/60 sticky top-0">
                <span>{group.heading}</span>
                {group.note && <span className="text-brand-accent/70 normal-case">{group.note}</span>}
              </div>
              {group.ids.map((id) => (
                <div
                  key={id}
                  id={`${uid}-opt-${id}`}
                  role="option"
                  aria-selected={id === trimmed}
                  className={`px-2 py-0.5 text-[11px] font-mono cursor-pointer hover:bg-brand-surface-raised ${
                    id === activeId ? "bg-brand-surface-raised" : ""
                  } ${id === trimmed ? "text-brand-accent" : "text-brand-text"}`}
                  onClick={() => commit(id)}
                >
                  {id}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {suppliedBy && (
        <p className="text-[10px] text-brand-muted">
          Needs <strong className="text-brand-text font-medium">{suppliedBy.name}</strong> ({suppliedBy.jar}, plugin{" "}
          {suppliedBy.minPluginVersion}+)
          {needsArgument && " — that target expects an argument after a colon."}
        </p>
      )}

      {!known && (
        <p className="text-[10px] text-brand-muted">
          <span className="text-brand-accent">{trimmed}</span> is not a known target — it must be a form of your own,
          registered under that id.
        </p>
      )}
    </div>
  );
}
