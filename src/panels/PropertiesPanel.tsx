import React from "react";
import { useDesignerStore } from "../core/store";
import { BufferedInput, BufferedTextArea } from "../components/BufferedInput";
import { VisualActionEditor } from "../actions/VisualActionEditor";
import { ConditionField } from "../components/ConditionWizard";
import { PlaceholderPicker } from "../components/PlaceholderPicker";
import { ImagePicker } from "../components/ImagePicker";
import { Field, Section } from "../components/Field";
import { Icon, IconName } from "../components/Icon";
import { FormTypePanel, FORM_TYPE_INFO } from "./FormTypePanel";
import { COMPONENT_META, choiceList } from "../core/componentMeta";
import { nextSequentialId } from "../core/ids";
import { componentReference, ONLINE_PLAYERS_TOKEN } from "../plugin/placeholders";
import type {
  ActionInstance,
  BedrockButton,
  BedrockButtonConditionRule,
  BedrockComponent,
  BedrockForm
} from "../core/types";

const COOLDOWN_HINT = "Seconds, or a number with s, m or h, like 30s or 2m. Leave empty for none.";

const PROPERTY_OPTIONS: { value: BedrockButtonConditionRule["property"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
  { value: "onClick", label: "Actions" }
];

function toBlocks(actions?: ActionInstance[]): string[] {
  return (actions ?? []).map((a) => a.raw ?? "").filter(Boolean);
}

function fromBlocks(blocks: string[]): ActionInstance[] | undefined {
  const list = blocks.filter(Boolean).map((raw) => ({ id: "raw", params: raw, raw }));
  return list.length ? list : undefined;
}

function optional(v: string): string | undefined {
  return v.trim() ? v : undefined;
}

export function PropertiesPanel() {
  const { activeForm, selectedBedrockButtonId, selectedBedrockComponentId } = useDesignerStore();
  const doc = activeForm();
  const form = doc.bedrock;
  const button = form.type !== "CUSTOM" ? form.buttons.find((b) => b.id === selectedBedrockButtonId) : undefined;
  const component = form.type === "CUSTOM" ? form.components.find((c) => c.id === selectedBedrockComponentId) : undefined;

  if (button && form.type !== "CUSTOM") return <ButtonInspector key={`${doc.id}:${button.id}`} form={form} button={button} />;
  if (component && form.type === "CUSTOM") return <ComponentInspector key={`${doc.id}:${component.id}`} form={form} component={component} />;
  return <FormInspector key={doc.id} formId={doc.id} form={form} />;
}

function InspectorHeader({
  icon,
  title,
  id,
  children
}: {
  icon: IconName;
  title: string;
  id?: string;
  children?: React.ReactNode;
}) {
  const { setSelectedBedrockButtonId, setSelectedBedrockComponentId } = useDesignerStore();
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-brand-border bg-brand-surface px-4 py-3">
      {id !== undefined && (
        <button
          type="button"
          className="ui-icon-btn -ml-1.5"
          aria-label="Back to form settings"
          title="Back to form settings"
          onClick={() => {
            setSelectedBedrockButtonId(null);
            setSelectedBedrockComponentId(null);
          }}
        >
          <Icon name="chevronRight" size={15} className="rotate-180" />
        </button>
      )}
      <Icon name={icon} size={16} className="text-brand-accent" />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[14px] font-semibold">{title}</h2>
        {id && <p className="truncate font-mono-ui text-[11.5px] text-brand-muted">{id}</p>}
      </div>
      {children}
    </header>
  );
}

