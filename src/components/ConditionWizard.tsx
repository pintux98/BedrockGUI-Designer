import React from "react";
import { OPERATORS, operatorsFor, validateCondition, type ConditionContext } from "../plugin/conditions";
import { PlaceholderPicker } from "./PlaceholderPicker";
import { Field } from "./Field";
import { Icon, IconName } from "./Icon";

export type ConditionKind = "permission" | "placeholder" | "plugin";

const KINDS: { kind: ConditionKind; title: string; hint: string; icon: IconName }[] = [
  { kind: "permission", title: "has a permission", hint: "Like vip.kit or server.staff", icon: "check" },
  { kind: "placeholder", title: "has a value that…", hint: "Compare balance, level, rank and more", icon: "sliders" },
  { kind: "plugin", title: "is on a server with a plugin", hint: "Only when that plugin is installed", icon: "settings" }
];

export interface ConditionParts {
  kind: ConditionKind | null;
  negate: boolean;
  value: string;
  op: string;
  expected: string;
}

export function kindsFor(context: ConditionContext): ConditionKind[] {
  return context === "symbol" ? ["permission", "placeholder"] : KINDS.map((k) => k.kind);
}

export function parseConditionParts(raw: string, context: ConditionContext): ConditionParts {
  const empty: ConditionParts = { kind: null, negate: false, value: "", op: "", expected: "" };
  const trimmed = raw.trim();
  if (!trimmed || /&&|\|\||[()]/.test(trimmed)) return empty;
  const negate = trimmed.startsWith("not:");
  const body = negate ? trimmed.slice(4) : trimmed;
  const colon = body.indexOf(":");
  const kind = (colon === -1 ? body : body.slice(0, colon)) as ConditionKind;
  if (!kindsFor(context).includes(kind)) return empty;
  const rest = colon === -1 ? "" : body.slice(colon + 1);
  if (kind !== "placeholder") return { kind, negate, value: rest, op: "", expected: "" };
  if (context === "symbol") {
    const m = rest.match(/^(.*?)\s+(>=|<=|==|!=|>|<)\s+(.*)$/);
    return m ? { kind, negate, value: m[1], op: m[2], expected: m[3] } : { kind, negate, value: rest, op: "", expected: "" };
  }
  const [value = "", op = "", ...exp] = rest.split(":");
  return { kind, negate, value, op, expected: exp.join(":") };
}

export function buildCondition(p: ConditionParts, context: ConditionContext): string {
  if (!p.kind) return "";
  let body: string;
  if (p.kind === "permission" || p.kind === "plugin") body = `${p.kind}:${p.value.trim()}`;
  else {
    const ops = operatorsFor(context);
    const op = ops.find((o) => o.word === p.op || o.symbol === p.op) ?? ops[0];
    const token = (context === "symbol" ? op.symbol : op.word) ?? "";
    body =
      context === "symbol"
        ? `placeholder:${p.value.trim()} ${token} ${p.expected.trim()}`
        : `placeholder:${p.value.trim()}:${token}:${op.needsExpected ? p.expected.trim() : "x"}`;
  }
  return p.negate && context === "colon" ? `not:${body}` : body;
}

export function describeCondition(raw: string, context: ConditionContext = "colon"): string {
  const p = parseConditionParts(raw, context);
  if (!p.kind) return raw.trim() ? `Custom: ${raw.trim()}` : "";
  const not = p.negate;
  switch (p.kind) {
    case "permission":
      return `Player ${not ? "does not have" : "has"} the permission ${p.value}`;
    case "plugin":
      return `Server ${not ? "does not have" : "has"} the plugin ${p.value}`;
    case "placeholder": {
      const op = OPERATORS.find((o) => o.word === p.op || o.symbol === p.op);
      const text = `${p.value} ${op?.label ?? p.op}${op?.needsExpected === false ? "" : ` ${p.expected}`}`;
      return not ? `Not when ${text}` : text;
    }
  }
}

