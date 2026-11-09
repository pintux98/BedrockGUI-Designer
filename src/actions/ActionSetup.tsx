import React from "react";
import { ParsedAction, serializeActionBlock } from "../plugin/grammar";
import { ActionId } from "../plugin/actions";
import { validateActionLine } from "../plugin/lines";
import { useLineContext } from "../data/useMinecraftData";
import { DEFAULT_LINES, LineFields, LineProblems, STRUCTURED_LINES } from "./LineFields";
import { ADDON_ACTION_IDS, addonActionSnippet, addonActionTakesArgument } from "../plugin/addons";
import { OpenTargetPicker } from "../components/OpenTargetPicker";
import { PlaceholderPicker } from "../components/PlaceholderPicker";
import { Field } from "../components/Field";
import { Icon } from "../components/Icon";
import { ActionKind, createDefaultAction } from "./actionInfo";
import { ActionPicker } from "./ActionPicker";
import { ACTION_TITLES } from "./actionWizard";

export function needsSetup(kind: string): boolean {
  if (ADDON_ACTION_IDS.has(kind)) return addonActionTakesArgument(kind);
  return !["conditional", "random", "raw"].includes(kind);
}

type Values = Record<string, string>;

function lines(id: ActionId, ...l: string[]): ParsedAction {
  return { kind: "lines", id, lines: l };
}