function FormInspector({ formId, form }: { formId: string; form: BedrockForm }) {
  const { setBedrock, setGlobalActions } = useDesignerStore();
  const update = (patch: Partial<BedrockForm>, description: string) =>
    setBedrock({ ...form, ...patch } as BedrockForm, description);
  const content = Array.isArray(form.content) ? form.content.join("\n") : form.content ?? "";

  return (
    <div>
      <InspectorHeader icon={FORM_TYPE_INFO[form.type].icon} title="Form settings">
        <span className="font-mono-ui text-[11.5px] text-brand-muted">{formId}.yml</span>
      </InspectorHeader>

      <Section title="Form">
        <div>
          <span className="ui-label">Type</span>
          <FormTypePanel />
        </div>
        <Field label="Title" hint="Colour codes like &a or §l work here.">
          <BufferedInput
            className="ui-input"
            aria-label="Form title"
            value={form.title}
            maxLength={64}
            onCommit={(v) => update({ title: v }, "Updated title")}
          />
        </Field>
        {form.type !== "CUSTOM" && (
          <Field label={form.type === "MODAL" ? "Message" : "Text above the buttons"}>
            <BufferedTextArea
              className="ui-textarea"
              aria-label="Form content"
              rows={3}
              value={content}
              onCommit={(v) => update({ content: v }, "Updated content")}
            />
          </Field>
        )}
      </Section>

      <Section title="Opening" description="Who can open this form, and how.">
        <Field label="Command" hint="Players open the form with /command. Leave empty for none.">
          <BufferedInput
            className="ui-input font-mono-ui"
            aria-label="Command"
            placeholder="shop"
            value={form.command ?? ""}
            onCommit={(v) => update({ command: optional(v) }, "Updated command")}
          />
        </Field>
        <Field label="Permission" hint="Only players with this permission can open it.">
          <BufferedInput
            className="ui-input font-mono-ui"
            aria-label="Permission"
            placeholder="server.shop"
            value={form.permission ?? ""}
            onCommit={(v) => update({ permission: optional(v) }, "Updated permission")}
          />
        </Field>
        <ConditionField
          label="Open only when"
          value={form.openCondition ?? ""}
          onChange={(v) => update({ openCondition: optional(v) }, "Updated open condition")}
        />
        {form.openCondition && (
          <Field label="Message when it can't open" hint="Leave empty to use menu.requirements from messages.yml.">
            <BufferedInput
              className="ui-input"
              aria-label="Open condition message"
              value={form.openConditionMessage ?? ""}
              onCommit={(v) => update({ openConditionMessage: optional(v) }, "Updated open condition message")}
            />
          </Field>
        )}
        <Field label="Cooldown" hint={COOLDOWN_HINT}>
          <BufferedInput
            className="ui-input font-mono-ui"
            aria-label="Form cooldown"
            placeholder="3s"
            value={form.cooldown ?? ""}
            onCommit={(v) => update({ cooldown: optional(v) }, "Updated cooldown")}
          />
        </Field>
        <Field label="Replace a command" hint="When a Bedrock player runs this command, they get this form instead.">
          <BufferedInput
            className="ui-input font-mono-ui"
            aria-label="Command intercept"
            placeholder="warp"
            value={form.commandIntercept ?? ""}
            onCommit={(v) => update({ commandIntercept: optional(v) }, "Updated command intercept")}
          />
        </Field>
      </Section>

      <Section
        title={form.type === "CUSTOM" ? "On submit" : "Global actions"}
        description={form.type === "CUSTOM" ? `Read a field's value with ${componentReference("id")}, using the field's ID.` : "Run for every response to this form."}
      >
        <VisualActionEditor
          value={toBlocks(form.globalActions)}
          onChange={(blocks) => setGlobalActions(fromBlocks(blocks))}
        />
      </Section>

      <Section title="On close" description="Runs when the player closes the form without choosing.">
        <VisualActionEditor
          value={toBlocks(form.onClose)}
          onChange={(blocks) => update({ onClose: fromBlocks(blocks) }, "Updated on close actions")}
        />
      </Section>
    </div>
  );
}

