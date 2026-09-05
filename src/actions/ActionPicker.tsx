import React from "react";
import { ACTIONS, ACTION_IDS, actionPlatformNote } from "../plugin";
import { ADDONS, AddonDef, addonActionTakesArgument } from "../plugin/addons";
import { ActionKind, RAW_ACTION_INFO } from "./actionInfo";

interface ActionPickerProps {
  onSelect: (type: ActionKind) => void;
  onClose: () => void;
}

function infoFor(id: ActionKind) {
  return id === "raw" ? RAW_ACTION_INFO : ACTIONS[id];
}

/**
 * Every action, always.
 *
 * This list used to be `actionsForPlatform(project.platformTarget)`, which quietly
 * dropped `sound` and `economy` from the picker whenever the project carried a
 * `velocity` or `bungee` target — two of the fourteen simply were not there, with
 * nothing on screen to say why. A form file is the same file on every platform, so
 * the capability difference is a warning to read (see `actionPlatformNote`), not a
 * reason to hide an action.
 */
const CORE_ORDER: ActionKind[] = [...ACTION_IDS, "raw"];

function matches(haystack: string[], query: string): boolean {
  return haystack.some((h) => h.toLowerCase().includes(query));
}

export function ActionPicker({ onSelect, onClose }: ActionPickerProps) {
  const [search, setSearch] = React.useState("");
  const [openAddons, setOpenAddons] = React.useState<Record<string, boolean>>({});
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const q = search.trim().toLowerCase();
  const searching = q.length > 0;

  const filtered = CORE_ORDER.filter((id) => {
    const info = infoFor(id);
    return matches([info.label, id, info.description], q);
  });

  /** One entry per addon, carrying only the ids the current search leaves. */
  const addonSections = ADDONS.map((addon) => ({
    addon,
    ids: addon.actionIds.filter((id) => matches([id, addon.name], q))
  })).filter((section) => section.ids.length > 0);

  const nothingMatched = filtered.length === 0 && addonSections.length === 0;

  /**
   * `createDefaultAction` turns an addon id into a raw block holding the colon form
   * (see actionInfo.ts), so an addon action rides the same `onSelect` the core rows
   * use. The cast is the one place the id crosses into `ActionKind`.
   */
  const selectAddonAction = (id: string) => onSelect(id as ActionKind);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40" onClick={onClose}>
      <div
        ref={ref}
        className="ui-panel w-full max-w-md p-0 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-brand-border bg-brand-surface">
          <div className="text-xs font-medium text-brand-text mb-2">Add Action</div>
          <input
            className="ui-input text-xs"
            placeholder="Search actions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto custom-scrollbar p-1">
          {filtered.map((id) => {
            const info = infoFor(id);
            const note = id === "raw" ? undefined : actionPlatformNote(id);
            return (
              <button
                key={id}
                data-action-id={id}
                data-paper-only={note ? "true" : "false"}
                className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-brand-surface-raised rounded transition-colors"
                onClick={() => onSelect(id)}
              >
                <span className="text-lg mt-0.5">{info.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-brand-text">{info.label}</div>
                  <div className="text-[10px] text-brand-muted">{info.description}</div>
                  {note && <div className="text-[10px] text-brand-warning">{note}</div>}
                  <pre className="text-[9px] text-brand-accent/70 font-mono mt-1 whitespace-pre-wrap">{info.formatExample}</pre>
                </div>
                <span className="text-[10px] text-brand-muted font-mono mt-0.5">{id}</span>
              </button>
            );
          })}

          {addonSections.map(({ addon, ids }) => (
            <AddonSection
              key={addon.id}
              addon={addon}
              ids={ids}
              /* A search is a request to see what matched, so it opens the sections itself. */
              expanded={searching || openAddons[addon.id] === true}
              onToggle={() => setOpenAddons((s) => ({ ...s, [addon.id]: !s[addon.id] }))}
              onSelect={selectAddonAction}
            />
          ))}

          {nothingMatched && (
            <div className="px-3 py-4 text-xs text-brand-muted text-center">No actions match "{search}"</div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddonSection({
  addon,
  ids,
  expanded,
  onToggle,
  onSelect
}: {
  addon: AddonDef;
  ids: readonly string[];
  expanded: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  const listId = React.useId();
  return (
    <div className="mt-1 border-t border-brand-border pt-1" data-addon-section={addon.id}>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-brand-surface-raised rounded transition-colors"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={listId}
      >
        <span className="text-[10px] text-brand-muted w-3">{expanded ? "▼" : "▶"}</span>
        <span className="text-xs font-medium text-brand-text flex-1">{addon.name}</span>
        <span className="text-[10px] text-brand-muted">{ids.length} actions</span>
      </button>
      {expanded && (
        <div id={listId}>
          <div className="px-3 pb-1 text-[10px] text-brand-muted">
            Needs <code className="font-mono">{addon.jar}</code> installed. Without it the action
            fails with "Unknown action type".
          </div>
          {ids.map((id) => {
            const takesValue = addonActionTakesArgument(id);
            return (
              <button
                key={id}
                type="button"
                data-action-id={id}
                data-addon={addon.id}
                data-takes-value={takesValue ? "true" : "false"}
                className="w-full flex items-start gap-3 px-3 py-1.5 text-left hover:bg-brand-surface-raised rounded transition-colors"
                onClick={() => onSelect(id)}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-mono text-brand-text">{id}</span>
                  <span className="block text-[10px] text-brand-muted">
                    {takesValue
                      ? "Takes a value after the colon (some handlers treat it as optional)."
                      : "Takes no value."}
                  </span>
                </span>
                <span className="text-[10px] text-brand-muted mt-0.5 whitespace-nowrap">needs {addon.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