function build(kind: string, v: Values): ParsedAction | null {
  const t = (k: string) => (v[k] ?? "").trim();
  if (ADDON_ACTION_IDS.has(kind)) return { kind: "raw", text: `${addonActionSnippet(kind)}${t("value")}` };
  switch (kind) {
    case "message":
    case "broadcast": {
      const text = (v.text ?? "").split("\n").filter((s) => s.trim());
      return text.length ? lines(kind, ...text) : null;
    }
    case "actionbar":
      return t("text") ? lines("actionbar", t("text")) : null;
    case "open":
      return t("form") ? lines("open", t("form")) : null;
    case "bungee":
      return t("server") ? { kind: "bungee", subchannel: "Connect", args: [t("server")] } : null;
    case "command":
    case "server":
      return t("command") ? lines(kind, t("command").replace(/^\//, "")) : null;
    default:
      return null;
  }
}

function buildStructured(id: ActionId, line: string, ctx: ReturnType<typeof useLineContext>): ParsedAction | null {
  if (!line.trim()) return null;
  if (id === "title" && !line.split(":")[0].trim()) return null;
  if (validateActionLine(id, line, ctx).some((p) => p.level === "error")) return null;
  return lines(id, line);
}

export function ActionSetup({
  kind,
  onBack,
  onCancel,
  onDone
}: {
  kind: ActionKind | string;
  onBack: () => void;
  onCancel: () => void;
  onDone: (action: ParsedAction) => void;
}) {
  const [v, setV] = React.useState<Values>({});
  const structured = STRUCTURED_LINES.includes(kind as ActionId);
  const [line, setLine] = React.useState(DEFAULT_LINES[kind as ActionId] ?? "");
  const ctx = useLineContext();
  const [picker, setPicker] = React.useState<string | null>(null);
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((s) => ({ ...s, [key]: e.target.value }));
  const result = structured ? buildStructured(kind as ActionId, line, ctx) : build(kind, v);
  const isAddon = ADDON_ACTION_IDS.has(kind);
  const title = isAddon ? kind : ACTION_TITLES[kind as ActionKind]?.title ?? kind;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const placeholderButton = (key: string) => (
    <button type="button" className="ui-btn-ghost min-h-7 px-1.5 text-[12px]" onClick={() => setPicker(key)}>
      Insert placeholder
    </button>
  );

  const fields = (() => {
    if (isAddon) {
      return (
        <Field label="Value" hint={`Written after the colon: ${addonActionSnippet(kind)}<value>`}>
          <input className="ui-input font-mono-ui" value={v.value ?? ""} onChange={set("value")} autoFocus />
        </Field>
      );
    }
    if (structured) {
      return (
        <div>
          <LineFields id={kind as ActionId} value={line} onChange={setLine} live />
          <LineProblems id={kind as ActionId} line={line} />
        </div>
      );
    }
    switch (kind) {
      case "message":
      case "broadcast":
        return (
          <Field label={kind === "message" ? "What should it say?" : "What should everyone see?"} hint="Each line becomes its own chat line. Colour codes like &a work.">
            <textarea className="ui-textarea" rows={3} value={v.text ?? ""} onChange={set("text")} placeholder="&aHello, {player}!" autoFocus />
            {placeholderButton("text")}
          </Field>
        );
      case "actionbar":
        return (
          <Field label="Text" hint="Shown above the hotbar for a few seconds.">
            <input className="ui-input" value={v.text ?? ""} onChange={set("text")} placeholder="&eBalance: %vault_eco_balance%" autoFocus />
          </Field>
        );
      case "open":
        return <OpenTargetPicker value={v.form ?? ""} onChange={(form) => setV((s) => ({ ...s, form }))} label="Which form?" />;
      case "bungee":
        return (
          <Field label="Server name" hint="The name from your proxy config, like lobby or survival.">
            <input className="ui-input font-mono-ui" value={v.server ?? ""} onChange={set("server")} placeholder="lobby" autoFocus />
          </Field>
        );
      case "command":
      case "server":
        return (
          <Field label="Command" hint={kind === "command" ? "{player} becomes the player's name. Runs with their permissions." : "{player} becomes the player's name. Runs from the console."}>
            <div className="flex items-center rounded-md border border-brand-border bg-brand-surface2 focus-within:border-brand-accent">
              <span className="pl-2.5 font-mono-ui text-brand-muted">/</span>
              <input className="w-full bg-transparent px-1 py-1.5 font-mono-ui outline-none" value={v.command ?? ""} onChange={set("command")} placeholder={kind === "command" ? "spawn" : "give {player} diamond 1"} autoFocus />
            </div>
          </Field>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-3 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div role="dialog" aria-label={title} className="ui-menu flex max-h-[84vh] w-full max-w-lg flex-col overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-brand-border p-3">
          <button type="button" className="ui-icon-btn" aria-label="Back to the action list" onClick={onBack}>
            <Icon name="chevronRight" size={15} className="rotate-180" />
          </button>
          <h2 className="flex-1 truncate text-[15px] font-semibold">{title}</h2>
          <button type="button" className="ui-icon-btn" aria-label="Close" onClick={onCancel}>
            <Icon name="x" size={15} />
          </button>
        </div>
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (result) onDone(result);
          }}
        >
          <div className="space-y-3 overflow-y-auto p-4">
            {fields}
            <div>
              <span className="ui-label">What gets saved</span>
              <pre className="whitespace-pre-wrap rounded-md border border-brand-border bg-brand-surface2 px-3 py-2 font-mono-ui text-[12px] text-brand-muted">
                {result ? serializeActionBlock(result) : "Fill in the fields above."}
              </pre>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-brand-border p-3">
            <button type="button" className="ui-btn-secondary" onClick={onBack}>
              Back
            </button>
            <button type="submit" className="ui-btn-primary" disabled={!result}>
              Add action
            </button>
          </div>
        </form>
      </div>
      {picker && (
        <PlaceholderPicker
          onSelect={(p) => {
            setV((s) => ({ ...s, [picker]: (s[picker] ?? "") + p }));
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

export function AddActionFlow({ onClose, onAdd }: { onClose: () => void; onAdd: (action: ParsedAction) => void }) {
  const [kind, setKind] = React.useState<string | null>(null);
  if (kind) {
    return (
      <ActionSetup
        kind={kind}
        onBack={() => setKind(null)}
        onCancel={onClose}
        onDone={(action) => {
          onAdd(action);
          onClose();
        }}
      />
    );
  }
  return (
    <ActionPicker
      onClose={onClose}
      onSelect={(k) => {
        if (needsSetup(k)) {
          setKind(k);
          return;
        }
        onAdd(createDefaultAction(k));
        onClose();
      }}
    />
  );
}