function ButtonInspector({ form, button }: { form: Extract<BedrockForm, { buttons: BedrockButton[] }>; button: BedrockButton }) {
  const { setBedrock, setSelectedBedrockButtonId } = useDesignerStore();
  const index = form.buttons.findIndex((b) => b.id === button.id);
  const isSimple = form.type === "SIMPLE";
  const update = (patch: Partial<BedrockButton>, description: string) =>
    setBedrock({ ...form, buttons: form.buttons.map((b) => (b.id === button.id ? { ...b, ...patch } : b)) }, description);

  const duplicate = () => {
    const id = nextSequentialId("button", form.buttons.map((b) => b.id));
    const buttons = [...form.buttons];
    buttons.splice(index + 1, 0, { ...structuredClone(button), id });
    setBedrock({ ...form, buttons }, "Duplicated button");
    setSelectedBedrockButtonId(id);
  };

  const remove = () => {
    const buttons = form.buttons.filter((b) => b.id !== button.id);
    setBedrock({ ...form, buttons }, "Removed button");
    setSelectedBedrockButtonId(null);
  };

  return (
    <div>
      <InspectorHeader icon="button" title={isSimple ? `Button ${index + 1}` : index === 0 ? "First button" : "Second button"} id={button.id}>
        {isSimple && (
          <>
            <button type="button" className="ui-icon-btn" aria-label="Duplicate button" title="Duplicate" onClick={duplicate}>
              <Icon name="copy" size={15} />
            </button>
            <button type="button" className="ui-icon-btn hover:!text-brand-danger" aria-label="Remove button" title="Remove" onClick={remove}>
              <Icon name="trash" size={15} />
            </button>
          </>
        )}
      </InspectorHeader>

      <Section title="Button">
        <Field label="Text" hint="Colour codes work. Press Enter for a second line.">
          <BufferedTextArea
            className="ui-textarea min-h-0"
            aria-label="Button text"
            rows={2}
            value={button.text}
            maxLength={form.type === "MODAL" ? 64 : 128}
            onCommit={(v) => update({ text: v }, "Updated button text")}
          />
        </Field>
        {isSimple && (
          <div>
            <span className="ui-label">Icon</span>
            <ImagePicker
              value={button.image ?? ""}
              ariaLabel={`Button ${index + 1} image`}
              onChange={(v) => update({ image: optional(v) }, "Updated button image")}
            />
          </div>
        )}
        <Field label="ID" hint="Used as the key in the YAML file.">
          <BufferedInput
            className="ui-input font-mono-ui"
            aria-label="Button ID"
            value={button.id}
            disabled={!isSimple}
            onCommit={(v) => {
              const id = v.trim();
              if (!id || form.buttons.some((b) => b.id === id)) return;
              update({ id }, "Renamed button ID");
              setSelectedBedrockButtonId(id);
            }}
          />
        </Field>
      </Section>

      <Section title="When clicked">
        <VisualActionEditor value={toBlocks(button.onClick)} onChange={(blocks) => update({ onClick: fromBlocks(blocks) }, "Updated button actions")} />
        <Field label="Cooldown" hint={COOLDOWN_HINT}>
          <BufferedInput
            className="ui-input font-mono-ui"
            aria-label="Button cooldown"
            placeholder="2s"
            value={button.cooldown ?? ""}
            onCommit={(v) => update({ cooldown: optional(v) }, "Updated button cooldown")}
          />
        </Field>
      </Section>

      {isSimple && (
        <Section title="Visibility" description="Hide the button, or swap its text and icon, for some players.">
          <ConditionField
            label="Show only when"
            value={button.showCondition ?? ""}
            onChange={(v) => update({ showCondition: optional(v) }, "Updated show condition")}
          />
          {(button.showCondition || button.alternativeText || button.alternativeImage) && (
            <>
              <Field label="Otherwise show this text" hint="Leave empty to hide the button instead.">
                <BufferedInput
                  className="ui-input"
                  aria-label="Alternative text"
                  value={button.alternativeText ?? ""}
                  onCommit={(v) => update({ alternativeText: optional(v) }, "Updated alternative text")}
                />
              </Field>
              <div>
                <span className="ui-label">Otherwise show this icon</span>
                <ImagePicker
                  value={button.alternativeImage ?? ""}
                  placeholder="Icon when the condition is false"
                  ariaLabel={`Button ${index + 1} alternative image`}
                  onChange={(v) => update({ alternativeImage: optional(v) }, "Updated alternative image")}
                />
              </div>
            </>
          )}
          <ConditionRuleList rules={button.conditions ?? []} onChange={(conditions) => update({ conditions }, "Updated conditions")} />
        </Section>
      )}
    </div>
  );
}

