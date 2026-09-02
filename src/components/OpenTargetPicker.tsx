import React from "react";
import { addonActionTakesArgument, findAddonForActionId } from "../plugin/addons";
import { useDesignerStore } from "../store";

/**
 * Picks the menu an `open` action targets.
 *
 * The value is always free text. A target may legitimately name a form the author
 * has not created yet, or one that lives in a config this project does not hold, so
 * nothing typed here is ever rejected, trimmed or case-folded — the suggestions are a
 * convenience, not a whitelist, and what is committed is what was typed.
 *
 * **Only this project's forms are suggested.** Addon ids used to be offered here and
 * that was wrong: an addon registers action *handlers*, never menus, so `open` can
 * never resolve one. When the author has typed one anyway they get a correction
 * naming the addon and the shape the id actually works in.
 *
 * Typing is buffered the way `BufferedInput` buffers: filtering and highlighting run
 * off a local draft, and the store only hears about it on a settling event — blur,
 * Enter, or picking a suggestion. Committing per keystroke cost ~35ms a key and
 * spammed the undo stack with one entry per character.
 *
 * The suggestion popup is always displayed rather than opening on focus: the list
 * is the discoverable half of the control, and there is nothing to reveal.
 */

export interface OpenTargetPickerProps {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}

export function OpenTargetPicker({ value, onChange, label = "Menu to open" }: OpenTargetPickerProps) {
  const uid = React.useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const forms = useDesignerStore((s) => s.project.forms);

  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  const trimmed = draft.trim();
  const query = trimmed.toLowerCase();
  const ids = forms.map((f) => f.id).filter((id) => !query || id.toLowerCase().includes(query));

  const [active, setActive] = React.useState(-1);
  const activeId = active >= 0 && active < ids.length ? ids[active] : undefined;

  const addon = trimmed ? findAddonForActionId(trimmed) : undefined;
  const takesArgument = addon !== undefined && addonActionTakesArgument(trimmed);
  const baseId = trimmed.includes(":") ? trimmed.slice(0, trimmed.indexOf(":")) : trimmed;
  const unknown = trimmed !== "" && addon === undefined && !forms.some((f) => f.id === trimmed);

  /** Send the draft on, verbatim — no trimming, no case folding, no rewriting. */
  const commit = (next: string) => {
    setActive(-1);
    setDraft(next);
    if (next !== value) onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setActive(-1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commit(activeId ?? draft);
      return;
    }
    if (ids.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % ids.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? ids.length - 1 : i - 1));
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
        aria-expanded={ids.length > 0}
        aria-controls={ids.length > 0 ? listId : undefined}
        aria-activedescendant={activeId ? `${uid}-opt-${activeId}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        className="ui-input text-xs w-full"
        placeholder="e.g. shop_menu"
        value={draft}
        onChange={(e) => {
          setActive(-1);
          setDraft(e.target.value);
        }}
        onBlur={() => commit(draft)}
        onKeyDown={handleKeyDown}
      />

      {ids.length > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label="Known menu targets"
          className="max-h-40 overflow-y-auto custom-scrollbar border border-brand-border rounded bg-brand-surface2"
        >
          <div role="group" aria-label="This project">
            <div className="flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase tracking-wide text-brand-muted bg-brand-surface/60 sticky top-0">
              <span>This project</span>
            </div>
            {ids.map((id) => (
              <div
                key={id}
                id={`${uid}-opt-${id}`}
                role="option"
                aria-selected={id === trimmed}
                className={`px-2 py-0.5 text-[11px] font-mono cursor-pointer hover:bg-brand-surface-raised ${
                  id === activeId ? "bg-brand-surface-raised" : ""
                } ${id === trimmed ? "text-brand-accent" : "text-brand-text"}`}
                // Keep the caret in the field so mousedown does not blur-commit the
                // half-typed draft a moment before the click commits the suggestion.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(id)}
              >
                {id}
              </div>
            ))}
          </div>
        </div>
      )}

      {addon && (
        <p className="text-[10px] text-brand-muted">
          <span className="text-brand-accent font-mono">{baseId}</span> is an action type registered by the{" "}
          <strong className="text-brand-text font-medium">{addon.name}</strong> ({addon.jar}) — not a menu. An{" "}
          <code>open</code> target only ever resolves to a form declared under <code>forms:</code>, so this fails at
          runtime even with the addon installed. Run it as an action of its own instead:{" "}
          <span className="font-mono text-brand-text">
            {takesArgument ? `${baseId}:<value>` : `${baseId} { }`}
          </span>
          {takesArgument && " — that action can take a value, though it does not have to."}
        </p>
      )}

      {unknown && (
        <p className="text-[10px] text-brand-muted">
          <span className="text-brand-accent">{trimmed}</span> is not a known target — it must be a form of your own,
          registered under that id.
        </p>
      )}
    </div>
  );
}