export function ConditionField({
  label,
  value,
  onChange,
  context = "colon"
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  context?: ConditionContext;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <span className="ui-label">{label}</span>
      {value.trim() ? (
        <div className="flex items-center gap-2 rounded-md border border-brand-border bg-brand-surface2 py-1.5 pl-3 pr-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-[13px]">{describeCondition(value, context)}</p>
            <p className="truncate font-mono-ui text-[11.5px] text-brand-muted">{value}</p>
          </div>
          <button type="button" className="ui-btn-ghost min-h-7 text-[12.5px]" onClick={() => setOpen(true)}>
            Change
          </button>
          <button type="button" className="ui-icon-btn size-7 hover:!text-brand-danger" aria-label={`Remove ${label.toLowerCase()} condition`} title="Remove" onClick={() => onChange("")}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ) : (
        <button type="button" className="ui-btn-secondary w-full justify-start" onClick={() => setOpen(true)}>
          <Icon name="plus" size={14} /> Add condition
        </button>
      )}
      {open && (
        <ConditionWizard
          title={label}
          value={value}
          context={context}
          onCancel={() => setOpen(false)}
          onSave={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function ConditionWizard({
  title,
  value,
  context,
  onCancel,
  onSave
}: {
  title: string;
  value: string;
  context: ConditionContext;
  onCancel: () => void;
  onSave: (v: string) => void;
}) {
  const initial = parseConditionParts(value, context);
  const custom = Boolean(value.trim()) && !initial.kind;
  const [parts, setParts] = React.useState<ConditionParts>(initial);
  const [raw, setRaw] = React.useState(value);
  const [mode, setMode] = React.useState<"pick" | "fill" | "custom">(custom ? "custom" : initial.kind ? "fill" : "pick");
  const [picking, setPicking] = React.useState(false);
  const ops = operatorsFor(context);
  const op = ops.find((o) => o.word === parts.op || o.symbol === parts.op) ?? ops[0];

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const result = mode === "custom" ? raw.trim() : buildCondition(parts, context);
  const problems = result ? validateCondition(result, context) : [];
  const missing =
    mode === "fill" &&
    (!parts.value.trim() ||
      (parts.kind === "placeholder" && op.needsExpected && !parts.expected.trim()));
  const canSave = Boolean(result) && !missing && problems.length === 0;
  const set = (patch: Partial<ConditionParts>) => setParts((p) => ({ ...p, ...patch }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-3 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div role="dialog" aria-label={title} className="ui-menu flex max-h-[84vh] w-full max-w-md flex-col overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-brand-border p-3">
          {mode !== "pick" && (
            <button type="button" className="ui-icon-btn" aria-label="Back to condition types" onClick={() => setMode("pick")}>
              <Icon name="chevronRight" size={15} className="rotate-180" />
            </button>
          )}
          <h2 className="flex-1 text-[15px] font-semibold">{mode === "pick" ? `${title}: the player…` : title}</h2>
          <button type="button" className="ui-icon-btn" aria-label="Close" onClick={onCancel}>
            <Icon name="x" size={15} />
          </button>
        </div>

        {mode === "pick" ? (
          <div className="space-y-1 overflow-y-auto p-2">
            {KINDS.filter((k) => kindsFor(context).includes(k.kind)).map((k) => (
              <button
                key={k.kind}
                type="button"
                data-condition-kind={k.kind}
                className="flex w-full items-center gap-3 rounded-md border border-brand-border bg-brand-surface px-3 py-2.5 text-left hover:border-brand-accent hover:bg-brand-accent/10"
                onClick={() => {
                  set({ kind: k.kind, value: parts.kind === k.kind ? parts.value : "", op: parts.kind === k.kind ? parts.op : "", expected: parts.kind === k.kind ? parts.expected : "" });
                  setMode("fill");
                }}
              >
                <Icon name={k.icon} size={16} className="text-brand-muted" />
                <span>
                  <span className="block text-[13px] font-medium">…{k.title}</span>
                  <span className="block text-[12px] text-brand-muted">{k.hint}</span>
                </span>
              </button>
            ))}
            <button type="button" className="ui-btn-ghost mt-1 w-full text-[12.5px]" onClick={() => setMode("custom")}>
              Write a custom condition
            </button>
          </div>
        ) : (
          <form
            className="flex min-h-0 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSave) onSave(result);
            }}
          >
            <div className="space-y-3 overflow-y-auto p-4">
              {mode === "custom" && (
                <Field label="Condition" hint="Combine checks with && (and) or || (or).">
                  <textarea className="ui-textarea font-mono-ui text-[12.5px]" rows={3} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="permission:vip && plugin:Vault" autoFocus />
                </Field>
              )}
              {mode === "fill" && (parts.kind === "permission" || parts.kind === "plugin") && (
                <Field label={parts.kind === "permission" ? "Permission" : "Plugin name"} hint={parts.kind === "plugin" ? "As shown in /plugins, like Vault." : undefined}>
                  <input className="ui-input font-mono-ui" value={parts.value} onChange={(e) => set({ value: e.target.value })} placeholder={parts.kind === "permission" ? "vip.kit" : "Vault"} autoFocus />
                </Field>
              )}
              {mode === "fill" && parts.kind === "placeholder" && (
                <>
                  <Field label="Value to check" hint="A placeholder, like %vault_eco_balance% or %player_level%.">
                    <div className="flex gap-1">
                      <input className="ui-input font-mono-ui" value={parts.value} onChange={(e) => set({ value: e.target.value })} placeholder="%vault_eco_balance%" autoFocus />
                      <button type="button" className="ui-btn-secondary shrink-0" onClick={() => setPicking(true)}>
                        Browse
                      </button>
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Is">
                      <select className="ui-input" value={(context === "symbol" ? op.symbol : op.word) ?? ""} onChange={(e) => set({ op: e.target.value })}>
                        {ops.map((o) => (
                          <option key={o.label} value={(context === "symbol" ? o.symbol : o.word) ?? ""}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {op.needsExpected && (
                      <Field label="This">
                        <input className="ui-input font-mono-ui" value={parts.expected} onChange={(e) => set({ expected: e.target.value })} placeholder="100" />
                      </Field>
                    )}
                  </div>
                </>
              )}
              {mode === "fill" && context === "colon" && (
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" className="accent-[rgb(var(--ui-accent))]" checked={parts.negate} onChange={(e) => set({ negate: e.target.checked })} />
                  Reverse it: only when this is not true
                </label>
              )}
              {result && (
                <div className="rounded-md border border-brand-border bg-brand-surface2 px-3 py-2">
                  <p className="text-[13px]">{describeCondition(result, context)}</p>
                  <p className="font-mono-ui text-[12px] text-brand-muted">{result}</p>
                </div>
              )}
              {problems.length > 0 && !missing && (
                <ul className="space-y-0.5 text-[12.5px] text-brand-danger">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-brand-border p-3">
              <button type="button" className="ui-btn-secondary" onClick={onCancel}>
                Cancel
              </button>
              <button type="submit" className="ui-btn-primary" disabled={!canSave}>
                Save condition
              </button>
            </div>
          </form>
        )}
      </div>
      {picking && (
        <PlaceholderPicker
          onSelect={(p) => {
            set({ value: p });
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