function ComponentInspector({ form, component }: { form: Extract<BedrockForm, { type: "CUSTOM" }>; component: BedrockComponent }) {
  const { setBedrock, setSelectedBedrockComponentId } = useDesignerStore();
  const meta = COMPONENT_META[component.type] ?? COMPONENT_META.input;
  const props = component.props as Record<string, any>;
  const update = (patch: Partial<BedrockComponent>, description: string) =>
    setBedrock(
      { ...form, components: form.components.map((c) => (c.id === component.id ? { ...c, ...patch } : c)) },
      description
    );
  const setProps = (next: Record<string, unknown>) => update({ props: { ...props, ...next } }, `Updated ${meta.label.toLowerCase()}`);

  const duplicate = () => {
    const id = nextSequentialId("component", form.components.map((c) => c.id));
    const components = [...form.components];
    components.splice(form.components.indexOf(component) + 1, 0, { ...structuredClone(component), id });
    setBedrock({ ...form, components }, "Duplicated component");
    setSelectedBedrockComponentId(id);
  };

  const remove = () => {
    setBedrock({ ...form, components: form.components.filter((c) => c.id !== component.id) }, "Removed component");
    setSelectedBedrockComponentId(null);
  };

  return (
    <div>
      <InspectorHeader icon={meta.icon} title={meta.label} id={component.id}>
        <button type="button" className="ui-icon-btn" aria-label="Duplicate field" title="Duplicate" onClick={duplicate}>
          <Icon name="copy" size={15} />
        </button>
        <button type="button" className="ui-icon-btn hover:!text-brand-danger" aria-label="Remove field" title="Remove" onClick={remove}>
          <Icon name="trash" size={15} />
        </button>
      </InspectorHeader>

      <Section title="Field">
        <Field label={component.type === "label" ? "Text" : "Label"}>
          {component.type === "label" ? (
            <BufferedTextArea className="ui-textarea" aria-label="Text" rows={3} value={String(props.text ?? "")} onCommit={(v) => setProps({ text: v })} />
          ) : (
            <BufferedInput className="ui-input" aria-label="Label" value={String(props.text ?? "")} onCommit={(v) => setProps({ text: v })} />
          )}
        </Field>
        <ComponentPropsEditor type={component.type} props={props} onChange={setProps} />
        <Field
          label="ID"
          hint={component.type === "label" ? undefined : `Read the answer in actions with ${componentReference(component.id)}.`}
        >
          <BufferedInput
            className="ui-input font-mono-ui"
            aria-label="Field ID"
            value={component.id}
            onCommit={(v) => {
              const id = v.trim();
              if (!id || form.components.some((c) => c.id === id)) return;
              update({ id }, "Renamed component ID");
              setSelectedBedrockComponentId(id);
            }}
          />
        </Field>
      </Section>

      {component.type !== "label" && (
        <Section title="On submit" description="Runs after the form is sent. {1} is this field's value.">
          <VisualActionEditor value={toBlocks(component.action)} onChange={(blocks) => update({ action: fromBlocks(blocks) }, "Updated component action")} />
        </Section>
      )}
    </div>
  );
}

function ComponentPropsEditor({
  type,
  props,
  onChange
}: {
  type: string;
  props: Record<string, any>;
  onChange: (p: Record<string, unknown>) => void;
}) {
  if (type === "input") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Field label="Placeholder">
          <BufferedInput className="ui-input" aria-label="Placeholder" value={props.placeholder ?? ""} onCommit={(v) => onChange({ placeholder: v })} />
        </Field>
        <Field label="Starting value">
          <BufferedInput className="ui-input" aria-label="Default value" value={props.default ?? ""} onCommit={(v) => onChange({ default: v })} />
        </Field>
      </div>
    );
  }
  if (type === "dropdown" || type === "step_slider") {
    const key = type === "dropdown" ? "options" : "steps";
    const list = choiceList(props[key]);
    const hasPlayers = list.some((o) => o.trim().toLowerCase() === ONLINE_PLAYERS_TOKEN);
    const def = Number(props.default ?? 0);
    return (
      <>
        <Field label={type === "dropdown" ? "Options" : "Steps"} hint="One per line.">
          <BufferedTextArea
            className="ui-textarea font-mono-ui text-[12px]"
            aria-label={type === "dropdown" ? "Options" : "Steps"}
            rows={4}
            value={list.join("\n")}
            onCommit={(v) => onChange({ [key]: v.split("\n").map((s) => s.trim()).filter(Boolean) })}
          />
        </Field>
        <label className="flex items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            className="mt-0.5 accent-[rgb(var(--ui-accent))]"
            checked={hasPlayers}
            onChange={(e) =>
              onChange({
                [key]: e.target.checked
                  ? [...list, ONLINE_PLAYERS_TOKEN]
                  : list.filter((o) => o.trim().toLowerCase() !== ONLINE_PLAYERS_TOKEN)
              })
            }
          />
          <span>
            Add every online player
            <span className="ui-hint block">Lists their names, without the player viewing the form.</span>
          </span>
        </label>
        <Field label="Selected at start">
          <select className="ui-input" aria-label="Default option" value={Number.isFinite(def) ? def : 0} onChange={(e) => onChange({ default: Number(e.target.value) })}>
            {list.map((o, i) => (
              <option key={i} value={i}>
                {o}
              </option>
            ))}
          </select>
        </Field>
      </>
    );
  }
  if (type === "toggle") {
    return (
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          className="accent-[rgb(var(--ui-accent))]"
          checked={props.default === true || props.default === "true"}
          onChange={(e) => onChange({ default: e.target.checked })}
        />
        On at start
      </label>
    );
  }
  if (type === "slider") {
    const num = (key: string, label: string, fallback: number) => (
      <Field label={label}>
        <BufferedInput
          className="ui-input font-mono-ui"
          type="number"
          aria-label={label}
          value={props[key] ?? fallback}
          onCommit={(v) => onChange({ [key]: Number(v) })}
        />
      </Field>
    );
    return (
      <div className="grid grid-cols-4 gap-2">
        {num("min", "Min", 0)}
        {num("max", "Max", 10)}
        {num("step", "Step", 1)}
        {num("default", "Start", Number(props.min ?? 0))}
      </div>
    );
  }
  return null;
}

