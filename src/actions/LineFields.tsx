import React from "react";
import type { ActionId } from "../plugin/actions";
import {
  ECONOMY_OPS,
  INVENTORY_OPS,
  TITLE_DEFAULTS,
  formatEconomyLine,
  formatInventoryLine,
  formatSoundLine,
  formatTitleLine,
  isDynamic,
  parseEconomyLine,
  parseInventoryLine,
  parseSoundLine,
  parseTitleLine,
  validateActionLine
} from "../plugin/lines";
import { LIMITS } from "../plugin/limits";
import { SuggestInput } from "../components/SuggestInput";
import { useLineContext } from "../data/useMinecraftData";
import { Icon } from "../components/Icon";

const Live = React.createContext(false);

export const STRUCTURED_LINES: ActionId[] = ["sound", "inventory", "economy", "title", "delay"];

export const DEFAULT_LINES: Partial<Record<ActionId, string>> = {
  sound: "entity.experience_orb.pickup",
  inventory: "give:diamond",
  economy: "add:100",
  title: "",
  delay: "1000"
};

const ECONOMY_LABELS: Record<string, string> = {
  add: "Give money",
  remove: "Take money",
  set: "Set balance to",
  check: "Require at least (stops the rest if not)",
  pay: "Pay another player"
};

const INVENTORY_LABELS: Record<string, string> = {
  give: "Give items",
  remove: "Take items",
  check: "Require items (stops the rest if missing)",
  clear: "Clear the inventory"
};

function Text({
  label,
  value,
  onCommit,
  className = "",
  ...rest
}: { label: string; value: string; onCommit: (v: string) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = React.useState(value);
  const live = React.useContext(Live);
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (document.activeElement !== ref.current) setDraft(value);
  }, [value]);
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="ui-label">{label}</span>
      <input
        ref={ref}
        {...rest}
        className="ui-input"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (live) onCommit(e.target.value);
        }}
        onBlur={() => draft !== value && onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (draft !== value) onCommit(draft);
        }}
      />
    </label>
  );
}

function Suggest({ label, source, value, onCommit, className = "" }: { label: string; source: "sound" | "item"; value: string; onCommit: (v: string) => void; className?: string }) {
  const [draft, setDraft] = React.useState(value);
  const live = React.useContext(Live);
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (document.activeElement !== ref.current) setDraft(value);
  }, [value]);
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="ui-label">{label}</span>
      <SuggestInput
        ref={ref}
        source={source}
        className="ui-input font-mono-ui"
        value={draft}
        placeholder={source === "sound" ? "Start typing, like levelup" : "Start typing, like diamond"}
        onChange={(e) => {
          setDraft(e.target.value);
          if (live) onCommit(e.target.value);
        }}
        onBlur={() => draft !== value && onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (draft !== value) onCommit(draft);
        }}
      />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className="block min-w-0">
      <span className="ui-label">{label}</span>
      <select className="ui-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {!options.some(([v]) => v === value) && <option value={value}>{value || "Choose…"}</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LineFields({ id, value, onChange, live = false }: { id: ActionId; value: string; onChange: (line: string) => void; live?: boolean }) {
  return (
    <Live.Provider value={live}>
      <Fields id={id} value={value} onChange={onChange} />
    </Live.Provider>
  );
}

