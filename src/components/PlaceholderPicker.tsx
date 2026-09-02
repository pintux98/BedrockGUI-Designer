import React from "react";
import { BUILTIN_PLACEHOLDERS, componentReference } from "../plugin/placeholders";

/**
 * Every entry offered here is either taken from the plugin contract
 * (`src/plugin/placeholders.ts`) or belongs to a group the contract deliberately
 * does not model — see the comments on each group below. There is no local copy
 * of the built-in table.
 */
type Group = "builtin" | "paper" | "component" | "argument" | "papi";

interface Entry {
  token: string;
  description: string;
  group: Group;
  paperOnly: boolean;
}

const BUILTIN_ENTRIES: Entry[] = BUILTIN_PLACEHOLDERS.map((p) => ({
  token: p.token,
  description: p.description,
  group: p.paperOnly ? "paper" : "builtin",
  paperOnly: p.paperOnly
}));

/**
 * Component references. The contract owns the syntax (`componentReference`); the
 * key is whatever the author named the component in the CUSTOM form, so these are
 * templates to edit, not fixed tokens.
 */
const COMPONENT_ENTRIES: Entry[] = [
  {
    token: componentReference("component_key"),
    description: "In global_actions: the value submitted by the CUSTOM form component with that key",
    group: "component",
    paperOnly: false
  }
];

/**
 * Positional arguments. These are NOT brace placeholders and are not part of
 * BUILTIN_PLACEHOLDERS — the plugin substitutes them positionally: inside a
 * component's own `action` block `$1` is that component's submitted value, and a
 * command-opened form receives its command arguments the same way.
 */
const ARGUMENT_ENTRIES: Entry[] = [1, 2, 3].map((n) => ({
  token: `$${n}`,
  description:
    n === 1
      ? "First positional value — a component's own submitted value inside its action, or the first command argument"
      : `${n === 2 ? "Second" : "Third"} positional value passed to the form`,
  group: "argument",
  paperOnly: false
}));

/**
 * PlaceholderAPI examples. Anything that is not a built-in above has to go
 * through PlaceholderAPI's %…% syntax; these two are illustrations of that
 * syntax, not a table the plugin ships.
 */
const PAPI_ENTRIES: Entry[] = [
  { token: "%player_name%", description: "Example: PlaceholderAPI player name", group: "papi", paperOnly: false },
  { token: "%vault_eco_balance%", description: "Example: PlaceholderAPI Vault balance", group: "papi", paperOnly: false }
];

const ENTRIES: Entry[] = [...BUILTIN_ENTRIES, ...COMPONENT_ENTRIES, ...ARGUMENT_ENTRIES, ...PAPI_ENTRIES];

const CATEGORIES: { id: Group; label: string; color: string }[] = [
  { id: "builtin", label: "Built-in", color: "text-blue-400" },
  { id: "paper", label: "Paper-only", color: "text-amber-400" },
  { id: "component", label: "Components", color: "text-cyan-400" },
  { id: "argument", label: "Arguments", color: "text-purple-400" },
  { id: "papi", label: "PlaceholderAPI", color: "text-pink-400" }
];

const PAPI_NOTE = "Anything that is not built in must come from PlaceholderAPI, written as %placeholder%.";

interface PlaceholderPickerProps {
  onSelect: (placeholder: string) => void;
  onClose?: () => void;
}

export function PlaceholderPicker({ onSelect, onClose }: PlaceholderPickerProps) {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<Group | "all">("all");
  const ref = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => onClose?.(), [onClose]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [close]);

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [close]);

  const filtered = ENTRIES.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || p.token.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    const matchesCategory =
      category === "all" || p.group === category || (category === "builtin" && p.group === "paper");
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40" onClick={close}>
      <div
        ref={ref}
        className="ui-panel w-full max-w-lg p-0 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-brand-border bg-brand-surface">
          <div className="text-xs font-medium text-brand-text mb-2">Insert Placeholder</div>
          <input
            className="ui-input text-xs mb-2"
            placeholder="Search placeholders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="flex flex-wrap gap-1">
            <button
              className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${category === "all" ? "bg-brand-accent text-white border-brand-accent" : "border-brand-border text-brand-muted hover:text-brand-text"}`}
              onClick={() => setCategory("all")}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${category === cat.id ? "bg-brand-accent text-white border-brand-accent" : `border-brand-border ${cat.color} hover:text-brand-text`}`}
                onClick={() => setCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto custom-scrollbar p-1">
          {filtered.map((p) => (
            <button
              key={p.token}
              data-placeholder={p.token}
              data-paper-only={String(p.paperOnly)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-brand-surface-raised rounded transition-colors"
              onClick={() => { onSelect(p.token); close(); }}
            >
              <code className="text-xs font-mono bg-brand-surface2 px-1.5 py-0.5 rounded text-brand-accent min-w-[80px] text-center">
                {p.token}
              </code>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] leading-snug text-brand-muted">{p.description}</div>
              </div>
              {p.paperOnly && (
                <span className="shrink-0 text-[9px] uppercase tracking-wide text-amber-400 border border-amber-400/40 rounded px-1 py-0.5">
                  Paper only
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-xs text-brand-muted text-center">No placeholders match</div>
          )}
        </div>
        <div className="px-3 py-2 border-t border-brand-border bg-brand-surface text-[10px] text-brand-muted">
          {PAPI_NOTE}
        </div>
      </div>
    </div>
  );
}