function ConditionRuleList({
  rules,
  onChange
}: {
  rules: BedrockButtonConditionRule[];
  onChange: (rules: BedrockButtonConditionRule[]) => void;
}) {
  const [pickerFor, setPickerFor] = React.useState<number | null>(null);

  const addRule = () => onChange([...rules, { id: `cond_${Date.now()}`, condition: "", property: "text", value: "" }]);
  const removeRule = (index: number) => onChange(rules.filter((_, i) => i !== index));
  const updateRule = (index: number, updates: Partial<BedrockButtonConditionRule>) => {
    const next = [...rules];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="ui-label mb-0">Overrides</span>
        <button type="button" className="ui-btn-ghost min-h-7 text-[12.5px]" onClick={addRule}>
          <Icon name="plus" size={13} /> Add override
        </button>
      </div>
      {rules.length === 0 && <p className="ui-hint mt-0">Change the text, icon or actions when a condition is true.</p>}

      {rules.map((rule, idx) => (
        <div key={rule.id} className="space-y-2 rounded-md border border-brand-border bg-brand-surface2/50 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-brand-muted">Override {idx + 1}</span>
            <button type="button" className="ui-icon-btn size-6 hover:!text-brand-danger" aria-label={`Remove override ${idx + 1}`} onClick={() => removeRule(idx)}>
              <Icon name="x" size={13} />
            </button>
          </div>
          <ConditionField label="When" value={rule.condition} onChange={(condition) => updateRule(idx, { condition })} />
          <div className="grid grid-cols-[96px_1fr] gap-2">
            <select
              className="ui-input"
              aria-label={`Rule ${idx + 1} property`}
              value={rule.property}
              onChange={(e) => updateRule(idx, { property: e.target.value as BedrockButtonConditionRule["property"] })}
            >
              {PROPERTY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {rule.property === "onClick" ? (
              <BufferedTextArea
                className="ui-textarea font-mono-ui text-[12px]"
                aria-label={`Rule ${idx + 1} actions`}
                placeholder={'message {\n  - "Conditional text"\n}'}
                value={rule.value}
                onCommit={(v) => updateRule(idx, { value: v })}
              />
            ) : (
              <div className="flex gap-1">
                <BufferedInput
                  className="ui-input flex-1"
                  aria-label={`Rule ${idx + 1} value`}
                  placeholder={rule.property === "text" ? "Text when true" : "Icon when true"}
                  value={rule.value}
                  onCommit={(v) => updateRule(idx, { value: v })}
                />
                {rule.property === "text" && (
                  <button type="button" className="ui-icon-btn size-8" title="Insert placeholder" aria-label="Insert placeholder" onClick={() => setPickerFor(idx)}>
                    {"{}"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {pickerFor !== null && (
        <PlaceholderPicker
          onSelect={(placeholder) => {
            updateRule(pickerFor, { value: rules[pickerFor].value + placeholder });
            setPickerFor(null);
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
}
