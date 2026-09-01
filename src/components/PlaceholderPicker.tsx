import React from "react";

export interface PlaceholderItem {
  id: string;
  label: string;
  description: string;
  category: "player" | "position" | "time" | "component" | "command" | "external";
}

export const PLACEHOLDERS: PlaceholderItem[] = [
  { id: "{player}", label: "Player Name", description: "The player's username", category: "player" },
  { id: "{uuid}", label: "Player UUID", description: "The player's unique identifier", category: "player" },
  { id: "{x}", label: "X Coordinate", description: "Player's X position", category: "position" },
  { id: "{y}", label: "Y Coordinate", description: "Player's Y position", category: "position" },
  { id: "{z}", label: "Z Coordinate", description: "Player's Z position", category: "position" },
  { id: "{world}", label: "World Name", description: "Player's current world", category: "position" },
  { id: "{health}", label: "Health", description: "Player's current health", category: "player" },
  { id: "{food}", label: "Food Level", description: "Player's current food level", category: "player" },
  { id: "{hour}", label: "Hour", description: "Current hour (0-23)", category: "time" },
  { id: "{minute}", label: "Minute", description: "Current minute (0-59)", category: "time" },
  { id: "{time}", label: "Time (ticks)", description: "Minecraft time in ticks", category: "time" },
  { id: "{timestamp}", label: "Timestamp", description: "System milliseconds", category: "time" },
  { id: "$1", label: "Arg 1", description: "First command argument", category: "command" },
  { id: "$2", label: "Arg 2", description: "Second command argument", category: "command" },
  { id: "$3", label: "Arg 3", description: "Third command argument", category: "command" },
  { id: "$value", label: "Component Value", description: "Value from a custom form component", category: "component" },
  { id: "$componentKey", label: "Component by Key", description: "Value from component with matching key", category: "component" },
  { id: "%player_name%", label: "PAPI: Player Name", description: "PlaceholderAPI player name", category: "external" },
  { id: "%vault_eco_balance%", label: "PAPI: Balance", description: "PlaceholderAPI economy balance", category: "external" },
];

const CATEGORIES = [
  { id: "player", label: "Player", color: "text-blue-400" },
  { id: "position", label: "Position", color: "text-green-400" },
  { id: "time", label: "Time", color: "text-yellow-400" },
  { id: "command", label: "Command Args", color: "text-purple-400" },
  { id: "component", label: "Components", color: "text-cyan-400" },
  { id: "external", label: "External (PAPI)", color: "text-pink-400" },
] as const;

interface PlaceholderPickerProps {
  onSelect: (placeholder: string) => void;
  onClose: () => void;
}

export function PlaceholderPicker({ onSelect, onClose }: PlaceholderPickerProps) {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
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

  const filtered = PLACEHOLDERS.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || p.id.toLowerCase().includes(q) || p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    const matchesCategory = category === "all" || p.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40" onClick={onClose}>
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
              key={p.id}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-brand-surface-raised rounded transition-colors"
              onClick={() => { onSelect(p.id); onClose(); }}
            >
              <code className="text-xs font-mono bg-brand-surface2 px-1.5 py-0.5 rounded text-brand-accent min-w-[80px] text-center">
                {p.id}
              </code>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-brand-text">{p.label}</div>
                <div className="text-[10px] text-brand-muted truncate">{p.description}</div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-xs text-brand-muted text-center">No placeholders match</div>
          )}
        </div>
      </div>
    </div>
  );
}