function Fields({ id, value, onChange }: { id: ActionId; value: string; onChange: (line: string) => void }) {
  switch (id) {
    case "sound": {
      const s = parseSoundLine(value);
      const set = (patch: Partial<typeof s>) => onChange(formatSoundLine({ ...s, ...patch }));
      return (
        <div className="space-y-2">
          <Suggest label="Sound" source="sound" value={s.name} onCommit={(name) => set({ name })} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="ui-label">Volume {s.volume || "1"}</span>
              <input className="w-full accent-[rgb(var(--ui-accent))]" type="range" min={0} max={1} step={0.1} value={s.volume || "1"} onChange={(e) => set({ volume: e.target.value })} />
            </label>
            <label className="block">
              <span className="ui-label">Pitch {s.pitch || "1"}</span>
              <input className="w-full accent-[rgb(var(--ui-accent))]" type="range" min={0.5} max={2} step={0.1} value={s.pitch || "1"} onChange={(e) => set({ pitch: e.target.value })} />
            </label>
          </div>
        </div>
      );
    }
    case "inventory": {
      const l = parseInventoryLine(value);
      const set = (patch: Partial<typeof l>) => onChange(formatInventoryLine({ ...l, ...patch }));
      return (
        <div className="space-y-2">
          <Select label="What should happen?" value={l.op} options={INVENTORY_OPS.map((o) => [o, INVENTORY_LABELS[o]])} onChange={(op) => set({ op })} />
          {l.op === "clear" ? (
            <Text label="What to clear" value={l.item} placeholder="all" onCommit={(item) => set({ item })} />
          ) : (
            <div className="grid grid-cols-[1fr_88px] gap-2">
              <Suggest label="Item" source="item" value={l.item} onCommit={(item) => set({ item })} />
              <Text label="How many" type="text" inputMode="numeric" value={l.amount || "1"} onCommit={(amount) => set({ amount })} />
            </div>
          )}
        </div>
      );
    }
    case "economy": {
      const l = parseEconomyLine(value);
      const set = (patch: Partial<typeof l>) => onChange(formatEconomyLine({ ...l, ...patch }));
      return (
        <div className="space-y-2">
          <Select label="What should happen?" value={l.op} options={ECONOMY_OPS.map((o) => [o, ECONOMY_LABELS[o]])} onChange={(op) => set({ op })} />
          <div className={l.op === "pay" ? "grid grid-cols-2 gap-2" : ""}>
            {l.op === "pay" && <Text label="Who gets paid" className="font-mono-ui" placeholder="$target" value={l.target} onCommit={(target) => set({ target })} />}
            <Text label="Amount" inputMode="decimal" placeholder="100" value={l.amount} onCommit={(amount) => set({ amount })} />
          </div>
        </div>
      );
    }
    case "title": {
      const t = parseTitleLine(value);
      const set = (patch: Partial<typeof t>) => onChange(formatTitleLine({ ...t, ...patch }));
      const custom = t.fadeIn !== TITLE_DEFAULTS.fadeIn || t.stay !== TITLE_DEFAULTS.stay || t.fadeOut !== TITLE_DEFAULTS.fadeOut;
      return (
        <div className="space-y-2">
          <Text label="Title" placeholder="&aWelcome!" value={t.title} onCommit={(title) => set({ title })} />
          <Text label="Subtitle (optional)" placeholder="&7to the server" value={t.subtitle} onCommit={(subtitle) => set({ subtitle })} />
          <details className="rounded-md border border-brand-border px-3 py-2" open={custom}>
            <summary className="text-[12.5px] text-brand-muted">Timing in ticks (20 = 1 second)</summary>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Text label="Fade in" inputMode="numeric" value={t.fadeIn} onCommit={(fadeIn) => set({ fadeIn })} />
              <Text label="Stay" inputMode="numeric" value={t.stay} onCommit={(stay) => set({ stay })} />
              <Text label="Fade out" inputMode="numeric" value={t.fadeOut} onCommit={(fadeOut) => set({ fadeOut })} />
            </div>
          </details>
        </div>
      );
    }
    case "delay": {
      if (isDynamic(value) && !value.includes("%")) {
        return <Text label="Milliseconds" value={value} onCommit={onChange} />;
      }
      const ms = Number(value);
      const seconds = Number.isFinite(ms) ? String(ms / 1000) : value;
      return (
        <Text
          label={`How many seconds? (up to ${LIMITS.delayMaxMs / 1000})`}
          inputMode="decimal"
          value={seconds}
          onCommit={(s) => {
            const n = Number(s.replace(",", "."));
            onChange(Number.isFinite(n) ? String(Math.round(n * 1000)) : s);
          }}
        />
      );
    }
    default:
      return null;
  }
}

export function LineProblems({ id, line }: { id: ActionId; line: string }) {
  const ctx = useLineContext();
  const problems = React.useMemo(() => validateActionLine(id, line, ctx), [id, line, ctx]);
  if (!problems.length) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {problems.map((p) => (
        <li key={p.message} className={`flex items-start gap-1.5 text-[12px] ${p.level === "error" ? "text-brand-danger" : "text-brand-warning"}`}>
          <Icon name="alert" size={13} className="mt-0.5" />
          {p.message}
        </li>
      ))}
    </ul>
  );
}
