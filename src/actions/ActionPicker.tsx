import React from "react";
import { ACTIONS, actionPlatformNote } from "../plugin";
import { ADDONS, AddonDef, addonActionTakesArgument } from "../plugin/addons";
import { ActionKind, RAW_ACTION_INFO } from "./actionInfo";
import { ACTION_GROUPS, ACTION_TITLES } from "./actionWizard";
import { Icon } from "../components/Icon";

interface ActionPickerProps {
  onSelect: (type: ActionKind) => void;
  onClose: () => void;
}

function infoFor(id: ActionKind) {
  return id === "raw" ? RAW_ACTION_INFO : ACTIONS[id];
}

function matches(haystack: string[], query: string): boolean {
  return haystack.some((h) => h.toLowerCase().includes(query));
}

export function ActionPicker({ onSelect, onClose }: ActionPickerProps) {
  const [search, setSearch] = React.useState("");
  const [openAddons, setOpenAddons] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const q = search.trim().toLowerCase();
  const searching = q.length > 0;
  const keep = (id: ActionKind) => {
    const info = infoFor(id);
    return matches([ACTION_TITLES[id].title, ACTION_TITLES[id].hint, info.label, id, info.description], q);
  };

  const groups = [...ACTION_GROUPS, { title: "Something else", icon: "pencil" as const, ids: ["raw" as ActionKind] }]
    .map((g) => ({ ...g, ids: g.ids.filter(keep) }))
    .filter((g) => g.ids.length);

  const addonSections = ADDONS.map((addon) => ({
    addon,
    ids: addon.actionIds.filter((id) => matches([id, addon.name], q))
  })).filter((section) => section.ids.length > 0);

  const nothingMatched = groups.length === 0 && addonSections.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-3 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Add action" className="ui-menu flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden p-0">
        <div className="border-b border-brand-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">What should happen?</h2>
            <button type="button" className="ui-icon-btn" aria-label="Close" onClick={onClose}>
              <Icon name="x" size={15} />
            </button>
          </div>
          <input className="ui-input" placeholder="Search actions..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="overflow-y-auto p-2">
          {groups.map((group) => (
            <section key={group.title} className="mb-2">
              <h3 className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 text-[12px] font-medium text-brand-muted">
                <Icon name={group.icon} size={13} />
                {group.title}
              </h3>
              <div className="grid gap-1 sm:grid-cols-2">
                {group.ids.map((id) => {
                  const note = id === "raw" ? undefined : actionPlatformNote(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      data-action-id={id}
                      data-paper-only={note ? "true" : "false"}
                      className="rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-left hover:border-brand-accent hover:bg-brand-accent/10"
                      onClick={() => onSelect(id)}
                    >
                      <span className="block text-[13px] font-medium">{ACTION_TITLES[id].title}</span>
                      <span className="block text-[12px] text-brand-muted">{ACTION_TITLES[id].hint}</span>
                      {note && <span className="mt-0.5 block text-[11.5px] text-brand-warning">{note}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {addonSections.length > 0 && (
            <h3 className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 text-[12px] font-medium text-brand-muted">
              <Icon name="plus" size={13} />
              From addons
            </h3>
          )}
          {addonSections.map(({ addon, ids }) => (
            <AddonSection
              key={addon.id}
              addon={addon}
              ids={ids}
              expanded={searching || openAddons[addon.id] === true}
              onToggle={() => setOpenAddons((s) => ({ ...s, [addon.id]: !s[addon.id] }))}
              onSelect={(id) => onSelect(id as ActionKind)}
            />
          ))}

          {nothingMatched && <div className="px-3 py-6 text-center text-[13px] text-brand-muted">No actions match "{search}"</div>}
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
    <div data-addon-section={addon.id}>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-brand-surface"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={listId}
      >
        <Icon name={expanded ? "chevronDown" : "chevronRight"} size={14} className="text-brand-muted" />
        <span className="flex-1 text-[13px] font-medium">{addon.name}</span>
        <span className="text-[12px] text-brand-muted">{ids.length} actions</span>
      </button>
      {expanded && (
        <div id={listId} className="pb-1 pl-6">
          <p className="px-2 pb-1 text-[12px] text-brand-muted">
            Needs <code className="font-mono-ui">{addon.jar}</code> installed. Without it the action fails with "Unknown action type".
          </p>
          {ids.map((id) => {
            const takesValue = addonActionTakesArgument(id);
            return (
              <button
                key={id}
                type="button"
                data-action-id={id}
                data-addon={addon.id}
                data-takes-value={takesValue ? "true" : "false"}
                className="flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left hover:bg-brand-surface"
                onClick={() => onSelect(id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-mono-ui text-[12.5px]">{id}</span>
                  <span className="block text-[12px] text-brand-muted">
                    {takesValue ? "Takes a value after the colon (some handlers treat it as optional)." : "Takes no value."}
                  </span>
                </span>
                <span className="mt-0.5 whitespace-nowrap text-[11.5px] text-brand-muted">needs {addon.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
